alter table public.transactions
  add column if not exists total_amount numeric(14,2),
  add column if not exists is_installment boolean not null default false,
  add column if not exists installment_count integer not null default 1 check (installment_count > 0),
  add column if not exists installment_number integer not null default 1 check (installment_number > 0),
  add column if not exists installment_amount numeric(14,2);

update public.transactions set total_amount=amount, installment_amount=amount
where total_amount is null or installment_amount is null;

alter table public.transactions alter column total_amount set not null;
alter table public.transactions alter column installment_amount set not null;

alter table public.obligations
  add column if not exists is_installment boolean not null default false,
  add column if not exists paid_installments integer not null default 0 check (paid_installments >= 0),
  add column if not exists installment_amount numeric(14,2);

update public.obligations
set installment_amount=round(total_amount/greatest(installments,1),2)
where installment_amount is null;

alter table public.obligations alter column installment_amount set not null;

create table public.card_purchases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  description text not null,
  total_amount numeric(14,2) not null check(total_amount >= 0),
  installment_count integer not null default 1 check(installment_count > 0),
  installment_amount numeric(14,2) not null check(installment_amount >= 0),
  paid_installments integer not null default 0 check(paid_installments >= 0),
  first_due_date date not null,
  status text not null default 'open' check(status in ('open','paid','cancelled')),
  created_at timestamptz not null default now()
);
create index card_purchases_owner_due_idx on public.card_purchases(owner_id,first_due_date);
alter table public.card_purchases enable row level security;
create policy "card_purchases_owner_all" on public.card_purchases for all to authenticated
using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
grant select,insert,update,delete on public.card_purchases to authenticated;

create or replace function public.advance_obligation_installment(p_obligation_id uuid)
returns public.obligations
language plpgsql
security invoker
set search_path=public
as $$
declare v public.obligations;
begin
 update public.obligations
 set paid_installments=least(paid_installments+1,installments),
     remaining_amount=greatest(0,total_amount-(least(paid_installments+1,installments)*installment_amount)),
     next_due_date=case when paid_installments+1>=installments then next_due_date else (next_due_date+interval '1 month')::date end,
     status=case when paid_installments+1>=installments then 'paid' else 'open' end,
     updated_at=now()
 where id=p_obligation_id and owner_id=(select auth.uid())
 returning * into v;
 return v;
end $$;
grant execute on function public.advance_obligation_installment(uuid) to authenticated;
