begin;
drop function if exists public.reg_mfa_forget_devices(), public.reg_mfa_set_optional(boolean), public.reg_mfa_trust_use(uuid,uuid,text),
  public.reg_mfa_code_use(uuid,uuid,text,text,text), public.reg_mfa_code_put(uuid,text,text), public.reg_mfa_ok(), public.reg_mfa_status(), public.reg_mfa_required_for(uuid);
drop table if exists public.reg_mfa_devices, public.reg_mfa_sessions, public.reg_mfa_codes;
delete from public.reg_msg_log where kind = 'mfa_code';
alter table public.reg_msg_log drop constraint if exists reg_msg_log_kind_check;
alter table public.reg_msg_log add constraint reg_msg_log_kind_check check (kind in ('reset_code','office_invite','farm_invite','sub_invite'));
commit;
