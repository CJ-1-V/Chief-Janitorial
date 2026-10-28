-- cj-active-001.sql — DRAFT. DO NOT RUN.
-- Chief Janitorial only. Lets the office choose which cleaners may use the CJ app.
-- The allow-list is reg_settings id 'cj-main', data.activeCleaners (a JSON array of account ids).
-- The same key is what the CJ app saves through the existing settings path (not reg_accounts).
--
-- Decision when activeCleaners is missing or is not a JSON array: nobody is active.
-- An empty array means the same thing. Office logins and client logins are not crew, so they
-- can still open People and tick cleaners before any crew is active.
-- Do not treat "missing" as "allow every cleaner": the owner rule is that only a ticked
-- cleaner may sign in, and a first deploy must not leave every cleaner in until someone
-- remembers to save the list.
--
-- UnScramble sign-in is not this file.
--   public.reg_snapshot()           — used by the UnScramble app (register/js/store-supabase.js) — NOT replaced.
--   reg_snapshot_for with p_company other than 'cj' — cj_crew_may_enter returns true immediately.
--   auth sign-in itself is unchanged. A denied CJ crew login still has a password; CJ only
--   withholds the crew snapshot.
--
-- Functions this migration ADDS (safe to create; they do not replace an existing body):
--   public.cj_active_cleaners()          text[]   ids from cj-main, or '{}' if missing / not an array
--   public.cj_crew_is_active(uuid)       boolean  true only when that id is in the list
--   public.cj_account_is_crew(uuid)      boolean  employee or worker, including a US crew row cj_us_crew_kind admits
--   public.cj_crew_may_enter(text, uuid) boolean  non-cj company → true; non-crew → true; else cj_crew_is_active
--
-- Functions this migration CHANGES (bodies are not in this repo — merge the guards below
-- into the current definitions; do not CREATE OR REPLACE from a guess):
--   public.cj_us_crew_kind(uuid)
--       CJ's classifier for an UnScramble crew account. Before it returns a kind, if
--       cj_crew_is_active(p_user) is false, return null so that person is not admitted as CJ crew.
--       This function is not the UnScramble app's sign-in. If a later check shows reg_snapshot()
--       calls it, do not add the null return there — keep the deny only on the CJ path below.
--   public.reg_snapshot_for(p_company text)
--       Only the branch that serves CJ crew (p_company = 'cj' and the caller is an employee,
--       a subcontractor worker, or someone cj_us_crew_kind would admit). When
--       cj_crew_may_enter('cj', auth.uid()) is false, return the small payload below with
--       role 'crew-inactive' (not role 'none' — the app treats 'none' as "no account" and
--       signs them out). Office and client branches are unchanged, so the office can still
--       read and save cj-main settings while every cleaner is inactive.
--
-- The CJ app (js/store-supabase.js) keeps that session and shows:
--   "Your account isn't active in the Chief Janitorial app yet. Please contact the office."
--
-- Rollback: migrations/cj-active-001-rollback.sql
--   Drops only the four functions added here.
--   If you merged the two guards, restore cj_us_crew_kind and reg_snapshot_for from the
--   previous migration before dropping the helpers (the guards call them).

begin;

create or replace function public.cj_active_cleaners()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select coalesce(array_agg(v), array[]::text[])
      from public.reg_settings s,
           lateral jsonb_array_elements_text(s.data->'activeCleaners') as v
      where s.id = 'cj-main'
        and jsonb_typeof(s.data->'activeCleaners') = 'array'
    ),
    array[]::text[]
  );
$$;

comment on function public.cj_active_cleaners() is
  'CJ settings allow-list (reg_settings cj-main data.activeCleaners). Missing or non-array = empty. Not used by UnScramble sign-in.';

create or replace function public.cj_crew_is_active(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user is not null and p_user::text = any (public.cj_active_cleaners());
$$;

comment on function public.cj_crew_is_active(uuid) is
  'True when this account id is ticked in CJ activeCleaners. False when the list is missing.';

-- True for a CJ employee / subcontractor worker, including an UnScramble crew account that
-- cj_us_crew_kind would admit into CJ. A missing or different cj_us_crew_kind signature is ignored.
create or replace function public.cj_account_is_crew(p_user uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  t text;
begin
  if p_user is null then
    return false;
  end if;
  select coalesce(a.data->>'type', '') into t
  from public.reg_accounts a
  where a.id = p_user;
  if t in ('employee', 'worker') then
    return true;
  end if;
  if to_regprocedure('public.cj_us_crew_kind(uuid)') is not null then
    begin
      execute 'select public.cj_us_crew_kind($1)::text' into t using p_user;
      if t is not null and btrim(t) <> '' and t <> 'null' then
        return true;
      end if;
    exception when others then
      return false;
    end;
  end if;
  return false;
end;
$$;

comment on function public.cj_account_is_crew(uuid) is
  'Employee or worker (CJ or UnScramble crew). Office and client accounts are false.';

-- p_company other than cj is always allowed, so the UnScramble app is untouched.
-- Office and client accounts (not crew) are always allowed, including when the list is empty.
create or replace function public.cj_crew_may_enter(p_company text, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_company is distinct from 'cj' then true
    when not public.cj_account_is_crew(p_user) then true
    else public.cj_crew_is_active(p_user)
  end;
$$;

comment on function public.cj_crew_may_enter(text, uuid) is
  'CJ crew gate. UnScramble (any company other than cj) always true. Office and clients always true.';

revoke all on function public.cj_active_cleaners() from public, anon, authenticated;
revoke all on function public.cj_crew_is_active(uuid) from public, anon, authenticated;
revoke all on function public.cj_account_is_crew(uuid) from public, anon, authenticated;
revoke all on function public.cj_crew_may_enter(text, uuid) from public, anon, authenticated;
grant execute on function public.cj_active_cleaners() to postgres;
grant execute on function public.cj_crew_is_active(uuid) to postgres;
grant execute on function public.cj_account_is_crew(uuid) to postgres;
grant execute on function public.cj_crew_may_enter(text, uuid) to postgres;

-- ---------------------------------------------------------------------------
-- MERGE INTO THE CURRENT BODIES. Do not run this section as-is.
-- Paste it into the live definitions of the two functions named below.
-- ---------------------------------------------------------------------------
--
-- 1) public.cj_us_crew_kind(p_user uuid)
--    Immediately before every RETURN that would admit this person as CJ crew:
--
--      if not public.cj_crew_is_active(p_user) then
--        return null;
--      end if;
--
--    Leave the rest of the function as it is. Do not change public.reg_snapshot().
--
-- 2) public.reg_snapshot_for(p_company text)
--    At the start of the crew path (after the office and client branches, and on the
--    branch that uses cj_us_crew_kind to let an UnScramble employee or worker in),
--    before any crew rows are assembled:
--
--      if p_company = 'cj'
--         and not public.cj_crew_may_enter(p_company, auth.uid()) then
--        return jsonb_build_object(
--          'role', 'crew-inactive',
--          'me', auth.uid(),
--          'kind', coalesce((select data->>'type' from public.reg_accounts where id = auth.uid()), 'employee'),
--          'name', coalesce((select data->>'name' from public.reg_accounts where id = auth.uid()), 'Cleaner'),
--          'username', coalesce((select data->>'username' from public.reg_accounts where id = auth.uid()), ''),
--          'email', coalesce((select data->>'email' from public.reg_accounts where id = auth.uid()), ''),
--          'usCrew', coalesce((select data->>'companyId' from public.reg_accounts where id = auth.uid()) = 'us', false),
--          'companyId', coalesce((select data->>'companyId' from public.reg_accounts where id = auth.uid()), ''),
--          'settings', coalesce((select data from public.reg_settings where id = 'cj-main'), '{}'::jsonb),
--          'users', '[]'::jsonb
--        );
--      end if;
--
--    Do not return role 'none' for this case.
--    Do not add this block when p_company is null or 'us'.
--    Do not add it on the office branch or the client (firm) branch.

commit;
