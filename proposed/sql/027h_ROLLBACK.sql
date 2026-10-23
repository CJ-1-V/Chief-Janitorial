begin;
delete from public.reg_msg_log where kind = 'sub_invite';
alter table public.reg_msg_log drop constraint if exists reg_msg_log_kind_check;
alter table public.reg_msg_log add constraint reg_msg_log_kind_check check (kind in ('reset_code','office_invite','farm_invite'));
commit;
