-- cj-extrainv-001-test.sql
-- Run after cj-extrainv-001.sql, as a role that bypasses row security.
-- Inserts a temporary CJ admin and a temporary CJ ops role, plus two invoices,
-- checks access, then rolls everything in this script back.
-- Needs one active profile that is not the CJ client, and one CJ employee or worker.
--
-- Pass: an admin can insert and read an extra-work invoice, cannot read a monthly
-- one, and a crew login sees neither. Ops can insert an extra-work invoice too.

begin;

do $$
declare
  n int;
  q text;
begin
  if to_regprocedure('public.reg_cj_extra_office()') is null then
    raise exception 'Apply cj-extrainv-001.sql first.';
  end if;

  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'reg_client_invoices' and policyname = 'cjiv__extra_office';
  if n <> 1 then
    raise exception 'cjiv__extra_office is missing.';
  end if;

  -- Policies this change must not rewrite.
  foreach q in array array[
    'cj__uscrew_nomoney|((company_id IS DISTINCT FROM ''cj''::text) OR (NOT ( SELECT cj_us_crew() AS cj_us_crew)))',
    'cjteam__inv|((COALESCE(company_id, ''us''::text) <> ''cj''::text) OR (NOT reg_is_team()))',
    'fr__nomoney|((NOT reg_farm_limited()) OR reg_farm_can(''invoices''::text))',
    'fr__nomoney_del|(NOT reg_farm_limited())',
    'fr__nomoney_ins|(NOT reg_farm_limited())',
    'fr__nomoney_upd|(NOT reg_farm_limited())',
    'cj__company_gate|(((company_id IS DISTINCT FROM ''cj''::text) AND (NOT ( SELECT reg_cj_only() AS reg_cj_only))) OR ((NOT (company_id IS DISTINCT FROM ''cj''::text)) AND ( SELECT reg_cj_ok() AS reg_cj_ok)))'
  ]
  loop
    if not exists (
      select 1 from pg_policies
       where schemaname = 'public' and tablename = 'reg_client_invoices' and policyname = split_part(q, '|', 1)
         and coalesce(qual, with_check) = split_part(q, '|', 2)
    ) then
      raise exception 'Policy changed: %', split_part(q, '|', 1);
    end if;
  end loop;
end $$;

create temp table cjx_fix (admin uuid, ops uuid, crew uuid, client text) on commit drop;

insert into cjx_fix (admin, ops, crew, client)
select
  (select p.id from profiles p
     where p.status = 'active'
       and p.id <> c.id
       and not exists (select 1 from staff_roles sr where sr.user_id = p.id and sr.role = 'owner')
       and not exists (select 1 from reg_accounts a where a.id = p.id and (
            (a.kind in ('employee', 'worker') and coalesce(a.company_id, 'us') = 'cj')
            or (a.company_id = 'us' and a.kind in ('employee', 'sub', 'worker'))))
     order by p.id
     limit 1),
  (select p.id from profiles p
     where p.status = 'active'
       and p.id <> c.id
       and not exists (select 1 from staff_roles sr where sr.user_id = p.id and sr.role = 'owner')
       and not exists (select 1 from reg_accounts a where a.id = p.id and (
            (a.kind in ('employee', 'worker') and coalesce(a.company_id, 'us') = 'cj')
            or (a.company_id = 'us' and a.kind in ('employee', 'sub', 'worker'))))
     order by p.id desc
     limit 1),
  (select a.id from reg_accounts a
     join profiles p on p.id = a.id and p.status = 'active'
    where a.kind in ('employee', 'worker') and coalesce(a.company_id, 'us') = 'cj' and a.active
    order by a.id
    limit 1),
  c.id::text
from reg_accounts c
where c.kind = 'firm' and coalesce(c.company_id, 'us') = 'cj' and c.active
order by c.id
limit 1;

do $$
declare f cjx_fix;
begin
  select * into f from cjx_fix;
  if f.admin is null or f.crew is null or f.client is null then
    raise exception 'Staging needs an active CJ client, a CJ crew login, and another active profile.';
  end if;
  if f.admin = f.crew or f.ops = f.crew then
    raise exception 'The temporary office login must not be the crew login.';
  end if;
end $$;

grant select on cjx_fix to authenticated;

insert into staff_roles (user_id, company_id, role)
select admin, 'cj', 'admin'::public.staff_role from cjx_fix
on conflict do nothing;

insert into staff_roles (user_id, company_id, role)
select ops, 'cj', 'ops'::public.staff_role from cjx_fix
where ops is not null and ops <> admin
on conflict do nothing;

insert into reg_client_invoices (id, company_id, client_id, data)
select 'cjx-test-monthly', 'cj', client,
       jsonb_build_object('kind', 'monthly', 'firmId', client, 'number', 'CJ-TEST-M', 'amount', 10)
from cjx_fix;

-- Admin: create an extra invoice, read it, and not the monthly one.
select set_config('request.jwt.claim.sub', (select admin::text from cjx_fix), true);
set local role authenticated;

insert into reg_client_invoices (id, company_id, data)
select 'cjx-test-extra', 'cj',
       jsonb_build_object('kind', 'extra', 'extraWork', true, 'firmId', client, 'number', 'CJ-TEST-X',
                          'workLines', jsonb_build_array(jsonb_build_object('desc', 'Floor recoat', 'amount', 200)))
from cjx_fix;

do $$
declare extra_n int; monthly_n int; blocked boolean := false;
begin
  select count(*) into extra_n from reg_client_invoices where id = 'cjx-test-extra';
  select count(*) into monthly_n from reg_client_invoices where id = 'cjx-test-monthly';
  if extra_n <> 1 then
    raise exception 'Admin read of extra invoice returned % rows, expected 1.', extra_n;
  end if;
  if monthly_n <> 0 then
    raise exception 'Admin read of monthly invoice returned % rows, expected 0.', monthly_n;
  end if;
  begin
    insert into reg_client_invoices (id, company_id, data)
    values ('cjx-test-bad', 'cj', jsonb_build_object('kind', 'monthly', 'firmId', 'someone-else', 'number', 'CJ-TEST-BAD'));
    blocked := false;
  exception when insufficient_privilege then
    blocked := true;
  when others then
    if sqlstate = '42501' then blocked := true; else raise; end if;
  end;
  if not blocked then
    raise exception 'Admin was able to insert a monthly invoice.';
  end if;
end $$;

-- Ops: create a second extra invoice. If only one non-crew profile is available,
-- swap that login from admin to ops for this step (cj__uscrew_nomoney still blocks a US crew login).
reset role;
update cjx_fix set ops = admin where ops is null or ops = admin;
delete from staff_roles sr
 using cjx_fix f
 where sr.user_id = f.ops and sr.company_id = 'cj' and sr.role = 'admin'
   and f.ops = f.admin;
insert into staff_roles (user_id, company_id, role)
select ops, 'cj', 'ops'::public.staff_role from cjx_fix
on conflict do nothing;

select set_config('request.jwt.claim.sub', (select ops::text from cjx_fix), true);
set local role authenticated;

insert into reg_client_invoices (id, company_id, data)
select 'cjx-test-ops', 'cj',
       jsonb_build_object('kind', 'extra', 'extraWork', true, 'firmId', client, 'number', 'CJ-TEST-OPS',
                          'workLines', jsonb_build_array(jsonb_build_object('desc', 'Glass', 'amount', 80)))
from cjx_fix;

do $$
declare n int;
begin
  select count(*) into n from reg_client_invoices where id = 'cjx-test-ops';
  if n <> 1 then
    raise exception 'Ops read of its extra invoice returned % rows, expected 1.', n;
  end if;
  select count(*) into n from reg_client_invoices where id = 'cjx-test-monthly';
  if n <> 0 then
    raise exception 'Ops read of monthly invoice returned % rows, expected 0.', n;
  end if;
end $$;

-- Crew: neither invoice.
reset role;
select set_config('request.jwt.claim.sub', (select crew::text from cjx_fix), true);
set local role authenticated;

do $$
declare n int;
begin
  select count(*) into n from reg_client_invoices where id in ('cjx-test-extra', 'cjx-test-monthly', 'cjx-test-ops');
  if n <> 0 then
    raise exception 'Crew login saw % invoice row(s), expected 0.', n;
  end if;
end $$;

select 'PASS' as result;

rollback;
