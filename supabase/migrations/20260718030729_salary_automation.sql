-- Configuração mensal de salário, adiantamento e aportes automáticos.
create table if not exists public.salary_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  salary_amount numeric(14,2) not null default 0,
  salary_day smallint not null default 5 check (salary_day between 1 and 31),
  salary_enabled boolean not null default false,
  advance_amount numeric(14,2) not null default 0,
  advance_day smallint not null default 20 check (advance_day between 1 and 31),
  advance_enabled boolean not null default false,
  savings_enabled boolean not null default false,
  savings_mode text not null default 'percentage' check (savings_mode in ('percentage','fixed')),
  savings_value numeric(14,4) not null default 0,
  savings_recurring boolean not null default false,
  savings_on_salary boolean not null default true,
  savings_on_advance boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.salary_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  reference_month date not null,
  event_type text not null check (event_type in ('salary','advance','salary_savings','advance_savings')),
  amount numeric(14,2) not null,
  transaction_id uuid references public.transactions(id) on delete set null,
  investment_id uuid references public.investments(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(owner_id, reference_month, event_type)
);

alter table public.salary_settings enable row level security;
alter table public.salary_events enable row level security;
create policy salary_settings_owner_all on public.salary_settings for all to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
create policy salary_events_owner_all on public.salary_events for all to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
create policy require_named_user_mfa on public.salary_settings as restrictive for all to authenticated using (coalesce((select auth.jwt()->>'is_anonymous'),'false')='false' and (select auth.jwt()->>'aal')='aal2') with check (coalesce((select auth.jwt()->>'is_anonymous'),'false')='false' and (select auth.jwt()->>'aal')='aal2');
create policy require_named_user_mfa on public.salary_events as restrictive for all to authenticated using (coalesce((select auth.jwt()->>'is_anonymous'),'false')='false' and (select auth.jwt()->>'aal')='aal2') with check (coalesce((select auth.jwt()->>'is_anonymous'),'false')='false' and (select auth.jwt()->>'aal')='aal2');
create trigger finance_audit_immutable after insert or update or delete on public.salary_settings for each row execute function private.write_finance_audit();
create trigger finance_audit_immutable after insert or update or delete on public.salary_events for each row execute function private.write_finance_audit();
grant select,insert,update,delete on public.salary_settings,public.salary_events to authenticated;
