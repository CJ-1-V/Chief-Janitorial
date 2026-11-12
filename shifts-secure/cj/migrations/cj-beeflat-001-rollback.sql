-- cj-beeflat-001-rollback.sql — DRAFT. DO NOT RUN.
-- Do not run this against the live Chief Janitorial database
-- (project lfefpmzfnvgwuicthlyg).
--
-- Puts cjiv__owner back to the text captured for draft PR #133's rollback
-- (original restrictive policy: non-cj rows, the owner, or the client on
-- their own invoices). Drops only what cj-beeflat-001.sql adds.
-- Does not drop columns. Does not delete invoice rows. Does not change
-- cj__uscrew_nomoney, cjteam__inv, fr__nomoney*, or cj__company_gate.
--
-- If cj-extrainv-001 was applied before this rollback, this restore also
-- removes the extra-work exception. Run cj-extrainv-001 again afterwards
-- if that access should come back, and keep the bee_flat clause out of it
-- unless Bee-Clean access should stay as well.

begin;

drop policy if exists cjiv__bee_office on public.reg_client_invoices;
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

drop function if exists public.reg_cj_bee_office();

commit;
