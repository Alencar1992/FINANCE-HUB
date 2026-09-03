alter table public.custom_modules
  add column if not exists automation_schema jsonb not null default '[]'::jsonb;

comment on column public.custom_modules.automation_schema is
  'Ações e regras guiadas criadas pelo proprietário para o módulo personalizado.';
