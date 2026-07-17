alter table public.owners
  add column if not exists app_name text not null default 'Finance Hub',
  add column if not exists app_color text not null default '#6445ED';
