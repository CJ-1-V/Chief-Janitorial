-- 027i_twostep.sql – PROPOSED, NOT RUN (DB hold). twostep1, Oct 23 2026. Run AFTER 027f, 027g, 027h.
-- 2-step sign-in: after the password, a 6-digit code by email (admin@unscramble.ca) via Edge Function reg-messages, text as fallback.
-- Required: office staff (profiles.is_staff – owner, office, billing, Office Assistant) and farm logins (reg_accounts.kind = 'firm').
-- Optional (off by default): employees, workers, subcontractors – they can switch it on in Profile.
-- Code: hash only, 10 minutes, 5 wrong tries, 60 s resend cooldown, max 5 codes per hour. Trusted device: 30 days, hash only.
-- Codes/devices are written ONLY by the Edge Function with the service role (the browser cannot write a code or mark itself verified).
begin;

create table if not exists public.reg_mfa_codes (
  user_id uuid primary key, code_hash text not null check (code_hash ~ '^[0-9a-f]{64}$'), via text not null default 'email',
  tries int not null default 0, sends int not null default 1, window_start timestamptz not null default now(),
  last_sent_at timestamptz not null default now(), expires_at timestamptz not null);
create table if not exists public.reg_mfa_sessions (
  session_id uuid primary key, user_id uuid not null, how text not null, verified_at timestamptz not null default now());
create index if not exists reg_mfa_sessions_u on public.reg_mfa_sessions(user_id, verified_at desc);
create table if not exists public.reg_mfa_devices (
  id bigserial primary key, user_id uuid not null, device_hash text not null check (device_hash ~ '^[0-9a-f]{64}$'),
  label text, created_at timestamptz not null default now(), last_used_at timestamptz, expires_at timestamptz not null,
  unique (user_id, device_hash));
alter table public.reg_mfa_codes enable row level security;     -- no policies: only security-definer functions touch these
alter table public.reg_mfa_sessions enable row level security;
alter table public.reg_mfa_devices enable row level security;
revoke all on public.reg_mfa_codes, public.reg_mfa_sessions, public.reg_mfa_devices from anon, authenticated;

-- send log: allow the new kind
alter table public.reg_msg_log drop constraint if exists reg_msg_log_kind_check;
alter table public.reg_msg_log add constraint reg_msg_log_kind_check check (kind in ('reset_code','office_invite','farm_invite','sub_invite','mfa_code'));

-- who must use it
create or replace function public.reg_mfa_required_for(p_user uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_staff from profiles where id = p_user), false)
      or exists (select 1 from reg_accounts where id = p_user and kind = 'firm' and active)
      or exists (select 1 from reg_accounts where id = p_user and coalesce((data->>'twoStep')::boolean, false)); $$;

-- the signed-in person's own status (browser and Edge Function, as that user)
create or replace function public.reg_mfa_status() returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare u uuid := auth.uid(); sid uuid := nullif(auth.jwt()->>'session_id','')::uuid; em text; ph text; nm text; k text;
begin
  if u is null then raise exception 'Please sign in.'; end if;
  select a.kind, nullif(btrim(a.data->>'email'),''), nullif(btrim(a.data->>'phone'),''), a.data->>'name' into k, em, ph, nm from reg_accounts a where a.id = u;
  if k is null then select 'staff', null, p.phone, p.full_name into k, em, ph, nm from profiles p where p.id = u; end if;
  if em is null then select nullif(email,'') into em from auth.users where id = u; end if;
  if em ilike '%@example.com' then em := null; end if;                    -- phone logins use a stand-in address that cannot get mail
  return jsonb_build_object('user_id', u, 'session_id', sid, 'kind', k, 'name', nm, 'email', em, 'phone', ph,
    'required', reg_mfa_required_for(u), 'optional_on', exists (select 1 from reg_accounts where id = u and coalesce((data->>'twoStep')::boolean,false)),
    'verified', sid is not null and exists (select 1 from reg_mfa_sessions s where s.session_id = sid and s.user_id = u),
    'devices', (select count(*) from reg_mfa_devices d where d.user_id = u and d.expires_at > now()));
end $$;

-- for later RLS hardening (phase 2): true when this session passed 2-step or the person does not need it
create or replace function public.reg_mfa_ok() returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (not reg_mfa_required_for(auth.uid())
    or exists (select 1 from reg_mfa_sessions s where s.user_id = auth.uid() and s.session_id = nullif(auth.jwt()->>'session_id','')::uuid)); $$;

-- service role only (Edge Function) ----------------------------------------------------------
create or replace function public.reg_mfa_code_put(p_user uuid, p_hash text, p_via text) returns text language plpgsql security definer set search_path = public as $$
declare r reg_mfa_codes;
begin
  select * into r from reg_mfa_codes where user_id = p_user for update;
  if found and r.last_sent_at > now() - interval '60 seconds' then return 'wait:' || ceil(extract(epoch from (r.last_sent_at + interval '60 seconds' - now())))::int; end if;
  if found and r.window_start > now() - interval '1 hour' and r.sends >= 5 then return 'limit'; end if;
  insert into reg_mfa_codes as c (user_id, code_hash, via, tries, sends, window_start, last_sent_at, expires_at)
  values (p_user, p_hash, coalesce(p_via,'email'), 0, 1, now(), now(), now() + interval '10 minutes')
  on conflict (user_id) do update set code_hash = excluded.code_hash, via = excluded.via, tries = 0, last_sent_at = now(), expires_at = excluded.expires_at,
    sends = case when c.window_start > now() - interval '1 hour' then c.sends + 1 else 1 end,
    window_start = case when c.window_start > now() - interval '1 hour' then c.window_start else now() end;
  return 'ok';
end $$;

create or replace function public.reg_mfa_code_use(p_user uuid, p_session uuid, p_hash text, p_trust_hash text default null, p_label text default null)
returns text language plpgsql security definer set search_path = public as $$
declare r reg_mfa_codes;
begin
  if p_session is null then return 'nosession'; end if;
  select * into r from reg_mfa_codes where user_id = p_user for update;
  if not found then return 'expired'; end if;
  if r.expires_at < now() then delete from reg_mfa_codes where user_id = p_user; return 'expired'; end if;
  if r.tries >= 5 then return 'locked'; end if;
  if r.code_hash <> p_hash then
    update reg_mfa_codes set tries = tries + 1 where user_id = p_user;
    return case when r.tries + 1 >= 5 then 'locked' else 'wrong:' || (5 - r.tries - 1) end;
  end if;
  delete from reg_mfa_codes where user_id = p_user;
  insert into reg_mfa_sessions(session_id, user_id, how) values (p_session, p_user, 'code') on conflict (session_id) do update set verified_at = now(), how = 'code';
  if p_trust_hash ~ '^[0-9a-f]{64}$' then
    insert into reg_mfa_devices(user_id, device_hash, label, expires_at, last_used_at) values (p_user, p_trust_hash, left(p_label,60), now() + interval '30 days', now())
    on conflict (user_id, device_hash) do update set expires_at = now() + interval '30 days', last_used_at = now();
  end if;
  delete from reg_mfa_sessions where verified_at < now() - interval '45 days';
  return 'ok';
end $$;

create or replace function public.reg_mfa_trust_use(p_user uuid, p_session uuid, p_hash text) returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_session is null or p_hash !~ '^[0-9a-f]{64}$' then return false; end if;
  update reg_mfa_devices set last_used_at = now() where user_id = p_user and device_hash = p_hash and expires_at > now();
  if not found then return false; end if;
  insert into reg_mfa_sessions(session_id, user_id, how) values (p_session, p_user, 'trusted device') on conflict (session_id) do nothing;
  return true;
end $$;

-- the person (browser) ----------------------------------------------------------------------
create or replace function public.reg_mfa_set_optional(p_on boolean) returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from reg_accounts where id = auth.uid() and kind in ('employee','worker','sub')) then raise exception 'Not available for this account.'; end if;
  update reg_accounts set data = data || jsonb_build_object('twoStep', coalesce(p_on,false)), updated_at = now() where id = auth.uid();
  return coalesce(p_on,false);
end $$;
create or replace function public.reg_mfa_forget_devices() returns int language plpgsql security definer set search_path = public as $$
declare n int; begin delete from reg_mfa_devices where user_id = auth.uid(); get diagnostics n = row_count; return n; end $$;

revoke all on function public.reg_mfa_required_for(uuid), public.reg_mfa_code_put(uuid,text,text), public.reg_mfa_code_use(uuid,uuid,text,text,text),
  public.reg_mfa_trust_use(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.reg_mfa_code_put(uuid,text,text), public.reg_mfa_code_use(uuid,uuid,text,text,text), public.reg_mfa_trust_use(uuid,uuid,text),
  public.reg_mfa_required_for(uuid) to service_role;
revoke all on function public.reg_mfa_status(), public.reg_mfa_ok(), public.reg_mfa_set_optional(boolean), public.reg_mfa_forget_devices() from public, anon;
grant execute on function public.reg_mfa_status(), public.reg_mfa_ok(), public.reg_mfa_set_optional(boolean), public.reg_mfa_forget_devices() to authenticated;
commit;
