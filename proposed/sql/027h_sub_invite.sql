-- 027h_sub_invite.sql – PROPOSED, NOT RUN (DB hold). subinvite1, Oct 22 2026. Run AFTER 027g.
-- Lets reg-messages log subcontractor -> worker invites. No other change (uses live 016r reg_sub_join_code / reg_sub_by_code).
begin;
alter table public.reg_msg_log drop constraint if exists reg_msg_log_kind_check;
alter table public.reg_msg_log add constraint reg_msg_log_kind_check check (kind in ('reset_code','office_invite','farm_invite','sub_invite'));
commit;
