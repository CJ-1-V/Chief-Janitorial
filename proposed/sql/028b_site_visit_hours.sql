-- 028b_site_visit_hours.sql — PROPOSED, NOT APPLIED.
-- Do not run this file. It needs the owner's OK, then a ping to US IT Bot
-- (Chief Janitorial and UnScramble share one Supabase project).
-- Merging the app pull request deploys the website on GitHub Pages.
-- This file does not run on that deploy.
--
-- Site table: public.reg_client_sites (the table the CJ app saves as "sites").
-- Adds nullable columns:
--   min_hours, max_hours  — owner-set range per visit. NULL means no limit.
--   typical_hours         — reference only (028b_typical_hours_seed.sql). Not a limit.
-- A clocked visit outside min/max is only flagged. Clock in and clock out are
-- not blocked, and the stored in/out times are not rewritten.
--
-- The app keeps minHours / maxHours / typicalHours inside the data JSON so the
-- screen works before this file is applied. The app does not send these
-- columns on save until they exist: an unknown column would fail the whole
-- site save. This file does not replace reg_snapshot_for.
-- Next free number after 028a (that file is on cursor/cj-bugsweep1, not applied here).

begin;

alter table public.reg_client_sites
  add column if not exists min_hours numeric,
  add column if not exists max_hours numeric,
  add column if not exists typical_hours numeric;

comment on column public.reg_client_sites.min_hours is
  'Optional minimum hours per visit. NULL = no minimum. Flag only; never blocks or edits a clock.';
comment on column public.reg_client_sites.max_hours is
  'Optional maximum hours per visit. NULL = no maximum. Flag only; never blocks or edits a clock.';
comment on column public.reg_client_sites.typical_hours is
  'Owner-approved typical hours per visit. Reference only, not a min or max. NULL = not set.';

-- Copy limits already saved in the site JSON. Leave NULL when the key is absent.
update public.reg_client_sites
set min_hours = (data->>'minHours')::numeric
where min_hours is null
  and coalesce(data->>'minHours', '') ~ '^[0-9]+(\.[0-9]+)?$';

update public.reg_client_sites
set max_hours = (data->>'maxHours')::numeric
where max_hours is null
  and coalesce(data->>'maxHours', '') ~ '^[0-9]+(\.[0-9]+)?$';

commit;
