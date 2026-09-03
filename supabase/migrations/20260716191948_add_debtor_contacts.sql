create table public.debtor_contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete cascade,
  display_name text not null,
  normalized_name text not null,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, normalized_name)
);
create index debtor_contacts_owner_name_idx on public.debtor_contacts(owner_id, normalized_name);
alter table public.debtor_contacts enable row level security;
create policy "debtor_contacts_owner_all" on public.debtor_contacts for all to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);
grant select,insert,update,delete on public.debtor_contacts to authenticated;

insert into public.debtor_contacts(owner_id,display_name,normalized_name,phone)
select owner_id, min(counterparty_name), upper(regexp_replace(trim(counterparty_name),'\s+',' ','g')), max(phone)
from public.obligations
where direction='receivable'
group by owner_id, upper(regexp_replace(trim(counterparty_name),'\s+',' ','g'))
on conflict(owner_id,normalized_name) do update set
phone=coalesce(excluded.phone,public.debtor_contacts.phone),
updated_at=now();
