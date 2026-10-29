-- cj-sec-002-rollback.sql — DRAFT. DO NOT RUN.
-- Undoes cj-sec-002.sql.
-- Does not change public.reg_snapshot() or public.reg_snapshot_for(text).
-- If the account-blocked return was merged into reg_snapshot_for, restore that
-- function from the migration that last created it BEFORE running this file.
-- The guards below call the helpers this file drops.
-- This file does not edit or delete reg_accounts rows.

begin;

drop trigger if exists cj_sec_signup_gate on auth.users;

do $$
declare
  r record;
begin
  for r in
    select n.nspname as sch, c.relname as rel
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where t.tgname = 'cj_sec_guard_write'
      and not t.tgisinternal
  loop
    execute format('drop trigger if exists cj_sec_guard_write on %I.%I', r.sch, r.rel);
  end loop;
end $$;

drop function if exists public.cj_signup_gate_on_auth_user();
drop function if exists public.cj_guard_writer();
drop function if exists public.cj_may_use_app(text, uuid);
drop function if exists public.cj_email_unconfirmed(uuid);
drop function if exists public.cj_account_is_off(uuid);
drop function if exists public.cj_caller_is_cj(uuid);

drop table if exists public.cj_signup_gate;

commit;
