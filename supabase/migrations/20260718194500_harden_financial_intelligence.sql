-- Mantém a mesma exigência de conta recuperável + MFA usada no restante do app.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['financial_goals','ai_insights'] loop
    execute format('drop policy if exists require_named_user_mfa on public.%I', table_name);
    execute format(
      'create policy require_named_user_mfa on public.%I as restrictive for all to authenticated using (coalesce((select auth.jwt() ->> ''is_anonymous''), ''false'') = ''false'' and (select auth.jwt() ->> ''aal'') = ''aal2'') with check (coalesce((select auth.jwt() ->> ''is_anonymous''), ''false'') = ''false'' and (select auth.jwt() ->> ''aal'') = ''aal2'')',
      table_name
    );
  end loop;
end $$;

create index if not exists transactions_duplicate_of_idx
  on public.transactions(duplicate_of)
  where duplicate_of is not null;
