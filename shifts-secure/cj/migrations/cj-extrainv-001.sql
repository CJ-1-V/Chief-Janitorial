-- cj-extrainv-001.sql — DRAFT. DO NOT RUN.
-- Extra work invoices for Chief Janitorial (company_id 'cj').
--
-- Investigation (no live database calls):
--   reg_client_invoices already stores each invoice as jsonb in data, plus id and company_id.
--   The app's save sends only those columns when the invoice does not set siteLines, extraLines,
--   specialLines, month, or hstOn (store-supabase.js typed()). Past invoices already insert that way.
--   Invoice numbers are chosen in the app (CJ-YYYY-NNN). There is no separate number sequence to add.
--   So an extra-work invoice needs NO new table and NO new column. The app stores:
--     data.kind = 'extra', data.extraWork = true, data.workLines = [{desc, amount}, ...],
--     data.workDate, data.note, data.site, data.amount, data.hst, data.total, and the usual
--     firmId / number / issued / due fields.
--
-- What still needs a database change:
--   cj-invowner-005 lets only the owner (and that client) read CJ client invoices, and only the
--   owner create them. This request also allows office admin and ops to create an extra-work
--   invoice and see it on the office list. Monthly invoices stay owner-only.
--   store-supabase.js loads invoices through reg_snapshot_for, which is filtered by row-level
--   security. A new SELECT policy is enough for that snapshot IF the function does not also
--   strip every non-owner invoice in its own body. If cj-invowner-005's copy of reg_snapshot_for
--   drops all client invoices unless the caller is the owner, update that filter so a row with
--   data->>'kind' = 'extra' is still returned when reg_cj_extra_office() is true, and is still
--   returned to the client it is billed to. Do not return monthly invoices to admin or ops.
--
-- Align reg_cj_extra_office() with the real account columns from cj-invowner-005 before running.
-- This draft assumes office roles are on reg_accounts.data (officeRoles / officeRole) and the
-- account's company is company_id or data.companyId. Confirm that, then run. Do not run this file
-- as part of app deploy.

begin;

create or replace function public.reg_cj_extra_office()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  rec public.reg_accounts%rowtype;
  roles jsonb;
begin
  select * into rec from public.reg_accounts where id = auth.uid();
  if not found then return false; end if;
  if coalesce(rec.company_id, '') <> 'cj' and coalesce(rec.data->>'companyId', '') <> 'cj' then
    return false;
  end if;
  roles := coalesce(rec.data->'officeRoles', '[]'::jsonb);
  if jsonb_typeof(roles) = 'array' and (roles ?| array['owner', 'admin', 'ops']) then
    return true;
  end if;
  if coalesce(rec.data->>'officeRole', '') in ('owner', 'admin', 'ops') then
    return true;
  end if;
  return false;
end;
$$;

comment on function public.reg_cj_extra_office() is
  'True for a CJ office login whose roles include owner, admin, or ops. Draft for extra-work invoices only.';

revoke all on function public.reg_cj_extra_office() from public;
grant execute on function public.reg_cj_extra_office() to authenticated;

-- Additive policies. They do not replace the owner-only policies, so monthly invoices stay as they are.
-- Insert is limited to kind = extra so admin/ops cannot write a monthly invoice through this policy.

drop policy if exists reg_cj_extrainv_select on public.reg_client_invoices;
create policy reg_cj_extrainv_select on public.reg_client_invoices
  for select to authenticated
  using (
    company_id = 'cj'
    and coalesce(data->>'kind', '') = 'extra'
    and public.reg_cj_extra_office()
  );

drop policy if exists reg_cj_extrainv_insert on public.reg_client_invoices;
create policy reg_cj_extrainv_insert on public.reg_client_invoices
  for insert to authenticated
  with check (
    company_id = 'cj'
    and coalesce(data->>'kind', '') = 'extra'
    and coalesce(data->>'extraWork', '') = 'true'
    and public.reg_cj_extra_office()
  );

commit;
