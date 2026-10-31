-- cj-sec-002.sql — DRAFT. DO NOT RUN.
-- Do not apply this file to the live database. Do not run it in the Supabase SQL editor.
-- It does not change existing rows. It adds Chief Janitorial checks only.
--
-- What it is for
--   1. A switched-off or inactive Chief Janitorial account cannot load the app or write rows,
--      even if the browser still has a password session. The sign-in form check is not enough.
--   2. A new Chief Janitorial self sign-up cannot use the app until a CJ 6-digit code matches.
--
-- Supabase "Confirm email" stays OFF.
--   That project switch is shared with UnScramble. This draft does not turn it on, does not
--   read the Auth email-confirmed stamp, and does not need it. CJ confirmation is the code
--   in public.cj_email_code only.
--
-- UnScramble is not this file.
--   public.reg_snapshot() is not replaced.
--   cj_may_use_app returns true as soon as p_company is anything other than 'cj'.
--   The write guard returns without raising when the signed-in user is not a CJ account
--   (auth metadata company/app, or reg_accounts companyId / company_id, is not 'cj').
--   cj_email_code.company must be 'cj'. An UnScramble sign-up never gets a row.
--
-- Email code (company cj new self sign-ups only)
--   Call public.cj_email_code_issue(user id, email) from the database owner (not the browser).
--   It stores a SHA-256 hash, a 15-minute expiry, and an attempt count. It returns the
--   6 digits once. The table never stores those digits.
--   Office-made accounts (metadata reg_office = '1' or added_by_office) are skipped.
--   A caller who is not company cj is skipped. Nothing is inserted.
--   The signed-in person submits the code with public.cj_email_code_check(text).
--   Five wrong tries, or a code past its expiry, does not confirm the row.
--   A match sets confirmed_at. Older accounts have no row, so they are not asked.
--
-- TODO(cj-email-code): send the 6 digits returned by cj_email_code_issue.
--   Not wired. This file does not send email, does not call an edge function, and does
--   not insert into a mail queue. Do not log the code.
--
-- Sign-in
--   Supabase Auth still checks the password. This draft does not delete passwords.
--   After a correct password, reg_snapshot_for('cj') must return the small payload in the
--   merge notes below (role account-blocked) instead of the app data. The write triggers
--   refuse later saves from that same session.
--
-- Rollback: migrations/cj-sec-002-rollback.sql

begin;

create table if not exists public.cj_email_code (
  user_id uuid primary key,
  company text not null default 'cj',
  email text not null default '',
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint cj_email_code_company_cj check (company = 'cj'),
  constraint cj_email_code_attempts_nonneg check (attempts >= 0 and max_attempts > 0)
);

comment on table public.cj_email_code is
  'CJ-only 6-digit email code. Stores a hash, expiry, and attempt count. Not used by UnScramble. Supabase Confirm email stays off.';

alter table public.cj_email_code enable row level security;
revoke all on table public.cj_email_code from public, anon, authenticated;

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

-- SHA-256 of the 6 digits. pgcrypto lives in extensions on Supabase. Not run from this repo.
create or replace function public.cj_email_code_hash(p_code text)
returns text
language sql
immutable
security definer
set search_path = public, extensions
as $$
  select encode(digest(convert_to(btrim(coalesce(p_code, '')), 'utf8'), 'sha256'), 'hex');
$$;

comment on function public.cj_email_code_hash(text) is
  'Hash of a CJ email code. The table stores this, never the 6 digits.';

-- Creates or replaces the pending code for a new CJ self sign-up.
-- Returns the 6 digits once, for the TODO sender. Returns null when this person is not a CJ self sign-up.
-- Does not send email.
create or replace function public.cj_email_code_issue(p_user uuid, p_email text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  is_office boolean;
  code text;
begin
  if p_user is null or not public.cj_caller_is_cj(p_user) then
    return null;
  end if;
  select coalesce(u.raw_user_meta_data->>'reg_office', '') = '1'
      or nullif(coalesce(u.raw_user_meta_data->>'added_by_office', ''), '') is not null
    into is_office
  from auth.users u
  where u.id = p_user;
  if coalesce(is_office, false) then
    return null;
  end if;
  code := lpad((floor(random() * 900000) + 100000)::int::text, 6, '0');
  insert into public.cj_email_code (user_id, company, email, code_hash, expires_at, attempts, max_attempts, confirmed_at)
  values (
    p_user,
    'cj',
    lower(btrim(coalesce(p_email, ''))),
    public.cj_email_code_hash(code),
    now() + interval '15 minutes',
    0,
    5,
    null
  )
  on conflict (user_id) do update
    set company = 'cj',
        email = excluded.email,
        code_hash = excluded.code_hash,
        expires_at = excluded.expires_at,
        attempts = 0,
        max_attempts = 5,
        confirmed_at = null;
  -- TODO(cj-email-code): email `code` to p_email. Not wired. Do not log `code`.
  return code;
end;
$$;

comment on function public.cj_email_code_issue(uuid, text) is
  'Stores a hashed CJ email code (15 minutes, 5 tries). Returns the digits once. Does not send email. Company cj self sign-ups only.';

-- Signed-in person submits the 6 digits. A match sets confirmed_at.
-- Wrong code increments attempts. At max_attempts, or after expires_at, it does not confirm.
-- Anyone who is not a CJ account is ignored (ok, skipped) so UnScramble is untouched.
create or replace function public.cj_email_code_check(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
  row public.cj_email_code%rowtype;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed-out');
  end if;
  if not public.cj_caller_is_cj(uid) then
    return jsonb_build_object('ok', true, 'skipped', true, 'reason', 'not-cj');
  end if;
  select * into row from public.cj_email_code c where c.user_id = uid and c.company = 'cj';
  if not found then
    return jsonb_build_object('ok', true, 'skipped', true, 'reason', 'no-code');
  end if;
  if row.confirmed_at is not null then
    return jsonb_build_object('ok', true, 'reason', 'already');
  end if;
  if row.attempts >= row.max_attempts then
    return jsonb_build_object('ok', false, 'reason', 'locked');
  end if;
  if now() > row.expires_at then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;
  if public.cj_email_code_hash(p_code) = row.code_hash and btrim(coalesce(p_code, '')) ~ '^[0-9]{6}$' then
    update public.cj_email_code
       set confirmed_at = now()
     where user_id = uid and company = 'cj';
    return jsonb_build_object('ok', true, 'reason', 'matched');
  end if;
  update public.cj_email_code
     set attempts = attempts + 1
   where user_id = uid and company = 'cj';
  if row.attempts + 1 >= row.max_attempts then
    return jsonb_build_object('ok', false, 'reason', 'locked');
  end if;
  return jsonb_build_object('ok', false, 'reason', 'wrong');
end;
$$;

comment on function public.cj_email_code_check(text) is
  'Checks the signed-in CJ user''s 6-digit code. Sets confirmed_at on match. Enforces expiry and the attempt limit.';

-- New CJ self sign-up whose code is not confirmed yet. No row = not waiting.
-- Does not look at the Auth email-confirmed stamp.
create or replace function public.cj_email_unconfirmed(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user is not null and exists (
    select 1
    from public.cj_email_code c
    where c.user_id = p_user
      and c.company = 'cj'
      and c.confirmed_at is null
  );
$$;

comment on function public.cj_email_unconfirmed(uuid) is
  'True when a CJ email-code row is still open. Older accounts and UnScramble accounts (no row) are false.';

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
    raise exception 'This Chief Janitorial account is switched off, inactive, or waiting for the email code'
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

revoke all on function public.cj_caller_is_cj(uuid) from public, anon, authenticated;
revoke all on function public.cj_account_is_off(uuid) from public, anon, authenticated;
revoke all on function public.cj_email_code_hash(text) from public, anon, authenticated;
revoke all on function public.cj_email_code_issue(uuid, text) from public, anon, authenticated;
revoke all on function public.cj_email_code_check(text) from public, anon;
revoke all on function public.cj_email_unconfirmed(uuid) from public, anon, authenticated;
revoke all on function public.cj_may_use_app(text, uuid) from public, anon, authenticated;
revoke all on function public.cj_guard_writer() from public, anon, authenticated;

grant execute on function public.cj_caller_is_cj(uuid) to postgres;
grant execute on function public.cj_account_is_off(uuid) to postgres;
grant execute on function public.cj_email_code_hash(text) to postgres;
grant execute on function public.cj_email_code_issue(uuid, text) to postgres;
grant execute on function public.cj_email_code_check(text) to postgres, authenticated;
grant execute on function public.cj_email_unconfirmed(uuid) to postgres;
grant execute on function public.cj_may_use_app(text, uuid) to postgres;
grant execute on function public.cj_guard_writer() to postgres;

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
--   reason 'email' -> enter the 6-digit CJ code (email sending is not wired yet)
--   reason 'off'   -> this account is switched off or inactive
-- Do not return role 'none' for this case (the app treats 'none' as "no account"
-- and the wording would be wrong).
-- Do not add this block when p_company is null or 'us'.

commit;
