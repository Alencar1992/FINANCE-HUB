-- Centraliza edição e remoção de movimentações em transações idempotentes.
create or replace function public.update_financial_movement(
  p_owner_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  source_transaction public.transactions%rowtype;
  source_obligation public.obligations%rowtype;
  source_purchase public.card_purchases%rowtype;
  source_charge public.subscription_charges%rowtype;
  salary_event public.salary_events%rowtype;
  custom_entry public.custom_module_entries%rowtype;
  finance jsonb;
  total_value numeric(14,2);
  installment_value numeric(14,2);
  new_installment_count integer;
  new_status text;
  new_direction text;
  new_date date;
  old_effective numeric(14,2);
  new_effective numeric(14,2);
  contribution_delta numeric(14,2);
  linked_obligation_id uuid;
  linked_transaction_id uuid;
begin
  if (select auth.uid()) is distinct from p_owner_id
    or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'false'
    or (select auth.jwt() ->> 'aal') <> 'aal2' then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_source_type = 'transaction' then
    select * into source_transaction from public.transactions
     where id = p_source_id and owner_id = p_owner_id for update;
    if not found then raise exception 'movement not found' using errcode = 'P0002'; end if;

    total_value := round(coalesce((p_payload ->> 'total_amount')::numeric, source_transaction.total_amount), 2);
    new_installment_count := greatest(1, coalesce((p_payload ->> 'installment_count')::integer, source_transaction.installment_count));
    installment_value := round(total_value / new_installment_count, 2);
    new_status := coalesce(p_payload ->> 'status', source_transaction.status);
    new_direction := coalesce(p_payload ->> 'transaction_type', source_transaction.transaction_type);
    new_date := coalesce((p_payload ->> 'transaction_date')::date, source_transaction.transaction_date);
    if total_value <= 0 then raise exception 'invalid movement amount' using errcode = '22003'; end if;

    update public.transactions set
      name = coalesce(nullif(trim(p_payload ->> 'name'), ''), name),
      category = coalesce(nullif(trim(p_payload ->> 'category'), ''), category),
      total_amount = total_value,
      amount = installment_value,
      installment_amount = installment_value,
      is_installment = new_installment_count > 1,
      installment_count = new_installment_count,
      transaction_type = new_direction,
      transaction_date = new_date,
      status = new_status,
      is_recurring = coalesce((p_payload ->> 'is_recurring')::boolean, is_recurring),
      recurrence_active = coalesce((p_payload ->> 'is_recurring')::boolean, is_recurring)
        and new_status not in ('paid', 'received', 'cancelled'),
      recurrence_day = case when coalesce((p_payload ->> 'is_recurring')::boolean, is_recurring)
        then coalesce((p_payload ->> 'recurrence_day')::integer, recurrence_day) else null end,
      notes = case when p_payload ? 'notes' then nullif(p_payload ->> 'notes', '') else notes end,
      updated_at = now()
    where id = p_source_id and owner_id = p_owner_id;

    for salary_event in select * from public.salary_events
      where salary_events.owner_id = p_owner_id and salary_events.transaction_id = p_source_id for update
    loop
      old_effective := case when source_transaction.status = 'cancelled' then 0 else salary_event.amount end;
      new_effective := case when new_status = 'cancelled' then 0 else total_value end;
      contribution_delta := new_effective - old_effective;
      update public.salary_events set amount = total_value where id = salary_event.id;
      if salary_event.investment_id is not null and contribution_delta <> 0 then
        update public.investments set
          initial_amount = greatest(0, initial_amount + contribution_delta),
          current_amount = greatest(0, current_amount + contribution_delta),
          updated_at = now()
        where id = salary_event.investment_id and owner_id = p_owner_id;
        update public.investment_snapshots set
          amount = greatest(0, amount + contribution_delta),
          contribution = case when reference_month = salary_event.reference_month
            then greatest(0, contribution + contribution_delta) else contribution end
        where investment_id = salary_event.investment_id
          and owner_id = p_owner_id and reference_month >= salary_event.reference_month;
      end if;
    end loop;

    for custom_entry in select * from public.custom_module_entries
      where owner_id = p_owner_id and data #>> '{_finance,transactionId}' = p_source_id::text for update
    loop
      finance := custom_entry.data -> '_finance';
      finance := finance || jsonb_build_object(
        'amount', total_value,
        'dueDate', new_date,
        'status', case when new_status in ('paid', 'received') then 'paid' else new_status end,
        'direction', new_direction
      );
      update public.custom_module_entries set
        data = jsonb_set(data, '{_finance}', finance), updated_at = now()
      where id = custom_entry.id and owner_id = p_owner_id;

      if coalesce(finance ->> 'obligationId', '') ~* '^[0-9a-f-]{36}$' then
        linked_obligation_id := (finance ->> 'obligationId')::uuid;
        update public.obligations set
          direction = case when new_direction = 'income' then 'receivable' else 'payable' end,
          description = coalesce(nullif(trim(p_payload ->> 'name'), ''), description),
          category = coalesce(nullif(trim(p_payload ->> 'category'), ''), category),
          total_amount = total_value,
          remaining_amount = case when new_status in ('paid', 'received') then 0 else total_value end,
          installment_amount = total_value,
          installments = 1,
          is_installment = false,
          next_due_date = new_date,
          status = case when new_status in ('paid', 'received') then 'paid'
            when new_status = 'overdue' then 'overdue'
            when new_status = 'cancelled' then 'cancelled' else 'open' end,
          notes = case when p_payload ? 'notes' then nullif(p_payload ->> 'notes', '') else notes end,
          updated_at = now()
        where id = linked_obligation_id and owner_id = p_owner_id;
      end if;
    end loop;

  elsif p_source_type = 'obligation' then
    select * into source_obligation from public.obligations
     where id = p_source_id and owner_id = p_owner_id for update;
    if not found then raise exception 'movement not found' using errcode = 'P0002'; end if;

    total_value := round(coalesce((p_payload ->> 'total_amount')::numeric, source_obligation.total_amount), 2);
    new_installment_count := greatest(1, coalesce((p_payload ->> 'installments')::integer, source_obligation.installments));
    installment_value := round(total_value / new_installment_count, 2);
    new_status := coalesce(p_payload ->> 'status', source_obligation.status);
    new_direction := coalesce(p_payload ->> 'direction', source_obligation.direction);
    new_date := coalesce((p_payload ->> 'next_due_date')::date, source_obligation.next_due_date);
    if total_value <= 0 then raise exception 'invalid movement amount' using errcode = '22003'; end if;

    update public.obligations set
      direction = new_direction,
      counterparty_name = coalesce(nullif(trim(p_payload ->> 'counterparty_name'), ''), counterparty_name),
      phone = case when p_payload ? 'phone' then nullif(regexp_replace(p_payload ->> 'phone', '\D', '', 'g'), '') else phone end,
      description = coalesce(nullif(trim(p_payload ->> 'description'), ''), description),
      category = coalesce(nullif(trim(p_payload ->> 'category'), ''), category),
      total_amount = total_value,
      remaining_amount = case when new_status = 'paid' then 0
        else greatest(0, total_value - source_obligation.paid_installments * installment_value) end,
      installments = new_installment_count,
      is_installment = new_installment_count > 1,
      installment_amount = installment_value,
      paid_installments = least(source_obligation.paid_installments, new_installment_count),
      next_due_date = new_date,
      status = new_status,
      notes = case when p_payload ? 'notes' then nullif(p_payload ->> 'notes', '') else notes end,
      updated_at = now()
    where id = p_source_id and owner_id = p_owner_id;

    if new_direction = 'receivable' and nullif(regexp_replace(coalesce(p_payload ->> 'phone', source_obligation.phone), '\D', '', 'g'), '') is not null then
      insert into public.debtor_contacts(owner_id, display_name, normalized_name, phone, updated_at)
      values (
        p_owner_id,
        coalesce(nullif(trim(p_payload ->> 'counterparty_name'), ''), source_obligation.counterparty_name),
        lower(regexp_replace(translate(coalesce(nullif(trim(p_payload ->> 'counterparty_name'), ''), source_obligation.counterparty_name),
          'ÁÀÃÂÉÊÍÓÔÕÚÇáàãâéêíóôõúç', 'AAAAEEIOOOUCaaaaeeiooouc'), '[^a-zA-Z0-9]', '', 'g')),
        regexp_replace(coalesce(p_payload ->> 'phone', source_obligation.phone), '\D', '', 'g'),
        now()
      ) on conflict(owner_id, normalized_name) do update
        set display_name = excluded.display_name, phone = excluded.phone, updated_at = now();
    end if;

    for custom_entry in select * from public.custom_module_entries
      where owner_id = p_owner_id and data #>> '{_finance,obligationId}' = p_source_id::text for update
    loop
      finance := custom_entry.data -> '_finance';
      finance := finance || jsonb_build_object(
        'amount', total_value,
        'dueDate', new_date,
        'status', case when new_status = 'paid' then 'paid' else new_status end,
        'direction', case when new_direction = 'receivable' then 'income' else 'expense' end
      );
      update public.custom_module_entries set data = jsonb_set(data, '{_finance}', finance), updated_at = now()
       where id = custom_entry.id and owner_id = p_owner_id;
      if coalesce(finance ->> 'transactionId', '') ~* '^[0-9a-f-]{36}$' then
        linked_transaction_id := (finance ->> 'transactionId')::uuid;
        update public.transactions set
          name = coalesce(nullif(trim(p_payload ->> 'description'), ''), name),
          category = coalesce(nullif(trim(p_payload ->> 'category'), ''), category),
          total_amount = total_value, amount = total_value, installment_amount = total_value,
          is_installment = false, installment_count = 1,
          transaction_type = case when new_direction = 'receivable' then 'income' else 'expense' end,
          transaction_date = new_date,
          status = case when new_status = 'paid' and new_direction = 'receivable' then 'received'
            when new_status = 'paid' then 'paid' when new_status = 'overdue' then 'overdue'
            when new_status = 'cancelled' then 'cancelled' else 'pending' end,
          notes = case when p_payload ? 'notes' then nullif(p_payload ->> 'notes', '') else notes end,
          updated_at = now()
        where id = linked_transaction_id and owner_id = p_owner_id;
      end if;
    end loop;

  elsif p_source_type = 'card_purchase' then
    select * into source_purchase from public.card_purchases
     where id = p_source_id and owner_id = p_owner_id for update;
    if not found then raise exception 'movement not found' using errcode = 'P0002'; end if;
    total_value := round(coalesce((p_payload ->> 'total_amount')::numeric, source_purchase.total_amount), 2);
    new_installment_count := greatest(1, coalesce((p_payload ->> 'installment_count')::integer, source_purchase.installment_count));
    new_status := coalesce(p_payload ->> 'status', source_purchase.status);
    if total_value <= 0 then raise exception 'invalid movement amount' using errcode = '22003'; end if;
    update public.card_purchases set
      description = coalesce(nullif(trim(p_payload ->> 'description'), ''), description),
      purchased_by = coalesce(nullif(trim(p_payload ->> 'purchased_by'), ''), purchased_by),
      total_amount = total_value,
      installment_count = new_installment_count,
      installment_amount = round(total_value / new_installment_count, 2),
      paid_installments = case when new_status = 'paid' then new_installment_count else least(paid_installments, new_installment_count) end,
      first_due_date = coalesce((p_payload ->> 'first_due_date')::date, first_due_date),
      status = new_status,
      paid_at = case when new_status = 'paid' then coalesce(paid_at, now()) else null end,
      updated_at = now()
    where id = p_source_id and owner_id = p_owner_id;

  elsif p_source_type = 'subscription_charge' then
    select * into source_charge from public.subscription_charges
     where id = p_source_id and owner_id = p_owner_id for update;
    if not found then raise exception 'movement not found' using errcode = 'P0002'; end if;
    total_value := round(coalesce((p_payload ->> 'amount')::numeric, source_charge.amount), 2);
    new_status := coalesce(p_payload ->> 'status', source_charge.status);
    if total_value <= 0 then raise exception 'invalid movement amount' using errcode = '22003'; end if;
    update public.subscription_charges set
      participant_name = coalesce(nullif(trim(p_payload ->> 'participant_name'), ''), participant_name),
      phone = case when p_payload ? 'phone' then nullif(regexp_replace(p_payload ->> 'phone', '\D', '', 'g'), '') else phone end,
      amount = total_value,
      due_date = coalesce((p_payload ->> 'due_date')::date, due_date),
      status = new_status,
      paid_at = case when new_status = 'paid' then coalesce(paid_at, now()) else null end,
      updated_at = now()
    where id = p_source_id and owner_id = p_owner_id;
  else
    raise exception 'invalid source type' using errcode = '22023';
  end if;

  return jsonb_build_object('sourceType', p_source_type, 'id', p_source_id, 'status', 'updated');
end;
$$;

create or replace function public.remove_financial_movement(
  p_owner_id uuid,
  p_source_type text,
  p_source_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  source_transaction public.transactions%rowtype;
  source_obligation public.obligations%rowtype;
  salary_event public.salary_events%rowtype;
  custom_entry public.custom_module_entries%rowtype;
  finance jsonb;
  linked_origin boolean := false;
  contribution_delta numeric(14,2);
  linked_obligation_id uuid;
  linked_transaction_id uuid;
begin
  if (select auth.uid()) is distinct from p_owner_id
    or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'false'
    or (select auth.jwt() ->> 'aal') <> 'aal2' then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_source_type = 'transaction' then
    select * into source_transaction from public.transactions
     where id = p_source_id and owner_id = p_owner_id for update;
    if not found then return jsonb_build_object('sourceType', p_source_type, 'id', p_source_id, 'status', 'already_removed'); end if;

    for salary_event in select * from public.salary_events
      where salary_events.owner_id = p_owner_id and salary_events.transaction_id = p_source_id for update
    loop
      linked_origin := true;
      if salary_event.investment_id is not null and source_transaction.status <> 'cancelled' then
        contribution_delta := -salary_event.amount;
        update public.investments set
          initial_amount = greatest(0, initial_amount + contribution_delta),
          current_amount = greatest(0, current_amount + contribution_delta), updated_at = now()
        where id = salary_event.investment_id and owner_id = p_owner_id;
        update public.investment_snapshots set
          amount = greatest(0, amount + contribution_delta),
          contribution = case when reference_month = salary_event.reference_month
            then greatest(0, contribution + contribution_delta) else contribution end
        where investment_id = salary_event.investment_id
          and owner_id = p_owner_id and reference_month >= salary_event.reference_month;
      end if;
    end loop;

    for custom_entry in select * from public.custom_module_entries
      where owner_id = p_owner_id and data #>> '{_finance,transactionId}' = p_source_id::text for update
    loop
      linked_origin := true;
      finance := (custom_entry.data -> '_finance') || jsonb_build_object('status', 'cancelled');
      update public.custom_module_entries set data = jsonb_set(data, '{_finance}', finance), updated_at = now()
       where id = custom_entry.id and owner_id = p_owner_id;
      if coalesce(finance ->> 'obligationId', '') ~* '^[0-9a-f-]{36}$' then
        linked_obligation_id := (finance ->> 'obligationId')::uuid;
        update public.obligations set status = 'cancelled', updated_at = now()
         where id = linked_obligation_id and owner_id = p_owner_id;
      end if;
    end loop;

    if linked_origin then
      update public.transactions set status = 'cancelled', recurrence_active = false, updated_at = now()
       where id = p_source_id and owner_id = p_owner_id;
    else
      delete from public.transactions where id = p_source_id and owner_id = p_owner_id;
    end if;

  elsif p_source_type = 'obligation' then
    select * into source_obligation from public.obligations
     where id = p_source_id and owner_id = p_owner_id for update;
    if not found then return jsonb_build_object('sourceType', p_source_type, 'id', p_source_id, 'status', 'already_removed'); end if;
    for custom_entry in select * from public.custom_module_entries
      where owner_id = p_owner_id and data #>> '{_finance,obligationId}' = p_source_id::text for update
    loop
      linked_origin := true;
      finance := (custom_entry.data -> '_finance') || jsonb_build_object('status', 'cancelled');
      update public.custom_module_entries set data = jsonb_set(data, '{_finance}', finance), updated_at = now()
       where id = custom_entry.id and owner_id = p_owner_id;
      if coalesce(finance ->> 'transactionId', '') ~* '^[0-9a-f-]{36}$' then
        linked_transaction_id := (finance ->> 'transactionId')::uuid;
        update public.transactions set status = 'cancelled', recurrence_active = false, updated_at = now()
         where id = linked_transaction_id and owner_id = p_owner_id;
      end if;
    end loop;
    if linked_origin then
      update public.obligations set status = 'cancelled', updated_at = now()
       where id = p_source_id and owner_id = p_owner_id;
    else
      delete from public.obligations where id = p_source_id and owner_id = p_owner_id;
    end if;

  elsif p_source_type = 'card_purchase' then
    delete from public.card_purchases where id = p_source_id and owner_id = p_owner_id;
  elsif p_source_type = 'subscription_charge' then
    delete from public.subscription_charges where id = p_source_id and owner_id = p_owner_id;
  else
    raise exception 'invalid source type' using errcode = '22023';
  end if;

  return jsonb_build_object('sourceType', p_source_type, 'id', p_source_id, 'status', 'removed');
end;
$$;

revoke all on function public.update_financial_movement(uuid, text, uuid, jsonb) from public, anon;
revoke all on function public.remove_financial_movement(uuid, text, uuid) from public, anon;
grant execute on function public.update_financial_movement(uuid, text, uuid, jsonb) to authenticated;
grant execute on function public.remove_financial_movement(uuid, text, uuid) to authenticated;
