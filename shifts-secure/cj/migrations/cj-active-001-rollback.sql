-- cj-active-001-rollback.sql — DRAFT. DO NOT RUN.
-- Undoes the helpers added by cj-active-001.sql.
--
-- If the guards were merged into these two functions, restore their previous
-- definitions FIRST (from the migration that last created them), then run this file.
-- This file does not contain those bodies, and it does not touch them:
--   public.cj_us_crew_kind(uuid)
--   public.reg_snapshot_for(text)
-- public.reg_snapshot() (UnScramble sign-in) was never changed.
-- The activeCleaners key left inside reg_settings 'cj-main' is ignored once the
-- guards are gone. This file does not delete that key.

begin;

drop function if exists public.cj_crew_may_enter(text, uuid);
drop function if exists public.cj_account_is_crew(uuid);
drop function if exists public.cj_crew_is_active(uuid);
drop function if exists public.cj_active_cleaners();

commit;
