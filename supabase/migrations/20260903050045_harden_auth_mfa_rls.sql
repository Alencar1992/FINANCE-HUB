-- Issue #4: remove public database access and require a named AAL2 session for assets.
-- Existing anonymous accounts are intentionally preserved so they can be upgraded in-place.

-- The browser uses the publishable/anon API key only to start Auth. No application table
-- is public, so the database role `anon` must not have table, sequence or RPC privileges.
revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;
revoke all privileges on all functions in schema public from anon;
revoke execute on all functions in schema public from public;

-- These RPCs are security-invoker and continue to pass through the caller's RLS policies.
grant execute on function public.advance_obligation_installment(uuid) to authenticated;
grant execute on function public.pay_card_purchases(uuid, uuid[], boolean) to authenticated;
grant execute on function public.block_streaming_access_profile(uuid) to authenticated;
grant execute on function public.restore_streaming_access_profile(uuid) to authenticated;

-- RLS does not apply to TRUNCATE. Browser roles only need row-level CRUD privileges.
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- New public functions must be explicitly granted instead of inheriting EXECUTE from PUBLIC.
alter default privileges for role postgres in schema public
  revoke execute on functions from public;

-- Storage ownership policies already isolate paths by auth.uid(). This restrictive policy
-- also blocks anonymous identities and sessions that have not completed MFA (AAL2).
drop policy if exists finance_assets_named_mfa on storage.objects;
create policy finance_assets_named_mfa
  on storage.objects
  as restrictive
  for all
  to authenticated
  using (
    bucket_id <> 'finance-assets'
    or (
      coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'false'
      and (select auth.jwt() ->> 'aal') = 'aal2'
    )
  )
  with check (
    bucket_id <> 'finance-assets'
    or (
      coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'false'
      and (select auth.jwt() ->> 'aal') = 'aal2'
    )
  );
