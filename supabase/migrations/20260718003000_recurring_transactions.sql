-- Recorrências mensais permanecem ativas até quitação ou cancelamento.
alter table public.transactions
  add column if not exists is_recurring boolean not null default false,
  add column if not exists recurrence_day smallint,
  add column if not exists recurrence_active boolean not null default false,
  add column if not exists recurrence_end_date date;

alter table public.transactions drop constraint if exists transactions_recurrence_day_check;
alter table public.transactions add constraint transactions_recurrence_day_check
  check (recurrence_day is null or recurrence_day between 1 and 31);

comment on column public.transactions.is_recurring is 'Indica movimentação mensal recorrente.';
comment on column public.transactions.recurrence_active is 'Mantém a recorrência visível até quitação ou cancelamento.';
