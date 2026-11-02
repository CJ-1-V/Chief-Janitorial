-- 028b rollback — PROPOSED, NOT APPLIED.
-- Drops min_hours, max_hours, and typical_hours from public.reg_client_sites.
-- Does not change the data JSON (minHours / maxHours / typicalHours keys stay).

begin;

alter table public.reg_client_sites
  drop column if exists min_hours,
  drop column if exists max_hours,
  drop column if exists typical_hours;

commit;
