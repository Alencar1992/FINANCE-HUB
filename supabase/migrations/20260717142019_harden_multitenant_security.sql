-- Finance Hub: isolamento multi-tenant, MFA obrigatório e auditoria imutável.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.write_finance_audit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  source_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  actor uuid := coalesce((source_row ->> 'owner_id')::uuid, (source_row ->> 'id')::uuid);
begin
  insert into public.audit_log(owner_id, action, entity_type, entity_id, metadata)
  values (
    actor,
    lower(tg_op),
    tg_table_name,
    source_row ->> 'id',
    jsonb_build_object(
      'old', case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
      'new', case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end,
      'at', clock_timestamp()
    )
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.write_finance_audit() from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'owners','transactions','obligations','cards','card_purchases',
    'subscriptions','debtor_contacts','custom_modules','custom_module_entries'
  ] loop
    execute format('drop trigger if exists finance_audit_immutable on public.%I', table_name);
    execute format(
      'create trigger finance_audit_immutable after insert or update or delete on public.%I for each row execute function private.write_finance_audit()',
      table_name
    );
  end loop;
end $$;

drop policy if exists audit_log_owner_all on public.audit_log;
drop policy if exists audit_log_owner_select on public.audit_log;
create policy audit_log_owner_select on public.audit_log
  for select to authenticated
  using ((select auth.uid()) = owner_id);

revoke insert, update, delete, truncate on public.audit_log from authenticated, anon;
grant select on public.audit_log to authenticated;

-- Bloqueia tokens anônimos e exige sessão elevada por TOTP (AAL2).
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'owners','transactions','obligations','cards','card_purchases','subscriptions',
    'debtor_contacts','custom_modules','custom_module_entries','audit_log'
  ] loop
    execute format('drop policy if exists require_named_user_mfa on public.%I', table_name);
    execute format(
      'create policy require_named_user_mfa on public.%I as restrictive for all to authenticated using (coalesce((select auth.jwt() ->> ''is_anonymous''), ''false'') = ''false'' and (select auth.jwt() ->> ''aal'') = ''aal2'') with check (coalesce((select auth.jwt() ->> ''is_anonymous''), ''false'') = ''false'' and (select auth.jwt() ->> ''aal'') = ''aal2'')',
      table_name
    );
  end loop;
end $$;

create index if not exists card_purchases_card_id_idx on public.card_purchases(card_id);
create index if not exists custom_module_entries_module_id_idx on public.custom_module_entries(module_id);
