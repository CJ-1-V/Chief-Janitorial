-- 017a reg_help_chats: sign-in help chat transcripts + summaries. PROPOSED – DO NOT RUN without owner OK.
create table if not exists public.reg_help_chats (
  id uuid primary key,
  ip_hash text not null,
  messages jsonb not null default '[]'::jsonb,   -- passwords/codes are masked before storing
  summary text,
  end_reason text,
  created_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  ended_at timestamptz
);
create index if not exists reg_help_chats_created_idx on public.reg_help_chats (created_at desc);
alter table public.reg_help_chats enable row level security;
revoke all on public.reg_help_chats from anon, authenticated;
-- Only the edge function (service role, bypasses RLS) writes. Owner reads summaries in the app/SQL editor:
create policy reg_help_chats_owner_read on public.reg_help_chats for select to authenticated
  using (public.is_owner());   -- existing helper (owner only; Office Assistant has no access)
grant select on public.reg_help_chats to authenticated;
-- Optional: idle sweep for chats left open (browser closed without beacon) – needs pg_cron + pg_net; can be added later.
-- 017b (owner add-on 8:34 PM): structured fields + status for Grok Bot review queue
alter table public.reg_help_chats
  add column if not exists name text, add column if not exists phone text, add column if not exists email text,
  add column if not exists role text, add column if not exists farm text, add column if not exists screen text,
  add column if not exists needed text, add column if not exists solved text, add column if not exists follow_up text,
  add column if not exists status text not null default 'new';
do $$ begin alter table public.reg_help_chats add constraint reg_help_chats_status_chk check (status in ('new','seen','approved','done')); exception when duplicate_object then null; end $$;
create index if not exists reg_help_chats_status_created_idx on public.reg_help_chats (status, created_at);
