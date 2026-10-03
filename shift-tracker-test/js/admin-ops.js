/* ADMIN pages for the Oct-2026 batch: Schedule, Incidents, Invoices / A-R, invoice print view, Reports.
 * Admin-only (farm names allowed). NO send/email buttons anywhere: Sandra drafts invoice emails for the owner's approval. */
(function () {
  const CJ = (window.CJ = window.CJ || {});
  const A = () => CJ.api.admin; const T = () => CJ.tz; const F = () => CJ.F;
  const { esc, fmtTime, fmtDate, fmtDT, fmtDur } = CJ;
  const M = (n) => F().money(n);
  const keyDate = (k, o) => T().zoned(k, 12, 0).toLocaleDateString('en-US', { timeZone: 'America/Halifax', ...o });
  const fD = (k) => keyDate(k, { weekday: 'short', month: 'short', day: 'numeric' });
  const fDY = (k) => (k ? keyDate(k, { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
  const state = { schedRange: 'recent', incOpen: false, invView: 'open', invSite: '', year: null };
  const dl = (name, text) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + text], { type: 'text/csv' })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); CJ.toast('CSV downloaded: ' + name, 'good'); };
  const ST_CLS = { ok: 'on', late: 'warn', noshow: 'bad', upcoming: '' };

  // ---------- Schedule ----------
  function schedulePage() {
    const { shell, siteCell, uname } = CJ.adm; const today = T().todayKey();
    const r = state.schedRange; const from = r === 'past' ? T().addDays(today, -7) : r === 'recent' ? T().addDays(today, -1) : T().addDays(today, 1);
    const to = r === 'past' ? T().addDays(today, -1) : r === 'recent' ? today : T().addDays(today, 7);
    const list = A().schedules().filter((x) => x.day >= from && x.day <= to).sort((a, b) => a.startIso.localeCompare(b.startIso));
    const withSt = list.map((x) => ({ x, st: A().schedStatus(x) })); const ns = withSt.filter((w) => w.st.key === 'noshow').length;
    const days = [...new Set(list.map((x) => x.day))];
    const workers = A().users().filter((u) => u.role === 'worker' && u.status === 'active');
    const seg = (k, l) => `<button class="seg ${r === k ? 'on' : ''}" data-sr="${k}">${l}</button>`;
    return shell('schedule', `<div class="page-h"><h1>Schedule</h1><span class="muted">Employees see their own upcoming shifts by site number only.</span></div>
      <section class="panel"><h2>Post a shift</h2><form id="addSched" class="inline-form">
        <select name="userId" required><option value="">Employee…</option>${workers.map((u) => `<option value="${u.id}">${esc(u.name)}</option>`).join('')}</select>
        <select name="siteId" required><option value="">Site…</option>${A().sites().map((s) => `<option value="${s.id}">Site ${s.number} — ${esc(s.clientName)}</option>`).join('')}</select>
        <input type="date" name="day" value="${T().addDays(today, 1)}" required><input type="time" name="start" value="07:00" required><span>to</span><input type="time" name="end" value="15:30" required>
        <button class="btn primary">Post shift</button></form>
        <p class="muted small">No-show rule: flagged if the employee hasn't clocked in at that site <b>15 min after the start time</b> (setting). A clock-in up to 2 h early counts. Nothing is texted — alerts show on the dashboard.</p></section>
      <div class="filters"><div class="segs">${seg('past', 'Last 7 days')}${seg('recent', 'Yesterday + today')}${seg('next', 'Next 7 days')}</div><span class="tot">${list.length} scheduled shifts${ns ? ` · <span class="tag bad">${ns} no-show${ns > 1 ? 's' : ''}</span>` : ''}</span></div>
      ${days.map((d) => `<div class="panel nopad"><h3 class="day-h">${d === today ? 'Today · ' : d === T().addDays(today, -1) ? 'Yesterday · ' : ''}${fD(d)}</h3><table class="tbl"><thead><tr><th>Employee</th><th>Site</th><th>Scheduled</th><th>Status</th><th>Clock-in</th></tr></thead><tbody>
        ${withSt.filter((w) => w.x.day === d).map(({ x, st }) => { const sh = st.shiftId ? A().shift(st.shiftId) : null; return `<tr class="${st.key === 'noshow' ? 'row-bad' : ''}"><td>${esc(uname(x.userId))}</td><td>${siteCell(A().site(x.siteId))}</td><td class="nowrap">${fmtTime(x.startIso)} – ${fmtTime(x.endIso)}</td><td><span class="tag ${ST_CLS[st.key]}">${st.key === 'noshow' ? '🚫 ' : ''}${esc(st.label)}</span></td><td>${sh ? `<a href="#/admin/shift/${sh.id}">${fmtTime(sh.clockIn)}</a> ${CJ.adm.locBadge(sh)}${CJ.adm.isMissed(sh) ? ' <span class="tag bad">Missed clock-out</span>' : ''}` : st.key === 'noshow' ? '<span class="muted">No clock-in</span>' : '—'}</td></tr>`; }).join('')}</tbody></table></div>`).join('') || '<div class="panel muted">Nothing scheduled in this range.</div>'}`);
  }
  function bindSchedule(root, uid) {
    root.querySelectorAll('[data-sr]').forEach((b) => b.addEventListener('click', () => { state.schedRange = b.dataset.sr; CJ.render(); }));
    const f = root.querySelector('#addSched'); f.addEventListener('submit', (e) => { e.preventDefault(); const d = new FormData(f); const r = A().addSchedule(d.get('userId'), d.get('siteId'), d.get('day'), d.get('start'), d.get('end'), uid); if (r.error) return CJ.toast(r.error, 'bad'); CJ.toast('Shift posted — the employee will see it in their Schedule tab', 'good'); state.schedRange = 'next'; CJ.render(); });
  }

  // ---------- Incidents ----------
  function incidentsPage() {
    const { shell, siteCell, uname } = CJ.adm;
    const all = A().incidents().slice().sort((a, b) => b.at.localeCompare(a.at)); const open = all.filter(A().incOpen);
    const list = state.incOpen ? open : all;
    return shell('incidents', `<div class="page-h"><h1>Safety incidents</h1><span class="muted">Reported by employees at clock-out (optional). Office only.</span></div>
      <div class="stats six"><div class="stat"><span>Total reported</span><b>${all.length}</b></div><div class="stat ${open.length ? 'alert' : ''}"><span>Needing WCB follow-up</span><b>${open.length}</b></div>${A().INC_TYPES.map((t) => `<div class="stat"><span>${t}</span><b>${all.filter((i) => i.type === t).length}</b></div>`).join('')}</div>
      <label class="chk"><input type="checkbox" id="incOpen" ${state.incOpen ? 'checked' : ''}> Open follow-ups only</label>
      <div class="panel nopad"><table class="tbl big"><thead><tr><th>Date</th><th>Employee</th><th>Site</th><th>Type</th><th>What happened</th><th>Photo</th><th>WCB follow-up</th></tr></thead><tbody>
      ${list.map((i) => `<tr><td class="nowrap">${fmtDate(i.at)}<br><span class="muted small">${fmtTime(i.at)}</span></td><td>${esc(uname(i.userId))}</td><td>${siteCell(A().site(i.siteId))}</td><td><span class="itype it-${i.type.replace(/\s/g, '').toLowerCase()}">${esc(i.type)}</span></td><td class="notes">${esc(i.text)}<div class="muted small"><a href="#/admin/shift/${i.shiftId}">Shift</a> · ${i.history.length} status change${i.history.length > 1 ? 's' : ''}, last by ${esc(uname(i.history[i.history.length - 1].by))}</div></td>
        <td>${i.photo ? `<img class="inc-thumb" src="${i.photo}" alt="photo">` : '<span class="muted">—</span>'}</td>
        <td><select data-wcb="${i.id}" class="wcb ${A().incOpen(i) ? 'open' : ''}">${A().WCB.map((w) => `<option ${w === i.wcbStatus ? 'selected' : ''}>${w}</option>`).join('')}</select></td></tr>`).join('') || '<tr><td colspan="7" class="muted">No incidents.</td></tr>'}</tbody></table></div>
      <p class="muted small">WCB = Workers Compensation Board of PEI. Statuses are for tracking only — this app does not file anything with WCB.</p>`);
  }
  function bindIncidents(root, uid) {
    root.querySelector('#incOpen').addEventListener('change', (e) => { state.incOpen = e.target.checked; CJ.render(); });
    root.querySelectorAll('[data-wcb]').forEach((s) => s.addEventListener('change', () => { A().setWcb(s.dataset.wcb, s.value, uid); CJ.toast('WCB status updated', 'good'); CJ.render(); }));
  }

  // ---------- Invoices / accounts receivable ----------
  const ageTag = (r) => (r.inv.status === 'draft' ? '<span class="muted small">not issued</span>' : r.balance <= 0.005 ? '' : `<span class="age a${r.ageFlag}">${r.age} d${r.ageFlag ? ' · ' + r.ageFlag + '+' : ''}</span>`);
  const stTag = (r) => `<span class="ist ist-${r.status.replace(/\s/g, '').toLowerCase()}">${r.status}</span>`;
  function invoicesPage() {
    const { shell } = CJ.adm; const rows = A().invoiceRows();
    const remaining = rows.reduce((a, r) => a + r.balance, 0); const issued = rows.filter((r) => r.inv.status !== 'draft');
    const cnt = (f) => issued.filter((r) => r.balance > 0.005 && r.ageFlag === f).length;
    const vis = rows.filter((r) => (!state.invSite || r.inv.siteId === state.invSite) && (state.invView === 'all' || r.balance > 0.005 || r.inv.status === 'draft'));
    const bySite = {}; vis.forEach((r) => (bySite[r.inv.siteId] = bySite[r.inv.siteId] || []).push(r));
    const order = Object.keys(bySite).sort((a, b) => bySite[b].reduce((x, r) => x + r.balance, 0) - bySite[a].reduce((x, r) => x + r.balance, 0));
    const seg = (k, l) => `<button class="seg ${state.invView === k ? 'on' : ''}" data-iv="${k}">${l}</button>`;
    return shell('invoices', `<div class="page-h"><h1>Invoices &amp; accounts receivable</h1><button class="btn primary" id="expAll">⤓ Accounting CSV (all invoices)</button></div>
      <div class="info">🧾 Invoices are <b>drafts made from Billing-locked timesheets</b>. This app never emails invoices — <b>Sandra drafts the email to the farm for the owner's approval</b>. Record payments here by hand when they arrive. Rates marked SAMPLE are placeholders.</div>
      <div class="stats six"><div class="stat big"><span>Total Amount Remaining</span><b class="remain">${M(remaining)}</b></div><div class="stat"><span>Invoices open</span><b>${issued.filter((r) => r.balance > 0.005).length}</b></div><div class="stat"><span>Current (&lt;15 d)</span><b>${cnt(0)}</b></div><div class="stat"><span class="age a15">15+ days</span><b>${cnt(15)}</b></div><div class="stat"><span class="age a30">30+ days</span><b>${cnt(30)}</b></div><div class="stat ${cnt(45) ? 'alert' : ''}"><span class="age a45">45+ days</span><b>${cnt(45)}</b></div></div>
      <div class="filters"><div class="segs">${seg('open', 'Open & drafts')}${seg('all', 'All invoices')}</div><select id="invSite"><option value="">All farms</option>${A().sites().filter((s) => rows.some((r) => r.inv.siteId === s.id)).map((s) => `<option value="${s.id}" ${state.invSite === s.id ? 'selected' : ''}>Site ${s.number} — ${esc(s.clientName)}</option>`).join('')}</select><span class="tot">${vis.length} invoices · ${order.length} farms</span></div>
      ${order.map((sid) => { const list = bySite[sid]; const st = A().site(sid); const bal = list.reduce((a, r) => a + r.balance, 0);
        return `<div class="panel nopad inv-farm"><h3 class="day-h"><span>Site ${st.number} — ${esc(st.clientName)} <span class="muted small">prefix ${esc(st.invoicePrefix)} · ${M(st.rate)}/h ${st.rateSample ? '<span class="tag sample">SAMPLE</span>' : ''}</span></span><span style="margin-left:auto">Remaining <b>${M(bal)}</b></span></h3>
        <table class="tbl"><thead><tr><th>Invoice #</th><th>Week</th><th class="r">Total</th><th class="r">Paid</th><th class="r">Balance</th><th>Date paid</th><th>Status</th><th>Age</th><th></th></tr></thead><tbody>
        ${list.map((r) => `<tr class="${r.ageFlag >= 45 ? 'row-bad' : ''}"><td><a href="#/admin/invoice/${r.inv.id}"><b>${esc(r.inv.number)}</b></a></td><td class="nowrap">${CJ.ts.fRange(r.inv.weekStart)}</td><td class="r">${M(r.inv.total)}</td><td class="r">${M(r.paid)}</td><td class="r"><b>${M(r.balance)}</b></td><td class="nowrap">${r.datePaid ? fDY(r.datePaid) : '—'}</td><td>${stTag(r)}</td><td>${ageTag(r)}</td>
          <td class="r nowrap"><a class="btn small ghost" href="#/admin/invoice/${r.inv.id}">View</a> ${r.inv.status !== 'draft' && r.balance > 0.005 ? `<button class="btn small" data-pay="${r.inv.id}">Record payment</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`; }).join('') || '<div class="panel muted">No invoices match.</div>'}
      <p class="muted small">Age = days since the invoice was issued (marked issued by the owner after Sandra's email went out). Flags at 15, 30 and 45 days.</p>`);
  }
  function payModal(id, uid) {
    const r = A().invoiceRows().find((x) => x.inv.id === id);
    CJ.modal(`<h2>Record payment · ${esc(r.inv.number)}</h2><p class="muted">${esc(r.site.clientName)} · balance <b>${M(r.balance)}</b></p>
      <div class="stack"><label class="field"><span>Amount received</span><input id="pAmt" type="number" step="0.01" min="0.01" value="${r.balance.toFixed(2)}"></label><label class="field"><span>Date received</span><input id="pDate" type="date" value="${T().todayKey()}"></label><label class="field"><span>Note</span><input id="pNote" placeholder="e.g. cheque #1042, e-transfer"></label><div class="err" id="pErr"></div></div>
      <div class="row-end"><button class="btn ghost" data-close>Cancel</button><button class="btn primary" id="pOk">Save payment</button></div>`, (w, close) => w.querySelector('#pOk').addEventListener('click', () => { const x = A().recordPayment(id, w.querySelector('#pAmt').value, w.querySelector('#pDate').value, w.querySelector('#pNote').value, uid); if (x.error) { w.querySelector('#pErr').textContent = x.error; return; } close(); CJ.toast('Payment recorded', 'good'); CJ.render(); }));
  }
  function bindInvoices(root, uid) {
    root.querySelectorAll('[data-iv]').forEach((b) => b.addEventListener('click', () => { state.invView = b.dataset.iv; CJ.render(); }));
    root.querySelector('#invSite').addEventListener('change', (e) => { state.invSite = e.target.value; CJ.render(); });
    root.querySelectorAll('[data-pay]').forEach((b) => b.addEventListener('click', () => payModal(b.dataset.pay, uid)));
    root.querySelector('#expAll').addEventListener('click', () => dl('accounting-export_all-invoices_' + T().todayKey() + '.csv', A().accountingCsv(A().invoiceRows().map((r) => r.inv))));
  }

  // ---------- Invoice print view (DRAFT) ----------
  function invoiceView(id) {
    const r = A().invoiceRows().find((x) => x.inv.id === id); if (!r) return '<p>Invoice not found.</p>';
    const i = r.inv, st = r.site; const days = CJ.rules.groupDays(A().shifts().filter((s) => s.siteId === st.id && CJ.rules.inWeek(T().dayKey(s.clockIn), i.weekStart)));
    const perDay = {}; days.forEach((d) => (perDay[d.day] = perDay[d.day] || { h: 0, n: 0 }, perDay[d.day].h += d.billable, perDay[d.day].n++));
    return `<div class="print-wrap">
      <div class="print-toolbar no-print"><a class="btn small ghost" href="#/admin/invoices">‹ Invoices</a><b>${esc(i.number)} · ${esc(st.clientName)}</b>${stTag(r)}<span class="spacer"></span>
        <button class="btn small" id="pBtn" title="Print → Save as PDF">⤓ PDF</button><button class="btn small" id="cBtn" title="Accounting CSV for this invoice">⤓ CSV</button>
        ${i.status === 'draft' ? '<button class="btn small" id="issBtn" title="Use after Sandra\'s email was approved and sent outside this app">Mark as issued</button>' : r.balance > 0.005 ? `<button class="btn small primary" data-pay="${i.id}">Record payment</button>` : ''}</div>
      <div class="info no-print">✉ <b>No send button — on purpose.</b> Sandra drafts the email to ${esc(st.clientName)} with this PDF attached, for the owner's approval. After it's sent (outside this app), click “Mark as issued” to start the aging clock.${i.changedAfterLock ? ' <b>⚠ Shifts in this week were changed after lock (owner override) — check this draft before sending.</b>' : ''}</div>
      <section class="sheet invoice ${i.status === 'draft' ? 'is-draft' : ''}"><div class="wm">DRAFT</div>
        <div class="sheet-h"><img src="assets/logo.png" alt="Chief Janitorial" class="sheet-logo"><div class="sheet-t"><h1>INVOICE <span class="draft-pill">DRAFT</span></h1><div>Chief Janitorial · Prince Edward Island · HST # <i>[to be added]</i></div></div></div>
        <div class="sheet-meta"><div><span>Invoice #</span><b>${esc(i.number)}</b></div><div><span>Invoice date</span><b>${fDY(i.date)}</b></div><div><span>Bill to</span><b>${esc(st.clientName)}</b><small>${esc(st.location)} · Site ${st.number}</small></div><div><span>Service week</span><b>${CJ.ts.fRange(i.weekStart)}</b></div></div>
        <table class="sheet-tbl"><thead><tr><th>Description</th><th class="r">Qty (h)</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead><tbody>
          <tr><td>Cleaning services — Site ${st.number}, week of ${CJ.ts.fRange(i.weekStart)}<div class="muted small">Billable hours per the Billing-locked weekly timesheet${st.rateSample ? ' · <b>SAMPLE rate — replace with contract rate</b>' : ''}</div></td><td class="r">${i.qty.toFixed(2)}</td><td class="r">${M(i.rate)}</td><td class="r">${M(i.subtotal)}</td></tr>
        </tbody><tfoot><tr><td colspan="3" class="r">Subtotal</td><td class="r">${M(i.subtotal)}</td></tr><tr><td colspan="3" class="r">HST 15% (PE)</td><td class="r">${M(i.hst)}</td></tr><tr class="grand"><td colspan="3" class="r">Total due (CAD)</td><td class="r">${M(i.total)}</td></tr>${r.paid ? `<tr><td colspan="3" class="r">Paid</td><td class="r">−${M(r.paid)}</td></tr><tr><td colspan="3" class="r"><b>Balance</b></td><td class="r"><b>${M(r.balance)}</b></td></tr>` : ''}</tfoot></table>
        <h3>Billable hours by day</h3><table class="sheet-tbl small"><thead><tr><th>Date</th><th class="r">Worker-days</th><th class="r">Billable h</th></tr></thead><tbody>${Object.keys(perDay).sort().map((d) => `<tr><td>${fD(d)}</td><td class="r">${perDay[d].n}</td><td class="r">${perDay[d].h.toFixed(2)}</td></tr>`).join('')}</tbody></table>
        <div class="sheet-foot">Billable hours follow the agreed billing rule (−0.5 h over 5 h; 5 h minimum per worker per day). Detailed timesheet available on request. Payment terms: to be confirmed.</div>
      </section></div>`;
  }
  function bindInvoice(root, id, uid) {
    root.querySelector('#pBtn').addEventListener('click', () => window.print());
    root.querySelector('#cBtn').addEventListener('click', () => { const r = A().invoiceRows().find((x) => x.inv.id === id); dl('accounting-export_' + r.inv.number + '.csv', A().accountingCsv([r.inv])); });
    const iss = root.querySelector('#issBtn'); iss && iss.addEventListener('click', () => CJ.modal('<h2>Mark as issued?</h2><p>Only do this after the owner approved Sandra\'s email and it was sent <b>outside this app</b>. Aging starts today.</p><div class="row-end"><button class="btn ghost" data-close>Cancel</button><button class="btn primary" id="ok">Mark issued</button></div>', (w, close) => w.querySelector('#ok').addEventListener('click', () => { A().markIssued(id, uid); close(); CJ.render(); })));
    root.querySelectorAll('[data-pay]').forEach((b) => b.addEventListener('click', () => payModal(id, uid)));
    if (CJ.query().get('autoprint')) { history.replaceState(null, '', location.pathname + location.hash); setTimeout(() => window.print(), 300); }
  }

  // ---------- Reports ----------
  function reportsPage() {
    const { shell } = CJ.adm; const year = state.year || +T().todayKey().slice(0, 4); const rows = A().seasonSummary(year);
    const t = (k) => rows.reduce((a, r) => a + r[k], 0); const tm = (m) => rows.reduce((a, r) => a + r.months[m], 0);
    const MN = { 7: 'Jul', 8: 'Aug', 9: 'Sep', 10: 'Oct', 11: 'Nov' };
    const ws = T().weekStart(T().todayKey()); const S = CJ.api.db().settings;
    const workers = A().users().filter((u) => u.role === 'worker' && u.status === 'active').map((u) => ({ u, h: A().weekHours(u.id, ws), d: F().consecutiveDays(A().shifts().filter((s) => s.userId === u.id).map((s) => T().dayKey(s.clockIn)), T().todayKey(), T().addDays) })).sort((a, b) => b.h - a.h);
    return shell('reports', `<div class="page-h"><h1>Reports</h1><span class="muted"><a href="#/admin/edits">Manual edit log →</a></span></div>
      <section class="panel"><div class="row-between"><h2>Season summary ${year} · July–November <span class="muted small">billable hours and dollars per farm (pre-tax, at current rates)</span></h2><button class="btn small" id="seasonCsv">⤓ CSV</button></div>
        <table class="tbl"><thead><tr><th>Site / farm</th>${Object.values(MN).map((m) => `<th class="r">${m} h</th>`).join('')}<th class="r">Billable h</th><th class="r">Rate</th><th class="r">Billable $</th><th class="r">Invoiced (incl. HST)</th><th class="r">Paid</th><th class="r">Balance</th></tr></thead><tbody>
        ${rows.map((r) => `<tr><td class="nowrap"><b>Site ${r.site.number}</b> · ${esc(r.site.clientName)}</td>${[7, 8, 9, 10, 11].map((m) => `<td class="r">${r.months[m] ? r.months[m].toFixed(1) : '—'}</td>`).join('')}<td class="r"><b>${r.billable.toFixed(2)}</b></td><td class="r nowrap">${M(r.site.rate)}${r.site.rateSample ? ' <span class="tag sample sm">S</span>' : ''}</td><td class="r"><b>${M(r.dollars)}</b></td><td class="r">${M(r.invoiced)}</td><td class="r">${M(r.paid)}</td><td class="r">${M(r.balance)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td><b>All farms (${rows.length})</b></td>${[7, 8, 9, 10, 11].map((m) => `<td class="r">${tm(m).toFixed(1)}</td>`).join('')}<td class="r"><b>${t('billable').toFixed(2)}</b></td><td></td><td class="r"><b>${M(t('dollars'))}</b></td><td class="r">${M(t('invoiced'))}</td><td class="r">${M(t('paid'))}</td><td class="r">${M(t('balance'))}</td></tr></tfoot></table>
        <p class="muted small">S / SAMPLE = placeholder rate. Billable $ = billable hours × current rate, before HST; months after today are partial or empty. Invoiced = draft + issued invoices for weeks starting in the season.</p></section>
      <div class="grid2">
        <section class="panel"><h2>Overtime &amp; fatigue · this week</h2><p class="muted small">Flag at <b>${S.otNearH} h</b> (nearing) and over <b>${S.otThresholdH} h</b> — <b>PEI OT threshold, confirm</b>. Fatigue flag at ${S.maxConsecDays}+ consecutive days.</p>
          <table class="tbl"><thead><tr><th>Employee</th><th class="r">Hours this week</th><th>OT</th><th class="r">Days in a row</th></tr></thead><tbody>
          ${workers.map((w) => { const o = F().otStatus(w.h, S); return `<tr><td>${esc(w.u.name)}</td><td class="r">${fmtDur(w.h)}</td><td>${o === 'over' ? '<span class="tag bad">Over 44 h</span>' : o === 'near' ? '<span class="tag warn">Nearing 44 h</span>' : ''}</td><td class="r">${w.d}${w.d >= S.maxConsecDays ? ' <span class="tag warn">😴 6+</span>' : ''}</td></tr>`; }).join('')}</tbody></table></section>
        <section class="panel"><h2>Accounting export</h2><p class="muted small">Generic CSV for import into accounting software: InvoiceNo, Customer, Date, Description, Qty, Rate, TaxCode, Total (line amount before tax), plus Tax and InvoiceTotal columns. One row per invoice.</p>
          <div class="stack"><button class="btn primary" id="expAll2">⤓ All invoices</button><button class="btn" id="expIssued">⤓ Issued invoices only</button><button class="btn" id="expSeason">⤓ This season (Jul–Nov)</button></div>
          <p class="muted small">Per-invoice CSV is on each invoice. Column names may need mapping to the chosen accounting package (open question).</p>
          <h2>Audit</h2><p><a class="btn ghost" href="#/admin/edits">Manual edit log (all <span class="mbadge sm">M</span> changes) →</a></p></section>
      </div>`);
  }
  function bindReports(root) {
    const year = state.year || +T().todayKey().slice(0, 4); const invs = () => A().invoiceRows().map((r) => r.inv);
    root.querySelector('#expAll2').addEventListener('click', () => dl('accounting-export_all-invoices_' + T().todayKey() + '.csv', A().accountingCsv(invs())));
    root.querySelector('#expIssued').addEventListener('click', () => dl('accounting-export_issued_' + T().todayKey() + '.csv', A().accountingCsv(invs().filter((i) => i.status !== 'draft'))));
    root.querySelector('#expSeason').addEventListener('click', () => dl('accounting-export_season-' + year + '.csv', A().accountingCsv(invs().filter((i) => i.weekStart >= year + '-07-01' && i.weekStart <= year + '-11-30'))));
    root.querySelector('#seasonCsv').addEventListener('click', () => { const c = (v) => '"' + String(v).replace(/"/g, '""') + '"'; const L = [['Site #', 'Farm', 'Jul h', 'Aug h', 'Sep h', 'Oct h', 'Nov h', 'Billable h', 'Rate', 'Rate is sample', 'Billable $ (pre-tax)', 'Invoiced incl HST', 'Paid', 'Balance'].map(c).join(',')]; A().seasonSummary(year).forEach((r) => L.push([r.site.number, r.site.clientName, ...[7, 8, 9, 10, 11].map((m) => r.months[m].toFixed(2)), r.billable.toFixed(2), r.site.rate.toFixed(2), r.site.rateSample ? 'SAMPLE' : '', r.dollars.toFixed(2), r.invoiced.toFixed(2), r.paid.toFixed(2), r.balance.toFixed(2)].map(c).join(','))); dl('season-summary_' + year + '.csv', L.join('\n')); });
  }

  const PAGES = ['schedule', 'incidents', 'invoices', 'invoice', 'reports'];
  CJ.admOps = {
    handles: (p) => PAGES.includes(p),
    view(app, p, id, parts, uid) {
      if (p === 'schedule') { app.innerHTML = schedulePage(); bindSchedule(app, uid); }
      else if (p === 'incidents') { app.innerHTML = incidentsPage(); bindIncidents(app, uid); }
      else if (p === 'invoices') { app.innerHTML = invoicesPage(); bindInvoices(app, uid); }
      else if (p === 'invoice') { app.innerHTML = invoiceView(id); bindInvoice(app, id, uid); }
      else if (p === 'reports') { app.innerHTML = reportsPage(); bindReports(app); }
    },
  };
})();
