-- cj-extrainv-001.sql
-- Extra-work invoices for Chief Janitorial (company_id 'cj').
--
-- Storage needs no new column. An extra-work invoice is a normal reg_client_invoices
-- row. The app puts kind = 'extra' and extraWork = true in data, with the lines in
-- data.workLines. reg_derive already copies data.firmId into client_id.
--
-- Office roles: reg_snapshot_for (security invoker) builds officeRoles with
--   select role from staff_roles
--   where user_id = auth.uid() and coalesce(company_id, 'us') = '<company>'
-- reg_cj_extra_office() uses that same source, then keeps owner, admin, and ops.
-- It does not read reg_accounts.data.
--
-- cjiv__owner is RESTRICTIVE, so a new permissive policy cannot let admin or ops
-- through. This replaces that policy with the same rule plus one exception:
-- a CJ row with data->>'kind' = 'extra' and data->>'extraWork' = 'true' also
-- passes, for read (USING) and write (WITH CHECK), when reg_cj_extra_office()
-- is true. The client's own invoices and the owner's access are unchanged.
-- A client still cannot write (the original WITH CHECK did not allow that).
--
-- cj__ci_write only allows can_bill (owner, admin, billing) or is_owner().
-- Ops is not in can_bill, so ops still could not insert after the restrictive
-- exception alone. cjiv__extra_office is permissive and matches only extra-work
-- rows. Monthly invoices stay behind cjiv__owner.
--
-- Unchanged: cj__uscrew_nomoney, cjteam__inv, fr__nomoney, fr__nomoney_del,
-- fr__nomoney_ins, fr__nomoney_upd, cj__company_gate.
--
-- reg_snapshot_for does not strip these rows. It is security invoker and loads
--   select data || jsonb_build_object('id', id)
--   from reg_client_invoices
--   where coalesce(company_id, 'us') = v_co
-- Row security decides which invoices each login receives. Confirmed on
-- shift-tracker-staging (ycidjatwzseowwvrtham), not run on the live project.
--
-- Rollback: migrations/cj-extrainv-001-rollback.sql
--   Restores the cjiv__owner text captured from pg_policies on that staging
--   database (same definition as the copy reviewed for this change).

begin;

create or replace function public.reg_cj_extra_office()
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
      and sr.role = any (array['owner', 'admin', 'ops']::public.staff_role[])
  );
$$;

comment on function public.reg_cj_extra_office() is
  'True when staff_roles for this login and company cj includes owner, admin, or ops. Same staff_roles source as reg_snapshot_for officeRoles.';

revoke all on function public.reg_cj_extra_office() from public;
grant execute on function public.reg_cj_extra_office() to postgres, service_role, authenticated;

-- Drop the old draft policies if a previous copy of this file was applied.
drop policy if exists reg_cj_extrainv_select on public.reg_client_invoices;
drop policy if exists reg_cj_extrainv_insert on public.reg_client_invoices;

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
      and (coalesce(data ->> 'kind', '') = 'extra')
      and (coalesce(data ->> 'extraWork', '') = 'true')
      and (select public.reg_cj_extra_office())
    )
  )
  with check (
    (coalesce(company_id, 'us'::text) <> 'cj'::text)
    or (select is_owner() as is_owner)
    or (
      (coalesce(company_id, 'us'::text) = 'cj'::text)
      and (coalesce(data ->> 'kind', '') = 'extra')
      and (coalesce(data ->> 'extraWork', '') = 'true')
      and (select public.reg_cj_extra_office())
    )
  );

-- Ops is not a billing role, so the existing write policies do not let them insert.
-- This policy is permissive and only matches extra-work rows.
drop policy if exists cjiv__extra_office on public.reg_client_invoices;

create policy cjiv__extra_office on public.reg_client_invoices
  as permissive
  for all
  to authenticated
  using (
    (coalesce(company_id, 'us'::text) = 'cj'::text)
    and (coalesce(data ->> 'kind', '') = 'extra')
    and (coalesce(data ->> 'extraWork', '') = 'true')
    and (select public.reg_cj_extra_office())
  )
  with check (
    (coalesce(company_id, 'us'::text) = 'cj'::text)
    and (coalesce(data ->> 'kind', '') = 'extra')
    and (coalesce(data ->> 'extraWork', '') = 'true')
    and (select public.reg_cj_extra_office())
  );

commit;
