-- 028b_typical_hours_seed.sql — PROPOSED, NOT APPLIED.
-- Run only after 028b_site_visit_hours.sql, and only with the owner's OK
-- and a ping to US IT Bot (shared Supabase project).
--
-- Owner-approved typical hours per visit, stored as typical_hours.
-- Reference values only. min_hours and max_hours are left NULL
-- (the owner has not set ranges). SDT114 is unknown, so typical_hours is NULL.
-- Does not insert sites. A code that is not already on a CJ row is skipped.

begin;

update public.reg_client_sites as s
set typical_hours = v.hrs
from (values
  ('CPM105', 4::numeric),
  ('CPS106', 4::numeric),
  ('CPK107', 1.5::numeric),
  ('SLF108', 1.5::numeric),
  ('TDU102', 1.5::numeric),
  ('CBS101', 3.5::numeric),
  ('SDS111', 4::numeric),
  ('TDS103', 1::numeric),
  ('TDQ104', 3::numeric),
  ('CAL109', 1::numeric),
  ('CAS116', 2::numeric),
  ('CHB117', 2::numeric),
  ('SDC110', 4::numeric),
  ('KHH112', 5::numeric),
  ('GOI113', 3::numeric),
  ('CIB115', 1.5::numeric),
  ('CIB119', 1.5::numeric),
  ('CIB120', 1.5::numeric),
  ('SDT114', null::numeric)
) as v(code, hrs)
where s.company_id = 'cj'
  and s.data->>'code' = v.code;

commit;
