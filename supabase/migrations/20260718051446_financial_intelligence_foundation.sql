-- Fundação segura para os recursos de inteligência financeira.
-- Todos os registros pertencem ao usuário autenticado e ficam protegidos por RLS.

alter table public.transactions
  add column if not exists classification_source text not null default 'manual'
    check (classification_source in ('manual', 'rules', 'gemini')),
  add column if not exists classification_confidence numeric(5,4)
    check (classification_confidence is null or classification_confidence between 0 and 1),
  add column if not exists duplicate_of uuid references public.transactions(id) on delete set null,
  add column if not exists duplicate_review_status text not null default 'not_flagged'
    check (duplicate_review_status in ('not_flagged', 'pending', 'confirmed', 'dismissed'));

create table if not exists public.financial_goals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  target_amount numeric(14,2) not null check (target_amount > 0),
  current_amount numeric(14,2) not null default 0 check (current_amount >= 0),
  target_date date not null,
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  status text not null default 'active' check (status in ('active','completed','paused','cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete cascade,
  insight_type text not null check (insight_type in ('assistant','savings','monthly_comparison','classification')),
  reference_month date,
  title text not null,
  content jsonb not null default '{}'::jsonb,
  model text,
  status text not null default 'active' check (status in ('active','dismissed','archived')),
  created_at timestamptz not null default now()
);

create index if not exists financial_goals_owner_status_idx on public.financial_goals(owner_id,status);
create index if not exists ai_insights_owner_type_created_idx on public.ai_insights(owner_id,insight_type,created_at desc);
create index if not exists transactions_duplicate_lookup_idx on public.transactions(owner_id,transaction_type,amount,transaction_date);

alter table public.financial_goals enable row level security;
alter table public.ai_insights enable row level security;

drop policy if exists "financial_goals_owner_all" on public.financial_goals;
create policy "financial_goals_owner_all" on public.financial_goals
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "ai_insights_owner_all" on public.ai_insights;
create policy "ai_insights_owner_all" on public.ai_insights
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

grant select, insert, update, delete on public.financial_goals to authenticated;
grant select, insert, update, delete on public.ai_insights to authenticated;

comment on table public.financial_goals is 'Metas financeiras isoladas por proprietário.';
comment on table public.ai_insights is 'Histórico de respostas estruturadas geradas pela camada de IA.';
