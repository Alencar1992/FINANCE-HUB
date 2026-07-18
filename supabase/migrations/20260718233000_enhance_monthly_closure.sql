create or replace function private.prepare_monthly_closures() returns void language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare o public.owners%rowtype; ref date := (date_trunc('month',(clock_timestamp() at time zone 'America/Sao_Paulo'))-interval '1 month')::date; month_end date := (date_trunc('month',(clock_timestamp() at time zone 'America/Sao_Paulo'))-interval '1 day')::date; payload jsonb;
begin
 for o in select * from public.owners loop
  payload=jsonb_build_object('periodo',to_char(ref,'YYYY-MM'),'gerado_em',clock_timestamp(),'perfil',to_jsonb(o),
   'movimentacoes',coalesce((select jsonb_agg(to_jsonb(x)) from public.transactions x where x.owner_id=o.id and x.transaction_date between ref and month_end),'[]'::jsonb),
   'salarios',coalesce((select jsonb_agg(to_jsonb(x)) from public.salary_events x where x.owner_id=o.id and x.reference_month=ref),'[]'::jsonb),
   'configuracao_salarial',coalesce((select jsonb_agg(to_jsonb(x)) from public.salary_settings x where x.owner_id=o.id),'[]'::jsonb),
   'investimentos',coalesce((select jsonb_agg(to_jsonb(x)) from public.investments x where x.owner_id=o.id),'[]'::jsonb),
   'evolucao_investimentos',coalesce((select jsonb_agg(to_jsonb(x)) from public.investment_snapshots x where x.owner_id=o.id and x.reference_month=ref),'[]'::jsonb),
   'eu_devo_me_devem',coalesce((select jsonb_agg(to_jsonb(x)) from public.obligations x where x.owner_id=o.id),'[]'::jsonb),
   'cartoes',coalesce((select jsonb_agg(to_jsonb(x)) from public.cards x where x.owner_id=o.id),'[]'::jsonb),
   'compras_cartao',coalesce((select jsonb_agg(to_jsonb(x)) from public.card_purchases x where x.owner_id=o.id),'[]'::jsonb),
   'streamings',coalesce((select jsonb_agg(to_jsonb(x)) from public.subscriptions x where x.owner_id=o.id),'[]'::jsonb),
   'cobrancas_streaming',coalesce((select jsonb_agg(to_jsonb(x)) from public.subscription_charges x where x.owner_id=o.id and x.reference_month=ref),'[]'::jsonb),
   'funcoes',coalesce((select jsonb_agg(to_jsonb(x)) from public.custom_modules x where x.owner_id=o.id),'[]'::jsonb),
   'registros_personalizados',coalesce((select jsonb_agg(to_jsonb(x)) from public.custom_module_entries x where x.owner_id=o.id),'[]'::jsonb));
  insert into public.monthly_closures(owner_id,reference_month,mode,status,snapshot,closed_at) values(o.id,ref,o.monthly_closure_mode,case when o.monthly_closure_mode='automatic' then 'ready' else 'pending' end,payload,case when o.monthly_closure_mode='automatic' then now() end)
  on conflict(owner_id,reference_month) do update set snapshot=excluded.snapshot,mode=excluded.mode;
 end loop;
end $$;
revoke all on function private.prepare_monthly_closures() from public,anon,authenticated;
select private.prepare_monthly_closures();
