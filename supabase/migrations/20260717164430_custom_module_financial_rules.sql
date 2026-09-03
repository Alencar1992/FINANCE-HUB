alter table public.custom_modules
  add column if not exists financial_schema jsonb not null default '{"enabled":false}'::jsonb;

comment on column public.custom_modules.financial_schema is
  'Integração do módulo personalizado com movimentações, pagamentos, recebimentos e vencimentos.';
