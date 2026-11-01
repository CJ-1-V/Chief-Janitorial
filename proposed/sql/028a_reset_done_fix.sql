-- 028a (DRAFT, not applied): reg_reset_done fixes ported from UnScramble PR #22 (resetdone1)
-- 1) reg_audit.actor is uuid (checked Nov 1 2026): insert p_user as uuid, never p_user::text (027g had ::text -> "column actor is of type uuid" error,
--    so a successful code reset showed "contact the office").
-- 2) company id was hard-coded 'us': use the account's own company_id (falls back to 'cj').
create or replace function public.reg_reset_done(p_user uuid) returns void language plpgsql security definer set search_path = public as $$
declare v_co text;
begin
  select coalesce(company_id, 'cj') into v_co from reg_accounts where id = p_user;
  update reg_accounts set data = (data - 'mustChangePw') || jsonb_build_object('failed', 0, 'lockedUntil', 0) where id = p_user;
  delete from auth.sessions where user_id = p_user;
  insert into reg_audit(id, company_id, actor, data) values ('aud_' || md5(random()::text || clock_timestamp()::text), coalesce(v_co, 'cj'), p_user,
    jsonb_build_object('action', 'Password reset by code', 'target', p_user::text, 'detail', 'self-service (code and password never logged)', 'at', now()));
end $$;
revoke all on function public.reg_reset_done(uuid) from public, anon, authenticated;
grant execute on function public.reg_reset_done(uuid) to service_role;
