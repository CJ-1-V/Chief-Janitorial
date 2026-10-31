-- cj-client-v1-001-rollback.sql — DRAFT. DO NOT RUN.
-- Drops only the functions added by cj-client-v1-001.sql.
-- Does not change tables, rows, reg_snapshot(), or reg_snapshot_for().
-- Public functions go first because they call the helpers.

begin;

drop function if exists public.cj_client_v1_invoices();
drop function if exists public.cj_client_v1_requests();
drop function if exists public.cj_client_v1_checklists(date, date);
drop function if exists public.cj_client_v1_hours(date, date);
drop function if exists public.cj_client_v1_supervisor_checks(date, date);
drop function if exists public.cj_client_v1_visits(date, date);
drop function if exists public.cj_client_v1_sites();
drop function if exists public.cj_client_v1_whoami();

drop function if exists public.cj_client_v1_crew_labels(date, date);
drop function if exists public.cj_client_v1_own_sites();
drop function if exists public.cj_client_v1_client_id();
drop function if exists public.cj_client_v1_minutes(text);
drop function if exists public.cj_client_v1_hhmm(text);

commit;
