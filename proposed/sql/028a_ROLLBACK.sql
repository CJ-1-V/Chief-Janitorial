-- 028a rollback: restore the definition live on lfefpmzfnvgwuicthlyg as of Nov 1 2026
create or replace function public.reg_reset_done(p_user uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  update reg_accounts set data = (data - 'mustChangePw') || jsonb_build_object('failed', 0, 'lockedUntil', 0) where id = p_user;
  delete from auth.sessions where user_id = p_user;
  insert into reg_audit(id, company_id, actor, data) values ('aud_' || md5(random()::text || clock_timestamp()::text), 'us', p_user,
    jsonb_build_object('action', 'Password reset by code', 'target', p_user::text, 'detail', 'self-service (code and password never logged)', 'at', now()));
end $$;
revoke all on function public.reg_reset_done(uuid) from public, anon, authenticated;
grant execute on function public.reg_reset_done(uuid) to service_role;
