-- cj-client-v1-001.sql — DRAFT. DO NOT RUN.
--
-- Frozen read API for the Chief Janitorial client portal (shifts-secure/cj/client/).
-- Committing this file does not change the live database. Apply it only after the
-- column names below have been checked against the current tables.
--
-- Why this is separate from the main app
--   The portal calls only the cj_client_v1_* functions listed at the bottom.
--   It does not call public.reg_snapshot_for() and it does not read tables itself.
--   A later change to the main app snapshot does not change this contract.
--   When a column has to change, add cj_client_v2_* and leave these functions
--   in place until the portal is deliberately updated.
--   public.reg_snapshot() (UnScramble) is not modified.
--
-- Who can read
--   auth.uid() must be a CJ client login: reg_accounts.company_id = 'cj'
--   and data.type = 'firm'. A team login (data.loginOf) is scoped to that
--   parent client, and data.teamSites (when it is a JSON array) limits sites.
--   There is no client-id argument. Office, crew, and every other client get
--   no rows. These functions are security definer so they can project a narrow
--   result; the auth.uid() check inside each function is the access rule.
--
-- What a row never contains
--   Worker account ids, worker names, pay, bill rates, owner-only site names
--   (data.ownerName), invoice line items, special-job rates, request contacts,
--   or request history. A person is "Cleaner" when they are the only person on
--   that site that day, otherwise "Crew 1", "Crew 2", … in arrival order.
--   reg_special_jobs is not read (those rows carry rates).
--
-- Tables read (the app stores the record in data jsonb, plus company_id)
--   reg_accounts, reg_client_sites, reg_time_entries, reg_bookings,
--   cj_visit_logs, reg_cleaning_requests, reg_client_invoices
--
-- Rollback: migrations/cj-client-v1-001-rollback.sql

begin;

-- ---------------------------------------------------------------------------
-- Helpers. Not granted to the portal. They exist so the public functions share
-- one definition of "this caller's sites" and one definition of crew labels.
-- ---------------------------------------------------------------------------

create or replace function public.cj_client_v1_hhmm(p text)
returns text
language sql
immutable
security invoker
set search_path = public
as $$
  select case
    when p ~ '^\d{1,2}:\d{2}'
     and split_part(p, ':', 1)::int between 0 and 23
     and split_part(split_part(p, ':', 2), ' ', 1)::int between 0 and 59
    then lpad(split_part(p, ':', 1), 2, '0')
      || ':'
      || lpad(split_part(split_part(p, ':', 2), ' ', 1), 2, '0')
    else null
  end;
$$;

create or replace function public.cj_client_v1_minutes(p text)
returns integer
language sql
immutable
security invoker
set search_path = public
as $$
  select case
    when public.cj_client_v1_hhmm(p) is null then null
    else split_part(public.cj_client_v1_hhmm(p), ':', 1)::int * 60
       + split_part(public.cj_client_v1_hhmm(p), ':', 2)::int
  end;
$$;

create or replace function public.cj_client_v1_client_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id uuid := auth.uid();
  v_company text;
  v_type text;
  v_active text;
  v_login text;
  v_parent uuid;
begin
  if v_id is null then
    return null;
  end if;

  select a.company_id,
         a.data->>'type',
         coalesce(a.data->>'active', 'true'),
         coalesce(a.data->>'loginOf', '')
    into v_company, v_type, v_active, v_login
  from public.reg_accounts a
  where a.id = v_id;

  if v_company is distinct from 'cj'
     or v_type is distinct from 'firm'
     or v_active = 'false' then
    return null;
  end if;

  if v_login <> '' then
    begin
      v_parent := v_login::uuid;
    exception
      when invalid_text_representation then
        return null;
    end;
    if not exists (
      select 1
      from public.reg_accounts p
      where p.id = v_parent
        and p.company_id = 'cj'
        and p.data->>'type' = 'firm'
        and coalesce(p.data->>'loginOf', '') = ''
        and coalesce(p.data->>'active', 'true') <> 'false'
    ) then
      return null;
    end if;
    return v_parent;
  end if;

  return v_id;
end;
$$;

create or replace function public.cj_client_v1_own_sites()
returns table(site_code text, site_name text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_client uuid := public.cj_client_v1_client_id();
  v_raw jsonb;
  v_limit text[];
begin
  if v_client is null then
    return;
  end if;

  select a.data->'teamSites'
    into v_raw
  from public.reg_accounts a
  where a.id = auth.uid();

  if jsonb_typeof(v_raw) = 'array' then
    select coalesce(array_agg(value), array[]::text[])
      into v_limit
    from jsonb_array_elements_text(v_raw) as value;
  else
    v_limit := null;
  end if;

  return query
  select distinct on (s.data->>'code')
         s.data->>'code',
         coalesce(nullif(s.data->>'name', ''), s.data->>'code')
  from public.reg_client_sites s
  where s.company_id = 'cj'
    and s.data->>'firmId' = v_client::text
    and coalesce(s.data->>'active', 'true') <> 'false'
    and coalesce(s.data->>'code', '') <> ''
    and s.data->>'code' <> 'TEST-PRACTICE'
    and (v_limit is null or s.data->>'code' = any (v_limit))
  order by s.data->>'code';
end;
$$;

-- person_ref stays inside the database. Callers that are granted to the portal
-- select crew_label only.
create or replace function public.cj_client_v1_crew_labels(p_from date, p_to date)
returns table(site_code text, visit_date date, person_ref text, crew_label text)
language sql
stable
security definer
set search_path = public
as $$
  with people as (
    select raw.site_code, raw.visit_date, raw.person_ref, min(raw.sort_key) as sort_key
    from (
      select
        s.site_code,
        (t.data->>'date')::date as visit_date,
        coalesce(nullif(t.data->>'userId', ''), 'entry:' || t.id::text) as person_ref,
        coalesce(public.cj_client_v1_hhmm(t.data->>'in'), '99:99') as sort_key
      from public.reg_time_entries t
      join public.cj_client_v1_own_sites() s
        on s.site_code = coalesce(
          nullif(t.data->>'site', ''),
          (
            select b.data->>'site'
            from public.reg_bookings b
            where b.company_id = 'cj'
              and b.id::text = coalesce(t.data->>'shiftId', '')
            limit 1
          )
        )
      where p_from is not null
        and p_to is not null
        and t.company_id = 'cj'
        and coalesce(t.data->>'test', '') <> 'true'
        and coalesce(t.data->>'lateEntry', '') <> 'rejected'
        and (t.data->>'date') ~ '^\d{4}-\d{2}-\d{2}$'
        and (t.data->>'date')::date between p_from and p_to
        and public.cj_client_v1_hhmm(t.data->>'in') is not null
        and public.cj_client_v1_hhmm(t.data->>'out') is not null
      union all
      select
        s.site_code,
        (v.data->>'date')::date,
        coalesce(nullif(v.data->>'userId', ''), 'log:' || v.id::text),
        coalesce(substring(v.data->>'at' from 'T(\d{2}:\d{2})'), '99:99')
      from public.cj_visit_logs v
      join public.cj_client_v1_own_sites() s
        on s.site_code = v.data->>'site'
      where p_from is not null
        and p_to is not null
        and v.company_id = 'cj'
        and (v.data->>'date') ~ '^\d{4}-\d{2}-\d{2}$'
        and (v.data->>'date')::date between p_from and p_to
    ) raw
    group by raw.site_code, raw.visit_date, raw.person_ref
  ),
  ranked as (
    select
      people.site_code,
      people.visit_date,
      people.person_ref,
      row_number() over (
        partition by people.site_code, people.visit_date
        order by people.sort_key, people.person_ref
      ) as n,
      count(*) over (
        partition by people.site_code, people.visit_date
      ) as n_people
    from people
  )
  select
    ranked.site_code,
    ranked.visit_date,
    ranked.person_ref,
    case
      when ranked.n_people = 1 then 'Cleaner'
      else 'Crew ' || ranked.n::text
    end
  from ranked;
$$;

-- ---------------------------------------------------------------------------
-- Portal reads. Granted to authenticated at the end of this file.
-- ---------------------------------------------------------------------------

create or replace function public.cj_client_v1_whoami()
returns table(ok boolean, client_label text, role text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_client uuid := public.cj_client_v1_client_id();
  v_label text;
begin
  if v_client is null then
    return query select false, null::text, null::text;
    return;
  end if;

  select left(coalesce(nullif(a.data->>'name', ''), 'Client'), 120)
    into v_label
  from public.reg_accounts a
  where a.id = v_client;

  return query select true, coalesce(v_label, 'Client'), 'Client'::text;
end;
$$;

create or replace function public.cj_client_v1_sites()
returns table(site_code text, site_name text)
language sql
stable
security definer
set search_path = public
as $$
  select s.site_code, s.site_name
  from public.cj_client_v1_own_sites() s
  order by s.site_code;
$$;

create or replace function public.cj_client_v1_visits(p_from date default null, p_to date default null)
returns table(
  visit_id text,
  site_code text,
  site_name text,
  visit_date date,
  start_time text,
  end_time text,
  hours_on_site numeric,
  crew_label text
)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select coalesce(p_from, (current_date - 21)) as d1, coalesce(p_to, current_date) as d2
  ),
  win as (
    select d1, d2 from bounds where d1 <= d2 and (d2 - d1) <= 400
  ),
  clocked as (
    select
      t.id::text as visit_id,
      s.site_code,
      s.site_name,
      (t.data->>'date')::date as visit_date,
      public.cj_client_v1_hhmm(t.data->>'in') as start_time,
      public.cj_client_v1_hhmm(t.data->>'out') as end_time,
      coalesce(nullif(t.data->>'userId', ''), 'entry:' || t.id::text) as person_ref
    from public.reg_time_entries t
    join win w on true
    join public.cj_client_v1_own_sites() s
      on s.site_code = coalesce(
        nullif(t.data->>'site', ''),
        (
          select b.data->>'site'
          from public.reg_bookings b
          where b.company_id = 'cj'
            and b.id::text = coalesce(t.data->>'shiftId', '')
          limit 1
        )
      )
    where t.company_id = 'cj'
      and coalesce(t.data->>'test', '') <> 'true'
      and coalesce(t.data->>'lateEntry', '') <> 'rejected'
      and (t.data->>'date') ~ '^\d{4}-\d{2}-\d{2}$'
      and (t.data->>'date')::date between w.d1 and w.d2
      and public.cj_client_v1_hhmm(t.data->>'in') is not null
      and public.cj_client_v1_hhmm(t.data->>'out') is not null
      and coalesce(t.data->>'visitKind', '') <> 'supervisor-check'
  )
  select
    c.visit_id,
    c.site_code,
    c.site_name,
    c.visit_date,
    c.start_time,
    c.end_time,
    round((
      case
        when public.cj_client_v1_minutes(c.end_time) >= public.cj_client_v1_minutes(c.start_time)
          then public.cj_client_v1_minutes(c.end_time) - public.cj_client_v1_minutes(c.start_time)
        else public.cj_client_v1_minutes(c.end_time) - public.cj_client_v1_minutes(c.start_time) + 1440
      end
    )::numeric / 60, 2),
    coalesce(k.crew_label, 'Cleaner')
  from clocked c
  left join public.cj_client_v1_crew_labels((select w.d1 from win w), (select w.d2 from win w)) k
    on k.site_code = c.site_code
   and k.visit_date = c.visit_date
   and k.person_ref = c.person_ref
  order by c.visit_date desc, c.site_code, c.start_time, c.visit_id
  limit 500;
$$;

create or replace function public.cj_client_v1_hours(p_from date default null, p_to date default null)
returns table(
  visit_id text,
  site_code text,
  site_name text,
  visit_date date,
  start_time text,
  end_time text,
  hours_on_site numeric,
  crew_label text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.visit_id,
    v.site_code,
    v.site_name,
    v.visit_date,
    v.start_time,
    v.end_time,
    v.hours_on_site,
    v.crew_label
  from public.cj_client_v1_visits(p_from, p_to) v;
$$;

-- Supervisor checks are time rows with data.visitKind = 'supervisor-check'.
-- The function returns the date, the site, and the label Supervisor.
-- It does not return the person's name, id, clock times, or pay.
create or replace function public.cj_client_v1_supervisor_checks(p_from date default null, p_to date default null)
returns table(
  check_id text,
  site_code text,
  site_name text,
  visit_date date,
  role_label text
)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select coalesce(p_from, (current_date - 21)) as d1, coalesce(p_to, current_date) as d2
  ),
  win as (
    select d1, d2 from bounds where d1 <= d2 and (d2 - d1) <= 400
  )
  select
    t.id::text,
    s.site_code,
    s.site_name,
    (t.data->>'date')::date,
    'Supervisor'::text
  from public.reg_time_entries t
  join win w on true
  join public.cj_client_v1_own_sites() s
    on s.site_code = coalesce(nullif(t.data->>'site', ''), '')
  where t.company_id = 'cj'
    and t.data->>'visitKind' = 'supervisor-check'
    and coalesce(t.data->>'test', '') <> 'true'
    and (t.data->>'date') ~ '^\d{4}-\d{2}-\d{2}$'
    and (t.data->>'date')::date between w.d1 and w.d2
  order by (t.data->>'date')::date desc, s.site_code, t.id::text
  limit 500;
$$;

create or replace function public.cj_client_v1_checklists(p_from date default null, p_to date default null)
returns table(
  checklist_id text,
  site_code text,
  site_name text,
  visit_date date,
  status text,
  marked_at text,
  crew_label text,
  note text,
  tasks jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select coalesce(p_from, (current_date - 21)) as d1, coalesce(p_to, current_date) as d2
  ),
  win as (
    select d1, d2 from bounds where d1 <= d2 and (d2 - d1) <= 400
  ),
  logs as (
    select
      v.id::text as checklist_id,
      s.site_code,
      s.site_name,
      (v.data->>'date')::date as visit_date,
      case v.data->>'status'
        when 'Done' then 'Done'
        when 'Partial' then 'Partial'
        when 'Missed' then 'Missed'
        else 'Not recorded'
      end as status,
      case
        when coalesce(v.data->>'at', '') ~ '^\d{4}-\d{2}-\d{2}' then left(v.data->>'at', 25)
        else null
      end as marked_at,
      left(coalesce(v.data->>'note', ''), 500) as note,
      coalesce(nullif(v.data->>'userId', ''), 'log:' || v.id::text) as person_ref,
      -- A plain string (or any non-array) must not be expanded. jsonb_array_elements
      -- errors with "cannot extract elements from a scalar" on those values.
      case
        when jsonb_typeof(v.data->'tasks') = 'array' then v.data->'tasks'
        else '[]'::jsonb
      end as ticked,
      case
        when jsonb_typeof(site.checklist) = 'array' and jsonb_array_length(site.checklist) > 0
          then site.checklist
        else '["Empty garbage and replace liners","Clean and stock washrooms","Sweep and mop floors","Wipe counters, desks and touch points","Vacuum mats and carpets","Lock up and set the alarm"]'::jsonb
      end as task_list
    from public.cj_visit_logs v
    join win w on true
    join public.cj_client_v1_own_sites() s
      on s.site_code = v.data->>'site'
    left join lateral (
      select s2.data->'checklist' as checklist
      from public.reg_client_sites s2
      where s2.company_id = 'cj'
        and s2.data->>'code' = s.site_code
        and s2.data->>'firmId' = public.cj_client_v1_client_id()::text
      limit 1
    ) site on true
    where v.company_id = 'cj'
      and (v.data->>'date') ~ '^\d{4}-\d{2}-\d{2}$'
      and (v.data->>'date')::date between w.d1 and w.d2
  ),
  labeled as (
    select
      l.*,
      coalesce(k.crew_label, 'Cleaner') as crew_label
    from logs l
    left join public.cj_client_v1_crew_labels((select w.d1 from win w), (select w.d2 from win w)) k
      on k.site_code = l.site_code
     and k.visit_date = l.visit_date
     and k.person_ref = l.person_ref
  )
  select
    l.checklist_id,
    l.site_code,
    l.site_name,
    l.visit_date,
    l.status,
    l.marked_at,
    l.crew_label,
    l.note,
    (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'label', names.lab,
          'result', case
            when exists (
              select 1
              from jsonb_array_elements(coalesce(l.ticked, '[]'::jsonb)) as e(elem)
              where case jsonb_typeof(e.elem)
                when 'string' then e.elem #>> '{}'
                when 'object' then coalesce(e.elem->>'label', e.elem->>'name', e.elem->>'text', '')
                else ''
              end = names.lab
            ) then 'Done'
            else 'Not done'
          end
        )
        order by names.ord
      ), '[]'::jsonb)
      from (
        select q.ord, q.lab
        from (
          select
            t.ord,
            case jsonb_typeof(t.elem)
              when 'string' then t.elem #>> '{}'
              when 'object' then coalesce(t.elem->>'label', t.elem->>'name', t.elem->>'text', '')
              else ''
            end as lab
          from jsonb_array_elements(l.task_list) with ordinality as t(elem, ord)
        ) q
        where q.lab <> ''
      ) names
    ) as tasks
  from labeled l
  order by l.visit_date desc, l.site_code, l.crew_label
  limit 500;
$$;

create or replace function public.cj_client_v1_requests()
returns table(
  request_no text,
  site_code text,
  site_name text,
  kind text,
  preferred_date date,
  preferred_time text,
  frequency text,
  status text,
  scheduled_date date,
  details text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.req_no,
    s.site_code,
    s.site_name,
    left(coalesce(r.kind, ''), 160),
    case when r.pref_date::text ~ '^\d{4}-\d{2}-\d{2}' then (left(r.pref_date::text, 10))::date else null end,
    left(coalesce(r.pref_time, ''), 80),
    left(coalesce(r.frequency, ''), 80),
    case r.status
      when 'Requested' then 'Requested'
      when 'Scheduled' then 'Scheduled'
      when 'Declined' then 'Declined'
      when 'Cancelled' then 'Cancelled'
      else 'Closed'
    end,
    case when r.sched_date::text ~ '^\d{4}-\d{2}-\d{2}' then (left(r.sched_date::text, 10))::date else null end,
    left(coalesce(r.note, ''), 1000)
  from public.reg_cleaning_requests r
  join public.cj_client_v1_own_sites() s
    on s.site_code = r.site_code
  where r.company_id = 'cj'
    and r.client_id::text = public.cj_client_v1_client_id()::text
  order by r.pref_date desc nulls last, r.req_no desc
  limit 500;
$$;

-- sent_copy is the email body stored when the invoice was sent. This function
-- returns that copy unchanged. It does not write payment terms onto an older invoice.
-- Interest (2% a month, only after more than 60 days overdue) is calculated only
-- when data.terms is cj-2026-10, the marker stored on invoices that used that wording.
create or replace function public.cj_client_v1_invoices()
returns table(
  invoice_no text,
  period_start date,
  period_end date,
  amount numeric,
  hst numeric,
  total numeric,
  issued date,
  due date,
  status text,
  new_terms boolean,
  sent_copy jsonb,
  interest numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.data->>'number',
    case when i.data->>'periodStart' ~ '^\d{4}-\d{2}-\d{2}$' then (i.data->>'periodStart')::date else null end,
    case when i.data->>'periodEnd' ~ '^\d{4}-\d{2}-\d{2}$' then (i.data->>'periodEnd')::date else null end,
    case when coalesce(i.data->>'amount', '') ~ '^-?\d+(\.\d+)?$' then round((i.data->>'amount')::numeric, 2) else null end,
    case when coalesce(i.data->>'hst', '') ~ '^-?\d+(\.\d+)?$' then round((i.data->>'hst')::numeric, 2) else null end,
    case when coalesce(i.data->>'total', '') ~ '^-?\d+(\.\d+)?$' then round((i.data->>'total')::numeric, 2) else null end,
    case when i.data->>'issued' ~ '^\d{4}-\d{2}-\d{2}$' then (i.data->>'issued')::date else null end,
    case when i.data->>'due' ~ '^\d{4}-\d{2}-\d{2}$' then (i.data->>'due')::date else null end,
    case
      when coalesce(i.data->>'paidAt', '') ~ '^\d{4}-\d{2}-\d{2}' then 'Paid'
      when i.data->>'due' ~ '^\d{4}-\d{2}-\d{2}$' and (i.data->>'due')::date < current_date then 'Overdue'
      else 'Unpaid'
    end,
    (i.data->>'terms' = 'cj-2026-10'),
    case when jsonb_typeof(i.data->'sentCopy') = 'array' then i.data->'sentCopy' else null end,
    case
      when coalesce(i.data->>'paidAt', '') ~ '^\d{4}-\d{2}-\d{2}' then null
      when i.data->>'terms' is distinct from 'cj-2026-10' then null
      when coalesce(i.data->>'total', '') !~ '^-?\d+(\.\d+)?$' then null
      when coalesce(i.data->>'due', '') !~ '^\d{4}-\d{2}-\d{2}$' then null
      when current_date <= (i.data->>'due')::date + coalesce(nullif(i.data->>'interestAfterDays', '')::int, 60) then null
      else round(
        (i.data->>'total')::numeric
        * coalesce(nullif(i.data->>'interestPct', '')::numeric, 2) / 100
        * ceil((
          (current_date - (i.data->>'due')::date)
          - coalesce(nullif(i.data->>'interestAfterDays', '')::int, 60)
        )::numeric / 30)
      , 2)
    end
  from public.reg_client_invoices i
  where i.company_id = 'cj'
    and public.cj_client_v1_client_id() is not null
    and i.data->>'firmId' = public.cj_client_v1_client_id()::text
    and coalesce(i.data->>'draft', '') <> 'true'
    and coalesce(i.data->>'number', '') <> ''
  order by (i.data->>'issued') desc nulls last, i.data->>'number' desc
  limit 500;
$$;

comment on function public.cj_client_v1_whoami() is
  'CJ client portal v1. Caller is a CJ client, or ok=false. No worker fields.';
comment on function public.cj_client_v1_sites() is
  'CJ client portal v1. Site code and site name for the caller only. Omits ownerName.';
comment on function public.cj_client_v1_visits(date, date) is
  'CJ client portal v1. Visit date, clock times, and hours on site. Crew label only, no person id. Skips supervisor-check rows.';
comment on function public.cj_client_v1_supervisor_checks(date, date) is
  'CJ client portal v1. Supervisor check visits for the caller''s sites: date and the label Supervisor. No name and no pay.';
comment on function public.cj_client_v1_hours(date, date) is
  'CJ client portal v1. Hours on site from clock in to clock out. No pay and no rates.';
comment on function public.cj_client_v1_checklists(date, date) is
  'CJ client portal v1. Checklist result for the caller''s sites. Crew label only.';
comment on function public.cj_client_v1_requests() is
  'CJ client portal v1. Plain cleaning requests for the caller''s sites. No rates.';
comment on function public.cj_client_v1_invoices() is
  'CJ client portal v1. Stored invoice number and sentCopy for the caller. Terms are not rewritten. Interest only when data.terms is cj-2026-10.';

revoke all on function public.cj_client_v1_hhmm(text) from public, anon, authenticated;
revoke all on function public.cj_client_v1_minutes(text) from public, anon, authenticated;
revoke all on function public.cj_client_v1_client_id() from public, anon, authenticated;
revoke all on function public.cj_client_v1_own_sites() from public, anon, authenticated;
revoke all on function public.cj_client_v1_crew_labels(date, date) from public, anon, authenticated;

revoke all on function public.cj_client_v1_whoami() from public, anon, authenticated;
revoke all on function public.cj_client_v1_sites() from public, anon, authenticated;
revoke all on function public.cj_client_v1_visits(date, date) from public, anon, authenticated;
revoke all on function public.cj_client_v1_supervisor_checks(date, date) from public, anon, authenticated;
revoke all on function public.cj_client_v1_hours(date, date) from public, anon, authenticated;
revoke all on function public.cj_client_v1_checklists(date, date) from public, anon, authenticated;
revoke all on function public.cj_client_v1_requests() from public, anon, authenticated;
revoke all on function public.cj_client_v1_invoices() from public, anon, authenticated;

grant execute on function public.cj_client_v1_whoami() to authenticated;
grant execute on function public.cj_client_v1_sites() to authenticated;
grant execute on function public.cj_client_v1_visits(date, date) to authenticated;
grant execute on function public.cj_client_v1_supervisor_checks(date, date) to authenticated;
grant execute on function public.cj_client_v1_hours(date, date) to authenticated;
grant execute on function public.cj_client_v1_checklists(date, date) to authenticated;
grant execute on function public.cj_client_v1_requests() to authenticated;
grant execute on function public.cj_client_v1_invoices() to authenticated;

commit;
