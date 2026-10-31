-- cj-site-invite-001-rollback.sql — DRAFT. DO NOT RUN.
-- Undoes cj-site-invite-001.sql.
-- Drops the lookup function and the invite table. Does not change reg_settings
-- or the active-cleaner allow-list. Does not touch UnScramble.

begin;

drop function if exists public.cj_lookup_site_join(text);
drop table if exists public.cj_site_invites;

commit;
