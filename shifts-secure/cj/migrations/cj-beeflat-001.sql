-- cj-beeflat-001.sql — DRAFT. DO NOT RUN.
-- Do not run this file against the live Chief Janitorial database
-- (project lfefpmzfnvgwuicthlyg) or any other database.
-- It does not insert rows, does not add columns, and does not change site amounts.
-- Merging the app pull request deploys the website. This file does not run on that deploy.
--
-- What the test copy does today
--   shifts-secure/cj/js/v2-cjbee.js stores Bee-Clean invoices only in the mock
--   browser (DB.beeInvoices) when the page is opened with ?store=mock.
--   Live Supabase mode shows the screen and refuses to save. The app does not
--   send a new column. An unknown column would fail the whole site or invoice save.
--
-- What this file would do later, after a separate OK
--   Let the owner and an admin read and write Chief Janitorial invoices whose
--   JSON is kind "bee_flat" and beeFlat "true". Billing, ops, crew, and the
--   CIBC client login stay out.
--   The row stays a normal reg_client_invoices row. Leave data.firmId unset so
--   reg_derive does not copy a client id. client_id stays null, so the client's
--   own-invoice rule does not match. Bill-to (Bee-Clean) is inside data.billTo.
--   Amounts, the SC-CIA / SC-CIS number, and the site code stay in that JSON.
--
-- cjiv__owner is RESTRICTIVE. A new permissive policy cannot let an admin
-- through it. This replaces cjiv__owner with the original rule plus one
-- exception for these rows, and adds permissive policy cjiv__bee_office.
-- Monthly client invoices stay owner-only (and the client's own login).
--
-- reg_cj_bee_office() reads staff_roles the same way reg_snapshot_for builds
-- officeRoles: role for this login where company_id is cj (missing company
-- counts as 'us', which does not match). It keeps owner and admin only.
-- It does not read reg_accounts.data. It does not use user_metadata.
--
-- MERGE WITH DRAFT PR #133 (cj-extrainv-001.sql)
--   The policy below is the original cjiv__owner text (from the staging
--   catalog captured for #133's rollback) PLUS the bee_flat exception.
--   It does NOT include #133's extra-work exception, because
--   reg_cj_extra_office() is not on master and this file must still parse
--   before that function exists.
--   If cj-extrainv-001 has already been applied, do not run the policy
--   replace in this file as written: it would drop the extra-work exception.
--   Use the COMBINED policy at the bottom of this file instead (it is
--   commented out). If this file is applied first, do not later apply
--   cj-extrainv-001's policy replace unchanged. Put both OR clauses in one
--   policy. The combined text is at the bottom.
--
-- Unchanged: cj__uscrew_nomoney, cjteam__inv, fr__nomoney*, cj__company_gate.
-- No seed. Charlottetown (CIB115) is not written. Alberton and Souris amounts
-- are not written.
--
-- Rollback: migrations/cj-beeflat-001-rollback.sql
--   Restores the original cjiv__owner (no bee exception, no extra-work
--   exception) and drops only what this file adds.
--   If extra-work access was already applied, run cj-extrainv-001 again after
--   that rollback, with the bee clause kept if both should stay.

begin;

create or replace function public.reg_cj_bee_office()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_roles sr
    where sr.user_id = auth.uid()
      and coalesce(sr.company_id, 'us') = 'cj'
      and sr.role = any (array['owner', 'admin']::public.staff_role[])
  );
$$;

comment on function public.reg_cj_bee_office() is
  'True when staff_roles for this login and company cj includes owner or admin. Bee-Clean flat monthly invoices only. Not used by UnScramble.';

revoke all on function public.reg_cj_bee_office() from public, anon;
grant execute on function public.reg_cj_bee_office() to postgres, service_role, authenticated;

drop policy if exists cjiv__bee_office on public.reg_client_invoices;
drop policy if exists cjiv__owner on public.reg_client_invoices;

create policy cjiv__owner on public.reg_client_invoices
  as restrictive
  for all
  to authenticated
  using (
    (coalesce(company_id, 'us'::text) <> 'cj'::text)
    or (select is_owner() as is_owner)
    or ((client_id is not null) and (client_id = (select reg_my_client() as reg_my_client)))
    or (
      (coalesce(company_id, 'us'::text) = 'cj'::text)
      and (coalesce(data ->> 'kind', '') = 'bee_flat')
      and (coalesce(data ->> 'beeFlat', '') = 'true')
      and (select public.reg_cj_bee_office())
    )
  )
  with check (
    (coalesce(company_id, 'us'::text) <> 'cj'::text)
    or (select is_owner() as is_owner)
    or (
      (coalesce(company_id, 'us'::text) = 'cj'::text)
      and (coalesce(data ->> 'kind', '') = 'bee_flat')
      and (coalesce(data ->> 'beeFlat', '') = 'true')
      and (select public.reg_cj_bee_office())
    )
  );

create policy cjiv__bee_office on public.reg_client_invoices
  as permissive
  for all
  to authenticated
  using (
    (coalesce(company_id, 'us'::text) = 'cj'::text)
    and (coalesce(data ->> 'kind', '') = 'bee_flat')
    and (coalesce(data ->> 'beeFlat', '') = 'true')
    and (select public.reg_cj_bee_office())
  )
  with check (
    (coalesce(company_id, 'us'::text) = 'cj'::text)
    and (coalesce(data ->> 'kind', '') = 'bee_flat')
    and (coalesce(data ->> 'beeFlat', '') = 'true')
    and (select public.reg_cj_bee_office())
  );

commit;

-- COMBINED policy — DO NOT RUN as part of the script above.
-- Use this INSTEAD of the cjiv__owner statement in this file when
-- public.reg_cj_extra_office() already exists (draft PR #133 applied),
-- and use it INSTEAD of the policy in cj-extrainv-001.sql when this
-- bee file is applied first. Both exceptions have to live in one
-- restrictive policy or the later file drops the earlier one.
--
-- create policy cjiv__owner on public.reg_client_invoices
--   as restrictive for all to authenticated
--   using (
--     (coalesce(company_id, 'us'::text) <> 'cj'::text)
--     or (select is_owner() as is_owner)
--     or ((client_id is not null) and (client_id = (select reg_my_client() as reg_my_client)))
--     or (
--       (coalesce(company_id, 'us'::text) = 'cj'::text)
--       and (coalesce(data ->> 'kind', '') = 'extra')
--       and (coalesce(data ->> 'extraWork', '') = 'true')
--       and (select public.reg_cj_extra_office())
--     )
--     or (
--       (coalesce(company_id, 'us'::text) = 'cj'::text)
--       and (coalesce(data ->> 'kind', '') = 'bee_flat')
--       and (coalesce(data ->> 'beeFlat', '') = 'true')
--       and (select public.reg_cj_bee_office())
--     )
--   )
--   with check (
--     (coalesce(company_id, 'us'::text) <> 'cj'::text)
--     or (select is_owner() as is_owner)
--     or (
--       (coalesce(company_id, 'us'::text) = 'cj'::text)
--       and (coalesce(data ->> 'kind', '') = 'extra')
--       and (coalesce(data ->> 'extraWork', '') = 'true')
--       and (select public.reg_cj_extra_office())
--     )
--     or (
--       (coalesce(company_id, 'us'::text) = 'cj'::text)
--       and (coalesce(data ->> 'kind', '') = 'bee_flat')
--       and (coalesce(data ->> 'beeFlat', '') = 'true')
--       and (select public.reg_cj_bee_office())
--     )
--   );
