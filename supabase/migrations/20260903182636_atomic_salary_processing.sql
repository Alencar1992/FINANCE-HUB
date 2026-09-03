-- Processa salário, adiantamento e reserva em uma única transação idempotente.
create or replace function public.process_salary_for_owner(p_owner_id uuid)
returns integer
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  setting public.salary_settings%rowtype;
  payment record;
  local_today date := (clock_timestamp() at time zone 'America/Sao_Paulo')::date;
  reference_date date := date_trunc('month', (clock_timestamp() at time zone 'America/Sao_Paulo'))::date;
  last_day integer := extract(day from (date_trunc('month', (clock_timestamp() at time zone 'America/Sao_Paulo')) + interval '1 month - 1 day'))::integer;
  due_date date;
  event_id uuid;
  event_transaction_id uuid;
  event_investment_id uuid;
  savings_event_id uuid;
  savings_amount numeric(14,2);
  investment_total numeric(14,2);
  created_count integer := 0;
  event_created boolean;
begin
  -- Chamadas do aplicativo só podem processar o próprio usuário nomeado com MFA.
  if current_user not in ('postgres', 'service_role') then
    if (select auth.uid()) is distinct from p_owner_id
      or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'false'
      or (select auth.jwt() ->> 'aal') <> 'aal2' then
      raise exception 'not authorized' using errcode = '42501';
    end if;
  end if;

  -- O bloqueio da configuração serializa cliques e execuções concorrentes do cron.
  select * into setting
    from public.salary_settings
   where owner_id = p_owner_id
   for update;
  if not found then return 0; end if;

  for payment in
    select * from (values
      ('salary'::text, 'Salário'::text, setting.salary_enabled, setting.salary_amount, least(setting.salary_day::integer, last_day), setting.savings_on_salary),
      ('advance'::text, 'Adiantamento salarial'::text, setting.advance_enabled, setting.advance_amount, least(setting.advance_day::integer, last_day), setting.savings_on_advance)
    ) as p(kind, label, enabled, amount, due_day, apply_savings)
  loop
    if not payment.enabled or payment.amount <= 0 or extract(day from local_today)::integer < payment.due_day then
      continue;
    end if;

    due_date := make_date(extract(year from reference_date)::integer, extract(month from reference_date)::integer, payment.due_day);
    event_id := null;
    event_transaction_id := null;
    insert into public.salary_events (owner_id, reference_month, event_type, amount)
    values (p_owner_id, reference_date, payment.kind, payment.amount)
    on conflict (owner_id, reference_month, event_type) do nothing
    returning id, transaction_id into event_id, event_transaction_id;

    if event_id is null then
      select id, transaction_id into event_id, event_transaction_id
        from public.salary_events
       where owner_id = p_owner_id and reference_month = reference_date and event_type = payment.kind
       for update;
    end if;

    -- Completa com segurança um evento legado sem movimentação vinculada.
    if event_transaction_id is null then
      insert into public.transactions (
        owner_id, name, category, amount, total_amount, installment_amount,
        transaction_type, transaction_date, status, is_installment,
        installment_count, installment_number, notes
      ) values (
        p_owner_id, payment.label || ' · ' || to_char(reference_date, 'YYYY-MM'),
        'Salário', payment.amount, payment.amount, payment.amount,
        'income', due_date, 'received', false, 1, 1,
        'Inserido automaticamente pela rotina transacional do Finance Hub.'
      ) returning id into event_transaction_id;
      update public.salary_events set transaction_id = event_transaction_id where id = event_id;
      created_count := created_count + 1;
    end if;

    if not setting.savings_enabled or not setting.savings_recurring or not payment.apply_savings then
      continue;
    end if;

    savings_amount := round(case
      when setting.savings_mode = 'percentage' then payment.amount * setting.savings_value / 100
      else setting.savings_value
    end, 2);
    if savings_amount <= 0 then continue; end if;

    savings_event_id := null;
    event_transaction_id := null;
    event_investment_id := null;
    event_created := false;
    insert into public.salary_events (owner_id, reference_month, event_type, amount)
    values (p_owner_id, reference_date, payment.kind || '_savings', savings_amount)
    on conflict (owner_id, reference_month, event_type) do nothing
    returning id, transaction_id, investment_id into savings_event_id, event_transaction_id, event_investment_id;
    if savings_event_id is not null then event_created := true; end if;

    if savings_event_id is null then
      select id, transaction_id, investment_id
        into savings_event_id, event_transaction_id, event_investment_id
        from public.salary_events
       where owner_id = p_owner_id and reference_month = reference_date and event_type = payment.kind || '_savings'
       for update;
    end if;

    if event_investment_id is null then
      select id into event_investment_id
        from public.investments
       where owner_id = p_owner_id and lower(name) = lower('Reserva de Poupança') and active
       order by created_at limit 1
       for update;

      if event_investment_id is null then
        insert into public.investments (
          owner_id, name, bank_name, investment_type, initial_amount,
          current_amount, rate_mode, invested_at, notes
        ) values (
          p_owner_id, 'Reserva de Poupança', 'Reserva automática', 'Poupança',
          savings_amount, savings_amount, 'savings', local_today,
          'Criada automaticamente pela central de salário.'
        ) returning id, current_amount into event_investment_id, investment_total;
      else
        update public.investments
           set initial_amount = initial_amount + savings_amount,
               current_amount = current_amount + savings_amount,
               updated_at = now()
         where id = event_investment_id and owner_id = p_owner_id
         returning current_amount into investment_total;
      end if;

      insert into public.investment_snapshots (
        owner_id, investment_id, reference_month, amount, contribution
      ) values (
        p_owner_id, event_investment_id, reference_date, investment_total, savings_amount
      ) on conflict (investment_id, reference_month) do update
        set amount = excluded.amount,
            contribution = public.investment_snapshots.contribution + excluded.contribution;
      update public.salary_events set investment_id = event_investment_id where id = savings_event_id;
    end if;

    if event_transaction_id is null then
      insert into public.transactions (
        owner_id, name, category, amount, total_amount, installment_amount,
        transaction_type, transaction_date, status, is_installment,
        installment_count, installment_number, notes
      ) values (
        p_owner_id, 'Aporte Reserva de Poupança · ' || payment.label,
        'Investimentos', savings_amount, savings_amount, savings_amount,
        'expense', local_today, 'paid', false, 1, 1,
        'Aporte debitado automaticamente do salário.'
      ) returning id into event_transaction_id;
      update public.salary_events set transaction_id = event_transaction_id where id = savings_event_id;
    end if;

    if event_created then created_count := created_count + 1; end if;
  end loop;

  return created_count;
end;
$$;

revoke all on function public.process_salary_for_owner(uuid) from public, anon;
grant execute on function public.process_salary_for_owner(uuid) to authenticated;

-- O cron reutiliza a mesma operação para impedir divergência entre servidor e aplicativo.
create or replace function private.run_salary_automation()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  owner_record record;
begin
  for owner_record in select owner_id from public.salary_settings loop
    perform public.process_salary_for_owner(owner_record.owner_id);
  end loop;
end;
$$;

revoke all on function private.run_salary_automation() from public, anon, authenticated;

create index if not exists salary_events_transaction_idx on public.salary_events(transaction_id) where transaction_id is not null;
create index if not exists salary_events_investment_idx on public.salary_events(investment_id) where investment_id is not null;
