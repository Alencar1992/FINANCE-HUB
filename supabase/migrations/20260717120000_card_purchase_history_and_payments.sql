alter table public.card_purchases
  add column if not exists purchased_by text not null default 'Próprio',
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists paid_at timestamptz;

create or replace function public.pay_card_purchases(
  p_card_id uuid,
  p_purchase_ids uuid[] default null,
  p_pay_all boolean default false
) returns integer
language plpgsql security invoker set search_path=public
as $$
declare affected integer;
begin
  if p_pay_all then
    update public.card_purchases
    set paid_installments=installment_count,status='paid',paid_at=now(),updated_at=now()
    where owner_id=(select auth.uid()) and card_id=p_card_id and status='open';
  else
    update public.card_purchases
    set paid_installments=least(paid_installments+1,installment_count),
        status=case when paid_installments+1>=installment_count then 'paid' else 'open' end,
        paid_at=case when paid_installments+1>=installment_count then now() else paid_at end,
        first_due_date=case when paid_installments+1>=installment_count then first_due_date else (first_due_date+interval '1 month')::date end,
        updated_at=now()
    where owner_id=(select auth.uid()) and card_id=p_card_id and status='open' and id=any(p_purchase_ids);
  end if;
  get diagnostics affected=row_count;
  return affected;
end $$;
