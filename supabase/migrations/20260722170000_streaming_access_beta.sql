-- Beta: controle assistido de perfis e aparelhos de streaming.
-- A ação de bloqueio é atômica no Finance Hub; a saída real continua sendo
-- confirmada pelo titular na página oficial da Netflix.

create table if not exists public.streaming_access_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  participant_name text not null check (length(trim(participant_name)) > 0),
  profile_name text not null check (length(trim(profile_name)) > 0),
  profile_email text,
  pin_enabled boolean not null default false,
  status text not null default 'active' check (status in ('active','review','blocked')),
  notes text,
  last_request_at timestamptz,
  blocked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(subscription_id, participant_name)
);

create table if not exists public.streaming_access_devices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.streaming_access_profiles(id) on delete cascade,
  nickname text not null check (length(trim(nickname)) > 0),
  device_type text not null default 'tv' check (device_type in ('tv','mobile','computer','tablet','other')),
  device_identifier text,
  status text not null default 'active' check (status in ('active','blocked')),
  last_seen_at timestamptz,
  blocked_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.streaming_access_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.streaming_access_profiles(id) on delete cascade,
  event_type text not null check (event_type in ('residence_update_request','temporary_access_code','unknown_access','profile_blocked')),
  email_subject text,
  sender_email text,
  received_at timestamptz not null default now(),
  status text not null default 'detected' check (status in ('detected','reviewed','dismissed')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists streaming_access_profiles_owner_idx on public.streaming_access_profiles(owner_id);
create index if not exists streaming_access_devices_profile_idx on public.streaming_access_devices(profile_id);
create index if not exists streaming_access_events_profile_received_idx on public.streaming_access_events(profile_id, received_at desc);

alter table public.streaming_access_profiles enable row level security;
alter table public.streaming_access_devices enable row level security;
alter table public.streaming_access_events enable row level security;

create policy streaming_access_profiles_owner_all on public.streaming_access_profiles for all to authenticated
  using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
create policy streaming_access_devices_owner_all on public.streaming_access_devices for all to authenticated
  using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
create policy streaming_access_events_owner_all on public.streaming_access_events for all to authenticated
  using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);

create policy streaming_access_profiles_named_mfa on public.streaming_access_profiles as restrictive for all to authenticated
  using (coalesce((select auth.jwt()->>'is_anonymous'),'false')='false' and (select auth.jwt()->>'aal')='aal2')
  with check (coalesce((select auth.jwt()->>'is_anonymous'),'false')='false' and (select auth.jwt()->>'aal')='aal2');
create policy streaming_access_devices_named_mfa on public.streaming_access_devices as restrictive for all to authenticated
  using (coalesce((select auth.jwt()->>'is_anonymous'),'false')='false' and (select auth.jwt()->>'aal')='aal2')
  with check (coalesce((select auth.jwt()->>'is_anonymous'),'false')='false' and (select auth.jwt()->>'aal')='aal2');
create policy streaming_access_events_named_mfa on public.streaming_access_events as restrictive for all to authenticated
  using (coalesce((select auth.jwt()->>'is_anonymous'),'false')='false' and (select auth.jwt()->>'aal')='aal2')
  with check (coalesce((select auth.jwt()->>'is_anonymous'),'false')='false' and (select auth.jwt()->>'aal')='aal2');

grant select,insert,update,delete on public.streaming_access_profiles to authenticated;
grant select,insert,update,delete on public.streaming_access_devices to authenticated;
grant select,insert,update,delete on public.streaming_access_events to authenticated;

create trigger streaming_access_profiles_audit after insert or update or delete on public.streaming_access_profiles
  for each row execute function private.write_finance_audit();
create trigger streaming_access_devices_audit after insert or update or delete on public.streaming_access_devices
  for each row execute function private.write_finance_audit();
create trigger streaming_access_events_audit after insert or update or delete on public.streaming_access_events
  for each row execute function private.write_finance_audit();

create or replace function public.block_streaming_access_profile(target_profile_id uuid)
returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
declare local_owner uuid := auth.uid();
begin
  update public.streaming_access_profiles
     set status='blocked', blocked_at=now(), updated_at=now()
   where id=target_profile_id and owner_id=local_owner;
  if not found then raise exception 'profile_not_found'; end if;
  update public.streaming_access_devices
     set status='blocked', blocked_at=now(), updated_at=now()
   where profile_id=target_profile_id and owner_id=local_owner;
end $$;

create or replace function public.restore_streaming_access_profile(target_profile_id uuid)
returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
declare local_owner uuid := auth.uid();
begin
  update public.streaming_access_profiles
     set status='active', blocked_at=null, updated_at=now()
   where id=target_profile_id and owner_id=local_owner;
  if not found then raise exception 'profile_not_found'; end if;
  update public.streaming_access_devices
     set status='active', blocked_at=null, updated_at=now()
   where profile_id=target_profile_id and owner_id=local_owner;
end $$;

revoke all on function public.block_streaming_access_profile(uuid) from public,anon;
revoke all on function public.restore_streaming_access_profile(uuid) from public,anon;
grant execute on function public.block_streaming_access_profile(uuid) to authenticated;
grant execute on function public.restore_streaming_access_profile(uuid) to authenticated;
