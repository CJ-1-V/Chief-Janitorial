-- cj-sec-002.sql — DRAFT. DO NOT RUN.
-- Do not apply this file to the live database. Do not run it in the Supabase SQL editor.
-- It does not change existing rows. It adds Chief Janitorial checks only.
--
-- What it is for
--   1. A switched-off or inactive Chief Janitorial account cannot load the app or write rows,
--      even if the browser still has a password session. The sign-in form check is not enough.
--   2. A new Chief Janitorial self sign-up cannot use the app until the login email is confirmed.
--
-- UnScramble is not this file.
--   public.reg_snapshot() is not replaced.
--   cj_may_use_app returns true as soon as p_company is anything other than 'cj'.
--   The write guard returns without raising when the signed-in user is not a CJ account
--   (auth metadata company/app, or reg_accounts companyId / company_id, is not 'cj').
--   An UnScramble row (company us) is never a CJ caller, so this file does not block it.
--
-- Email confirmation
--   New CJ self sign-ups (auth metadata company or app = 'cj', and not an office-made account)
--   get a row in public.cj_signup_gate.
--   Office-made accounts are exempt: metadata reg_office = '1' or added_by_office set.
--   The gate stays shut while that row says email_confirmed = false AND
--   auth.users.email_confirmed_at is null.
--   Existing accounts have no gate row, so they are not asked to confirm.
--   This file cannot turn on Supabase "Confirm email" by itself. Until that Auth setting
--   is on, GoTrue stamps email_confirmed_at at sign-up and this email check does not trip.
--   Turn Confirm email on for the project before relying on the email half of this draft.
--   The mock app (?store=mock) already holds a new sign-up on a confirm screen without that setting.
--
-- Sign-in
--   Supabase Auth still checks the password. This draft does not delete passwords.
--   After a correct password, reg_snapshot_for('cj') must return the small payload in the
--   merge notes below (role account-blocked) instead of the app data. The write triggers
--   refuse later saves from that same session.
--
-- Rollback: migrations/cj-sec-002-rollback.sql

begin;

create table if not exists public.cj_signup_gate (
  user_id uuid primary key,
  email_confirmed boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.cj_signup_gate is
  'CJ self sign-ups waiting for email confirmation. No row means an older account (not gated). Not used by UnScramble.';

alter table public.cj_signup_gate enable row level security;
revoke all on table public.cj_signup_gate from public, anon, authenticated;

-- True only for a Chief Janitorial account. UnScramble (company us, or no CJ mark) is false.
create or replace function public.cj_caller_is_cj(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user is not null and (
    exists (
      select 1
      from public.reg_accounts a
      where a.id = p_user
        and coalesce(a.data->>'companyId', a.data->>'company_id', '') = 'cj'
    )
    or exists (
      select 1
      from auth.users u
      where u.id = p_user
        and coalesce(u.raw_user_meta_data->>'company', u.raw_user_meta_data->>'app', '') = 'cj'
    )
  );
$$;

comment on function public.cj_caller_is_cj(uuid) is
  'True when this login is marked Chief Janitorial. UnScramble accounts stay false.';

-- Switched off, inactive, on hold, or removed. Reads reg_accounts.data only.
create or replace function public.cj_account_is_off(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user is not null and exists (
    select 1
    from public.reg_accounts a
    where a.id = p_user
      and (
        lower(coalesce(a.data->>'active', '')) in ('false', '0')
        or lower(replace(replace(coalesce(a.data->>'status', ''), '_', '-'), ' ', '-')) in ('inactive', 'switched-off', 'suspended')
        or lower(coalesce(a.data->>'suspended', '')) in ('true', '1')
        or lower(coalesce(a.data->>'removed', '')) in ('true', '1')
      )
  );
$$;

comment on function public.cj_account_is_off(uuid) is
  'True when the CJ account is switched off, inactive, on hold, or removed.';

-- New CJ self sign-up whose email is not confirmed yet. No gate row = not waiting.
create or replace function public.cj_email_unconfirmed(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user is not null and exists (
    select 1
    from public.cj_signup_gate g
    join auth.users u on u.id = g.user_id
    where g.user_id = p_user
      and g.email_confirmed = false
      and u.email_confirmed_at is null
  );
$$;

comment on function public.cj_email_unconfirmed(uuid) is
  'True when a new CJ self sign-up has not confirmed its email. Older accounts (no gate row) are false.';

-- p_company other than cj is always allowed, so the UnScramble app is untouched.
-- A caller who is not a CJ account is always allowed, including when p_company is cj.
create or replace function public.cj_may_use_app(p_company text, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_company is distinct from 'cj' then true
    when p_user is null then false
    when not public.cj_caller_is_cj(p_user) then true
    when public.cj_account_is_off(p_user) then false
    when public.cj_email_unconfirmed(p_user) then false
    else true
  end;
$$;

comment on function public.cj_may_use_app(text, uuid) is
  'CJ use gate. Any company other than cj is true. UnScramble callers are true. Off or unconfirmed CJ accounts are false.';

create or replace function public.cj_guard_writer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and public.cj_caller_is_cj(auth.uid())
     and not public.cj_may_use_app('cj', auth.uid()) then
    raise exception 'This Chief Janitorial account is switched off, inactive, or waiting for email confirmation'
      using errcode = '42501';
  end if;
  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

comment on function public.cj_guard_writer() is
  'Refuses writes from a CJ account that cj_may_use_app would turn away. UnScramble sessions pass through.';

create or replace function public.cj_signup_gate_on_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_cj boolean;
  is_office boolean;
begin
  is_cj := coalesce(NEW.raw_user_meta_data->>'company', NEW.raw_user_meta_data->>'app', '') = 'cj';
  is_office := coalesce(NEW.raw_user_meta_data->>'reg_office', '') = '1'
    or nullif(coalesce(NEW.raw_user_meta_data->>'added_by_office', ''), '') is not null;
  if TG_OP = 'INSERT' and is_cj and not is_office then
    insert into public.cj_signup_gate (user_id, email_confirmed)
    values (NEW.id, NEW.email_confirmed_at is not null)
    on conflict (user_id) do nothing;
  elsif TG_OP = 'UPDATE'
    and NEW.email_confirmed_at is not null
    and OLD.email_confirmed_at is null then
    update public.cj_signup_gate
       set email_confirmed = true
     where user_id = NEW.id;
  end if;
  return NEW;
end;
$$;

comment on function public.cj_signup_gate_on_auth_user() is
  'Records a new CJ self sign-up. Office-made accounts and UnScramble sign-ups are skipped.';

revoke all on function public.cj_caller_is_cj(uuid) from public, anon, authenticated;
revoke all on function public.cj_account_is_off(uuid) from public, anon, authenticated;
revoke all on function public.cj_email_unconfirmed(uuid) from public, anon, authenticated;
revoke all on function public.cj_may_use_app(text, uuid) from public, anon, authenticated;
revoke all on function public.cj_guard_writer() from public, anon, authenticated;
revoke all on function public.cj_signup_gate_on_auth_user() from public, anon, authenticated;
grant execute on function public.cj_caller_is_cj(uuid) to postgres;
grant execute on function public.cj_account_is_off(uuid) to postgres;
grant execute on function public.cj_email_unconfirmed(uuid) to postgres;
grant execute on function public.cj_may_use_app(text, uuid) to postgres;
grant execute on function public.cj_guard_writer() to postgres;
grant execute on function public.cj_signup_gate_on_auth_user() to postgres;

-- Attach the write guard only where the table already exists. Skips anything this project does not have.
do $$
declare
  t text;
begin
  foreach t in array array[
    'reg_accounts',
    'reg_documents',
    'reg_time_entries',
    'reg_audit',
    'reg_alerts_outbox',
    'reg_cleaning_requests',
    'reg_special_jobs',
    'reg_client_invoices',
    'reg_client_sites',
    'reg_bookings',
    'reg_login_history',
    'reg_settings'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists cj_sec_guard_write on public.%I', t);
      execute format(
        'create trigger cj_sec_guard_write before insert or update or delete on public.%I for each row execute function public.cj_guard_writer()',
        t
      );
    end if;
  end loop;
end $$;

drop trigger if exists cj_sec_signup_gate on auth.users;
create trigger cj_sec_signup_gate
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.cj_signup_gate_on_auth_user();

-- ---------------------------------------------------------------------------
-- MERGE INTO THE CURRENT BODY. Do not run this section as-is.
-- Paste it into public.reg_snapshot_for(p_company text) only.
-- Do not add it to public.reg_snapshot() (that is the UnScramble read).
-- Place it after the role is known and before any CJ crew or office rows are built,
-- and only when p_company = 'cj'.
-- ---------------------------------------------------------------------------
--
--   if p_company = 'cj'
--      and not public.cj_may_use_app(p_company, auth.uid()) then
--     return jsonb_build_object(
--       'role', 'account-blocked',
--       'reason', case
--         when public.cj_email_unconfirmed(auth.uid()) then 'email'
--         else 'off'
--       end,
--       'me', auth.uid()
--     );
--   end if;
--
-- The CJ app (js/store-supabase.js) signs that session out and shows:
--   reason 'email' -> confirm your email, then sign in
--   reason 'off'   -> this account is switched off or inactive
-- Do not return role 'none' for this case (the app treats 'none' as "no account"
-- and the wording would be wrong).
-- Do not add this block when p_company is null or 'us'.

commit;
