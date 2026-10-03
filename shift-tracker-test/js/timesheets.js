/* ADMIN-ONLY weekly farm timesheets.
 * - One timesheet per farm/site per week (Mon–Sun), "generated" every Monday for the previous week.
 * - Break/billing rules live in rules.js (per employee/day/farm, Atlantic time): Worked, Paid, Billable shown per row + totals.
 * - Downloads: CSV is a real Blob download. PDF = print view + window.print() ("Save as PDF").
 * - NO email/send. Reviewer per company (CJ: CJ Bal · Unscramble: Us Sandra) reviews and drafts farm emails for the owner's approval.
 * - Two companies: 'all-cj' / 'all-us' build one company's farms; files and notes are per company.
 * Never loaded into employee code paths (employee.js does not reference CJ.ts). */
(function () {
  const CJ = (window.CJ = window.CJ || {});
  const A = () => CJ.api.admin;
  const T = () => CJ.tz;
  const R = () => CJ.rules;
  const TZO = { timeZone: 'America/Halifax' };
  const h2 = (h) => (Math.round(h * 100) / 100).toFixed(2);
  const sgn = (h) => (Math.abs(h) < 0.005 ? '—' : (h > 0 ? '+' : '−') + h2(Math.abs(h)));
  const fT = (iso) => new Date(iso).toLocaleTimeString('en-US', { ...TZO, hour: 'numeric', minute: '2-digit' });
  const keyDate = (key, opts) => T().zoned(key, 12, 0).toLocaleDateString('en-US', { ...TZO, ...opts });
  const fD = (key) => keyDate(key, { weekday: 'short', month: 'short', day: 'numeric' });
  const fRange = (ws) => keyDate(ws, { month: 'short', day: 'numeric' }) + ' – ' + keyDate(T().addDays(ws, 6), { month: 'short', day: 'numeric', year: 'numeric' });
  const thisWeek = () => T().weekStart(T().todayKey());
  const lastCompletedWeek = () => T().addDays(thisWeek(), -7);
  function weeks(n) { const out = []; let w = thisWeek(); for (let i = 0; i < n; i++) { out.push(w); w = T().addDays(w, -7); } return out; }
  function status(ws) {
    const genKey = T().addDays(ws, 7); const gen = T().zoned(genKey, 6, 0); // Monday 6:00 AM Atlantic after the week
    const lbl = keyDate(genKey, { weekday: 'short', month: 'short', day: 'numeric' }) + ', 6:00 AM AT';
    return Date.now() >= gen.getTime() ? { done: true, label: 'Generated ' + lbl } : { done: false, label: 'Week in progress — will be generated ' + lbl };
  }
  const uname = (id) => (A().user(id) || {}).name || id;

  // Build sheets for a week (ws = Monday key, Atlantic). One row per employee/day/farm (split punches combined).
  const CO = (c) => CJ.F.COMPANIES[c || 'cj'];
  const coOfSite = (site) => CJ.api.coOf(site);
  function build(ws, siteId) {
    const co = /^all-(cj|us)$/.test(siteId || '') ? siteId.slice(4) : null; if (co || siteId === 'all') siteId = null;
    const inWeek = A().shifts().filter((s) => R().inWeek(T().dayKey(s.clockIn), ws) && (!siteId || s.siteId === siteId) && (!co || coOfSite(A().site(s.siteId)) === co));
    const bySite = {};
    inWeek.forEach((s) => (bySite[s.siteId] = bySite[s.siteId] || []).push(s));
    const ids = siteId ? [siteId] : Object.keys(bySite);
    return ids.map((sid) => sheetFor(ws, A().site(sid), bySite[sid] || [])).sort((a, b) => a.site.number - b.site.number);
  }
  function sheetFor(ws, site, shifts) {
    const groups = R().groupDays(shifts);
    const zero = groups.filter((g) => !(g.worked > 0));
    const rows = groups.filter((g) => g.worked > 0).map((g) => ({
      ...g, employee: uname(g.userId), split: g.shifts.length > 1,
      overnight: g.shifts.some((s) => T().dayKey(s.clockOut) !== g.day),
      punches: g.shifts.map((s) => ({ id: s.id, clockIn: s.clockIn, clockOut: s.clockOut, inM: A().fieldEdited(s, 'clockIn'), outM: A().fieldEdited(s, 'clockOut'), nextDay: T().dayKey(s.clockOut) !== g.day })),
    })).sort((a, b) => a.employee.localeCompare(b.employee) || a.day.localeCompare(b.day));
    rows.forEach((r) => {
      r.crewM = r.shifts.some((s) => A().fieldEdited(s, 'crewCount'));
      r.edited = r.crewM || r.punches.some((p) => p.inM || p.outM);
      r.crew = [...new Set(r.shifts.map((s) => s.crewCount).filter((c) => c != null))]; // crew size(s) this employee reported
      r.crewCheck = A().crewCheck(site.id, r.day);
      r.outNotes = r.shifts.map((s) => s.outNote).filter(Boolean);                       // read-only clock-out notes                                       // vs distinct workers clocked in at site that day
    });
    const issues = shifts.filter((s) => !s.clockOut).map((s) => ({ userId: s.userId, day: T().dayKey(s.clockIn), clockIn: s.clockIn, why: 'No clock-out' }))
      .concat(zero.map((g) => ({ userId: g.userId, day: g.day, clockIn: g.shifts[0].clockIn, why: '0 h worked' })));
    const totals = R().totals(rows);
    return { weekStart: ws, weekEnd: T().addDays(ws, 6), site, rows, issues, employees: [...new Set(rows.map((r) => r.employee))], totals: { ...totals, shifts: rows.reduce((a, r) => a + r.shifts.length, 0), days: rows.length, edited: rows.filter((r) => r.edited).length, crewMismatch: new Set(rows.filter((r) => r.crewCheck.mismatch).map((r) => r.day)).size, minDays: rows.filter((r) => r.minApplied).length, outNotes: rows.reduce((a, r) => a + r.outNotes.length, 0) } };
  }

  function csv(sheets) {
    const c = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const L = [['Week start (Mon, Atlantic)', 'Week end', 'Site #', 'Farm / client', 'Employee', 'Date', 'Clock in', 'Clock out', 'Edited (M)', 'Crew reported', 'Workers clocked in (site/day)', 'Crew mismatch', 'Notes', 'Clock-out note (employee, read-only)', 'Worked hours', 'Pay deduction (h)', 'Paid hours', 'Bill adjustment (h)', 'Billable hours'].map(c).join(',')];
    const pin = (r) => r.punches.map((p) => fT(p.clockIn) + (p.inM ? ' M' : '')).join(' / ');
    const pout = (r) => r.punches.map((p) => fT(p.clockOut) + (p.nextDay ? ' (+1 day)' : '') + (p.outM ? ' M' : '')).join(' / ');
    const flags = (r) => [r.split ? 'split day (combined)' : '', r.overnight ? 'overnight (counts on start day)' : '', r.minApplied ? '5 h billing minimum' : ''].filter(Boolean).join('; ');
    sheets.forEach((sh) => {
      sh.rows.forEach((r) => L.push([sh.weekStart, sh.weekEnd, sh.site.number, sh.site.clientName, r.employee, r.day, pin(r), pout(r), r.edited ? 'M' : '', r.crew.join('/') + (r.crewM ? ' M' : ''), r.crewCheck.clockedIn, r.crewCheck.label, flags(r), r.outNotes.join(' | '), h2(r.worked), h2(-r.payDed), h2(r.paid), h2(r.billAdj), h2(r.billable)].map(c).join(',')));
      L.push([sh.weekStart, sh.weekEnd, sh.site.number, sh.site.clientName, 'TOTAL', '', '', '', sh.totals.edited ? sh.totals.edited + ' edited' : '', '', '', sh.totals.crewMismatch ? sh.totals.crewMismatch + ' day(s) with crew mismatch' : '', '', sh.totals.outNotes ? sh.totals.outNotes + ' note(s)' : '', h2(sh.totals.worked), h2(-sh.totals.payDed), h2(sh.totals.paid), h2(sh.totals.billAdj), h2(sh.totals.billable)].map(c).join(','));
      sh.issues.forEach((x) => L.push([sh.weekStart, sh.weekEnd, sh.site.number, sh.site.clientName, uname(x.userId), x.day, fT(x.clockIn), '', '', '', '', '', 'ISSUE: ' + x.why + ' — not paid or billed until fixed', '', '', '', '', '', ''].map(c).join(',')));
    });
    if (sheets.length > 1) { const t = (k) => sheets.reduce((a, s) => a + s.totals[k], 0); L.push(['', '', '', 'ALL FARMS', 'GRAND TOTAL', '', '', '', '', '', '', '', '', '', h2(t('worked')), h2(-t('payDed')), h2(t('paid')), h2(t('billAdj')), h2(t('billable'))].map(c).join(',')); }
    const lg = R().LEGEND; [lg.unit, lg.paid, lg.bill, lg.combined].forEach((x) => L.push(c('Note: ' + x)));
    return L.join('\n');
  }
  const fileName = (ws, sheets, all) => CO(coOfSite(sheets[0].site)).short + '_timesheet_' + ws + '_' + (all ? 'all-farms' : 'site-' + sheets[0].site.number + '-' + sheets[0].site.clientName.replace(/[^A-Za-z0-9]+/g, '-').replace(/-+$/, '')) + '.csv';
  function downloadCsv(ws, siteId) {
    if (!siteId || siteId === 'all') siteId = 'all-' + CJ.api.scope()[0]; // never mix companies in one file
    const sheets = build(ws, siteId);
    if (!sheets.length) return CJ.toast('No shifts that week', 'bad');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + csv(sheets)], { type: 'text/csv' })); a.download = fileName(ws, sheets, /^all/.test(siteId)); document.body.appendChild(a); a.click(); a.remove();
    CJ.toast('CSV downloaded', 'good');
  }
  const legendHtml = (cls) => { const lg = R().LEGEND; return `<div class="${cls}"><b>Break &amp; billing rules</b><ul><li>${lg.unit}</li><li>${lg.paid}</li><li>${lg.bill}</li><li><b>${lg.combined}</b></li></ul></div>`; };

  // ---------- Status workflow: Draft → Reviewed (Bal) → Approved (owner) → Billing locked ----------
  function statusTag(siteId, ws) {
    const co = coOfSite(A().site(siteId)); const st = A().tsStatus(siteId, ws).status; const n = st === 'locked' ? 0 : A().lockIssues(siteId, ws).length;
    return `<span class="wf wf-${st}">${st === 'locked' ? '🔒 ' : ''}${CJ.F.statusLabel(st, co)}</span>${n ? ` <span class="tag bad sm" title="Issues that block Billing lock">${n} blocking</span>` : ''}${A().invoiceFor(siteId, ws) ? ` <a class="tag sm" href="#/admin/invoice/${A().invoiceFor(siteId, ws).id}">🧾 ${CJ.esc(A().invoiceFor(siteId, ws).number)}</a>` : ''}`;
  }
  function workflowPanel(ws, site) {
    const co = coOfSite(site); const C = CO(co); const cur = A().tsStatus(site.id, ws); const issues = cur.status === 'locked' ? [] : A().lockIssues(site.id, ws); const i = CJ.F.STATUSES.indexOf(cur.status);
    const steps = CJ.F.STATUSES.map((k, j) => `<li class="${j < i ? 'done' : j === i ? 'now' : ''}">${CJ.F.statusLabel(k, co)}</li>`).join('');
    const next = CJ.F.STATUSES[i + 1];
    const btn = { reviewed: ['Mark reviewed (' + C.reviewer + ')', C.reviewer, 'review'], approved: ['Approve (owner)', 'Owner', 'approve'], locked: ['🔒 Billing lock (owner)', 'Owner', 'lock'] }[next];
    const allowed = btn && A().can(btn[2], co); const canBill = A().can('billing', co); const block = A().invoiceBlock(site.id);
    const days = []; for (let d = 0; d < 7; d++) { const k = T().addDays(ws, d); const has = A().shifts().some((x) => x.siteId === site.id && T().dayKey(x.clockIn) === k); if (has) days.push({ k, so: A().signoff(site.id, k) }); }
    const inv = A().invoiceFor(site.id, ws);
    return `<section class="wf-panel no-print">
      <div class="row-between"><h2>Timesheet status · <span class="cochip co-${co}">${C.short}</span> Site ${site.number} — ${CJ.esc(site.clientName)}</h2><span class="wf wf-${cur.status} big">${cur.status === 'locked' ? '🔒 ' : ''}${CJ.F.statusLabel(cur.status, co)}</span></div>
      <p class="muted small">${C.name}: <b>${C.reviewer}</b> reviews this timesheet and drafts the email to the farm · the <b>owner</b> approves and locks · <b>${C.billing}</b> drafts the invoice. Nothing is sent from this app.</p>
      <ol class="wf-steps">${steps}</ol>
      <div class="grid2">
        <div><h3>${issues.length ? `⚠ ${issues.length} issue${issues.length > 1 ? 's' : ''} block Billing lock` : cur.status === 'locked' ? '🔒 Locked for billing' : '✓ No blocking issues'}</h3>
          ${issues.length ? `<ul class="issues">${issues.map((x) => `<li><span class="itype it-${x.type}">${{ missed: 'Missed clock-out', zero: '0 h', crew: 'Crew mismatch', offsite: 'Location', unsigned: 'Unsigned day' }[x.type]}</span> ${fD(x.day)} — ${CJ.esc(x.label)} ${x.shiftId ? `<a href="#/admin/shift/${x.shiftId}">Review</a>` : ''}</li>`).join('')}</ul>` : ''}
          ${cur.status === 'locked' ? '<p class="muted small">Shift edits for this farm-week are blocked. The owner can override from the shift edit screen; every override is written to the audit log below.</p>' : ''}
          <div class="row-gap">${btn ? `<button class="btn primary" data-advance="${next}" data-by="${btn[1]}" ${!allowed ? `disabled title="Your login can't do this step"` : next === 'locked' && issues.length ? 'disabled title="Fix the issues first"' : ''}>${btn[0]}</button>` : ''}
            ${cur.status === 'locked' ? (inv ? `<a class="btn primary" href="#/admin/invoice/${inv.id}">🧾 Open draft invoice ${CJ.esc(inv.number)}</a>` : (block ? `<button class="btn" disabled title="${CJ.esc(block)}">🧾 Create draft invoice</button><div class="err small">⛔ ${CJ.esc(block)}</div>` : `<button class="btn primary" data-invoice="1" ${canBill ? '' : `disabled title="${C.billing} or the owner drafts invoices"`}>🧾 Create draft invoice</button>`)) : '<button class="btn" disabled title="Available once Billing locked">🧾 Create draft invoice</button>'}</div></div>
        <div><h3>Daily crew sign-off</h3><table class="tbl"><tbody>${days.map((d) => `<tr><td class="nowrap">${fD(d.k)}</td><td>${d.so ? `<span class="tag on">✓ Signed</span> <span class="muted small">${CJ.esc(uname(d.so.byUserId))}${d.so.byRole === 'crewlead' ? ' (crew lead)' : ' (office)'}</span>` : `<span class="tag warn">Not signed</span> ${cur.status === 'locked' ? '' : `<button class="btn small ghost" data-sign="${d.k}">Sign off as office</button>`}`}</td></tr>`).join('')}</tbody></table>
          <h3>History</h3><ul class="wf-hist">${(cur.history.length ? cur.history : [{ status: 'draft', byName: 'System', note: 'Generated' }]).map((h) => `<li class="${/OVERRIDE/.test(h.note || '') ? 'ovr' : ''}"><b>${CJ.F.STATUS_LABEL[h.status]}</b> · ${CJ.esc(h.byName)}${h.at ? ' · ' + CJ.fmtDT(h.at) : ''}${h.note ? ' — ' + CJ.esc(h.note) : ''}</li>`).join('')}</ul></div>
      </div></section>`;
  }

  // ---------- Admin Timesheets page ----------
  function page() {
    const q = CJ.query(); const ws = q.get('week') || lastCompletedWeek(); const st = status(ws);
    const sheets = build(ws, null); const tot = (k) => sheets.reduce((a, s) => a + s.totals[k], 0); const cos = CJ.api.scope();
    const both = cos.length > 1; const chip = (site) => (both ? `<span class="cochip co-${coOfSite(site)}">${CO(coOfSite(site)).short}</span> ` : '');
    const wk = weeks(16); const prev = T().addDays(ws, -7), next = T().addDays(ws, 7);
    const link = (w) => location.pathname + '?week=' + w + '#/admin/timesheets';
    const nIssues = sheets.reduce((a, s) => a + s.issues.length, 0);
    return `
      <div class="page-h"><h1>Weekly farm timesheets</h1></div>
      <div class="ts-bar">
        <a class="btn small ghost" href="${link(prev)}">‹</a>
        <select id="tsWeek">${wk.map((w) => `<option value="${w}" ${w === ws ? 'selected' : ''}>Week of ${fRange(w)}${w === thisWeek() ? ' (this week)' : w === lastCompletedWeek() ? ' (last week)' : ''}</option>`).join('')}${wk.includes(ws) ? '' : `<option selected>${fRange(ws)}</option>`}</select>
        ${next <= thisWeek() ? `<a class="btn small ghost" href="${link(next)}">›</a>` : '<span class="btn small ghost" style="opacity:.4">›</span>'}
        <span class="tag ${st.done ? 'on' : 'warn'}">${st.label}</span>
      </div>
      <div class="info ts-note">📧 <b>Timesheets are never emailed to farms by this app.</b> ${cos.map((c) => `<b>${CO(c).reviewer}</b> reviews ${CO(c).name} timesheets`).join(' · ')} and drafts the email to the farm; nothing goes out without the owner's OK. Use the downloads below — files are separate per company.</div>
      ${legendHtml('ts-legend')}
      <div class="stats five">
        <div class="stat"><span>Farms with shifts</span><b>${sheets.length}</b></div>
        <div class="stat"><span>Worked h</span><b>${h2(tot('worked'))}</b></div>
        <div class="stat"><span>Paid h <em class="muted small">(employee pay)</em></span><b class="paid">${h2(tot('paid'))}</b></div>
        <div class="stat"><span>Billable h <em class="muted small">(farms)</em></span><b class="bill">${h2(tot('billable'))}</b></div>
        <div class="stat"><span>Edited days</span><b>${tot('edited')} <span class="mbadge">M</span></b></div>
      </div>
      <div class="panel nopad"><table class="tbl big">
        <thead><tr><th>Site</th><th>Employees</th><th>Days</th><th class="r">Worked h</th><th class="r">Paid h</th><th class="r">Billable h</th><th>Flags</th><th>Status</th><th class="r">Preview / download</th></tr></thead>
        <tbody>
        ${cos.map((c) => { const sh = sheets.filter((x) => coOfSite(x.site) === c); if (!sh.length) return ''; const t = (k) => sh.reduce((a, s) => a + s.totals[k], 0); const ni = sh.reduce((a, s) => a + s.issues.length, 0);
          return `<tr class="all-row"><td><b>${chip(sh[0].site)}All ${CO(c).name} farms</b><div class="muted small">${sh.length} timesheets in one file</div></td><td>${new Set(sh.flatMap((s) => s.employees)).size}</td><td>${t('days')}</td><td class="r">${h2(t('worked'))}</td><td class="r">${h2(t('paid'))}</td><td class="r"><b>${h2(t('billable'))}</b></td>
          <td>${t('edited') ? t('edited') + ' <span class="mbadge sm">M</span> ' : ''}${t('minDays') ? `<span class="tag">${t('minDays')} min 5 h</span> ` : ''}${t('crewMismatch') ? `<span class="crewbad">⚠ crew ${t('crewMismatch')}</span> ` : ''}${ni ? `<span class="tag bad">${ni} issue${ni > 1 ? 's' : ''}</span>` : ''}</td><td class="muted small">${['locked', 'approved', 'reviewed', 'draft'].map((k) => { const n = sh.filter((x) => A().tsStatus(x.site.id, ws).status === k).length; return n ? n + ' ' + CJ.F.STATUS_LABEL[k].replace(/ \(.*\)/, '').toLowerCase() : ''; }).filter(Boolean).join(' · ')}</td>
          <td class="r nowrap"><a class="btn small ghost" href="#/admin/timesheet/${ws}/all-${c}">Preview</a> <a class="btn small" href="#/admin/timesheet/${ws}/all-${c}" data-pdf>⤓ PDF</a> <button class="btn small primary" data-csv="all-${c}">⤓ CSV</button></td></tr>`; }).join('')}
        ${sheets.map((s) => `<tr><td><div class="sitecell"><b>${chip(s.site)}Site ${s.site.number}</b><span>${CJ.esc(s.site.clientName)}</span></div></td><td>${s.employees.length}</td><td>${s.totals.days}</td><td class="r">${h2(s.totals.worked)}</td><td class="r">${h2(s.totals.paid)}</td><td class="r"><b>${h2(s.totals.billable)}</b></td>
          <td>${s.totals.edited ? s.totals.edited + ' <span class="mbadge sm">M</span> ' : ''}${s.totals.minDays ? `<span class="tag">${s.totals.minDays} min 5 h</span> ` : ''}${s.totals.crewMismatch ? `<span class="crewbad">⚠ crew ${s.totals.crewMismatch}</span> ` : ''}${s.issues.length ? `<span class="tag bad">${s.issues.length} issue${s.issues.length > 1 ? 's' : ''}</span>` : ''}${s.totals.outNotes ? ` <a class="tag" href="#/admin/timesheet/${ws}/${s.site.id}" title="${CJ.esc(s.rows.flatMap((r) => r.outNotes.map((n) => r.employee + ': ' + n)).join('\n'))}">🗒 ${s.totals.outNotes}</a>` : ''}</td><td>${statusTag(s.site.id, ws)}</td>
          <td class="r nowrap"><a class="btn small ghost" href="#/admin/timesheet/${ws}/${s.site.id}">Preview</a> <a class="btn small" href="#/admin/timesheet/${ws}/${s.site.id}" data-pdf>⤓ PDF</a> <button class="btn small primary" data-csv="${s.site.id}">⤓ CSV</button></td></tr>`).join('') || '<tr><td colspan="9" class="muted">No shifts this week.</td></tr>'}
        </tbody></table></div>
      <p class="muted small">PDF opens the print view and your browser's print dialog — choose “Save as PDF”. Shifts with no clock-out (or 0 h) are not paid or billed and are listed as issues until fixed. ${st.done ? '' : 'This week is still in progress; numbers will change until Monday.'}</p>`;
  }
  function bindPage(root) {
    const sel = root.querySelector('#tsWeek'); sel && sel.addEventListener('change', () => { location.href = location.pathname + '?week=' + sel.value + '#/admin/timesheets'; });
    const ws = CJ.query().get('week') || lastCompletedWeek();
    root.querySelectorAll('[data-csv]').forEach((b) => b.addEventListener('click', () => downloadCsv(ws, b.dataset.csv)));
    root.querySelectorAll('[data-pdf]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); location.href = location.pathname + '?autoprint=1' + a.getAttribute('href'); }));
  }

  // ---------- Print view (one page per farm) ----------
  function printView(ws, which) {
    if (which === 'all') which = 'all-' + CJ.api.scope()[0];
    const sheets = build(ws, which); const st = status(ws);
    const mf = (on) => (on ? '<span class="mflag">M</span>' : '');
    const cellIn = (r) => r.punches.map((p) => `<div>${fT(p.clockIn)}${mf(p.inM)}</div>`).join('');
    const cellOut = (r) => r.punches.map((p) => `<div>${fT(p.clockOut)}${p.nextDay ? '<sup class="nd">+1</sup>' : ''}${mf(p.outM)}</div>`).join('');
    const tags = (r) => [r.split ? '<span class="rtag">split · combined</span>' : '', r.overnight ? '<span class="rtag">overnight · start day</span>' : ''].join('');
    const sheetHtml = (s) => `<section class="sheet">
      <div class="sheet-h co-${coOfSite(s.site)}"><img src="${CO(coOfSite(s.site)).logo}" alt="${CO(coOfSite(s.site)).name}" class="sheet-logo"><div class="sheet-co">${CO(coOfSite(s.site)).name}<span>${CO(coOfSite(s.site)).web}</span></div><div class="sheet-t"><h1>Weekly Timesheet</h1><div>Week of <b>${fRange(ws)}</b> <span class="muted">(Mon–Sun, Atlantic)</span></div></div></div>
      <div class="sheet-meta"><div><span>Client / farm</span><b>${CJ.esc(s.site.clientName)}</b></div><div><span>Site</span><b>Site ${s.site.number}</b></div><div><span>Location</span><b>${CJ.esc(s.site.location)}</b></div><div><span>Prepared</span><b>${st.done ? st.label.replace('Generated ', '') : 'DRAFT — week in progress'}</b></div></div>
      <table class="sheet-tbl"><thead><tr><th>Employee</th><th>Date</th><th>In</th><th>Out</th><th class="c">Crew rep.</th><th class="r">Worked</th><th class="r sub">Pay ded.</th><th class="r">Paid</th><th class="r sub">Bill adj.</th><th class="r">Billable</th></tr></thead><tbody>
      ${s.rows.map((r) => `<tr><td>${CJ.esc(r.employee)}${tags(r)}${r.outNotes.map((n) => `<div class="sheet-outnote">🗒 “${CJ.esc(n)}”</div>`).join('')}</td><td class="nowrap">${fD(r.day)}</td><td class="nowrap">${cellIn(r)}</td><td class="nowrap">${cellOut(r)}</td><td class="c">${r.crew.join('/') || '—'}${mf(r.crewM)}${r.crewCheck.mismatch ? `<div class="crewwarn">⚠ ${r.crewCheck.clockedIn} clocked in</div>` : ''}</td><td class="r">${h2(r.worked)}</td><td class="r sub">${sgn(-r.payDed)}</td><td class="r"><b>${h2(r.paid)}</b></td><td class="r sub">${sgn(r.billAdj)}${r.minApplied ? '<div class="minnote">min 5 h</div>' : ''}</td><td class="r"><b>${h2(r.billable)}</b></td></tr>`).join('')}
      </tbody><tfoot><tr><td colspan="5">Totals · ${s.totals.days} day${s.totals.days === 1 ? '' : 's'} · ${s.totals.shifts} punch${s.totals.shifts === 1 ? '' : 'es'} · ${s.employees.length} employee${s.employees.length === 1 ? '' : 's'}</td><td class="r">${h2(s.totals.worked)}</td><td class="r sub">${sgn(-s.totals.payDed)}</td><td class="r">${h2(s.totals.paid)}</td><td class="r sub">${sgn(s.totals.billAdj)}</td><td class="r">${h2(s.totals.billable)}</td></tr></tfoot></table>
      ${s.issues.length ? `<div class="sheet-issue">⚠ Not paid or billed until fixed: ${s.issues.map((x) => CJ.esc(uname(x.userId)) + ' ' + fD(x.day) + ' (' + x.why + ')').join(', ')}.</div>` : ''}
      <div class="sheet-foot"><span><span class="mflag">M</span> = time entered or corrected by hand (original time kept in ${CO(coOfSite(s.site)).name}'s audit log). <sup class="nd">+1</sup> = next day. Hours are decimal. Crew rep. = workers on site reported by the employee at clock-out; ⚠ = differs from the number of workers who clocked in at this site that day. 🗒 = clock-out note written by the employee (read-only).</span></div>
      ${legendHtml('sheet-legend')}
    </section>`;
    return `<div class="print-wrap">
      <div class="print-toolbar no-print"><a class="btn small ghost" href="${location.pathname}?week=${ws}#/admin/timesheets">‹ Timesheets</a><b>${/^all/.test(which) ? 'All ' + CO(which.slice(4)).name + ' farms' : 'Site ' + (sheets[0] ? sheets[0].site.number : '')} · ${fRange(ws)}</b><span class="spacer"></span><button class="btn small" id="pBtn">⤓ PDF (print → Save as PDF)</button><button class="btn small primary" id="cBtn">⤓ CSV</button></div>
      ${!/^all/.test(which) && sheets[0] ? workflowPanel(ws, sheets[0].site) : ''}
      ${sheets.map(sheetHtml).join('') || '<p>No shifts that week.</p>'}</div>`;
  }
  function bindPrint(root, ws, which) {
    root.querySelector('#pBtn').addEventListener('click', () => window.print());
    root.querySelector('#cBtn').addEventListener('click', () => downloadCsv(ws, which));
    root.querySelectorAll('[data-advance]').forEach((b) => b.addEventListener('click', () => { const r = A().advance(which, ws, b.dataset.advance, b.dataset.by); if (r.error) return CJ.toast(r.error, 'bad'); CJ.toast('Status: ' + CJ.F.statusLabel(r.status, CJ.api.coOf(A().site(which))), 'good'); CJ.render(); }));
    root.querySelectorAll('[data-sign]').forEach((b) => b.addEventListener('click', () => { const r = A().adminSignoff(which, b.dataset.sign, CJ.session.get()); if (r.error) return CJ.toast(r.error, 'bad'); CJ.toast('Day signed off', 'good'); CJ.render(); }));
    const ib = root.querySelector('[data-invoice]'); ib && ib.addEventListener('click', () => { const r = A().createInvoice(which, ws, CJ.session.get()); if (r.error) return CJ.toast(r.error, 'bad'); CJ.go('#/admin/invoice/' + r.id); });
    if (CJ.query().get('autoprint')) { history.replaceState(null, '', location.pathname + location.hash); setTimeout(() => window.print(), 300); }
  }

  CJ.ts = { statusTag, fRange, build, csv, weeks, lastCompletedWeek, status, page, bindPage, printView, bindPrint };
})();
