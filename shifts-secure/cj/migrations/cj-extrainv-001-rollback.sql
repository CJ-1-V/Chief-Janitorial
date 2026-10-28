-- cj-extrainv-001-rollback.sql — DRAFT. DO NOT RUN.
-- Removes only the extra-work invoice policies and helper from cj-extrainv-001.sql.
-- Does not drop invoices, columns, or the owner-only invoice policies.

begin;

drop policy if exists reg_cj_extrainv_insert on public.reg_client_invoices;
drop policy if exists reg_cj_extrainv_select on public.reg_client_invoices;
drop function if exists public.reg_cj_extra_office();

commit;
