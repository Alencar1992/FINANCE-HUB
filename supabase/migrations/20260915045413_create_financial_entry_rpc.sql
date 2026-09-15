-- Issue #10.4.2: cria lançamentos dos quatro fluxos por uma única transação
-- idempotente, preservando transactions e obligations como fontes oficiais.

create table public.financial_entry_requests (
  owner_id uuid not null references public.owners(id) on delete cascade,
  request_id uuid not null,
  entry_type text not null check (
    entry_type in ('income', 'expense', 'receivable', 'payable')
  ),
  payload jsonb not null,
  source_type text not null check (source_type in ('transaction', 'obligation')),
  source_id uuid not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, request_id)
);

alter table public.financial_entry_requests enable row level security;

create policy financial_entry_requests_owner_all
  on public.financial_entry_requests
  for all
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy require_named_user_mfa
  on public.financial_entry_requests
  as restrictive
  for all
  to authenticated
  using (
    coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'false'
    and (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'false'
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

revoke all on table public.financial_entry_requests from public, anon;
grant select, insert on table public.financial_entry_requests to authenticated;

create or replace function public.create_financial_entry(
  p_owner_id uuid,
  p_request_id uuid,
  p_entry_type text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_claimed integer;
  v_existing public.financial_entry_requests%rowtype;
  v_source_id uuid;
  v_source_type text;
  v_result jsonb;
  v_description text := nullif(trim(p_payload ->> 'description'), '');
  v_category text := coalesce(nullif(trim(p_payload ->> 'category'), ''), 'Outros');
  v_counterparty text := nullif(trim(p_payload ->> 'counterparty_name'), '');
  v_phone text := nullif(regexp_replace(coalesce(p_payload ->> 'phone', ''), '\D', '', 'g'), '');
  v_notes text := nullif(trim(p_payload ->> 'notes'), '');
  v_total numeric(14,2);
  v_installments integer;
  v_installment_amount numeric(14,2);
  v_date date;
  v_status text;
  v_recurring boolean := coalesce((p_payload ->> 'is_recurring')::boolean, false);
  v_recurrence_day integer;
  v_duplicate_id uuid;
begin
  if (select auth.uid()) is distinct from p_owner_id
    or coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') <> 'false'
    or (select auth.jwt() ->> 'aal') <> 'aal2' then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_request_id is null then
    raise exception 'request id is required' using errcode = '22023';
  end if;
  if p_entry_type not in ('income', 'expense', 'receivable', 'payable') then
    raise exception 'invalid entry type' using errcode = '22023';
  end if;
  if v_description is null or char_length(v_description) > 160 then
    raise exception 'invalid description' using errcode = '22023';
  end if;

  v_total := round((p_payload ->> 'total_amount')::numeric, 2);
  if v_total is null or v_total <= 0 then
    raise exception 'invalid entry amount' using errcode = '22003';
  end if;

  v_installments := coalesce((p_payload ->> 'installments')::integer, 1);
  if v_installments < 1 or v_installments > 120 then
    raise exception 'invalid installment count' using errcode = '22023';
  end if;
  if v_recurring and v_installments > 1 then
    raise exception 'recurring entries cannot be installment plans' using errcode = '22023';
  end if;

  v_installment_amount := round(v_total / v_installments, 2);
  v_date := coalesce(nullif(p_payload ->> 'date', '')::date, current_date);
  v_status := coalesce(nullif(p_payload ->> 'status', ''),
    case when p_entry_type in ('income', 'expense') then 'pending' else 'open' end
  );
  v_recurrence_day := case
    when v_recurring then coalesce((p_payload ->> 'recurrence_day')::integer, extract(day from v_date)::integer)
    else null
  end;
  if v_recurrence_day is not null and (v_recurrence_day < 1 or v_recurrence_day > 31) then
    raise exception 'invalid recurrence day' using errcode = '22023';
  end if;

  if p_entry_type in ('income', 'expense') then
    if (p_entry_type = 'income' and v_status not in ('pending', 'received'))
      or (p_entry_type = 'expense' and v_status not in ('pending', 'paid')) then
      raise exception 'invalid transaction status' using errcode = '22023';
    end if;

    select transaction.id into v_duplicate_id
      from public.transactions as transaction
     where transaction.owner_id = p_owner_id
       and transaction.transaction_type = p_entry_type
       and transaction.amount = v_installment_amount
       and transaction.transaction_date between v_date - 2 and v_date + 2
       and transaction.status <> 'cancelled'
       and lower(trim(transaction.name)) = lower(v_description)
     order by transaction.created_at desc
     limit 1;

    v_source_type := 'transaction';
  else
    if v_counterparty is null then
      raise exception 'counterparty is required' using errcode = '22023';
    end if;
    if v_status not in ('open', 'paid', 'overdue') then
      raise exception 'invalid obligation status' using errcode = '22023';
    end if;

    v_source_type := 'obligation';
  end if;

  v_source_id := gen_random_uuid();
  v_result := jsonb_build_object(
    'status', 'created',
    'entryType', p_entry_type,
    'sourceType', v_source_type,
    'id', v_source_id,
    'duplicateOf', v_duplicate_id,
    'idempotentReplay', false
  );

  insert into public.financial_entry_requests (
    owner_id,
    request_id,
    entry_type,
    payload,
    source_type,
    source_id,
    result
  ) values (
    p_owner_id,
    p_request_id,
    p_entry_type,
    p_payload,
    v_source_type,
    v_source_id,
    v_result
  )
  on conflict (owner_id, request_id) do nothing;
  get diagnostics v_claimed = row_count;

  if v_claimed = 0 then
    select * into v_existing
      from public.financial_entry_requests
     where owner_id = p_owner_id
       and request_id = p_request_id;

    if v_existing.entry_type is distinct from p_entry_type
      or v_existing.payload is distinct from p_payload then
      raise exception 'request id already used with different data' using errcode = '23505';
    end if;

    return v_existing.result || jsonb_build_object('idempotentReplay', true);
  end if;

  if p_entry_type in ('income', 'expense') then
    insert into public.transactions (
      id,
      owner_id,
      name,
      category,
      amount,
      total_amount,
      is_installment,
      installment_count,
      installment_number,
      installment_amount,
      transaction_type,
      transaction_date,
      status,
      notes,
      is_recurring,
      recurrence_active,
      recurrence_day,
      classification_source,
      classification_confidence,
      duplicate_of,
      duplicate_review_status
    ) values (
      v_source_id,
      p_owner_id,
      v_description,
      v_category,
      v_installment_amount,
      v_total,
      v_installments > 1,
      v_installments,
      1,
      v_installment_amount,
      p_entry_type,
      v_date,
      v_status,
      v_notes,
      v_recurring,
      v_recurring and v_status = 'pending',
      v_recurrence_day,
      coalesce(nullif(p_payload ->> 'classification_source', ''), 'manual'),
      coalesce((p_payload ->> 'classification_confidence')::numeric, 1),
      v_duplicate_id,
      case when v_duplicate_id is null then 'not_flagged' else 'pending' end
    );
  else
    insert into public.obligations (
      id,
      owner_id,
      direction,
      counterparty_name,
      phone,
      description,
      category,
      total_amount,
      remaining_amount,
      is_installment,
      installments,
      installment_amount,
      paid_installments,
      next_due_date,
      status,
      notes
    ) values (
      v_source_id,
      p_owner_id,
      case when p_entry_type = 'receivable' then 'receivable' else 'payable' end,
      v_counterparty,
      v_phone,
      v_description,
      v_category,
      v_total,
      case when v_status = 'paid' then 0 else v_total end,
      v_installments > 1,
      v_installments,
      v_installment_amount,
      case when v_status = 'paid' then v_installments else 0 end,
      v_date,
      v_status,
      v_notes
    );

    if p_entry_type = 'receivable' and v_phone is not null then
      insert into public.debtor_contacts (
        owner_id,
        display_name,
        normalized_name,
        phone,
        updated_at
      ) values (
        p_owner_id,
        v_counterparty,
        upper(regexp_replace(v_counterparty, '\s+', ' ', 'g')),
        v_phone,
        now()
      )
      on conflict (owner_id, normalized_name) do update
        set display_name = excluded.display_name,
            phone = excluded.phone,
            updated_at = now();
    end if;
  end if;

  return v_result;
end;
$$;

revoke execute on function public.create_financial_entry(uuid, uuid, text, jsonb)
  from public, anon;
grant execute on function public.create_financial_entry(uuid, uuid, text, jsonb)
  to authenticated;
