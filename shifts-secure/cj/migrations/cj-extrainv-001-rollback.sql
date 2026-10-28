-- cj-extrainv-001-rollback.sql
-- Puts cjiv__owner back to the text captured from pg_policies on
-- shift-tracker-staging (ycidjatwzseowwvrtham) when this change was written:
--   permissive = RESTRICTIVE, command = ALL, roles = authenticated
--   qual and with_check below are that catalog text.
-- Drops only what cj-extrainv-001.sql added. Does not change
-- cj__uscrew_nomoney, cjteam__inv, fr__nomoney*, or cj__company_gate.

begin;

drop policy if exists cjiv__extra_office on public.reg_client_invoices;
drop policy if exists reg_cj_extrainv_select on public.reg_client_invoices;
drop policy if exists reg_cj_extrainv_insert on public.reg_client_invoices;
drop policy if exists cjiv__owner on public.reg_client_invoices;

create policy cjiv__owner on public.reg_client_invoices
  as restrictive
  for all
  to authenticated
  using (
    ((COALESCE(company_id, 'us'::text) <> 'cj'::text) OR ( SELECT is_owner() AS is_owner) OR ((client_id IS NOT NULL) AND (client_id = ( SELECT reg_my_client() AS reg_my_client))))
  )
  with check (
    ((COALESCE(company_id, 'us'::text) <> 'cj'::text) OR ( SELECT is_owner() AS is_owner))
  );

drop function if exists public.reg_cj_extra_office();

commit;
