/* ADMIN / OWNER screens (desktop-first). Admin sees site number + client/farm name everywhere. */
(function () {
  const CJ = (window.CJ = window.CJ || {});
  const A = () => CJ.api.admin;
  const { esc, fmtTime, fmtDate, fmtDT, fmtDur, hours, mBadge, toLocalInput, ago } = CJ;
  const siteCell = (s) => (s ? `<div class="sitecell"><b>Site ${s.number}</b><span>${esc(s.clientName)}</span></div>` : '—');
  const siteText = (s) => (s ? `Site ${s.number} — ${s.clientName}` : '');
  const uname = (id) => { const u = A().user(id); return u ? u.name : id; };
  const FL = { clockIn: 'clock-in', clockOut: 'clock-out', crewCount: 'workers on site' };
  const FLc = { clockIn: 'Clock in', clockOut: 'Clock out', crewCount: 'Workers on site' };
  const fv = (e, v, long) => (e.field === 'crewCount' ? (v == null ? 'none' : v) : v ? (long ? fmtDT(v) : fmtTime(v)) : 'none');
  const crewOf = (s) => A().crewCheck(s.siteId, CJ.tz.dayKey(s.clockIn));
  const crewBadge = (c) => (c.mismatch ? `<span class="crewbad" title="Crew count reported at clock-out doesn't match who clocked in">⚠ ${esc(c.label)}</span>` : '');
  const crewCell = (s) => (s.crewCount == null ? '<span class="muted">—</span>' : `<b>${s.crewCount}</b>${mBadge(A().fieldEdited(s, 'crewCount'), 'Changed by hand — view history', '#/admin/shift/' + s.id)}`) + (crewOf(s).mismatch ? '<br>' + crewBadge(crewOf(s)) : '');
  const state = { range: 'week', site: '', q: '', editedOnly: false, openOnly: false, tab: 'pending' };

  function shell(active, body) {
    const n = A().pending().length;
    const link = (k, label, extra) => `<a href="#/admin/${k}" class="${active === k ? 'on' : ''}">${label}${extra || ''}</a>`;
    return `<div class="adm">
      <header class="adm-top"><div class="adm-top-in">
        <a href="#/admin/dashboard">${CJ.logo()}</a>
        <nav class="adm-nav">${link('dashboard', 'Dashboard')}${link('shifts', 'Shifts')}${link('schedule', 'Schedule')}${link('employees', 'Employees')}${link('timesheets', 'Timesheets')}${link('invoices', 'Invoices')}${link('incidents', 'Incidents')}${link('reports', 'Reports')}${link('sites', 'Sites')}</nav>
        <div class="topbar-r"><a class="iconbtn bell" href="#/admin/approvals" title="${n} sign-ups waiting">🔔${n ? `<span class="dot">${n}</span>` : ''}</a>${CJ.themeBtn()}<span class="who">Owner</span><button class="btn small ghost" data-act="logout">Log out</button></div>
      </div></header>
      <main class="adm-main">${body}</main></div>`;
  }

  function inRange(iso) {
    const k = CJ.tz.dayKey(iso), t = CJ.tz.todayKey(); // Atlantic days
    if (state.range === 'today') return k === t;
    if (state.range === 'week') return k >= CJ.tz.weekStart(t);
    if (state.range === '7') return k >= CJ.tz.addDays(t, -6);
    if (state.range === '14') return k >= CJ.tz.addDays(t, -13);
    return true;
  }
  // Missed clock-out: open > settings.missedOpenHours (default 14 h) OR past scheduled end + 2 h
  const isMissed = (s) => !s.clockOut && !!CJ.F.missedClockOut(s, A().schedFor(s), Date.now(), CJ.api.db().settings);
  const locBadge = (s) => (!s.location || s.location.status === 'ok' ? '' : `<a class="locbad ${s.location.reviewed ? 'rev' : ''}" href="#/admin/shift/${s.id}" title="Location check at clock-in">${s.location.status === 'none' ? '📍 No location' : '📍 Off-site ' + CJ.F.fmtDist(s.location.distanceM)}${s.location.reviewed ? ' ✓' : ''}</a>`);

  // ---------- Dashboard ----------
  function dashboard() {
    const all = A().shifts(); const now = new Date().toISOString();
    const onNow = all.filter((s) => !s.clockOut && !isMissed(s));
    const missed = all.filter(isMissed);
    const wk = all.filter((s) => new Date(s.clockIn) >= CJ.startOfWeek());
    const wkH = wk.reduce((a, s) => a + hours(s.clockIn, s.clockOut), 0);
    const edits = A().allEdits(); const wkAgo = Date.now() - 7 * 86400000; const recentEdits = edits.filter((e) => new Date(e.at) > wkAgo);
    const pend = A().pending(); const mm = A().crewMismatches(14);
    const al = A().alerts();
    const mmShift = (c) => A().shifts().find((x) => x.siteId === c.siteId && CJ.tz.dayKey(x.clockIn) === c.day && x.crewCount != null);
    return shell('dashboard', `
      <h1>${CJ.tz.parts(Date.now()).h < 12 ? 'Good morning' : CJ.tz.parts(Date.now()).h < 18 ? 'Good afternoon' : 'Good evening'}</h1>
      ${pend.length ? `<a class="banner" href="#/admin/approvals"><b>${pend.length} new sign-up${pend.length > 1 ? 's' : ''} waiting for approval</b><span>${pend.map((u) => esc(u.name)).join(', ')} — they can't clock in until you approve.</span><em>Review →</em></a>` : ''}
      ${alertsPanel(al)}
      <div class="stats six">
        <div class="stat"><span>On shift now</span><b>${onNow.length}</b></div>
        <div class="stat"><span>Hours this week</span><b>${fmtDur(wkH)}</b></div>
        <div class="stat"><span>Manual edits (7 days)</span><b>${recentEdits.length} <span class="mbadge">M</span></b></div>
        <div class="stat ${missed.length ? 'alert' : ''}"><span>Missed clock-outs</span><b>${missed.length}</b></div>
        <div class="stat ${al.noShows.length ? 'alert' : ''}"><span>No-shows (7 days)</span><b>${al.noShows.length}</b></div>
        <div class="stat ${mm.length ? 'alert' : ''}"><span>Crew count mismatches (14 days)</span><b>${mm.length} ${mm.length ? '<span class="crewbad big">⚠</span>' : ''}</b></div>
      </div>
      ${mm.length ? `<section class="panel mm-panel"><h2>⚠ Crew count mismatches <span class="muted small">workers reported at clock-out vs workers who clocked in, same site &amp; day</span></h2>
        <table class="tbl"><thead><tr><th>Date</th><th>Site</th><th>Reported by</th><th>Check</th><th></th></tr></thead><tbody>
        ${mm.map((c) => { const st = A().site(c.siteId); const reps = A().shifts().filter((x) => x.siteId === c.siteId && CJ.tz.dayKey(x.clockIn) === c.day && x.crewCount != null); const sh = mmShift(c);
          return `<tr><td class="nowrap">${fmtDate(sh.clockIn)}</td><td>${siteCell(st)}</td><td>${reps.map((x) => esc(uname(x.userId)) + ' (' + x.crewCount + ')').join(', ')}</td><td>${crewBadge(c)}</td><td class="r"><a class="btn small ghost" href="#/admin/shift/${sh.id}">Review</a></td></tr>`; }).join('')}
        </tbody></table></section>` : ''}
      <div class="grid2">
        <section class="panel"><h2>On shift now</h2>
          <table class="tbl"><thead><tr><th>Employee</th><th>Site</th><th>Since</th><th>Elapsed</th></tr></thead><tbody>
          ${onNow.map((s) => `<tr><td>${esc(uname(s.userId))}</td><td>${siteCell(A().site(s.siteId))}</td><td>${fmtTime(s.clockIn)}${mBadge(A().fieldEdited(s, 'clockIn'), '', '#/admin/shift/' + s.id)}</td><td>${fmtDur(hours(s.clockIn, now))}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Nobody on shift.</td></tr>'}
          </tbody></table>
          ${missed.length ? `<h3 class="warn-h">Missed clock-outs</h3><table class="tbl"><tbody>${missed.map((s) => `<tr><td>${esc(uname(s.userId))}</td><td>${siteCell(A().site(s.siteId))}</td><td>In ${fmtDT(s.clockIn)}<br><span class="muted small">${esc(CJ.F.missedClockOut(s, A().schedFor(s), Date.now(), CJ.api.db().settings).reason)}</span></td><td><a class="btn small" href="#/admin/edit/${s.id}">Fix</a></td></tr>`).join('')}</tbody></table>` : ''}
        </section>
        <section class="panel"><h2>Recent manual edits <a class="small" href="#/admin/edits">All →</a></h2>
          <ul class="feed">${recentEdits.slice(0, 6).map((e) => editItem(e, true)).join('') || '<li class="muted">No edits this week.</li>'}</ul>
        </section>
      </div>`);
  }
  function alertsPanel(al) {
    const row = (cls, icon, title, items, more) => items.length ? `<div class="al ${cls}"><div class="al-h">${icon} <b>${title}</b> <span class="count">${items.length}</span>${more ? ` <a class="small" href="${more}">View →</a>` : ''}</div><ul>${items.slice(0, 4).join('')}${items.length > 4 ? `<li class="muted">+ ${items.length - 4} more</li>` : ''}</ul></div>` : '';
    const li = (h) => `<li>${h}</li>`; const st = (id) => { const x = A().site(id); return `Site ${x.number} · ${esc(x.clientName)}`; };
    const html = [
      row('bad', '⏰', 'Missed clock-outs', al.missed.map((x) => li(`<b>${esc(uname(x.shift.userId))}</b> — ${st(x.shift.siteId)}, in ${fmtDT(x.shift.clockIn)} · <span class="muted">${esc(x.m.reason)}</span>${x.reminded ? ' · <span class="tag sm">🔔 in-app reminder sent</span>' : ''} <a href="#/admin/edit/${x.shift.id}">Fix</a>`))),
      row('bad', '🚫', 'No-shows (no clock-in 15 min after start)', al.noShows.map((x) => li(`<b>${esc(uname(x.sched.userId))}</b> — ${st(x.sched.siteId)}, scheduled ${fmtDate(x.sched.startIso)} ${fmtTime(x.sched.startIso)}–${fmtTime(x.sched.endIso)}`)), '#/admin/schedule'),
      row('warn', '📍', 'Off-site / no-location clock-ins to review', al.offsite.map((s) => li(`<b>${esc(uname(s.userId))}</b> — ${st(s.siteId)}, ${fmtDate(s.clockIn)} ${locBadge(s)}`))),
      row('warn', '👥', 'Crew count mismatches', al.crew.map((c) => li(`${st(c.siteId)} — ${fmtDate(CJ.tz.zoned(c.day, 12, 0).toISOString())} ${crewBadge(c)}`))),
      row('warn', '⏱', 'Overtime (PEI OT threshold, confirm: 44 h/week)', al.ot.map((x) => li(`<b>${esc(x.user.name)}</b> — ${fmtDur(x.hours)} this week <span class="tag ${x.status === 'over' ? 'bad' : 'warn'}">${x.status === 'over' ? 'Over 44 h' : 'Nearing 44 h'}</span>`)), '#/admin/reports'),
      row('warn', '😴', 'Fatigue: 6+ consecutive days', al.fatigue.map((x) => li(`<b>${esc(x.user.name)}</b> — ${x.days} days in a row`)), '#/admin/reports'),
      row('warn', '🩹', 'Incidents needing WCB follow-up', al.incidents.map((i) => li(`<b>${esc(uname(i.userId))}</b> — ${esc(i.type)}, ${st(i.siteId)}, ${fmtDate(i.at)} · <span class="tag warn">${esc(i.wcbStatus)}</span>`)), '#/admin/incidents'),
      row('info', '✍', 'Days not signed off (since last Monday)', al.unsigned.map((u) => li(`${st(u.siteId)} — ${fmtDate(CJ.tz.zoned(u.day, 12, 0).toISOString())}`)), '#/admin/timesheets'),
      row('info', '💲', 'Invoices 30+ days unpaid', al.overdue.map((r) => li(`<b>${esc(r.inv.number)}</b> — ${esc(r.site.clientName)}, balance ${CJ.F.money(r.balance)} · <span class="age a${r.ageFlag}">${r.age} days</span>`)), '#/admin/invoices'),
    ].join('');
    return html ? `<section class="panel alerts"><h2>Alerts <span class="muted small">auto-flagged · in-app only, nothing is texted or emailed</span></h2><div class="al-grid">${html}</div></section>` : '';
  }
  function editItem(e, withShift) {
    const s = e.shift || A().shift(e.shiftId); const st = A().site(s.siteId);
    const fl = FL[e.field];
    return `<li><div class="feed-h"><b>${esc(uname(e.byUserId))}</b> <span class="role ${e.byRole}">${e.byRole === 'admin' ? 'admin' : 'employee'}</span> changed ${e.byUserId === s.userId ? 'their own ' : ''}${fl}${withShift && e.byUserId !== s.userId ? ` for <b>${esc(uname(s.userId))}</b>` : ''}</div>
      <div class="feed-c"><s>${fv(e, e.from)}</s> → <b>${fv(e, e.to)}</b> <span class="mbadge sm">M</span>${withShift ? ` · ${fmtDate(s.clockIn)} · ${esc(siteText(st))}` : ''}</div>
      <div class="feed-r">“${esc(e.reason)}”</div><div class="feed-t">${fmtDT(e.at)} ${withShift ? `· <a href="#/admin/shift/${s.id}">History</a>` : ''}</div></li>`;
  }

  // ---------- Shifts table ----------
  function filtered() {
    const q = state.q.toLowerCase();
    return A().shifts().filter((s) => {
      if (!inRange(s.clockIn)) return false;
      if (state.site && s.siteId !== state.site) return false;
      if (state.editedOnly && !s.edits.length) return false;
      if (state.openOnly && s.clockOut) return false;
      if (q) { const st = A().site(s.siteId); const hay = [uname(s.userId), 'site ' + st.number, st.clientName, st.legacyCode, s.notes].join(' ').toLowerCase(); if (!hay.includes(q)) return false; }
      return true;
    });
  }
  function shiftsPage() {
    const q0 = CJ.query(); if (q0.get('edited') && !state._q) { state.editedOnly = true; state._q = 1; } if (q0.get('range') && !state._r) { state.range = q0.get('range'); state._r = 1; }
    const rows = filtered(); const tot = rows.reduce((a, s) => a + hours(s.clockIn, s.clockOut), 0); const ed = rows.filter((s) => s.edits.length).length;
    const seg = (k, l) => `<button class="seg ${state.range === k ? 'on' : ''}" data-range="${k}">${l}</button>`;
    return shell('shifts', `
      <div class="page-h"><h1>All shifts</h1><button class="btn primary" id="exportBtn">⤓ Export CSV</button></div>
      <div class="filters">
        <div class="segs">${seg('today', 'Today')}${seg('week', 'This week')}${seg('7', 'Last 7 days')}${seg('14', 'Last 14 days')}${seg('all', 'All')}</div>
        <select id="fSite"><option value="">All sites</option>${A().sites().map((s) => `<option value="${s.id}" ${state.site === s.id ? 'selected' : ''}>${esc(siteText(s))}</option>`).join('')}</select>
        <input id="fQ" placeholder="Search name, site #, farm, notes…" value="${esc(state.q)}">
        <label class="chk"><input type="checkbox" id="fEd" ${state.editedOnly ? 'checked' : ''}> Edited only <span class="mbadge sm">M</span></label>
        <label class="chk"><input type="checkbox" id="fOpen" ${state.openOnly ? 'checked' : ''}> Open only</label>
      </div>
      <div class="tot">${rows.length} shifts · <b>${fmtDur(tot)}</b> total · ${ed} with manual edits <span class="muted">— <span class="mbadge sm">M</span> = changed by hand; click it for the audit history</span></div>
      <div class="panel nopad"><table class="tbl big">
        <thead><tr><th>Date</th><th>Employee</th><th>Site</th><th>Clock in</th><th>Clock out</th><th>Hours</th><th>Crew</th><th>Notes <span class="muted small">(in · 🗒 out)</span></th><th></th></tr></thead>
        <tbody>${rows.slice(0, 60).map((s) => {
          const st = A().site(s.siteId); const missed = isMissed(s);
          return `<tr class="${missed ? 'row-bad' : ''}"><td class="nowrap">${fmtDate(s.clockIn)}</td><td>${esc(uname(s.userId))}</td><td>${siteCell(st)}</td>
            <td class="nowrap">${fmtTime(s.clockIn)}${mBadge(A().fieldEdited(s, 'clockIn'), 'Changed by hand — view history', '#/admin/shift/' + s.id)}${locBadge(s) ? '<br>' + locBadge(s) : ''}</td>
            <td class="nowrap">${s.clockOut ? fmtTime(s.clockOut) : missed ? '<span class="tag bad">Missed</span>' : '<span class="tag on">On shift</span>'}${mBadge(A().fieldEdited(s, 'clockOut'), 'Changed by hand — view history', '#/admin/shift/' + s.id)}</td>
            <td class="nowrap">${s.clockOut ? fmtDur(hours(s.clockIn, s.clockOut)) : '—'}</td><td class="nowrap">${crewCell(s)}</td><td class="notes">${esc(s.notes)}${s.outNote ? `<span class="outnote-cell" title="Clock-out note — written by the employee, read-only">🗒 ${esc(s.outNote)}</span>` : ''}</td>
            <td class="nowrap"><a class="btn small" href="#/admin/edit/${s.id}">Edit</a> <a class="btn small ghost" href="#/admin/shift/${s.id}">History${s.edits.length ? ' (' + s.edits.length + ')' : ''}</a></td></tr>`;
        }).join('') || '<tr><td colspan="9" class="muted">No shifts match.</td></tr>'}</tbody></table></div>
      ${rows.length > 60 ? `<p class="muted small">Showing first 60 of ${rows.length}. (Prototype — paging omitted.)</p>` : ''}`);
  }
  function bindShifts(root) {
    root.querySelectorAll('[data-range]').forEach((b) => b.addEventListener('click', () => { state.range = b.dataset.range; CJ.render(); }));
    root.querySelector('#fSite').addEventListener('change', (e) => { state.site = e.target.value; CJ.render(); });
    root.querySelector('#fEd').addEventListener('change', (e) => { state.editedOnly = e.target.checked; CJ.render(); });
    root.querySelector('#fOpen').addEventListener('change', (e) => { state.openOnly = e.target.checked; CJ.render(); });
    const q = root.querySelector('#fQ'); q.addEventListener('change', () => { state.q = q.value; CJ.render(); });
    root.querySelector('#exportBtn').addEventListener('click', exportCsv);
  }
  function exportCsv() {
    const cell = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const head = ['Date', 'Employee', 'Phone', 'Site #', 'Client / farm', 'Old code', 'Clock in', 'In edited (M)', 'Original clock in', 'Clock out', 'Out edited (M)', 'Original clock out', 'Hours', 'Crew reported', 'Crew edited (M)', 'Workers clocked in (site/day)', 'Crew mismatch', 'Notes', 'Clock-out note', 'Edit count', 'Last edited by'];
    const lines = [head.map(cell).join(',')];
    filtered().forEach((s) => {
      const st = A().site(s.siteId); const u = A().user(s.userId); const ie = A().fieldEdited(s, 'clockIn'); const oe = A().fieldEdited(s, 'clockOut'); const le = s.edits[s.edits.length - 1];
      lines.push([fmtDate(s.clockIn), u.name, u.phone, st.number, st.clientName, st.legacyCode, fmtTime(s.clockIn) + (ie ? ' M' : ''), ie ? 'M' : '', ie ? fmtDT(s.recordedIn) : '', s.clockOut ? fmtTime(s.clockOut) + (oe ? ' M' : '') : '', oe ? 'M' : '', oe ? fmtDT(s.recordedOut) : '', s.clockOut ? hours(s.clockIn, s.clockOut).toFixed(2) : '', s.crewCount == null ? '' : s.crewCount, A().fieldEdited(s, 'crewCount') ? 'M' : '', crewOf(s).clockedIn, crewOf(s).label, s.notes, s.outNote || '', s.edits.length, le ? uname(le.byUserId) + ' ' + fmtDT(le.at) : ''].map(cell).join(','));
    });
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' })); a.download = 'shifts-export.csv'; a.click();
    CJ.toast('CSV exported (' + (lines.length - 1) + ' rows)', 'good');
  }

  // ---------- Shift detail / audit history ----------
  function historyPage(id) {
    const s = A().shift(id); if (!s) return shell('shifts', '<p>Shift not found.</p>');
    const st = A().site(s.siteId); const u = A().user(s.userId);
    const ie = A().fieldEdited(s, 'clockIn'), oe = A().fieldEdited(s, 'clockOut');
    const timeline = [{ at: s.recordedIn, html: `<b>${esc(u.name)}</b> clocked in with the app at <b>${fmtTime(s.recordedIn)}</b> at ${esc(siteText(st))}${s.notes ? ` — note: “${esc(s.notes)}”` : ''}`, kind: 'sys' }];
    if (s.recordedOut) timeline.push({ at: s.recordedOut, html: `<b>${esc(u.name)}</b> clocked out with the app at <b>${fmtTime(s.recordedOut)}</b>${s.recordedCrew != null ? ` and reported <b>${s.recordedCrew}</b> worker${s.recordedCrew === 1 ? '' : 's'} on site` : ''}${s.outNote ? ` — clock-out note: “${esc(s.outNote)}”` : ''}${new Date(s.recordedOut).toDateString() !== new Date(s.recordedIn).toDateString() ? ' (' + fmtDate(s.recordedOut) + ')' : ''}`, kind: 'sys' });
    s.edits.forEach((e) => timeline.push({ at: e.at, kind: 'edit', html: `<b>${esc(uname(e.byUserId))}</b> <span class="role ${e.byRole}">${e.byRole === 'admin' ? 'admin' : 'employee'}</span> changed <b>${FL[e.field]}</b> from <s>${fv(e, e.from, true)}</s> to <b>${fv(e, e.to, true)}</b> <span class="mbadge sm">M</span><div class="feed-r">Reason: “${esc(e.reason)}”</div>` }));
    timeline.sort((a, b) => new Date(a.at) - new Date(b.at));
    return shell('shifts', `
      <a class="back" href="#/admin/shifts">‹ All shifts</a>
      <div class="page-h"><h1>Shift audit history</h1><a class="btn primary" href="#/admin/edit/${s.id}">✎ Edit times</a></div>
      <div class="grid2">
        <section class="panel"><h2>${esc(u.name)} · ${fmtDate(s.clockIn)}</h2>
          <div class="kv wide"><span>Site</span><b>Site ${st.number} — ${esc(st.clientName)}</b><span>Location</span><b>${esc(st.location)}${st.legacyCode ? ` · old code ${esc(st.legacyCode)}` : ''}</b><span>Employee</span><b>${esc(u.name)} · ${esc(u.phone)}</b><span>Clock-in note</span><b>${esc(s.notes) || '—'}</b><span>Clock-out note</span><b>${s.outNote ? `<span class="outnote-box">🗒 “${esc(s.outNote)}”</span> <span class="muted small">written by ${esc(u.name)} at clock-out${s.outNoteAt ? ' · ' + fmtDT(s.outNoteAt) : ''} · read-only</span>` : '—'}</b></div>
          <table class="tbl cmp"><thead><tr><th></th><th>Current (used for pay)</th><th>Originally recorded by app</th></tr></thead><tbody>
            <tr><td>Clock in</td><td><b>${fmtDT(s.clockIn)}</b>${mBadge(ie)}</td><td>${fmtDT(s.recordedIn)}</td></tr>
            <tr><td>Clock out</td><td><b>${fmtDT(s.clockOut)}</b>${mBadge(oe)}</td><td>${s.recordedOut ? fmtDT(s.recordedOut) : '— (not clocked out)'}</td></tr>
            <tr><td>Workers on site</td><td><b>${s.crewCount == null ? '—' : s.crewCount}</b>${mBadge(A().fieldEdited(s, 'crewCount'))} ${crewBadge(crewOf(s))}</td><td>${s.recordedCrew == null ? '—' : s.recordedCrew + ' (reported at clock-out)'}</td></tr>
            <tr><td>Clocked in at site that day</td><td colspan="2">${crewOf(s).clockedIn} worker${crewOf(s).clockedIn === 1 ? '' : 's'} used the app at Site ${st.number} on ${fmtDate(s.clockIn)}</td></tr>
            <tr><td>Hours</td><td><b>${s.clockOut ? fmtDur(hours(s.clockIn, s.clockOut)) : '—'}</b></td><td>${s.recordedOut ? fmtDur(hours(s.recordedIn, s.recordedOut)) : '—'}</td></tr>
          </tbody></table>
          ${locPanel(s, st)}
          ${A().isLockedShift(s) ? '<div class="info">🔒 This farm-week is <b>Billing locked</b>. Edits need an owner override and are recorded in the audit log.</div>' : ''}
        </section>
        <section class="panel"><h2>Timeline <span class="muted small">(${s.edits.length} manual edit${s.edits.length === 1 ? '' : 's'})</span></h2>
          <ol class="timeline">${timeline.map((t) => `<li class="${t.kind}"><div class="tl-t">${fmtDT(t.at)}</div><div>${t.html}</div></li>`).join('')}</ol>
          <p class="muted small">Audit entries can't be deleted or changed. Original app times are always kept.</p>
        </section>
      </div>`);
  }

  function locPanel(s, st) {
    const l = s.location; if (!l) return '';
    const status = l.status === 'ok' ? '<span class="tag on">On site</span>' : l.status === 'none' ? '<span class="tag warn">No location shared</span>' : '<span class="tag bad">Off-site</span>';
    return `<div class="locpanel"><h3>📍 Location check at clock-in <span class="muted small">(one-time check, simulated in prototype)</span></h3>
      <div class="kv wide"><span>Result</span><b>${status} ${l.distanceM != null ? CJ.F.fmtDist(l.distanceM) + ' from site' : ''}</b><span>Site geofence</span><b>${st.lat.toFixed(4)}, ${st.lng.toFixed(4)} · radius ${st.radiusM} m</b>
      ${l.reviewed ? `<span>Reviewed</span><b>✓ ${esc(uname(l.reviewed.by))} · ${fmtDT(l.reviewed.at)}${l.reviewed.note ? ' — “' + esc(l.reviewed.note) + '”' : ''}</b>` : ''}</div>
      ${l.status !== 'ok' && !l.reviewed ? `<form id="locRev" class="inline-form"><input name="note" placeholder="Review note (e.g. confirmed with crew lead)"><button class="btn primary small">✓ Mark reviewed</button></form>` : ''}</div>`;
  }

  // ---------- Admin edit ----------
  function editPage(id) {
    const s = A().shift(id); if (!s) return shell('shifts', '<p>Shift not found.</p>');
    const st = A().site(s.siteId); const u = A().user(s.userId);
    return shell('shifts', `<a class="back" href="#/admin/shift/${s.id}">‹ Shift history</a>
      <h1>Edit shift times</h1>
      <section class="panel narrow">
        <div class="kv wide"><span>Employee</span><b>${esc(u.name)}</b><span>Site</span><b>Site ${st.number} — ${esc(st.clientName)}</b><span>Date</span><b>${fmtDate(s.clockIn)}</b></div>
        <form id="aEdit" class="stack">
          <label class="field"><span>Clock-in ${mBadge(A().fieldEdited(s, 'clockIn'))} <em>app recorded ${fmtDT(s.recordedIn)}</em></span><input type="datetime-local" name="clockIn" value="${toLocalInput(s.clockIn)}"></label>
          <label class="field"><span>Clock-out ${mBadge(A().fieldEdited(s, 'clockOut'))} <em>app recorded ${s.recordedOut ? fmtDT(s.recordedOut) : '—'}</em></span><input type="datetime-local" name="clockOut" value="${toLocalInput(s.clockOut)}"></label>
          <label class="field"><span>Workers on site ${mBadge(A().fieldEdited(s, 'crewCount'))} <em>reported at clock-out: ${s.recordedCrew == null ? '—' : s.recordedCrew} · clocked in that day: ${crewOf(s).clockedIn}</em></span><input type="number" name="crewCount" min="1" max="50" step="1" inputmode="numeric" value="${s.crewCount == null ? '' : s.crewCount}"></label>
          ${crewOf(s).mismatch ? `<div>${crewBadge(crewOf(s))}</div>` : ''}
          <label class="field"><span>Reason (saved in audit log) <span class="req">*</span></span><input name="reason" placeholder="e.g. confirmed with supervisor"></label>
          ${A().isLockedShift(s) ? `<div class="lockbox">🔒 <b>Billing locked.</b> This farm-week's timesheet is locked for billing${A().invoiceFor(s.siteId, CJ.tz.weekStart(CJ.tz.dayKey(s.clockIn))) ? ' and has an invoice' : ''}.<label class="chk"><input type="checkbox" name="override"> Owner override — I'm the owner and this change is needed. Record it in the audit log.</label></div>` : ''}
          <div class="info">Saved changes are marked <span class="mbadge sm">M</span> in every view and export. The original times stay in the audit history.</div>
          <div class="err" id="aErr"></div>
          <div class="row-end"><a class="btn ghost" href="#/admin/shift/${s.id}">Cancel</a><button class="btn primary">Save changes</button></div>
        </form></section>`);
  }
  function bindEdit(root, id, uid) {
    const f = root.querySelector('#aEdit'); if (!f) return;
    f.addEventListener('submit', (e) => {
      e.preventDefault(); const d = new FormData(f);
      const r = A().edit(id, { clockIn: CJ.tz.fromInput(d.get('clockIn')), clockOut: CJ.tz.fromInput(d.get('clockOut')) || null, crewCount: d.get('crewCount') || undefined, reason: d.get('reason'), override: !!d.get('override') }, uid);
      if (r.error) { root.querySelector('#aErr').textContent = r.error; return; }
      CJ.toast('Saved — marked M', 'good'); CJ.go('#/admin/shift/' + id);
    });
  }

  // ---------- Approvals ----------
  function approvalsPage() {
    const tab = CJ.query().get('tab') || state.tab; const pend = A().pending(); const done = A().processed();
    return shell('approvals', `
      <div class="page-h"><h1>Sign-up approvals</h1></div>
      <p class="muted">New employee accounts stay <b>Pending</b> and can't clock in until you approve them.</p>
      <div class="tabs"><button class="tab ${tab === 'pending' ? 'on' : ''}" data-tab="pending">Pending <span class="count">${pend.length}</span></button><button class="tab ${tab === 'processed' ? 'on' : ''}" data-tab="processed">Processed</button></div>
      ${tab === 'pending' ? `<div class="cards">${pend.map((u) => `
        <div class="req-card"><div class="req-h"><div class="av">${esc(CJ.initials(u.name))}</div><div><b>${esc(u.name)}</b><div class="muted">📞 ${esc(u.phone)}</div></div><span class="tag warn">PENDING</span></div>
          <div class="kv"><span>Signed up</span><b>${fmtDT(u.createdAt)} <span class="muted">(${ago(u.createdAt)})</span></b><span>Role</span><b>Worker</b><span>Phone check</span><b class="muted">Not verified (SMS check proposed)</b></div>
          <div class="row-2"><button class="btn approve" data-approve="${u.id}">✓ Approve</button><button class="btn reject" data-reject="${u.id}">✕ Reject</button></div></div>`).join('') || '<div class="panel muted center">No pending sign-ups 🎉</div>'}</div>`
      : `<div class="panel nopad"><table class="tbl"><thead><tr><th>Employee</th><th>Phone</th><th>Signed up</th><th>Decision</th><th>By</th><th>When</th><th>Note</th></tr></thead><tbody>
        ${done.map((u) => `<tr><td>${esc(u.name)}</td><td>${esc(u.phone)}</td><td>${fmtDT(u.createdAt)}</td><td><span class="tag ${u.status === 'active' ? 'on' : 'bad'}">${u.status === 'active' ? 'APPROVED' : 'REJECTED'}</span></td><td>${esc(uname(u.decidedBy))}</td><td>${fmtDT(u.decidedAt)}</td><td>${esc(u.decisionNote || '')}</td></tr>`).join('')}</tbody></table></div>`}`);
  }
  function bindApprovals(root, uid) {
    root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { state.tab = b.dataset.tab; history.replaceState(null, '', location.pathname + '#/admin/approvals'); CJ.render(); }));
    root.querySelectorAll('[data-approve]').forEach((b) => b.addEventListener('click', () => { const u = A().user(b.dataset.approve); CJ.modal(`<h2>Approve ${esc(u.name)}?</h2><p>They'll be able to log in and clock in right away.</p><div class="row-end"><button class="btn ghost" data-close>Cancel</button><button class="btn approve" id="ok">Approve</button></div>`, (w, close) => w.querySelector('#ok').addEventListener('click', () => { A().decide(u.id, true, '', uid); close(); CJ.toast(u.name + ' approved', 'good'); CJ.render(); })); }));
    root.querySelectorAll('[data-reject]').forEach((b) => b.addEventListener('click', () => { const u = A().user(b.dataset.reject); CJ.modal(`<h2>Reject ${esc(u.name)}?</h2><p>They won't be able to clock in.</p><label class="field"><span>Note (optional, internal)</span><input id="note"></label><div class="row-end"><button class="btn ghost" data-close>Cancel</button><button class="btn reject" id="ok">Reject</button></div>`, (w, close) => w.querySelector('#ok').addEventListener('click', () => { A().decide(u.id, false, w.querySelector('#note').value, uid); close(); CJ.toast(u.name + ' rejected'); CJ.render(); })); }));
  }

  // ---------- Employees ----------
  function employeesPage() {
    const wk = CJ.startOfWeek(); const all = A().shifts();
    const rows = A().users().filter((u) => u.role === 'worker');
    return shell('employees', `<div class="page-h"><h1>Employees</h1><span class="muted">${rows.length} accounts</span></div>
      <div class="panel nopad"><table class="tbl"><thead><tr><th>Employee</th><th>Phone</th><th>Account</th><th>Now</th><th>Hours this week</th><th>Edits (14 days)</th></tr></thead><tbody>
      ${rows.map((u) => { const mine = all.filter((s) => s.userId === u.id); const open = mine.find((s) => !s.clockOut); const wh = mine.filter((s) => new Date(s.clockIn) >= wk).reduce((a, s) => a + hours(s.clockIn, s.clockOut), 0); const ne = mine.reduce((a, s) => a + s.edits.length, 0);
        return `<tr><td><b>${esc(u.name)}</b>${u.crewLead ? ' <span class="tag lead">Crew lead</span>' : ''}</td><td>${esc(u.phone)}</td><td><span class="tag ${u.status === 'active' ? 'on' : u.status === 'pending' ? 'warn' : 'bad'}">${u.status === 'active' ? 'Approved' : u.status === 'pending' ? 'Pending' : 'Rejected'}</span></td>
          <td>${open ? (isMissed(open) ? '<span class="tag bad">Missed clock-out</span> ' : '<span class="tag on">On shift</span> ') + `Site ${A().site(open.siteId).number} · ${esc(A().site(open.siteId).clientName)} since ${fmtTime(open.clockIn)}` : '<span class="muted">Off shift</span>'}</td>
          <td>${wh ? fmtDur(wh) : '—'}</td><td>${ne ? ne + ' <span class="mbadge sm">M</span>' : '—'}</td></tr>`; }).join('')}</tbody></table></div>`);
  }

  // ---------- Sites ----------
  function sitesPage() {
    const wk = CJ.startOfWeek(); const all = A().shifts();
    return shell('sites', `<div class="page-h"><h1>Sites &amp; rates</h1><span class="muted">Employees only ever see the site number.</span></div>
      <div class="info"><b>SAMPLE rates:</b> the hourly rates below are made-up placeholders for the prototype — the owner must enter the real contract rate per farm. Geofence radius is used only for the one-time clock-in location check. Changing a rate affects new draft invoices only.</div>
      <section class="panel"><h2>Add site</h2><form id="addSite" class="inline-form"><input name="name" placeholder="Client / farm name" required><select name="type"><option>Farm</option><option>Office</option><option>Warehouse</option><option>Healthcare</option><option>Restaurant</option><option>Retail Store</option><option>Other</option></select><input name="loc" placeholder="Town, PEI"><button class="btn primary">Add — gets next number</button></form></section>
      <div class="panel nopad"><table class="tbl"><thead><tr><th>Site #</th><th>Client / farm (admin only)</th><th>Type</th><th>Location</th><th>Old code</th><th>Geofence (lat, lng · radius)</th><th>Hourly rate</th><th>Invoice prefix</th><th>Hours this week</th><th>On now</th></tr></thead><tbody>
      ${A().sites().map((s) => { const sh = all.filter((x) => x.siteId === s.id); const wh = sh.filter((x) => new Date(x.clockIn) >= wk).reduce((a, x) => a + hours(x.clockIn, x.clockOut), 0); const on = sh.filter((x) => !x.clockOut && !isMissed(x)).length;
        return `<tr><td><b>Site ${s.number}</b></td><td>${esc(s.clientName)}</td><td>${esc(s.type)}</td><td>${esc(s.location)}</td><td class="muted">${esc(s.legacyCode || '—')}</td><td class="nowrap small">${s.lat.toFixed(4)}, ${s.lng.toFixed(4)} · <input class="mini" type="number" data-radius="${s.id}" value="${s.radiusM}" min="25" max="5000" step="25"> m</td><td class="nowrap">$<input class="mini" type="number" data-rate="${s.id}" value="${s.rate.toFixed(2)}" step="0.25" min="1">/h ${s.rateSample ? '<span class="tag sample">SAMPLE</span>' : ''}</td><td><code>${esc(s.invoicePrefix)}</code></td><td>${wh ? fmtDur(wh) : '—'}</td><td>${on || ''}</td></tr>`; }).join('')}</tbody></table></div>`);
  }
  function bindSites(root) {
    root.querySelectorAll('[data-rate]').forEach((i) => i.addEventListener('change', () => { const r = A().setRate(i.dataset.rate, i.value); r.error ? CJ.toast(r.error, 'bad') : (CJ.toast('Rate saved', 'good'), CJ.render()); }));
    root.querySelectorAll('[data-radius]').forEach((i) => i.addEventListener('change', () => { const r = A().setRadius(i.dataset.radius, i.value); r.error ? CJ.toast(r.error, 'bad') : CJ.toast('Radius saved', 'good'); }));
    const f = root.querySelector('#addSite'); f && f.addEventListener('submit', (e) => { e.preventDefault(); const d = new FormData(f); const r = A().addSite(d.get('name'), d.get('type'), d.get('loc')); CJ.toast('Added as Site ' + r.number, 'good'); CJ.render(); });
  }

  // ---------- Edit log ----------
  function editsPage() {
    const ed = A().allEdits();
    return shell('edits', `<div class="page-h"><h1>Manual edit log</h1><span class="muted">${ed.length} edits · newest first</span></div>
      <div class="panel nopad"><table class="tbl"><thead><tr><th>When edited</th><th>Edited by</th><th>Employee</th><th>Shift</th><th>Field</th><th>Original → New</th><th>Reason</th><th></th></tr></thead><tbody>
      ${ed.map((e) => { const s = e.shift; const st = A().site(s.siteId); return `<tr><td class="nowrap">${fmtDT(e.at)}</td><td>${esc(uname(e.byUserId))} <span class="role ${e.byRole}">${e.byRole === 'admin' ? 'admin' : 'employee'}</span></td><td>${esc(uname(s.userId))}</td><td>${fmtDate(s.clockIn)}<br>${siteCell(st)}</td><td>${FLc[e.field]}</td><td class="nowrap"><s>${fv(e, e.from)}</s> → <b>${fv(e, e.to)}</b> <span class="mbadge sm">M</span></td><td>${esc(e.reason)}</td><td><a class="btn small ghost" href="#/admin/shift/${s.id}">History</a></td></tr>`; }).join('')}</tbody></table></div>`);
  }

  CJ.adm = { shell, siteCell, siteText, uname, locBadge, crewBadge, isMissed };
  CJ.adminView = function (app, parts, uid) {
    const [p, id] = parts;
    if (p === 'shifts') { app.innerHTML = shiftsPage(); bindShifts(app); }
    else if (p === 'shift') { app.innerHTML = historyPage(id); const f = app.querySelector('#locRev'); f && f.addEventListener('submit', (e) => { e.preventDefault(); A().reviewLocation(id, uid, new FormData(f).get('note')); CJ.toast('Location reviewed ✓', 'good'); CJ.render(); }); }
    else if (CJ.admOps && CJ.admOps.handles(p)) { CJ.admOps.view(app, p, id, parts, uid); }
    else if (p === 'edit') { app.innerHTML = editPage(id); bindEdit(app, id, uid); }
    else if (p === 'approvals') { app.innerHTML = approvalsPage(); bindApprovals(app, uid); }
    else if (p === 'employees') { app.innerHTML = employeesPage(); }
    else if (p === 'sites') { app.innerHTML = sitesPage(); bindSites(app); }
    else if (p === 'edits') { app.innerHTML = editsPage(); }
    else if (p === 'timesheets') { app.innerHTML = shell('timesheets', CJ.ts.page()); CJ.ts.bindPage(app); }
    else if (p === 'timesheet') { const which = (parts[2] || 'all').split('?')[0]; app.innerHTML = CJ.ts.printView(id, which); CJ.ts.bindPrint(app, id, which); }
    else { app.innerHTML = dashboard(); }
  };
})();
