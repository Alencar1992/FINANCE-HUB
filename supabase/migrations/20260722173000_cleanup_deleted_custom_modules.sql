-- Garante limpeza integral dos reflexos financeiros antes de qualquer
-- exclusão futura de uma função personalizada. Resíduos históricos são
-- tratados separadamente após conferência individual no banco.

create or replace function private.cleanup_custom_module_finance()
returns trigger
language plpgsql
security invoker
set search_path=pg_catalog,public,private
as $$
begin
  delete from public.obligations obligation
   using public.custom_module_entries entry
   where entry.module_id=old.id
     and entry.owner_id=old.owner_id
     and obligation.owner_id=old.owner_id
     and obligation.id::text=entry.data#>>'{_finance,obligationId}';

  delete from public.transactions transaction_row
   using public.custom_module_entries entry
   where entry.module_id=old.id
     and entry.owner_id=old.owner_id
     and transaction_row.owner_id=old.owner_id
     and transaction_row.id::text=entry.data#>>'{_finance,transactionId}';

  return old;
end $$;

revoke all on function private.cleanup_custom_module_finance() from public,anon,authenticated;

drop trigger if exists cleanup_custom_module_finance_before_delete on public.custom_modules;
create trigger cleanup_custom_module_finance_before_delete
before delete on public.custom_modules
for each row execute function private.cleanup_custom_module_finance();
