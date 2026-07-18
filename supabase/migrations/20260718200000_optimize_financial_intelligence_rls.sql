-- Evita reavaliar auth.jwt() a cada linha nas políticas dos novos recursos.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['financial_goals','ai_insights'] loop
    execute format('drop policy if exists require_named_user_mfa on public.%I', table_name);
    execute format(
      'create policy require_named_user_mfa on public.%I as restrictive for all to authenticated using (coalesce((select auth.jwt()) ->> ''is_anonymous'', ''false'') = ''false'' and (select auth.jwt()) ->> ''aal'' = ''aal2'') with check (coalesce((select auth.jwt()) ->> ''is_anonymous'', ''false'') = ''false'' and (select auth.jwt()) ->> ''aal'' = ''aal2'')',
      table_name
    );
  end loop;
end $$;
