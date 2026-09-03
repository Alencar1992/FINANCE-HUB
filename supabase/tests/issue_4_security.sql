-- Catalog checks for Issue #4. Run after applying the migration in homologation.
do $$
declare
  unsafe_anon_grants integer;
  unsafe_authenticated_grants integer;
  unsafe_anon_functions integer;
  public_tables_without_rls integer;
begin
  select count(*) into unsafe_anon_grants
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee = 'anon';

  if unsafe_anon_grants <> 0 then
    raise exception 'Expected zero anon grants on public tables; found %', unsafe_anon_grants;
  end if;

  select count(*) into unsafe_authenticated_grants
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee = 'authenticated'
    and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER');

  if unsafe_authenticated_grants <> 0 then
    raise exception 'Unsafe authenticated table grants remain: %', unsafe_authenticated_grants;
  end if;

  select count(*) into unsafe_anon_functions
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE');

  if unsafe_anon_functions <> 0 then
    raise exception 'Anonymous RPC access remains on % public functions', unsafe_anon_functions;
  end if;

  select count(*) into public_tables_without_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

  if public_tables_without_rls <> 0 then
    raise exception 'Public tables without RLS: %', public_tables_without_rls;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'finance_assets_named_mfa'
      and permissive = 'RESTRICTIVE'
      and 'authenticated' = any(roles)
      and coalesce(qual, '') like '%is_anonymous%'
      and coalesce(qual, '') like '%aal2%'
  ) then
    raise exception 'Restrictive named-user AAL2 policy is missing from finance-assets';
  end if;
end $$;

