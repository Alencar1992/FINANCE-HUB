alter table public.owners add column if not exists monthly_closure_mode text not null default 'manual' check(monthly_closure_mode in ('automatic','manual'));
create table if not exists public.monthly_closures(
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 reference_month date not null, mode text not null check(mode in ('automatic','manual')),
 status text not null default 'pending' check(status in ('pending','ready','completed')),
 snapshot jsonb not null default '{}'::jsonb, closed_at timestamptz, downloaded_at timestamptz,
 created_at timestamptz not null default now(), unique(owner_id,reference_month)
);
alter table public.monthly_closures enable row level security;
create policy monthly_closures_owner_all on public.monthly_closures for all to authenticated using((select auth.uid())=owner_id) with check((select auth.uid())=owner_id);
create policy require_named_user_mfa on public.monthly_closures as restrictive for all to authenticated using(coalesce((select auth.jwt()->>'is_anonymous'),'false')='false' and (select auth.jwt()->>'aal')='aal2') with check(coalesce((select auth.jwt()->>'is_anonymous'),'false')='false' and (select auth.jwt()->>'aal')='aal2');
grant select,insert,update on public.monthly_closures to authenticated;
create trigger finance_audit_immutable after insert or update or delete on public.monthly_closures for each row execute function private.write_finance_audit();

create or replace function private.prepare_monthly_closures() returns void language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare o public.owners%rowtype; ref date := (date_trunc('month',(clock_timestamp() at time zone 'America/Sao_Paulo'))-interval '1 month')::date; month_end date := (date_trunc('month',(clock_timestamp() at time zone 'America/Sao_Paulo'))-interval '1 day')::date; payload jsonb;
begin
 for o in select * from public.owners loop
  payload=jsonb_build_object(
   'periodo',to_char(ref,'YYYY-MM'),'gerado_em',clock_timestamp(),
   'movimentacoes',coalesce((select jsonb_agg(to_jsonb(t)) from public.transactions t where t.owner_id=o.id and t.transaction_date between ref and month_end),'[]'::jsonb),
   'obrigacoes',coalesce((select jsonb_agg(to_jsonb(x)) from public.obligations x where x.owner_id=o.id and x.next_due_date between ref and month_end),'[]'::jsonb),
   'cartoes',coalesce((select jsonb_agg(to_jsonb(c)) from public.card_purchases c where c.owner_id=o.id and c.first_due_date<=month_end),'[]'::jsonb),
   'streamings',coalesce((select jsonb_agg(to_jsonb(s)) from public.subscription_charges s where s.owner_id=o.id and s.reference_month=ref),'[]'::jsonb),
   'funcoes',coalesce((select jsonb_agg(to_jsonb(e)) from public.custom_module_entries e where e.owner_id=o.id and e.created_at::date between ref and month_end),'[]'::jsonb)
  );
  insert into public.monthly_closures(owner_id,reference_month,mode,status,snapshot,closed_at)
  values(o.id,ref,o.monthly_closure_mode,case when o.monthly_closure_mode='automatic' then 'ready' else 'pending' end,payload,case when o.monthly_closure_mode='automatic' then now() end)
  on conflict(owner_id,reference_month) do nothing;
 end loop;
end $$;
revoke all on function private.prepare_monthly_closures() from public,anon,authenticated;
do $$ declare jid bigint; begin select jobid into jid from cron.job where jobname='finance-hub-monthly-closure';if jid is not null then perform cron.unschedule(jid);end if;perform cron.schedule('finance-hub-monthly-closure','31 3 * * *','select private.prepare_monthly_closures();');end $$;
select private.prepare_monthly_closures();
