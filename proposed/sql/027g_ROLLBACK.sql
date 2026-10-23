begin;
drop function if exists public.reg_farm_team_resend(text,text,text,text,int), public.reg_farm_team_invite_for_send(text),
  public.reg_reset_done(uuid), public.reg_reset_code_use(uuid,text), public.reg_reset_code_put(uuid,text,int,text), public.reg_reset_find(text,boolean),
  public.reg_msg_log(text,text,text,text,text,text,text,text);
drop table if exists public.reg_reset_requests, public.reg_reset_codes, public.reg_msg_log;
commit;
