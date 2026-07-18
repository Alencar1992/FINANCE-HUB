alter table public.owners add column if not exists closure_destination text not null default 'local' check(closure_destination in ('local','google_drive','onedrive'));
create table if not exists public.finance_backups(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,
 backup_date date not null, snapshot jsonb not null, checksum text not null,status text not null default 'available' check(status in ('available','restored','invalid')),
 restored_at timestamptz,created_at timestamptz not null default now(),unique(owner_id,backup_date)
);
alter table public.finance_backups enable row level security;
create policy finance_backups_owner_select on public.finance_backups for select to authenticated using((select auth.uid())=owner_id);
create policy require_named_user_mfa on public.finance_backups as restrictive for select to authenticated using(coalesce((select auth.jwt()->>'is_anonymous'),'false')='false' and (select auth.jwt()->>'aal')='aal2');
grant select on public.finance_backups to authenticated;
create trigger finance_audit_immutable after insert or update or delete on public.finance_backups for each row execute function private.write_finance_audit();

create or replace function private.create_weekly_finance_backups() returns void language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare o public.owners%rowtype; payload jsonb;
begin
 for o in select * from public.owners loop
  payload=jsonb_build_object('owner',to_jsonb(o),'transactions',coalesce((select jsonb_agg(to_jsonb(x)) from public.transactions x where x.owner_id=o.id),'[]'::jsonb),'obligations',coalesce((select jsonb_agg(to_jsonb(x)) from public.obligations x where x.owner_id=o.id),'[]'::jsonb),'cards',coalesce((select jsonb_agg(to_jsonb(x)) from public.cards x where x.owner_id=o.id),'[]'::jsonb),'card_purchases',coalesce((select jsonb_agg(to_jsonb(x)) from public.card_purchases x where x.owner_id=o.id),'[]'::jsonb),'subscriptions',coalesce((select jsonb_agg(to_jsonb(x)) from public.subscriptions x where x.owner_id=o.id),'[]'::jsonb),'subscription_charges',coalesce((select jsonb_agg(to_jsonb(x)) from public.subscription_charges x where x.owner_id=o.id),'[]'::jsonb),'investments',coalesce((select jsonb_agg(to_jsonb(x)) from public.investments x where x.owner_id=o.id),'[]'::jsonb),'investment_snapshots',coalesce((select jsonb_agg(to_jsonb(x)) from public.investment_snapshots x where x.owner_id=o.id),'[]'::jsonb),'salary_settings',coalesce((select jsonb_agg(to_jsonb(x)) from public.salary_settings x where x.owner_id=o.id),'[]'::jsonb),'salary_events',coalesce((select jsonb_agg(to_jsonb(x)) from public.salary_events x where x.owner_id=o.id),'[]'::jsonb),'custom_modules',coalesce((select jsonb_agg(to_jsonb(x)) from public.custom_modules x where x.owner_id=o.id),'[]'::jsonb),'custom_module_entries',coalesce((select jsonb_agg(to_jsonb(x)) from public.custom_module_entries x where x.owner_id=o.id),'[]'::jsonb));
  insert into public.finance_backups(owner_id,backup_date,snapshot,checksum) values(o.id,current_date,payload,md5(payload::text)) on conflict(owner_id,backup_date) do update set snapshot=excluded.snapshot,checksum=excluded.checksum,created_at=now();
 end loop;
end $$;
revoke all on function private.create_weekly_finance_backups() from public,anon,authenticated;
do $$ declare jid bigint;begin select jobid into jid from cron.job where jobname='finance-hub-weekly-backup';if jid is not null then perform cron.unschedule(jid);end if;perform cron.schedule('finance-hub-weekly-backup','0 6 * * 0','select private.create_weekly_finance_backups();');end $$;
select private.create_weekly_finance_backups();
