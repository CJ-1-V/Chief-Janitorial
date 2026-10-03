/* ADMIN screens. Company scoping: the owner can switch Chief Janitorial / Unscramble / both;
 * a company admin sees only their company (also enforced by the database RLS policies).
 * Sites are shown by NUMBER ONLY. Client names are added outside the app from the Drive Site Key. */
(function () {
  const ST = window.ST; const { sb, esc, fmtTime, fmtDate, fmtDay, fmtDT, hours, fmtDur, money, mBadge, q, toast, modal, unpaidBreak, errMsg, COMPANIES, download, csv } = ST;
  const C = window.ST_CONFIG; const T = () => ST.tz();
  const ROLES = ['Labourer', 'Truck driver', 'Cleaner', 'Painter', 'Machine operator'];
  const h2 = (h) => (Math.round(h * 100) / 100).toFixed(2);
  const r2 = (n) => Math.round(n * 100) / 100;
  const allowed = () => ST.me.companies;
  const filter = () => { const f = localStorage.getItem('st-co') || 'all'; return allowed().includes(f) ? f : 'all'; };
  const scope = () => (allowed().length > 1 && filter() !== 'all' ? [filter()] : allowed());
  const chip = (co) => `<span class="cochip co-${co}" title="${COMPANIES[co].name}">${COMPANIES[co].short}</span>`;
  const params = () => new URLSearchParams((location.hash.split('?')[1]) || '');
  const go = (path, p) => { location.hash = '#/admin/' + path + (p ? '?' + new URLSearchParams(p) : ''); };
  const flagTag = (f) => `<span class="flag ${/missing/.test(f) ? 'bad' : ''}">${esc(f.replace(/_/g, ' '))}</span>`;
  const dayRange = (from, to) => [T().zoned(from, 0, 0).toISOString(), T().zoned(T().addDays(to, 1), 0, 0).toISOString()];

  async function sitesInScope() { return q(sb.from('sites').select('*').in('company_id', scope()).order('site_no')); }
  async function people() { const r = await q(sb.from('profiles').select('id, full_name, nickname, phone, company_id, status, is_staff, created_at, decided_at').order('created_at', { ascending: false })); const m = {}; r.forEach((p) => (m[p.id] = p)); return { list: r.filter((p) => scope().includes(p.company_id)), byId: m }; }  // byId also holds workers from the other office who worked at our sites (RLS decides)
  async function shiftsBetween(from, to, siteId) {
    const [a, b] = dayRange(from, to);
    let qq = sb.from('shifts').select('*').in('company_id', scope()).gte('clock_in', a).lt('clock_in', b).order('clock_in', { ascending: false }).limit(2000);
    if (siteId) qq = qq.eq('site_id', siteId);
    const rows = await q(qq);
    if (rows.length) { const ed = await q(sb.from('shift_edits').select('shift_id, field, by_kind, reason, details, at, old_value, new_value').in('shift_id', rows.map((r) => r.id))); rows.forEach((s) => { s.edits = ed.filter((e) => e.shift_id === s.id); s.inM = s.edits.some((e) => e.field === 'clock_in'); s.outM = s.edits.some((e) => e.field === 'clock_out'); }); }
    return rows;
  }
  async function openShifts() { return q(sb.from('shifts').select('id, user_id, site_id, company_id, clock_in').in('company_id', scope()).is('clock_out', null)); }

  function shell(active, body, pendingN) {
    const me = ST.me; const sc = scope(); const f = filter();
    const top = me.roles.filter((r) => sc.includes(r.company_id)).map((r) => r.role)[0] || 'staff';
    const switcher = allowed().length > 1
      ? `<label class="coswitch" title="Company filter — applies to every admin page"><span>Company</span><select id="coFilter"><option value="all" ${f === 'all' ? 'selected' : ''}>All companies</option><option value="cj" ${f === 'cj' ? 'selected' : ''}>Chief Janitorial</option><option value="us" ${f === 'us' ? 'selected' : ''}>Unscramble</option></select></label>`
      : `<span class="coswitch fixed co-${allowed()[0]}" title="This login only sees ${COMPANIES[allowed()[0]].name}">${COMPANIES[allowed()[0]].name} only</span>`;
    const billing = sc.some((c) => ST.canBill(c));
    const link = (k, label, extra) => `<a href="#/admin/${k}" class="${active === k ? 'on' : ''}">${label}${extra || ''}</a>`;
    document.title = 'Shift Tracker — Admin';
    return `<div class="adm"><header class="adm-top"><div class="adm-top-in">
        <a href="#/admin/dashboard">${ST.logo(sc.length > 1 ? 'both' : sc[0])}</a>
        <nav class="adm-nav">${link('dashboard', 'Dashboard')}${link('employees', 'Employees', pendingN ? ` <span class="count">${pendingN}</span>` : '')}${link('shifts', 'Shifts')}${link('timesheets', 'Timesheets')}${billing ? link('rates', 'Rates') + link('invoices', 'Invoices') : ''}${sc.some((c) => ST.can(c, ['owner', 'admin'])) ? link('sites', 'Sites') : ''}</nav>
        <div class="topbar-r">${ST.themeBtn()}${switcher}<span class="who">${esc(ST.who(me.profile))} <em>${esc(top[0].toUpperCase() + top.slice(1))}</em></span><button class="btn small ghost" data-act="logout">Log out</button></div>
      </div></header>
      ${sc.length === 1 && allowed().length > 1 ? `<div class="co-band co-${sc[0]}">Showing <b>${COMPANIES[sc[0]].name}</b> only · <a href="#" data-cof="all">show all companies</a></div>` : ''}
      <main class="adm-main">${body}</main></div>`;
  }
  function bindShell(root) {
    const s = root.querySelector('#coFilter'); s && s.addEventListener('change', () => { localStorage.setItem('st-co', s.value); ST.render(); });
    root.querySelectorAll('[data-cof]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); localStorage.setItem('st-co', a.dataset.cof); ST.render(); }));
  }

  // ---------- billable / pay maths (per worker-day per site; split shifts added together) ----------
  function workerDays(shifts, site) {
    const m = {};
    shifts.filter((s) => s.clock_out).forEach((s) => {
      const k = s.user_id + '|' + T().dayKey(s.clock_in) + '|' + s.site_id;
      const d = (m[k] = m[k] || { user_id: s.user_id, day: T().dayKey(s.clock_in), site_id: s.site_id, worked: 0, shifts: [], edited: false, roles: new Set(), crew: [] });
      d.worked += hours(s.clock_in, s.clock_out); d.shifts.push(s); d.edited = d.edited || s.inM || s.outM; d.roles.add(s.work_role || ''); if (s.crew_count) d.crew.push(s.crew_count);
    });
    return Object.values(m).map((d) => {
      const minH = site && site.min_hours_per_day ? +site.min_hours_per_day : 0;
      const unpaid = unpaidBreak(d.worked); const billable = Math.max(d.worked, minH);
      return { ...d, unpaid, paid: d.worked - unpaid, billable, billAdj: billable - d.worked };
    }).sort((a, b) => a.day.localeCompare(b.day) || a.user_id.localeCompare(b.user_id));
  }

  // ---------- Dashboard ----------
  async function dashboard() {
    const tk = T().todayKey(); const ws = T().weekStart(tk);
    const [pp, open, wk, sites] = await Promise.all([people(), openShifts(), shiftsBetween(ws, tk), sitesInScope()]);
    const pending = pp.list.filter((p) => p.status === 'pending' && !p.is_staff);
    const missed = open.filter((s) => hours(s.clock_in, new Date().toISOString()) > 14);
    const wkH = wk.filter((s) => s.clock_out).reduce((a, s) => a + hours(s.clock_in, s.clock_out), 0);
    const edits = wk.filter((s) => s.inM || s.outM).length;
    const rateMissing = sites.filter((s) => s.flags.includes('rate_missing') || s.flags.includes('fee_missing'));
    let overdue = []; if (scope().some((c) => ST.canBill(c))) overdue = await q(sb.from('invoices').select('invoice_no, due_on, total, amount_paid, status').in('company_id', scope()).eq('status', 'sent').lt('due_on', tk));
    const sn = {}; const sno = {}; sites.forEach((s) => { sn[s.id] = ST.siteName(s); sno[s.id] = s; });
    return [shell('dashboard', `<div class="page-h"><h1>Dashboard</h1><span class="muted">${fmtDay(tk)} · Atlantic time</span></div>
      <div class="stats six">
        <div class="stat"><span>On shift now</span><b>${open.length}</b></div>
        <div class="stat"><span>Hours this week</span><b>${fmtDur(wkH)}</b></div>
        <div class="stat"><span>Manual edits (this week)</span><b>${edits} <span class="mbadge">M</span></b></div>
        <div class="stat ${missed.length ? 'alert' : ''}"><span>Missed clock-outs</span><b>${missed.length}</b></div>
        <div class="stat ${pending.length ? 'alert' : ''}"><span>Sign-ups waiting</span><b>${pending.length}</b></div>
        <div class="stat ${overdue.length ? 'alert' : ''}"><span>Overdue invoices</span><b>${overdue.length}</b></div>
      </div>
      ${pending.length ? `<section class="panel"><h2>Sign-ups waiting for approval</h2>${pending.map((p) => `<div class="row-between"><span>${chip(p.company_id)} ${esc(ST.who(p))} · ${esc(p.phone || '')}</span><a class="btn small primary" href="#/admin/employees">Review</a></div>`).join('')}</section>` : ''}
      <section class="panel"><h2>On shift now</h2>${open.length ? `<table class="tbl"><tr><th></th><th>Employee</th><th>Site</th><th>Since</th><th></th></tr>${open.map((s) => `<tr><td>${chip(s.company_id)}</td><td>${esc(ST.who(pp.byId[s.user_id]))}</td><td>${esc(sn[s.site_id])}</td><td>${fmtDT(s.clock_in)}</td><td>${hours(s.clock_in, new Date().toISOString()) > 14 ? '<span class="tag bad">No clock-out</span>' : ''}</td></tr>`).join('')}</table>` : '<div class="empty">Nobody is clocked in.</div>'}</section>
      ${rateMissing.length ? `<section class="panel"><h2>Sites that can't be invoiced yet</h2><p class="muted small">Missing rate or monthly fee — owner question. Invoices for these sites are blocked until a rate is added.</p><div class="chips">${rateMissing.map((s) => `<span class="tag">${chip(s.company_id)} ${esc(ST.siteName(s))}</span>`).join(' ')}</div></section>` : ''}`, pending.length)];
  }

  // ---------- Employees / approvals ----------
  async function employees() {
    const pp = await people(); const emp = pp.list.filter((p) => !p.is_staff);
    const pending = emp.filter((p) => p.status === 'pending');
    const row = (p) => `<tr><td>${chip(p.company_id)}</td><td>${esc(ST.who(p))}${!p.is_staff && ST.canOps(p.company_id) ? ` <button class="linkbtn small" data-reroll="${p.id}" title="Give this worker a new random nickname">🎲</button>` : ''}</td><td>${esc(p.phone || '')}</td><td><span class="tag ${p.status === 'active' ? 'on' : p.status === 'disabled' ? 'bad' : ''}">${p.status}</span></td><td>${fmtDT(p.created_at)}</td>
      <td>${ST.canOps(p.company_id) ? (p.status === 'pending' ? `<button class="btn small primary" data-appr="${p.id}" data-ok="1">Approve</button> <button class="btn small ghost" data-appr="${p.id}" data-ok="0">Reject</button>` : p.status === 'active' ? `<button class="btn small ghost" data-appr="${p.id}" data-ok="0">Turn off</button>` : `<button class="btn small ghost" data-appr="${p.id}" data-ok="1">Turn back on</button>`) : ''}</td></tr>`;
    return [shell('employees', `<div class="page-h"><h1>Employees</h1><span class="muted">${emp.length} accounts · ${pending.length} waiting</span></div>
      <section class="panel"><h2>Sign-up approvals</h2>${pending.length ? `<table class="tbl"><tr><th></th><th>Nickname</th><th>Phone (login)</th><th>Status</th><th>Signed up</th><th></th></tr>${pending.map(row).join('')}</table>` : '<div class="empty">No sign-ups waiting.</div>'}</section>
      <section class="panel"><h2>All employees</h2><table class="tbl"><tr><th></th><th>Nickname</th><th>Phone (login)</th><th>Status</th><th>Signed up</th><th></th></tr>${emp.filter((p) => p.status !== 'pending').map(row).join('') || '<tr><td colspan="6" class="empty">None yet.</td></tr>'}</table>
      <p class="muted small">Password resets: not self-service yet (needs a small server function). Until then the owner resets a password in the Supabase dashboard.</p></section>`, pending.length), (root) => {
      root.querySelectorAll('[data-reroll]').forEach((b) => b.addEventListener('click', async () => {
        try { const n = await q(sb.rpc('reroll_nickname', { p_user: b.dataset.reroll })); toast('New nickname: ' + n, 'good'); ST.render(); } catch (e) { toast(errMsg(e), 'bad'); }
      }));
      root.querySelectorAll('[data-appr]').forEach((b) => b.addEventListener('click', async () => {
        try { await q(sb.rpc('approve_employee', { p_user: b.dataset.appr, p_approve: b.dataset.ok === '1' })); toast(b.dataset.ok === '1' ? 'Approved ✓' : 'Turned off', 'good'); ST.render(); } catch (e) { toast(errMsg(e), 'bad'); }
      }));
    }];
  }

  // ---------- Shifts ----------
  async function shiftsPage() {
    const p = params(); const tk = T().todayKey();
    const range = p.get('r') || 'week';
    const from = range === 'today' ? tk : range === 'last' ? T().addDays(T().weekStart(tk), -7) : range === '30' ? T().addDays(tk, -30) : T().weekStart(tk);
    const to = range === 'last' ? T().addDays(T().weekStart(tk), -1) : tk;
    const [sites, pp] = await Promise.all([sitesInScope(), people()]);
    const siteF = p.get('site') || ''; const site = sites.find((s) => String(s.site_no) === siteF);
    const rows = await shiftsBetween(from, to, site && site.id);
    const sn = {}; const sno = {}; sites.forEach((s) => { sn[s.id] = ST.siteName(s); sno[s.id] = s; });
    const name = (id) => esc(ST.who(pp.byId[id]));
    const loc = (s) => (s.loc_status === 'ok' ? '<span class="tag on">at site</span>' : s.loc_status === 'off' ? `<span class="tag bad">${s.loc_distance_m} m away</span>` : '<span class="muted small">no GPS point</span>');
    const exp = () => download(`shifts-${from}-to-${to}.csv`, csv([['company', 'employee', 'phone', 'site_code', 'site_no', 'date', 'clock_in', 'clock_out', 'worked_h', 'crew', 'role', 'edited', 'location', 'in_note', 'out_note'], ...rows.map((s) => [s.company_id.toUpperCase(), ST.who(pp.byId[s.user_id]), (pp.byId[s.user_id] || {}).phone, (sno[s.site_id] || {}).site_code || '', (sno[s.site_id] || {}).site_no, T().dayKey(s.clock_in), fmtTime(s.clock_in), s.clock_out ? fmtTime(s.clock_out) : '', s.clock_out ? h2(hours(s.clock_in, s.clock_out)) : '', s.crew_count, s.work_role, s.inM || s.outM ? 'M' : '', s.loc_status, s.in_note, s.out_note])]));
    const opt = (v, l) => `<option value="${v}" ${range === v ? 'selected' : ''}>${l}</option>`;
    return [shell('shifts', `<div class="page-h"><h1>Shifts</h1><button class="btn primary" id="exportBtn">⤓ Export CSV</button></div>
      <div class="filters form-row"><label>Period<select id="rF">${opt('today', 'Today')}${opt('week', 'This week')}${opt('last', 'Last week')}${opt('30', 'Last 30 days')}</select></label>
        <label>Site<select id="sF"><option value="">All sites</option>${sites.map((s) => `<option value="${s.site_no}" ${String(s.site_no) === siteF ? 'selected' : ''}>${esc(ST.siteName(s))}</option>`).join('')}</select></label><span class="muted">${rows.length} shifts · ${fmtDay(from)} – ${fmtDay(to)}</span></div>
      <table class="tbl"><tr><th></th><th>Date</th><th>Employee</th><th>Site</th><th>In</th><th>Out</th><th class="num">Worked</th><th class="num">Crew</th><th>Role</th><th>Location</th><th>Notes</th><th></th></tr>
      ${rows.map((s) => `<tr><td>${chip(s.company_id)}</td><td>${fmtDate(s.clock_in)}</td><td>${name(s.user_id)}</td><td>${esc(sn[s.site_id])}</td><td>${fmtTime(s.clock_in)}${mBadge(s.inM)}</td><td>${s.clock_out ? fmtTime(s.clock_out) : '<span class="tag on">on shift</span>'}${mBadge(s.outM)}</td><td class="num">${s.clock_out ? fmtDur(hours(s.clock_in, s.clock_out)) : ''}</td><td class="num">${s.crew_count ?? ''}</td><td>${esc(s.work_role || '')}</td><td>${loc(s)}</td><td class="small">${s.in_note ? '📝 ' + esc(s.in_note) : ''}${s.out_note ? '<br>🗒 ' + esc(s.out_note) : ''}</td><td>${s.locked ? '🔒 ' : ''}${(!s.locked && ST.canOps(s.company_id)) || ST.can(s.company_id, ['owner']) ? `<button class="btn small" data-edit="${s.id}">Edit</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="12" class="empty">No shifts in this period.</td></tr>'}</table>
      <p class="muted small"><span class="mbadge">M</span> = time changed by hand (original kept). Locked 🔒 = invoiced; only the owner can change it.</p>`), (root) => {
      root.querySelector('#exportBtn').addEventListener('click', exp);
      root.querySelector('#rF').addEventListener('change', (e) => go('shifts', { r: e.target.value, site: siteF }));
      root.querySelector('#sF').addEventListener('change', (e) => go('shifts', { r: range, site: e.target.value }));
      root.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => {
        const s = rows.find((x) => x.id === b.dataset.edit);
        modal(`<h2>Edit shift · ${esc(sn[s.site_id])}</h2><p class="muted">${name(s.user_id)} · ${fmtDate(s.clock_in)}</p>
          <form id="oe" class="stack"><label class="field"><span>Clock-in</span><input type="datetime-local" name="ci" value="${T().toInput(s.clock_in)}" required></label>
          <label class="field"><span>Clock-out</span><input type="datetime-local" name="co" value="${T().toInput(s.clock_out)}"></label>
          <label class="field"><span>Workers on site</span><input type="number" name="crew" min="1" max="50" value="${s.crew_count ?? ''}"></label>
          <label class="field"><span>Role (for billing)</span><select name="role"><option value="">—</option>${ROLES.map((r) => `<option ${s.work_role === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
          <label class="field"><span>Reason / details</span><input name="det" maxlength="200" placeholder="e.g. confirmed with crew lead"></label>
          ${s.edits.length ? `<div class="small muted">History: ${s.edits.map((e) => `${esc(e.field)} ${esc(e.old_value || '—')} → ${esc(e.new_value || '—')} (${e.by_kind}, ${fmtDate(e.at)})`).join('<br>')}</div>` : ''}
          <div class="err" id="oeErr"></div><div class="row-end"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Save (marks M)</button></div></form>`, (w, close) => {
          w.querySelector('#oe').addEventListener('submit', async (e) => {
            e.preventDefault(); const d = new FormData(e.target);
            try { await q(sb.rpc('office_edit_shift', { p_shift: s.id, p_clock_in: d.get('ci') === T().toInput(s.clock_in) ? s.clock_in : T().fromInput(d.get('ci')), p_clock_out: !d.get('co') ? null : d.get('co') === T().toInput(s.clock_out) ? s.clock_out : T().fromInput(d.get('co')), p_crew: d.get('crew') ? +d.get('crew') : null, p_role: d.get('role') || null, p_details: d.get('det') || null })); close(); toast('Saved ✓', 'good'); ST.render(); }
            catch (err) { w.querySelector('#oeErr').textContent = errMsg(err); }
          });
        });
      }));
    }];
  }

  // ---------- Timesheets per site number (PDF via print, CSV) ----------
  async function timesheets() {
    const p = params(); const tk = T().todayKey(); const ws = p.get('week') || T().weekStart(tk); const we = T().addDays(ws, 6);
    const [sites, pp] = await Promise.all([sitesInScope(), people()]);
    const all = await shiftsBetween(ws, we);
    const withShifts = sites.filter((s) => all.some((x) => x.site_id === s.id));
    const site = sites.find((s) => String(s.site_no) === p.get('site')) || withShifts[0];
    const rows = site ? workerDays(all.filter((x) => x.site_id === site.id), site) : [];
    const name = (id) => ST.who(pp.byId[id]);
    const showBill = site && ST.canBill(site.company_id);
    const tot = (k) => rows.reduce((a, r) => a + r[k], 0);
    const openN = site ? all.filter((x) => x.site_id === site.id && !x.clock_out).length : 0;
    const csvOut = () => download(`timesheet-${site.site_code || 'site-' + site.site_no}-${ws}.csv`, csv([['company', 'site_code', 'site_no', 'week_start', 'employee', 'phone', 'date', 'in', 'out', 'crew', 'worked_h', 'unpaid_break_h', 'paid_h', ...(showBill ? ['billable_h'] : []), 'edited'], ...rows.map((r) => [site.company_id.toUpperCase(), site.site_code || '', site.site_no, ws, name(r.user_id), (pp.byId[r.user_id] || {}).phone, r.day, r.shifts.map((s) => fmtTime(s.clock_in)).join(' / '), r.shifts.map((s) => fmtTime(s.clock_out)).join(' / '), r.crew.join('/'), h2(r.worked), h2(r.unpaid), h2(r.paid), ...(showBill ? [h2(r.billable)] : []), r.edited ? 'M' : ''])]));
    const co = site ? site.company_id : scope()[0];
    return [shell('timesheets', `<div class="page-h no-print"><h1>Timesheets</h1><span class="muted">Per site number · week Mon–Sun (Atlantic)</span></div>
      <div class="form-row no-print"><label>Week<span class="segs"><button class="btn small" id="prevW">‹</button> <b>${fmtDay(ws)} – ${fmtDay(we)}</b> <button class="btn small" id="nextW">›</button></span></label>
        <label>Site<select id="sF">${sites.map((s) => `<option value="${s.site_no}" ${site && s.id === site.id ? 'selected' : ''}>${esc(ST.siteName(s))}${withShifts.includes(s) ? ' •' : ''}</option>`).join('')}</select></label>
        <span class="spacer"></span>${site ? '<button class="btn" id="pBtn">⤓ PDF (print → Save as PDF)</button> <button class="btn primary" id="cBtn">⤓ CSV</button>' : ''}</div>
      <p class="muted small no-print">• = site has shifts this week. The printed sheet shows the site number only; add the client name from the Drive Site Key if the client needs it.</p>
      ${site ? `<div class="sheet"><div class="sheet-h co-${co}">${ST.logo(co)}<div class="sheet-co">${COMPANIES[co].name}</div><div class="sheet-t"><h1>Weekly Timesheet</h1><div>Week of <b>${fmtDay(ws)} – ${fmtDay(we)}</b> <span class="muted">(Mon–Sun, Atlantic)</span></div></div></div>
        <div class="sheet-meta"><div><span>Site</span><b>${esc(ST.siteName(site))}</b></div><div><span>Type</span><b>${esc(site.label)}</b></div><div><span>Prepared</span><b>${fmtDT(new Date().toISOString())}</b></div>${openN ? `<div><span>Open shifts</span><b class="bad">${openN} not clocked out</b></div>` : ''}</div>
        <table class="sheet-tbl tbl"><thead><tr><th>Employee</th><th>Date</th><th>In</th><th>Out</th><th class="num">Crew</th><th class="num">Worked</th><th class="num">Unpaid break</th><th class="num">Paid</th>${showBill ? '<th class="num">Billable</th>' : ''}</tr></thead><tbody>
        ${rows.map((r) => `<tr><td>${esc(name(r.user_id))}</td><td>${fmtDay(r.day)}</td><td>${r.shifts.map((s) => fmtTime(s.clock_in) + mBadge(s.inM)).join('<br>')}</td><td>${r.shifts.map((s) => fmtTime(s.clock_out) + mBadge(s.outM)).join('<br>')}</td><td class="num">${r.crew.join('/')}</td><td class="num">${h2(r.worked)}</td><td class="num">${r.unpaid ? '−' + h2(r.unpaid) : '0.00'}</td><td class="num"><b>${h2(r.paid)}</b></td>${showBill ? `<td class="num">${h2(r.billable)}${r.billAdj > 0 ? ` <span class="flag" title="Billing minimum ${site.min_hours_per_day} h/day">min</span>` : ''}</td>` : ''}</tr>`).join('') || `<tr><td colspan="9" class="empty">No completed shifts at ${esc(ST.siteName(site))} this week.</td></tr>`}
        </tbody><tfoot><tr><th colspan="5">Totals</th><th class="num">${h2(tot('worked'))}</th><th class="num">−${h2(tot('unpaid'))}</th><th class="num">${h2(tot('paid'))}</th>${showBill ? `<th class="num">${h2(tot('billable'))}</th>` : ''}</tr></tfoot></table>
        <div class="sheet-foot small"><span class="mbadge">M</span> = time changed by hand. Unpaid break per worker per day: over 5 h → 0.5 h, 8 h or more → 1 h.${showBill && site.min_hours_per_day ? ` Billable includes the ${site.min_hours_per_day} h/day minimum.` : ''}<br><br>Approved by: ____________________ &nbsp; Date: ____________</div></div>` : '<div class="empty">No sites in scope.</div>'}`), (root) => {
      const nav = (w, s) => go('timesheets', { week: w, site: s });
      root.querySelector('#prevW').addEventListener('click', () => nav(T().addDays(ws, -7), site ? site.site_no : ''));
      root.querySelector('#nextW').addEventListener('click', () => nav(T().addDays(ws, 7), site ? site.site_no : ''));
      root.querySelector('#sF') && root.querySelector('#sF').addEventListener('change', (e) => nav(ws, e.target.value));
      const pb = root.querySelector('#pBtn'); pb && pb.addEventListener('click', () => window.print());
      const cb = root.querySelector('#cBtn'); cb && cb.addEventListener('click', csvOut);
    }];
  }

  // ---------- Rates per role (effective-dated; insert only) ----------
  const rateOn = (rates, siteId, role, day) => rates.filter((r) => r.site_id === siteId && r.role === role && r.effective_from <= day).sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0];
  async function ratesPage() {
    const tk = T().todayKey();
    const sites = (await sitesInScope()).filter((s) => ST.canBill(s.company_id));
    const rates = await q(sb.from('site_rates').select('*').in('company_id', scope()).order('effective_from'));
    const p = params(); const onlyFlag = p.get('f') === '1';
    const list = onlyFlag ? sites.filter((s) => s.flags.length) : sites;
    const cell = (s) => { const roles = [...new Set(rates.filter((r) => r.site_id === s.id).map((r) => r.role))];
      if (s.billing_type === 'monthly') return s.monthly_fee ? `${money(s.monthly_fee)}/month${s.monthly_fee_incl_hst ? ' (incl. HST)' : ' + HST'}` : '<span class="flag bad">monthly fee missing</span>';
      if (!roles.length) return '<span class="flag bad">no rate — invoices blocked</span>';
      return roles.map((role) => { const cur = rateOn(rates, s.id, role, tk); const next = rates.filter((r) => r.site_id === s.id && r.role === role && r.effective_from > tk);
        return `<div>${esc(role)}: <b>${cur ? money(cur.rate) : '—'}</b>${cur ? ` <span class="muted small">since ${cur.effective_from}</span>` : ''}${next.map((n) => ` <span class="tag">${money(n.rate)} from ${n.effective_from}</span>`).join('')}</div>`; }).join(''); };
    return [shell('rates', `<div class="page-h"><h1>Rates per role</h1><span class="muted">Hourly rate per site number and role. A change is a new dated rate (history kept). Never shown to employees.</span></div>
      <section class="panel"><h2>Add a rate</h2><form id="addRate" class="form-row">
        <label>Site<select name="site" required>${sites.map((s) => `<option value="${s.id}">${s.company_id.toUpperCase()} · ${esc(ST.siteName(s))}</option>`).join('')}</select></label>
        <label>Role<select name="role">${ROLES.map((r) => `<option>${r}</option>`).join('')}</select></label>
        <label>Rate $/h<input name="rate" type="number" step="0.01" min="0.01" required></label>
        <label>Effective from<input name="eff" type="date" value="${tk}" required></label>
        <label>Note<input name="note" maxlength="200" placeholder="optional"></label>
        <button class="btn primary">Add rate</button></form><div class="err" id="rateErr"></div></section>
      <div class="form-row"><label class="chk"><input type="checkbox" id="onlyF" ${onlyFlag ? 'checked' : ''}> Only flagged sites (owner questions)</label><span class="muted">${list.length} sites</span></div>
      <table class="tbl"><tr><th></th><th>Site</th><th>Type</th><th>Billing</th><th>Current rate(s)</th><th>Billing min.</th><th>Terms</th><th>Flags</th>${sites.some((s) => ST.can(s.company_id, ['owner', 'admin'])) ? '<th></th>' : ''}</tr>
      ${list.map((s) => `<tr><td>${chip(s.company_id)}</td><td><b>${esc(ST.siteName(s))}</b>${s.site_code ? '' : ' <span class="flag bad">name needed</span>'}</td><td>${esc(s.label)}</td><td>${s.billing_type}</td><td>${cell(s)}</td><td>${s.min_hours_per_day ? s.min_hours_per_day + ' h/day' : ''}</td><td class="small">${esc((s.payment_terms || '').replace(/_/g, ' '))}</td><td>${s.flags.map(flagTag).join('')}</td>${ST.can(s.company_id, ['owner', 'admin']) ? `<td>${s.billing_type === 'monthly' ? `<button class="btn small" data-fee="${s.id}">Monthly fee</button> ` : ''}<button class="btn small ghost" data-gps="${s.id}" title="GPS point for the clock-in location check">${s.lat != null ? '📍 GPS' : '+ GPS'}</button></td>` : ''}</tr>`).join('')}</table>`), (root) => {
      root.querySelector('#onlyF').addEventListener('change', (e) => go('rates', e.target.checked ? { f: 1 } : null));
      root.querySelector('#addRate').addEventListener('submit', async (e) => {
        e.preventDefault(); const d = new FormData(e.target); const s = sites.find((x) => x.id === d.get('site'));
        try {
          await q(sb.from('site_rates').insert({ site_id: s.id, company_id: s.company_id, role: d.get('role'), rate: +d.get('rate'), effective_from: d.get('eff'), note: d.get('note') || null }));
          if (s.flags.includes('rate_missing') && ST.can(s.company_id, ['owner', 'admin'])) await q(sb.from('sites').update({ flags: s.flags.filter((f) => f !== 'rate_missing') }).eq('id', s.id));
          toast('Rate added ✓', 'good'); ST.render();
        } catch (err) { root.querySelector('#rateErr').textContent = /duplicate/.test(errMsg(err)) ? 'That site already has a rate for this role starting that day.' : errMsg(err); }
      });
      root.querySelectorAll('[data-gps]').forEach((b) => b.addEventListener('click', () => {
        const s = sites.find((x) => x.id === b.dataset.gps);
        modal(`<h2>GPS point · ${esc(ST.siteName(s))}</h2><p class="muted small">Used only for the clock-in check (employee within the radius). Leave empty for “no GPS point”. Employees' raw positions are never stored.</p><form id="gpsF" class="stack"><label class="field"><span>Latitude</span><input name="lat" type="number" step="0.000001" min="40" max="50" value="${s.lat ?? ''}"></label><label class="field"><span>Longitude</span><input name="lng" type="number" step="0.000001" min="-70" max="-59" value="${s.lng ?? ''}"></label><label class="field"><span>Radius (m)</span><input name="r" type="number" min="50" max="5000" value="${s.radius_m}"></label><div class="err" id="gpsErr"></div><div class="row-end"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Save</button></div></form>`, (w, close) => {
          w.querySelector('#gpsF').addEventListener('submit', async (e) => { e.preventDefault(); const d = new FormData(e.target); const lat = d.get('lat') ? +d.get('lat') : null; const lng = d.get('lng') ? +d.get('lng') : null;
            if ((lat == null) !== (lng == null)) { w.querySelector('#gpsErr').textContent = 'Enter both latitude and longitude, or neither.'; return; }
            try { await q(sb.from('sites').update({ lat, lng, radius_m: +d.get('r') }).eq('id', s.id)); close(); toast('Saved ✓', 'good'); ST.render(); } catch (err) { w.querySelector('#gpsErr').textContent = errMsg(err); } });
        });
      }));
      root.querySelectorAll('[data-fee]').forEach((b) => b.addEventListener('click', () => {
        const s = sites.find((x) => x.id === b.dataset.fee);
        modal(`<h2>Monthly fee · ${esc(ST.siteName(s))}</h2><form id="feeF" class="stack"><label class="field"><span>Fee per month ($)</span><input name="fee" type="number" step="0.01" min="0" value="${s.monthly_fee ?? ''}" required></label><label class="chk"><input type="checkbox" name="incl" ${s.monthly_fee_incl_hst ? 'checked' : ''}> Fee already includes HST</label><div class="err" id="feeErr"></div><div class="row-end"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Save</button></div></form>`, (w, close) => {
          w.querySelector('#feeF').addEventListener('submit', async (e) => { e.preventDefault(); const d = new FormData(e.target);
            try { await q(sb.from('sites').update({ monthly_fee: +d.get('fee'), monthly_fee_incl_hst: !!d.get('incl'), flags: s.flags.filter((f) => f !== 'fee_missing') }).eq('id', s.id)); close(); toast('Saved ✓', 'good'); ST.render(); } catch (err) { w.querySelector('#feeErr').textContent = errMsg(err); } });
        });
      }));
    }];
  }

  // ---------- Invoices ----------
  async function buildInvoice(site, from, to) {
    const blocks = []; const warns = [];
    if (site.flags.includes('rate_check')) warns.push('This site\'s rate is flagged “rate check” (owner question). Confirm the rate before sending.');
    if (site.flags.includes('no_client_matched')) warns.push('This site number has no matched client in the Site Key yet (owner question).');
    if (site.billing_type === 'per-visit') { blocks.push('Per-visit site: price per visit is not set up in the app yet. Invoice it by hand.'); return { blocks, warns, lines: [] }; }
    if (site.billing_type === 'monthly') {
      if (!site.monthly_fee) { blocks.push('Monthly fee missing for this site (owner question). Add it on the Rates page.'); return { blocks, warns, lines: [] }; }
      const fee = +site.monthly_fee; const sub = site.monthly_fee_incl_hst ? r2(fee / (1 + C.hst)) : fee;
      return { blocks, warns, hours: 0, lines: [{ desc: `Monthly service ${from} to ${to}`, qty: 1, rate: sub, amount: sub }], subtotal: sub };
    }
    const rates = await q(sb.from('site_rates').select('*').eq('site_id', site.id));
    const shifts = await shiftsBetween(from, to, site.id);
    const open = shifts.filter((s) => !s.clock_out); if (open.length) blocks.push(`${open.length} shift(s) in this period are not clocked out. Fix them on the Shifts page first.`);
    if (site.flags.includes('rate_missing') || !rates.length) blocks.push('No hourly rate for this site (owner question). Add the rate on the Rates page — invoice blocked.');
    const roles = [...new Set(rates.map((r) => r.role))];
    const days = workerDays(shifts, site); if (!days.length) blocks.push('No completed shifts at this site in the period.');
    const agg = {};
    days.forEach((d) => {
      const rs = [...d.roles]; let role = rs.length === 1 && rs[0] ? rs[0] : null;
      if (!role) { if (roles.length === 1) role = roles[0]; else if (roles.includes('Labourer') && rs.every((x) => !x)) role = 'Labourer'; }
      if (!role || rs.length > 1) { blocks.push(`${fmtDay(d.day)}: set the role on the shift (site has ${roles.join(', ') || 'no'} rates).`); return; }
      const rt = rateOn(rates, site.id, role, d.day);
      if (!rt) { blocks.push(`No ${role} rate in effect on ${fmtDay(d.day)} — invoice blocked.`); return; }
      const k = role + '|' + rt.rate; (agg[k] = agg[k] || { desc: `${role} hours`, role, qty: 0, rate: +rt.rate }).qty += d.billable;
    });
    const lines = Object.values(agg).map((l) => ({ ...l, qty: r2(l.qty), amount: r2(r2(l.qty) * l.rate) }));
    return { blocks: [...new Set(blocks)], warns, lines, hours: r2(lines.reduce((a, l) => a + l.qty, 0)), subtotal: r2(lines.reduce((a, l) => a + l.amount, 0)) };
  }
  function invoiceSheet(inv, site) {
    const co = inv.company_id;
    return `<div class="sheet"><div class="sheet-h co-${co}">${ST.logo(co)}<div class="sheet-co">${COMPANIES[co].name}</div><div class="sheet-t"><h1>Invoice ${esc(inv.invoice_no)}</h1><div>Period <b>${inv.period_start} – ${inv.period_end}</b></div></div></div>
      <div class="sheet-meta"><div><span>Bill to</span><b>${esc(ST.siteName(site))}</b><small class="muted" style="display:block">client details from the Site Key</small></div><div><span>Issued</span><b>${inv.issued_on || 'draft'}</b></div><div><span>Received</span><b>${inv.received_on || '—'}</b></div><div><span>Payment due</span><b>${inv.due_on || 'within one month of receipt'}</b></div></div>
      <table class="sheet-tbl tbl"><thead><tr><th>Description</th><th class="num">Qty / hours</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead><tbody>
      ${inv.lines.map((l) => `<tr><td>${esc(l.desc)}</td><td class="num">${h2(l.qty)}</td><td class="num">${money(l.rate)}</td><td class="num">${money(l.amount)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><th colspan="3">Subtotal</th><th class="num">${money(inv.subtotal)}</th></tr><tr><th colspan="3">HST ${Math.round(inv.hst_rate * 100)}%</th><th class="num">${money(inv.hst)}</th></tr><tr><th colspan="3">Total</th><th class="num">${money(inv.total)}</th></tr>${+inv.amount_paid ? `<tr><th colspan="3">Paid</th><th class="num">−${money(inv.amount_paid)}</th></tr><tr><th colspan="3">Balance</th><th class="num">${money(inv.total - inv.amount_paid)}</th></tr>` : ''}</tfoot></table>
      <div class="sheet-foot small"><b>Payment due within one month of receipt of this invoice.</b></div></div>`;
  }
  async function invoices() {
    const p = params(); const tk = T().todayKey();
    const sites = (await sitesInScope()).filter((s) => ST.canBill(s.company_id)); const byId = {}; sites.forEach((s) => (byId[s.id] = s));
    const list = await q(sb.from('invoices').select('*').in('company_id', scope().filter((c) => ST.canBill(c))).order('created_at', { ascending: false }));
    const view = p.get('id') && list.find((i) => i.id === p.get('id'));
    if (view) {
      const site = byId[view.site_id]; const pays = await q(sb.from('payments').select('*').eq('invoice_id', view.id).order('paid_on'));
      return [shell('invoices', `<div class="print-toolbar no-print"><a class="btn small ghost" href="#/admin/invoices">‹ Invoices</a><b>${esc(view.invoice_no)}</b> <span class="tag">${view.status}</span><span class="spacer"></span>
        ${view.status === 'draft' ? '<button class="btn small primary" id="sendB">Mark as sent (locks the shifts)</button> <button class="btn small ghost" id="delB">Delete draft</button>' : ''}
        ${view.status === 'sent' ? '<button class="btn small" id="recB">Set date received</button> <button class="btn small primary" id="payB">Record payment</button> <button class="btn small ghost" id="voidB">Void</button>' : ''}
        <button class="btn small" id="pB">⤓ PDF (print)</button></div>
        ${invoiceSheet(view, site)}
        <section class="panel no-print"><h2>Payments</h2>${pays.length ? `<table class="tbl"><tr><th>Date</th><th class="num">Amount</th><th>Method</th><th>Reference</th></tr>${pays.map((x) => `<tr><td>${x.paid_on}</td><td class="num">${money(x.amount)}</td><td>${esc(x.method || '')}</td><td>${esc(x.reference || '')}</td></tr>`).join('')}</table>` : '<div class="empty">No payments yet.</div>'}</section>`), (root) => {
        const upd = async (patch, msg) => { try { await q(sb.from('invoices').update(patch).eq('id', view.id)); toast(msg, 'good'); ST.render(); } catch (e) { toast(errMsg(e), 'bad'); } };
        root.querySelector('#pB').addEventListener('click', () => window.print());
        const sB = root.querySelector('#sendB'); sB && sB.addEventListener('click', async () => { try { await q(sb.rpc('lock_period', { p_site: view.site_id, p_from: view.period_start, p_to: view.period_end })); } catch (e) { return toast(errMsg(e), 'bad'); } upd({ status: 'sent', issued_on: tk }, 'Marked as sent ✓ (shifts locked)'); });
        const dB = root.querySelector('#delB'); dB && dB.addEventListener('click', async () => { try { await q(sb.from('invoices').delete().eq('id', view.id)); toast('Draft deleted'); go('invoices'); } catch (e) { toast(errMsg(e), 'bad'); } });
        const vB = root.querySelector('#voidB'); vB && vB.addEventListener('click', () => upd({ status: 'void' }, 'Voided'));
        const rB = root.querySelector('#recB'); rB && rB.addEventListener('click', () => modal(`<h2>Date the client received it</h2><form id="rf" class="stack"><input type="date" name="d" value="${view.received_on || tk}" required><p class="muted small">Payment is due within one month of this date.</p><div class="row-end"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Save</button></div></form>`, (w, close) => w.querySelector('#rf').addEventListener('submit', (e) => { e.preventDefault(); close(); upd({ received_on: new FormData(e.target).get('d') }, 'Saved ✓'); })));
        const pyB = root.querySelector('#payB'); pyB && pyB.addEventListener('click', () => modal(`<h2>Record payment</h2><form id="pf" class="stack"><label class="field"><span>Amount</span><input name="a" type="number" step="0.01" min="0.01" value="${r2(view.total - view.amount_paid)}" required></label><label class="field"><span>Date paid</span><input name="d" type="date" value="${tk}" required></label><label class="field"><span>Method</span><select name="m"><option>e-Transfer</option><option>Cheque</option><option>Direct deposit</option><option>Cash</option><option>Other</option></select></label><label class="field"><span>Reference</span><input name="r" maxlength="60"></label><div class="err" id="pe"></div><div class="row-end"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Save</button></div></form>`, (w, close) => w.querySelector('#pf').addEventListener('submit', async (e) => { e.preventDefault(); const d = new FormData(e.target);
          try { await q(sb.from('payments').insert({ company_id: view.company_id, invoice_id: view.id, amount: +d.get('a'), paid_on: d.get('d'), method: d.get('m'), reference: d.get('r') || null })); close(); toast('Payment recorded ✓', 'good'); ST.render(); } catch (err) { w.querySelector('#pe').textContent = errMsg(err); } })));
      }];
    }
    const age = (i) => { if (i.status !== 'sent') return ''; if (!i.due_on) return '<span class="muted small">not received yet</span>'; const days = Math.round((new Date(tk) - new Date(i.due_on)) / 86400000); return days > 0 ? `<span class="tag bad">${days} days overdue</span>` : `<span class="tag">due in ${-days} d</span>`; };
    const lastMonth = T().addDays(tk.slice(0, 8) + '01', -1);
    return [shell('invoices', `<div class="page-h"><h1>Invoices</h1><span class="muted">Payment due within one month of receipt · HST ${C.hst * 100}%</span></div>
      <section class="panel"><h2>New invoice</h2><form id="newInv" class="form-row">
        <label>Site<select name="site">${sites.map((s) => `<option value="${s.id}">${s.company_id.toUpperCase()} · ${esc(ST.siteName(s))}${s.flags.some((f) => /missing/.test(f)) || s.billing_type === 'per-visit' ? ' ⛔' : ''}</option>`).join('')}</select></label>
        <label>From<input type="date" name="from" value="${lastMonth.slice(0, 8)}01" required></label><label>To<input type="date" name="to" value="${lastMonth}" required></label>
        <button class="btn">Preview</button></form><div id="prev"></div></section>
      <table class="tbl"><tr><th></th><th>No.</th><th>Site</th><th>Period</th><th class="num">Total</th><th class="num">Paid</th><th>Received</th><th>Due</th><th>Status</th><th></th></tr>
      ${list.map((i) => `<tr><td>${chip(i.company_id)}</td><td><a href="#/admin/invoices?id=${i.id}">${esc(i.invoice_no)}</a></td><td>${esc(ST.siteName(byId[i.site_id]))}</td><td>${i.period_start} – ${i.period_end}</td><td class="num">${money(i.total)}</td><td class="num">${money(i.amount_paid)}</td><td>${i.received_on || ''}</td><td>${i.due_on || ''}</td><td><span class="tag ${i.status === 'paid' ? 'on' : ''}">${i.status}</span> ${age(i)}</td><td><a class="btn small" href="#/admin/invoices?id=${i.id}">Open</a></td></tr>`).join('') || '<tr><td colspan="10" class="empty">No invoices yet.</td></tr>'}</table>`), (root) => {
      root.querySelector('#newInv').addEventListener('submit', async (e) => {
        e.preventDefault(); const d = new FormData(e.target); const site = byId[d.get('site')]; const from = d.get('from'); const to = d.get('to'); const box = root.querySelector('#prev');
        if (to < from) { box.innerHTML = '<div class="blockbox">“To” must be after “From”.</div>'; return; }
        const b = await buildInvoice(site, from, to);
        const hst = b.subtotal != null ? r2(b.subtotal * C.hst) : 0;
        box.innerHTML = `${b.blocks.map((x) => `<div class="blockbox">⛔ ${esc(x)}</div>`).join('')}${b.warns.map((x) => `<div class="warnbox warn">⚠ ${esc(x)}</div>`).join('')}
          ${b.lines.length ? `<table class="tbl"><tr><th>Line</th><th class="num">Qty / h</th><th class="num">Rate</th><th class="num">Amount</th></tr>${b.lines.map((l) => `<tr><td>${esc(l.desc)}</td><td class="num">${h2(l.qty)}</td><td class="num">${money(l.rate)}</td><td class="num">${money(l.amount)}</td></tr>`).join('')}<tr><th colspan="3">Subtotal / HST / Total</th><th class="num">${money(b.subtotal)} / ${money(hst)} / <b>${money(r2(b.subtotal + hst))}</b></th></tr></table>` : ''}
          ${b.blocks.length ? '' : `<div class="okbox">Ready. ${b.warns.length ? '<label class="chk"><input type="checkbox" id="ack"> I checked the warning(s)</label>' : ''}</div><button class="btn primary" id="mk">Create draft invoice</button>`}`;
        const mk = box.querySelector('#mk'); mk && mk.addEventListener('click', async () => {
          const ack = box.querySelector('#ack'); if (ack && !ack.checked) return toast('Tick the box to confirm the warning(s).', 'bad');
          try {
            const no = await q(sb.rpc('next_invoice_no', { p_co: site.company_id }));
            const ins = await q(sb.from('invoices').insert({ company_id: site.company_id, invoice_no: no, site_id: site.id, period_start: from, period_end: to, hours: b.hours, subtotal: b.subtotal, hst_rate: C.hst, hst, total: r2(b.subtotal + hst), lines: b.lines, status: 'draft' }).select('id').single());
            toast('Draft ' + no + ' created ✓', 'good'); go('invoices', { id: ins.id });
          } catch (err) { toast(errMsg(err), 'bad'); }
        });
      });
    }];
  }


  // ---------- Sites: list, Add site, set acronym (owner/admin; enforced by RLS policy sites_admin_write) ----------
  const ACR_RE = /^[A-Z]{3}$/;
  const RANGE = { cj: [101, 199], us: [201, 299] };
  const nextFree = (all, co) => { const nos = all.filter((x) => x.company_id === co).map((x) => x.site_no); const used = new Set(nos); const top = Math.max(RANGE[co][0] - 1, ...nos) + 1; if (top <= RANGE[co][1]) return top; for (let n = RANGE[co][0]; n <= RANGE[co][1]; n++) if (!used.has(n)) return n; return null; };  // next after the highest; gaps only when full
  async function acronymTaken(acr, exceptId) { const r = await q(sb.rpc('acronym_taken', { p_acr: acr, p_except: exceptId || null })); return !!r; }
  const NAME_WARN = '<div class="warnbox warn">⚠ <b>Never type the client or farm name here.</b> Use a 3-letter acronym only (e.g. CVF). The full name goes in the Drive “Site Key” sheet, not in this app.</div>';
  async function sitesPage() {
    const cos = scope().filter((c) => ST.can(c, ['owner', 'admin']));
    const all = (await sitesInScope()).filter((x) => cos.includes(x.company_id));
    const p = params(); const showOff = p.get('off') === '1';
    const list = all.filter((x) => showOff || x.active || !x.site_code);
    const tk = T().todayKey();
    return [shell('sites', `<div class="page-h"><h1>Sites</h1><button class="btn primary" id="addSiteBtn">+ Add site</button></div>
      <p class="muted small">Sites are shown by code only: 3-letter acronym + number (Chief Janitorial 101–199, Unscramble 201–299). Client names live only in the Drive Site Key.</p>
      <div class="form-row"><label class="chk"><input type="checkbox" id="showOff" ${showOff ? 'checked' : ''}> Show turned-off sites</label><span class="muted">${list.length} sites · ${all.filter((x) => !x.site_code).length} need a name/acronym</span></div>
      <table class="tbl"><tr><th></th><th>Code</th><th>Type</th><th>Billing</th><th>GPS</th><th>Status</th><th>Flags</th><th></th></tr>
      ${list.map((x) => `<tr><td>${chip(x.company_id)}</td><td><b>${esc(ST.siteName(x))}</b></td><td>${esc(x.label)}</td><td>${x.billing_type}</td><td>${x.lat != null ? '📍 ' + x.radius_m + ' m' : '<span class="muted small">none</span>'}</td><td>${x.active ? '<span class="tag on">active</span>' : '<span class="tag">off</span>'}</td><td>${x.flags.map(flagTag).join('')}</td>
        <td><button class="btn small ${x.site_code ? 'ghost' : 'primary'}" data-acr="${x.id}">${x.site_code ? 'Change acronym' : 'Set acronym'}</button> <button class="btn small ghost" data-act2="${x.id}">${x.active ? 'Turn off' : 'Turn on'}</button></td></tr>`).join('')}</table>`), (root) => {
      root.querySelector('#showOff').addEventListener('change', (e) => go('sites', e.target.checked ? { off: 1 } : null));
      root.querySelectorAll('[data-act2]').forEach((b) => b.addEventListener('click', async () => {
        const x = all.find((y) => y.id === b.dataset.act2);
        if (!x.active && !x.site_code) return toast('Set an acronym first.', 'bad');
        try { await q(sb.from('sites').update({ active: !x.active }).eq('id', x.id)); toast(x.active ? 'Turned off' : 'Turned on ✓', 'good'); ST.render(); } catch (e) { toast(errMsg(e), 'bad'); }
      }));
      root.querySelectorAll('[data-acr]').forEach((b) => b.addEventListener('click', () => {
        const x = all.find((y) => y.id === b.dataset.acr);
        modal(`<h2>${x.site_code ? 'Change acronym' : 'Set acronym'} · ${esc(ST.siteName(x))}</h2>${NAME_WARN}
          <form id="acrF" class="stack"><label class="field"><span>Acronym (3 letters)</span><input name="acr" maxlength="3" autocapitalize="characters" autocomplete="off" required value="${esc((x.site_code || '').slice(0, 3))}" placeholder="ABC"></label>
          <div>New code: <b id="acrPrev">${esc(x.site_code || '—')}</b> <span id="acrMsg" class="small"></span></div>
          ${x.active ? '' : '<label class="chk"><input type="checkbox" name="on" checked> Turn the site on (employees can pick it)</label>'}
          <div class="err" id="acrErr"></div><div class="row-end"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Save</button></div></form>`, (w, close) => {
          const inp = w.querySelector('input[name=acr]'); let t;
          const upd = () => { inp.value = inp.value.toUpperCase().replace(/[^A-Z]/g, ''); const ok = ACR_RE.test(inp.value); w.querySelector('#acrPrev').textContent = ok ? inp.value + x.site_no : '—'; const m = w.querySelector('#acrMsg'); m.textContent = '';
            clearTimeout(t); if (ok) t = setTimeout(async () => { m.textContent = (await acronymTaken(inp.value, x.id)) ? '✗ already used by another site' : '✓ free'; m.className = 'small ' + (m.textContent.startsWith('✗') ? 'bad' : 'ok'); }, 250); };
          inp.addEventListener('input', upd); upd();
          w.querySelector('#acrF').addEventListener('submit', async (e) => { e.preventDefault(); const acr = inp.value; const err = w.querySelector('#acrErr');
            if (!ACR_RE.test(acr)) { err.textContent = 'Use exactly 3 letters A–Z.'; return; }
            if (await acronymTaken(acr, x.id)) { err.textContent = 'That acronym is already used by another site (in either company). Pick another.'; return; }
            const on = w.querySelector('input[name=on]');
            try { await q(sb.from('sites').update({ site_code: acr + x.site_no, flags: x.flags.filter((f) => f !== 'name_needed' && f !== 'no_client_matched'), ...(on && on.checked ? { active: true } : {}) }).eq('id', x.id)); close(); toast('Code set: ' + acr + x.site_no, 'good'); ST.render(); }
            catch (er) { err.textContent = /sites_site_code_key|sites_acronym_key|duplicate/.test(errMsg(er)) ? 'That acronym or code is already used.' : errMsg(er); } });
        });
      }));
      root.querySelector('#addSiteBtn').addEventListener('click', () => go('addsite'));
    }];
  }
  async function addSitePage() {
    const cos = allowed().filter((c) => ST.can(c, ['owner', 'admin']));
    if (!cos.length) return [shell('sites', '<div class="card">Only the owner or a company admin can add sites.</div>')];
    const all = await q(sb.from('sites').select('id, site_no, company_id, site_code').in('company_id', cos));
    const co0 = scope().find((c) => cos.includes(c)) || cos[0]; const tk = T().todayKey();
    const roleOpts = ROLES.map((r) => `<option>${r}</option>`).join('');
    const rateRow = () => `<div class="form-row rate-row"><label>Role<select name="role">${roleOpts}</select></label><label>$/h<input name="rate" type="number" step="0.01" min="0.01"></label><label>From<input name="eff" type="date" value="${tk}"></label><button type="button" class="btn small ghost" data-delrate>✕</button></div>`;
    return [shell('sites', `<a class="back" href="#/admin/sites">‹ Sites</a><div class="page-h"><h1>Add site</h1></div>
      <section class="panel"><form id="addSiteF" class="stack" autocomplete="off">
        ${NAME_WARN}
        <div class="form-row">
          <label>Company${cos.length > 1 ? `<select name="co">${cos.map((c) => `<option value="${c}" ${c === co0 ? 'selected' : ''}>${COMPANIES[c].name}</option>`).join('')}</select>` : `<input type="hidden" name="co" value="${cos[0]}"><b>${COMPANIES[cos[0]].name}</b>`}</label>
          <label>Number<input name="no" type="number" required></label>
          <label>Acronym (3 letters)<input name="acr" maxlength="3" required placeholder="ABC" autocapitalize="characters"></label>
          <div><div class="muted small">Code</div><b id="codePrev" style="font-size:1.4em">—</b> <span id="codeMsg" class="small"></span></div>
        </div>
        <div class="form-row">
          <label>Type<select name="label">${['Farm', 'Commercial', 'Worksite', 'Office', 'Plant', 'Site'].map((l) => `<option>${l}</option>`).join('')}</select></label>
          <label>GPS latitude<input name="lat" type="number" step="0.000001" min="40" max="50" placeholder="optional"></label>
          <label>GPS longitude<input name="lng" type="number" step="0.000001" min="-70" max="-59" placeholder="optional"></label>
          <label>Radius (m)<input name="radius" type="number" min="50" max="5000" value="300"></label>
        </div>
        <div class="form-row">
          <label>Billing<select name="billing"><option value="hourly">Hourly</option><option value="monthly">Monthly fee</option><option value="per-visit">Per visit</option></select></label>
          <label>Payment terms<select name="terms"><option value="one_month_from_receipt">Due 1 month after receipt</option><option value="net30_receipt">Net 30 from receipt</option><option value="net30_invoice_date">Net 30 from invoice date</option><option value="due_on_completion">Due on completion</option></select></label>
          <label>Billing minimum (h/day)<input name="minh" type="number" step="0.25" min="0" max="24" placeholder="optional"></label>
          <label class="mfee" style="display:none">Monthly fee ($)<input name="fee" type="number" step="0.01" min="0"></label>
          <label class="chk mfee" style="display:none"><input type="checkbox" name="incl"> Fee includes HST</label>
        </div>
        <div class="hrates"><div class="label">Starting rates per role <span class="muted small">(without a rate, invoices for this site stay blocked)</span></div><div id="rates">${rateRow()}</div><button type="button" class="btn small" id="addRateRow">+ Another role</button></div>
        <label class="chk"><input type="checkbox" name="active" checked> Active (employees can pick it right away)</label>
        <div class="err" id="addErr"></div>
        <div class="row-end"><a class="btn ghost" href="#/admin/sites">Cancel</a><button class="btn primary">Add site</button></div>
      </form></section>`), (root) => {
      const f = root.querySelector('#addSiteF'); const coSel = f.querySelector('[name=co]'); const no = f.querySelector('[name=no]'); const acr = f.querySelector('[name=acr]');
      const co = () => coSel.value; let t;
      const setNo = () => { no.value = nextFree(all, co()) || ''; no.min = RANGE[co()][0]; no.max = RANGE[co()][1]; prev(); };
      const prev = () => { acr.value = acr.value.toUpperCase().replace(/[^A-Z]/g, ''); const ok = ACR_RE.test(acr.value) && +no.value; root.querySelector('#codePrev').textContent = ok ? acr.value + no.value : '—'; const m = root.querySelector('#codeMsg'); m.textContent = '';
        clearTimeout(t); if (ACR_RE.test(acr.value)) t = setTimeout(async () => { const taken = await acronymTaken(acr.value); m.textContent = taken ? '✗ acronym already used' : '✓ free'; m.className = 'small ' + (taken ? 'bad' : 'ok'); }, 250); };
      coSel.tagName === 'SELECT' && coSel.addEventListener('change', setNo); no.addEventListener('input', prev); acr.addEventListener('input', prev); setNo();
      const bill = f.querySelector('[name=billing]'); const bshow = () => { root.querySelectorAll('.mfee').forEach((e) => (e.style.display = bill.value === 'monthly' ? '' : 'none')); root.querySelector('.hrates').style.display = bill.value === 'hourly' ? '' : 'none'; }; bill.addEventListener('change', bshow); bshow();
      const rates = root.querySelector('#rates'); root.querySelector('#addRateRow').addEventListener('click', () => rates.insertAdjacentHTML('beforeend', rateRow()));
      rates.addEventListener('click', (e) => { if (e.target.closest('[data-delrate]')) e.target.closest('.rate-row').remove(); });
      f.addEventListener('submit', async (e) => {
        e.preventDefault(); const d = new FormData(f); const err = root.querySelector('#addErr'); err.textContent = '';
        const c = co(); const n = +d.get('no'); const a = String(d.get('acr'));
        if (!ACR_RE.test(a)) return (err.textContent = 'Acronym: exactly 3 letters A–Z.');
        if (!(n >= RANGE[c][0] && n <= RANGE[c][1])) return (err.textContent = `Number must be ${RANGE[c][0]}–${RANGE[c][1]} for ${COMPANIES[c].name}.`);
        if (all.some((x) => x.site_no === n)) return (err.textContent = 'That number is already used.');
        if (await acronymTaken(a)) return (err.textContent = 'That acronym is already used by another site (in either company).');
        const lat = d.get('lat') ? +d.get('lat') : null; const lng = d.get('lng') ? +d.get('lng') : null;
        if ((lat == null) !== (lng == null)) return (err.textContent = 'GPS: enter both latitude and longitude, or neither.');
        const billing = d.get('billing');
        const rr = billing === 'hourly' ? [...rates.querySelectorAll('.rate-row')].map((r) => ({ role: r.querySelector('[name=role]').value, rate: +r.querySelector('[name=rate]').value, eff: r.querySelector('[name=eff]').value })).filter((r) => r.rate > 0) : [];
        if (new Set(rr.map((r) => r.role + r.eff)).size !== rr.length) return (err.textContent = 'Each role can have one starting rate per date.');
        const fee = billing === 'monthly' && d.get('fee') ? +d.get('fee') : null;
        const flags = [...(billing === 'hourly' && !rr.length ? ['rate_missing'] : []), ...(billing === 'monthly' && !fee ? ['fee_missing'] : [])];
        try {
          const site = await q(sb.from('sites').insert({ site_no: n, site_code: a + n, company_id: c, label: d.get('label'), lat, lng, radius_m: +d.get('radius') || 300, billing_type: billing, payment_terms: d.get('terms'), monthly_fee: fee, monthly_fee_incl_hst: !!d.get('incl'), min_hours_per_day: d.get('minh') ? +d.get('minh') : null, flags, active: !!d.get('active') }).select('id').single());
          if (rr.length) await q(sb.from('site_rates').insert(rr.map((r) => ({ site_id: site.id, company_id: c, role: r.role, rate: r.rate, effective_from: r.eff }))));
          toast(`Site ${a + n} added ✓ Add the client name to the Drive Site Key.`, 'good'); go('sites');
        } catch (er) { err.textContent = /sites_site_code_key|sites_acronym_key|sites_site_no_key|duplicate/.test(errMsg(er)) ? 'That number, code or acronym is already used.' : errMsg(er); }
      });
    }];
  }

  const PAGES = { sites: sitesPage, addsite: addSitePage, dashboard, employees, approvals: employees, shifts: shiftsPage, timesheets, rates: ratesPage, invoices };
  ST.adminView = async function (app, p) {
    const page = (p[0] || 'dashboard').split('?')[0];
    const fn = PAGES[page] || dashboard;
    const [html, bind] = await fn();
    app.innerHTML = html; bindShell(app); bind && bind(app);
  };
})();
