alter table public.owners add column if not exists streaming_enabled boolean not null default false;
alter table public.subscriptions add column if not exists updated_at timestamptz not null default now();

create table if not exists public.subscription_charges (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  participant_name text not null,
  phone text,
  amount numeric(14,2) not null check (amount >= 0),
  reference_month date not null,
  due_date date not null,
  status text not null default 'pending' check (status in ('pending','paid','overdue','cancelled')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(subscription_id, participant_name, reference_month)
);

create index if not exists subscription_charges_owner_month_idx on public.subscription_charges(owner_id,reference_month);
create index if not exists subscription_charges_subscription_idx on public.subscription_charges(subscription_id);
alter table public.subscription_charges enable row level security;
create policy subscription_charges_owner_all on public.subscription_charges for all to authenticated
  using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
create policy require_named_user_mfa on public.subscription_charges as restrictive for all to authenticated
  using (coalesce((select auth.jwt()->>'is_anonymous'),'false')='false' and (select auth.jwt()->>'aal')='aal2')
  with check (coalesce((select auth.jwt()->>'is_anonymous'),'false')='false' and (select auth.jwt()->>'aal')='aal2');
grant select,insert,update,delete on public.subscription_charges to authenticated;
create trigger finance_audit_immutable after insert or update or delete on public.subscription_charges
  for each row execute function private.write_finance_audit();

create or replace function private.run_streaming_automation()
returns void language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare s public.subscriptions%rowtype; participant jsonb; local_today date := (clock_timestamp() at time zone 'America/Sao_Paulo')::date; ref date := date_trunc('month',(clock_timestamp() at time zone 'America/Sao_Paulo'))::date; v_due_date date;
begin
  update public.subscription_charges set status='overdue',updated_at=now()
   where status='pending' and subscription_charges.due_date < local_today;
  for s in select * from public.subscriptions where active and is_shared loop
    v_due_date := make_date(extract(year from ref)::int,extract(month from ref)::int,least(coalesce(s.due_day,1)::int,extract(day from (date_trunc('month',local_today)+interval '1 month - 1 day'))::int));
    for participant in select value from jsonb_array_elements(coalesce(s.participants,'[]'::jsonb)) loop
      if nullif(trim(participant->>'name'),'') is not null then
        insert into public.subscription_charges(owner_id,subscription_id,participant_name,phone,amount,reference_month,due_date,status)
        values(s.owner_id,s.id,participant->>'name',participant->>'phone',coalesce(nullif(participant->>'amount','')::numeric,0),ref,v_due_date,case when v_due_date<local_today then 'overdue' else 'pending' end)
        on conflict(subscription_id,participant_name,reference_month) do nothing;
      end if;
    end loop;
  end loop;
end $$;
revoke all on function private.run_streaming_automation() from public,anon,authenticated;

do $$ declare existing_job bigint; begin
  select jobid into existing_job from cron.job where jobname='finance-hub-streaming-daily';
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
  perform cron.schedule('finance-hub-streaming-daily','23 3 * * *','select private.run_streaming_automation();');
end $$;
select private.run_streaming_automation();
