-- Carteira de investimentos com evolução mensal e isolamento por proprietário.
create table if not exists public.investments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  bank_name text not null,
  investment_type text not null,
  initial_amount numeric(14,2) not null check (initial_amount >= 0),
  current_amount numeric(14,2) not null check (current_amount >= 0),
  rate_mode text not null check (rate_mode in ('cdi','fixed','savings','manual')),
  contracted_rate numeric(9,4),
  invested_at date not null default current_date,
  maturity_date date,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.investment_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  investment_id uuid not null references public.investments(id) on delete cascade,
  reference_month date not null,
  amount numeric(14,2) not null check (amount >= 0),
  contribution numeric(14,2) not null default 0,
  withdrawal numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (investment_id, reference_month)
);

create index if not exists investments_owner_idx on public.investments(owner_id);
create index if not exists investment_snapshots_owner_month_idx on public.investment_snapshots(owner_id, reference_month);
alter table public.investments enable row level security;
alter table public.investment_snapshots enable row level security;

create policy investments_owner_all on public.investments for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy investment_snapshots_owner_all on public.investment_snapshots for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

create policy require_named_user_mfa on public.investments as restrictive for all to authenticated
  using (coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'false' and (select auth.jwt() ->> 'aal') = 'aal2')
  with check (coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'false' and (select auth.jwt() ->> 'aal') = 'aal2');
create policy require_named_user_mfa on public.investment_snapshots as restrictive for all to authenticated
  using (coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'false' and (select auth.jwt() ->> 'aal') = 'aal2')
  with check (coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'false' and (select auth.jwt() ->> 'aal') = 'aal2');

create trigger finance_audit_immutable after insert or update or delete on public.investments
  for each row execute function private.write_finance_audit();
create trigger finance_audit_immutable after insert or update or delete on public.investment_snapshots
  for each row execute function private.write_finance_audit();

grant select, insert, update, delete on public.investments to authenticated;
grant select, insert, update, delete on public.investment_snapshots to authenticated;
