-- Executa salário, adiantamento e Reserva de Poupança mesmo com o app fechado.
alter table public.salary_events
  add column if not exists notified_at timestamptz;

create extension if not exists pg_cron with schema pg_catalog;

create or replace function private.run_salary_automation()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  setting public.salary_settings%rowtype;
  payment record;
  local_today date := (clock_timestamp() at time zone 'America/Sao_Paulo')::date;
  reference_date date := date_trunc('month', (clock_timestamp() at time zone 'America/Sao_Paulo'))::date;
  last_day integer := extract(day from (date_trunc('month', (clock_timestamp() at time zone 'America/Sao_Paulo')) + interval '1 month - 1 day'))::integer;
  due_date date;
  event_id uuid;
  v_transaction_id uuid;
  savings_event_id uuid;
  savings_amount numeric(14,2);
  v_investment_id uuid;
  investment_total numeric(14,2);
begin
  for setting in select * from public.salary_settings loop
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
      insert into public.salary_events (owner_id, reference_month, event_type, amount)
      values (setting.owner_id, reference_date, payment.kind, payment.amount)
      on conflict (owner_id, reference_month, event_type) do nothing
      returning id into event_id;

      if event_id is not null then
        insert into public.transactions (
          owner_id, name, category, amount, total_amount, installment_amount,
          transaction_type, transaction_date, status, is_installment,
          installment_count, installment_number, notes
        ) values (
          setting.owner_id,
          payment.label || ' · ' || to_char(reference_date, 'YYYY-MM'),
          'Salário', payment.amount, payment.amount, payment.amount,
          'income', due_date, 'received', false, 1, 1,
          'Inserido automaticamente pela rotina segura do Finance Hub.'
        ) returning id into v_transaction_id;
        update public.salary_events set transaction_id = v_transaction_id
          where id = event_id;
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
      insert into public.salary_events (owner_id, reference_month, event_type, amount)
      values (setting.owner_id, reference_date, payment.kind || '_savings', savings_amount)
      on conflict (owner_id, reference_month, event_type) do nothing
      returning id into savings_event_id;
      if savings_event_id is null then continue; end if;

      v_investment_id := null;
      select i.id into v_investment_id
        from public.investments i
       where i.owner_id = setting.owner_id and lower(i.name) = lower('Reserva de Poupança') and i.active
       order by i.created_at limit 1
       for update;

      if v_investment_id is null then
        insert into public.investments (
          owner_id, name, bank_name, investment_type, initial_amount,
          current_amount, rate_mode, invested_at, notes
        ) values (
          setting.owner_id, 'Reserva de Poupança', 'Reserva automática', 'Poupança',
          savings_amount, savings_amount, 'savings', local_today,
          'Criada automaticamente pela central de salário.'
        ) returning id, current_amount into v_investment_id, investment_total;
      else
        update public.investments
           set initial_amount = initial_amount + savings_amount,
               current_amount = current_amount + savings_amount,
               updated_at = now()
         where id = v_investment_id
         returning current_amount into investment_total;
      end if;

      insert into public.investment_snapshots (
        owner_id, investment_id, reference_month, amount, contribution
      ) values (
        setting.owner_id, v_investment_id, reference_date, investment_total, savings_amount
      ) on conflict (investment_id, reference_month) do update
        set amount = excluded.amount,
            contribution = public.investment_snapshots.contribution + excluded.contribution;

      insert into public.transactions (
        owner_id, name, category, amount, total_amount, installment_amount,
        transaction_type, transaction_date, status, is_installment,
        installment_count, installment_number, notes
      ) values (
        setting.owner_id, 'Aporte Reserva de Poupança · ' || payment.label,
        'Investimentos', savings_amount, savings_amount, savings_amount,
        'expense', local_today, 'paid', false, 1, 1,
        'Aporte debitado automaticamente do salário.'
      ) returning id into v_transaction_id;

      update public.salary_events
         set transaction_id = v_transaction_id, investment_id = v_investment_id
       where id = savings_event_id;
    end loop;
  end loop;
end;
$$;

revoke all on function private.run_salary_automation() from public, anon, authenticated;

do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'finance-hub-salary-hourly';
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
  perform cron.schedule(
    'finance-hub-salary-hourly',
    '17 * * * *',
    'select private.run_salary_automation();'
  );
end $$;

-- Processa imediatamente eventuais lançamentos vencidos e mantém o cron como garantia.
select private.run_salary_automation();
