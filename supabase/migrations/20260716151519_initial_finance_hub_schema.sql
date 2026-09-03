create extension if not exists pgcrypto;

create table public.owners (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  avatar_url text,
  profile_color text not null default '#6445ED',
  currency text not null default 'BRL',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  category text not null default 'Outros',
  amount numeric(14,2) not null check (amount >= 0),
  transaction_type text not null check (transaction_type in ('income','expense')),
  transaction_date date not null default current_date,
  payment_method text,
  status text not null default 'pending' check (status in ('pending','paid','received','cancelled','overdue')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.obligations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete cascade,
  direction text not null check (direction in ('receivable','payable')),
  counterparty_name text not null,
  phone text,
  description text not null,
  category text not null default 'Outros',
  total_amount numeric(14,2) not null check (total_amount >= 0),
  remaining_amount numeric(14,2) not null check (remaining_amount >= 0),
  installments integer not null default 1 check (installments > 0),
  next_due_date date,
  status text not null default 'open' check (status in ('open','paid','overdue','cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete cascade,
  bank text not null,
  name text not null,
  credit_limit numeric(14,2) not null default 0 check (credit_limit >= 0),
  closing_day smallint check (closing_day between 1 and 31),
  due_day smallint check (due_day between 1 and 31),
  color text not null default '#6445ED',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete cascade,
  name text not null,
  amount numeric(14,2) not null check (amount >= 0),
  due_day smallint check (due_day between 1 and 31),
  is_shared boolean not null default false,
  participants jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.custom_modules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete cascade,
  name text not null,
  icon text,
  color text not null default '#6445ED',
  field_schema jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(owner_id,name)
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  owner_id uuid not null references public.owners(id) on delete cascade,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index transactions_owner_date_idx on public.transactions(owner_id, transaction_date desc);
create index transactions_owner_type_idx on public.transactions(owner_id, transaction_type);
create index obligations_owner_due_idx on public.obligations(owner_id, next_due_date) where status in ('open','overdue');
create index cards_owner_idx on public.cards(owner_id);
create index subscriptions_owner_idx on public.subscriptions(owner_id);
create index custom_modules_owner_idx on public.custom_modules(owner_id);
create index audit_log_owner_created_idx on public.audit_log(owner_id, created_at desc);

alter table public.owners enable row level security;
alter table public.transactions enable row level security;
alter table public.obligations enable row level security;
alter table public.cards enable row level security;
alter table public.subscriptions enable row level security;
alter table public.custom_modules enable row level security;
alter table public.audit_log enable row level security;

create policy "owners_select_own" on public.owners for select to authenticated using ((select auth.uid()) = id);
create policy "owners_insert_own" on public.owners for insert to authenticated with check ((select auth.uid()) = id);
create policy "owners_update_own" on public.owners for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "owners_delete_own" on public.owners for delete to authenticated using ((select auth.uid()) = id);

create policy "transactions_owner_all" on public.transactions for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "obligations_owner_all" on public.obligations for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "cards_owner_all" on public.cards for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "subscriptions_owner_all" on public.subscriptions for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "custom_modules_owner_all" on public.custom_modules for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "audit_log_owner_all" on public.audit_log for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

grant usage on schema public to authenticated;
grant select,insert,update,delete on public.owners,public.transactions,public.obligations,public.cards,public.subscriptions,public.custom_modules to authenticated;
grant select,insert on public.audit_log to authenticated;
grant usage,select on sequence public.audit_log_id_seq to authenticated;
