alter table public.owners
  add column if not exists background_color text not null default '#F6F8FC',
  add column if not exists background_image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'finance-assets',
  'finance-assets',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists finance_assets_select_own on storage.objects;
drop policy if exists finance_assets_insert_own on storage.objects;
drop policy if exists finance_assets_update_own on storage.objects;
drop policy if exists finance_assets_delete_own on storage.objects;

create policy finance_assets_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'finance-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy finance_assets_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'finance-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy finance_assets_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'finance-assets' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'finance-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy finance_assets_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'finance-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
