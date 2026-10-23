-- rollback for 027f (PROPOSED). Leaves reg_client_invites rows; only drops the new objects.
begin;
drop function if exists public.reg_invite_opened(text);
drop function if exists public.reg_sms_mark_optout(text);
drop function if exists public.reg_sms_is_opted_out(text);
drop function if exists public.reg_invite_log_send(text,text,text,text,text,text);
drop function if exists public.reg_office_invite_send(text,text,text,text,int,jsonb,text,text);
drop table if exists public.reg_sms_optout;
drop table if exists public.reg_invite_sends;
commit;
