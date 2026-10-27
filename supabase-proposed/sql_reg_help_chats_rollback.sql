-- Rollback 017b only: drop index if exists public.reg_help_chats_status_created_idx; (columns go with table drop)
-- Rollback 017a
drop policy if exists reg_help_chats_owner_read on public.reg_help_chats;
drop table if exists public.reg_help_chats;
