create table public.custom_module_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete cascade,
  module_id uuid not null references public.custom_modules(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index custom_module_entries_owner_module_idx
  on public.custom_module_entries(owner_id,module_id,created_at desc);

alter table public.custom_module_entries enable row level security;
create policy "custom_module_entries_owner_all" on public.custom_module_entries
for all to authenticated using ((select auth.uid())=owner_id)
with check ((select auth.uid())=owner_id);
