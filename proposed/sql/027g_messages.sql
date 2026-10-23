-- 027g_messages.sql – PROPOSED, NOT RUN (DB hold). For Edge Function reg-messages (msgsend1, Oct 22 2026).
-- Needs 027f_farm_invite_send.sql first (reg_sms_optout, reg_sms_is_opted_out, reg_office_invite_send, reg_invite_opened).
-- Adds: one send log for every text/email; forgot-password codes (hash only, 10 min, 5 tries, 3/hour/account, 10/hour per typed login);
--       farm-owner send / resend for its own team invites.
begin;

-- 1) every send attempt (office reads; only the server function writes). Never stores the code or the full number/email.
create table if not exists public.reg_msg_log (
  id bigserial primary key, company_id text not null default 'us', kind text not null check (kind in ('reset_code','office_invite','farm_invite')),
  ref text not null, channel text not null check (channel in ('sms','email')), status text not null check (status in ('sent','failed','skipped','dry_run')),
  to_masked text, msg_id text, why text, provider text, at timestamptz not null default now());
create index if not exists reg_msg_log_ref on public.reg_msg_log(ref, at desc);
alter table public.reg_msg_log enable row level security;
create policy reg_msg_log_office_read on public.reg_msg_log for select to authenticated using (public.reg_office_write());
create or replace function public.reg_msg_log(p_kind text, p_ref text, p_channel text, p_status text, p_to_masked text, p_msg_id text, p_why text, p_provider text)
returns void language sql security definer set search_path = public as $$
  insert into reg_msg_log(kind, ref, channel, status, to_masked, msg_id, why, provider)
  values (p_kind, left(p_ref,80), p_channel, p_status, left(p_to_masked,60), left(p_msg_id,120), left(p_why,120), left(p_provider,20));
  -- invites also keep the last result on the invite itself so the office / farm list shows it
  update reg_client_invites set data = data || jsonb_build_object('sends', coalesce(data->'sends','[]'::jsonb) ||
         jsonb_build_array(jsonb_build_object('channel',p_channel,'status',p_status,'to',p_to_masked,'at',now())), 'lastSentAt', now())
   where p_kind <> 'reset_code' and id = p_ref; $$;
revoke all on function public.reg_msg_log(text,text,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.reg_msg_log(text,text,text,text,text,text,text,text) to service_role;

-- 2) forgot-password codes
create table if not exists public.reg_reset_codes (user_id uuid primary key, code_hash text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  via text not null default 'sms', tries int not null default 0, expires_at timestamptz not null, created_at timestamptz not null default now());
create table if not exists public.reg_reset_requests (id bigserial primary key, user_id uuid, login_key text not null, at timestamptz not null default now());
create index if not exists reg_reset_requests_u on public.reg_reset_requests(user_id, at desc);
create index if not exists reg_reset_requests_l on public.reg_reset_requests(login_key, at desc);
alter table public.reg_reset_codes enable row level security;      -- no policies: service role only
alter table public.reg_reset_requests enable row level security;

create or replace function public.reg_reset_find(p_login text, p_for_confirm boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s text := lower(btrim(coalesce(p_login,''))); d text := regexp_replace(s, '\D', '', 'g'); a reg_accounts; k text;
begin
  if length(d) = 11 and left(d,1) = '1' then d := substr(d,2); end if;
  k := md5(s);
  if not p_for_confirm then
    if (select count(*) from reg_reset_requests where login_key = k and at > now() - interval '1 hour') >= 10 then return null; end if;
  end if;
  select * into a from reg_accounts r where r.active and not r.suspended and (
       lower(coalesce(r.username,'')) = s or lower(coalesce(r.data->>'email','')) = s
    or (length(d) = 10 and d in (right(regexp_replace(coalesce(r.data->>'phone',''),'\D','','g'),10),
                                right(regexp_replace(coalesce(r.data#>>'{profile,phone}',''),'\D','','g'),10),
                                right(regexp_replace(coalesce(r.data#>>'{company,phone}',''),'\D','','g'),10))))
   order by r.created_at limit 1;
  if p_for_confirm then return case when a.id is null then null else jsonb_build_object('user_id', a.id) end; end if;
  insert into reg_reset_requests(user_id, login_key) values (a.id, k);
  if a.id is null then return null; end if;
  if (select count(*) from reg_reset_requests where user_id = a.id and at > now() - interval '1 hour') > 3 then return null; end if;
  return jsonb_build_object('user_id', a.id, 'name', coalesce(a.data->>'name',''),
    'phone', coalesce(nullif(a.data->>'phone',''), nullif(a.data#>>'{profile,phone}',''), a.data#>>'{company,phone}'),
    'email', nullif(a.data->>'email',''));       -- real contact email only (synthetic login emails live in auth.users, not here)
end $$;
create or replace function public.reg_reset_code_put(p_user uuid, p_hash text, p_minutes int, p_via text) returns void
language sql security definer set search_path = public as $$
  insert into reg_reset_codes(user_id, code_hash, via, tries, expires_at) values (p_user, lower(p_hash), p_via, 0, now() + make_interval(mins => least(greatest(p_minutes,1),15)))
  on conflict (user_id) do update set code_hash = excluded.code_hash, via = excluded.via, tries = 0, expires_at = excluded.expires_at, created_at = now(); $$;
create or replace function public.reg_reset_code_use(p_user uuid, p_hash text) returns text
language plpgsql security definer set search_path = public as $$
declare c reg_reset_codes;
begin
  select * into c from reg_reset_codes where user_id = p_user for update;
  if c.user_id is null then return 'wrong'; end if;
  if c.expires_at < now() then delete from reg_reset_codes where user_id = p_user; return 'expired'; end if;
  if c.code_hash <> lower(p_hash) then
    update reg_reset_codes set tries = tries + 1 where user_id = p_user;
    if c.tries + 1 >= 5 then delete from reg_reset_codes where user_id = p_user; return 'locked'; end if;
    return 'wrong'; end if;
  delete from reg_reset_codes where user_id = p_user; return 'ok';
end $$;
create or replace function public.reg_reset_done(p_user uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  update reg_accounts set data = (data - 'mustChangePw') || jsonb_build_object('failed', 0, 'lockedUntil', 0) where id = p_user;
  delete from auth.sessions where user_id = p_user;                -- sign out everywhere else
  insert into reg_audit(id, company_id, actor, data) values ('aud_' || md5(random()::text || clock_timestamp()::text), 'us', p_user::text,
    jsonb_build_object('action', 'Password reset by code', 'target', p_user::text, 'detail', 'self-service (code and password never logged)', 'at', now()));
end $$;
revoke all on function public.reg_reset_find(text,boolean), public.reg_reset_code_put(uuid,text,int,text), public.reg_reset_code_use(uuid,text), public.reg_reset_done(uuid) from public, anon, authenticated;
grant execute on function public.reg_reset_find(text,boolean), public.reg_reset_code_put(uuid,text,int,text), public.reg_reset_code_use(uuid,text), public.reg_reset_done(uuid) to service_role;

-- 3) farm owner: details of its own waiting invite (proved by the code it just made) so the server can send it
create or replace function public.reg_farm_team_invite_for_send(p_code_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare i reg_client_invites;
begin
  if not public.reg_farm_main() then raise exception 'Only the farm owner can send invites.' using errcode = '42501'; end if;
  select * into i from reg_client_invites where code_hash = lower(p_code_hash) and client_id = public.reg_my_client()
     and coalesce(data->>'byFarm','') = 'true' and used_by is null and not revoked and expires_on >= current_date;
  if i.id is null then raise exception 'Invite not found.'; end if;
  if (select count(*) from reg_msg_log where ref = i.id and at > now() - interval '1 day') >= 5 then raise exception 'This invite was sent too often today.'; end if;
  return jsonb_build_object('invite_id', i.id, 'name', i.data->>'inviteName', 'contact', i.data->>'inviteContact', 'role', i.data->>'farmRole',
    'expires', i.expires_on::text, 'farm', (select coalesce(data->>'name','Your farm') from reg_accounts where id::text = public.reg_my_client() or sub_id = public.reg_my_client() limit 1));
end $$;
-- resend: new code, old invite cancelled (code fingerprints are immutable, so a resend is always a new invite)
create or replace function public.reg_farm_team_resend(p_old text, p_id text, p_code_hash text, p_last4 text, p_days int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o reg_client_invites;
begin
  if not public.reg_farm_main() then raise exception 'Only the farm owner can send invites.' using errcode = '42501'; end if;
  select * into o from reg_client_invites where id = p_old and client_id = public.reg_my_client() and coalesce(data->>'byFarm','') = 'true' and used_by is null;
  if o.id is null then raise exception 'This invite can''t be sent again.'; end if;
  perform public.reg_farm_team_invite(p_id, p_code_hash, p_last4, p_days, o.data->>'farmRole', o.data->>'inviteName', o.data->>'inviteContact',
    (o.data#>>'{farmPerms,approve}')::boolean, (o.data#>>'{farmPerms,order}')::boolean);
  update reg_client_invites set data = data || jsonb_build_object('revokedAt', now(), 'replacedBy', p_id) where id = p_old and not revoked;
  return public.reg_farm_team_invite_for_send(p_code_hash);
end $$;
revoke all on function public.reg_farm_team_invite_for_send(text), public.reg_farm_team_resend(text,text,text,text,int) from public, anon;
grant execute on function public.reg_farm_team_invite_for_send(text), public.reg_farm_team_resend(text,text,text,text,int) to authenticated;
commit;
