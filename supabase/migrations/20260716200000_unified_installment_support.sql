alter table public.transactions
  add column if not exists total_amount numeric(14,2),
  add column if not exists is_installment boolean not null default false,
  add column if not exists installment_count integer not null default 1,
  add column if not exists installment_number integer not null default 1,
  add column if not exists installment_amount numeric(14,2);

alter table public.obligations
  add column if not exists is_installment boolean not null default false,
  add column if not exists paid_installments integer not null default 0,
  add column if not exists installment_amount numeric(14,2);

create table if not exists public.card_purchases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  description text not null,
  total_amount numeric(14,2) not null,
  installment_count integer not null default 1,
  installment_amount numeric(14,2) not null,
  paid_installments integer not null default 0,
  first_due_date date not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);
