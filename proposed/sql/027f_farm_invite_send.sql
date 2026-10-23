-- 027f_farm_invite_send.sql – PROPOSED, NOT APPLIED (DB hold). TEST COPY farminvite1, Oct 22 2026.
-- Office "Send invite" for farms/clients: invite send log, STOP list, "opened" tracking. Additive only – no existing column/row changed.
-- Apply only after: (1) DB hold lifted, (2) owner OK, (3) a dry run on the local stack (cj-golive/localtest) with rollback 027f_ROLLBACK.sql.
begin;

-- 1) every send attempt (office can read; only the server function writes)
create table if not exists public.reg_invite_sends (
  id bigserial primary key,
  invite_id text not null references public.reg_client_invites(id) on delete cascade,
  company_id text not null default 'us',
  channel text not null check (channel in ('sms','email')),
  status text not null check (status in ('sent','failed','skipped','dry_run')),
  to_masked text, msg_id text, why text,
  at timestamptz not null default now()
);
alter table public.reg_invite_sends enable row level security;
create policy reg_invite_sends_office_read on public.reg_invite_sends for select to authenticated using (public.reg_office_write_for(company_id));
revoke insert, update, delete on public.reg_invite_sends from authenticated, anon;

-- 2) numbers that replied STOP (never texted again)
create table if not exists public.reg_sms_optout (e164 text primary key check (e164 ~ '^\+1\d{10}$'), at timestamptz not null default now(), source text not null default 'office');
alter table public.reg_sms_optout enable row level security;
create policy reg_sms_optout_office_read on public.reg_sms_optout for select to authenticated using (public.reg_office_write());

-- 3) office makes + (re)sends an invite. Called by the Edge Function AS THE SIGNED-IN OFFICE USER. Code never reaches the DB, only its hash.
create or replace function public.reg_office_invite_send(p_id text, p_client text, p_code_hash text, p_last4 text, p_days int,
  p_send_to jsonb, p_via text, p_resend_of text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare co text; exp date; old record;
begin
  select company_id into co from reg_clients where id = p_client;
  if co is null then select company_id into co from reg_accounts where id::text = p_client and kind = 'firm' and client_link is null; end if;
  if co is null then raise exception 'Invite must be for an existing client.'; end if;
  if not public.reg_office_write_for(co) then raise exception 'Only the office sends invites.' using errcode = '42501'; end if;
  if p_code_hash !~ '^[0-9a-f]{64}$' then raise exception 'Bad code.'; end if;
  if (select count(*) from reg_client_invites where client_id = p_client and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Too many invites for this client today.'; end if;
  exp := current_date + greatest(1, least(30, coalesce(p_days, 14)));
  if p_resend_of is not null then
    select * into old from reg_client_invites where id = p_resend_of and client_id = p_client;
    if not found then raise exception 'Invite to resend not found.'; end if;
    if old.used_by is null and not old.revoked then
      update reg_client_invites set data = data || jsonb_build_object('revokedAt', now(), 'replacedBy', p_id) where id = p_resend_of;
    else update reg_client_invites set data = data || jsonb_build_object('replacedBy', p_id) where id = p_resend_of; end if;
  end if;
  insert into reg_client_invites(id, company_id, data) values (p_id, co, jsonb_strip_nulls(jsonb_build_object(
    'clientId', p_client, 'codeHash', lower(p_code_hash), 'last4', left(coalesce(p_last4,''),4), 'expires', to_char(exp,'YYYY-MM-DD'), 'days', p_days,
    'createdAt', now(), 'createdBy', (select coalesce(data->>'name','Office') from reg_accounts where id = auth.uid()),
    'sendTo', jsonb_build_object('name', left(p_send_to->>'name',80), 'phone', nullif(p_send_to->>'phone',''), 'email', nullif(left(p_send_to->>'email',120),'')),
    'via', p_via, 'consentBy', auth.uid(), 'consentAt', now(), 'resendOf', p_resend_of, 'usedBy', '', 'revokedAt', '')));
  insert into reg_audit(id, company_id, actor, data) values ('au_' || p_id, co, auth.uid(), jsonb_build_object('at', now(),
    'action', case when p_resend_of is null then 'Sent client invite' else 'Resent client invite' end, 'target', p_client, 'detail', 'code ending ' || left(coalesce(p_last4,''),4)));
  return jsonb_build_object('expires', to_char(exp,'YYYY-MM-DD'));
end $$;
revoke all on function public.reg_office_invite_send(text,text,text,text,int,jsonb,text,text) from public;
grant execute on function public.reg_office_invite_send(text,text,text,text,int,jsonb,text,text) to authenticated;

-- 4) server-only: log an attempt (also mirrored into the invite's data.sends so the existing app load shows it)
create or replace function public.reg_invite_log_send(p_invite text, p_channel text, p_status text, p_to_masked text, p_msg_id text, p_why text) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into reg_invite_sends(invite_id, company_id, channel, status, to_masked, msg_id, why)
    select id, company_id, p_channel, p_status, p_to_masked, p_msg_id, p_why from reg_client_invites where id = p_invite;
  update reg_client_invites set data = jsonb_set(data, '{sends}', coalesce(data->'sends','[]'::jsonb) || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
    'channel', p_channel, 'status', case when p_status = 'dry_run' then 'sent' else p_status end, 'dryRun', p_status = 'dry_run', 'to', p_to_masked, 'why', p_why, 'at', now()))))
  where id = p_invite;
end $$;
revoke all on function public.reg_invite_log_send(text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.reg_invite_log_send(text,text,text,text,text,text) to service_role;

create or replace function public.reg_sms_is_opted_out(p_e164 text) returns boolean language sql stable security definer set search_path = public as
$$ select exists(select 1 from reg_sms_optout where e164 = p_e164) $$;
revoke all on function public.reg_sms_is_opted_out(text) from public, anon, authenticated;
grant execute on function public.reg_sms_is_opted_out(text) to service_role;

create or replace function public.reg_sms_mark_optout(p_e164 text) returns void language plpgsql security definer set search_path = public as $$
begin if not public.reg_office_write() then raise exception 'Office only.' using errcode = '42501'; end if;
  insert into reg_sms_optout(e164, source) values (p_e164, 'office') on conflict do nothing; end $$;
revoke all on function public.reg_sms_mark_optout(text) from public; grant execute on function public.reg_sms_mark_optout(text) to authenticated;

-- 5) "opened": the sign-up page reports the code's hash. Callable before sign-in (anon). Idempotent, returns nothing (no lookup oracle).
create or replace function public.reg_invite_opened(p_code_hash text) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_code_hash !~ '^[0-9a-f]{64}$' then return; end if;
  update reg_client_invites set data = data || jsonb_build_object('openedAt', now())
   where code_hash = lower(p_code_hash) and used_by is null and not revoked and coalesce(data->>'openedAt','') = '' and expires_on >= current_date;
end $$;
revoke all on function public.reg_invite_opened(text) from public; grant execute on function public.reg_invite_opened(text) to anon, authenticated;

commit;
