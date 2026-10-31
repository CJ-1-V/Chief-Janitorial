-- cj-site-invite-001.sql — DRAFT. DO NOT RUN.
-- Chief Janitorial site sign-up links. One active long random join code per site.
-- The short site code (CJC101, or UnScramble's 3 letters + 201–299) is NOT the secret.
-- A join token is 20–40 characters. The CJ front end in this change does not call this
-- database. Mock (?store=mock) keeps links in the browser only (DB.siteInvites).
--
-- Do not copy these tokens into reg_settings or into the crew snapshot. A cleaner who
-- opens one link may learn that one site code. They must not be able to list every token.
--
-- This draft turns on row level security and does not add policies, so the table is not
-- readable through the API. The lookup function is revoked from public. Grant execute
-- only after a rate limit is added and the office role check is confirmed against the
-- current reg_accounts rules. Until then, leave this file unapplied.
--
-- A new sign-up is still not an active cleaner. That allow-list stays
-- reg_settings id 'cj-main', data.activeCleaners (see cj-active-001.sql). This file
-- does not change it.
--
-- Rollback: migrations/cj-site-invite-001-rollback.sql

begin;

create table public.cj_site_invites (
  id uuid primary key default gen_random_uuid(),
  company_id text not null default 'cj' check (company_id = 'cj'),
  site_code text not null,
  token text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid,
  revoked_at timestamptz,
  constraint cj_site_invites_token_len check (char_length(token) between 20 and 40),
  constraint cj_site_invites_not_short_code check (token !~ '^[A-Za-z]{3}[0-9]{3}$')
);

create unique index cj_site_invites_token_key on public.cj_site_invites (token);
create unique index cj_site_invites_one_active
  on public.cj_site_invites (company_id, site_code)
  where active;

comment on table public.cj_site_invites is
  'CJ site sign-up links. Long random token, not the short site code. Draft — not used by the app yet.';

alter table public.cj_site_invites enable row level security;
-- No policies on purpose. anon and authenticated cannot select or change rows.

create or replace function public.cj_lookup_site_join(p_token text)
returns table (site_code text)
language sql
stable
security definer
set search_path = public
as $$
  select i.site_code
  from public.cj_site_invites i
  where i.company_id = 'cj'
    and i.active
    and i.token = left(coalesce(p_token, ''), 40)
    and char_length(i.token) >= 20
  limit 1;
$$;

comment on function public.cj_lookup_site_join(text) is
  'Returns one CJ site code for an active join token. Does not return the token or any other site. Not granted.';

revoke all on function public.cj_lookup_site_join(text) from public;
revoke all on table public.cj_site_invites from public, anon, authenticated;

commit;
