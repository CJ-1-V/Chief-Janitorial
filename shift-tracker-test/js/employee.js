/* EMPLOYEE screens (mobile-first).
 * PRIVACY RULE: this file may only use CJ.api.emp.* which exposes site NUMBERS only.
 * Pay view (owner confirmed Oct 3 9:14 AM): Worked / Unpaid break / Paid only — never billable hours, bill adjustments, the 5 h billing minimum, money or farm names.
 * Never reference CJ.api.admin or any client/farm field here. */
(function () {
  const CJ = (window.CJ = window.CJ || {});
  const E = () => CJ.api.emp;
  const { esc, fmtTime, fmtDate, fmtDateLong, fmtDur, hours, mBadge, toLocalInput } = CJ;
  const siteLabel = (n) => (n == null ? 'Site ?' : 'Site ' + n);

  function shell(uid, active, body) {
    const me = E().me(uid);
    return `<div class="emp">
      <header class="topbar"><a href="#/emp/clock">${CJ.logo()}</a><div class="topbar-r">${CJ.themeBtn()}<a class="avatar" href="#/emp/profile" title="${esc(me.name)}">${esc(CJ.initials(me.name))}</a></div></header>
      <main class="emp-main">${reminders(uid)}${body}</main>
      <nav class="tabbar">
        <a href="#/emp/clock" class="${active === 'clock' ? 'on' : ''}"><span class="ti">⏱</span>Clock</a>
        <a href="#/emp/schedule" class="${active === 'schedule' ? 'on' : ''}"><span class="ti">📅</span>Schedule</a>
        <a href="#/emp/shifts" class="${active === 'shifts' ? 'on' : ''}"><span class="ti">☰</span>My shifts</a>
        ${E().isCrewLead(uid) ? `<a href="#/emp/crew" class="${active === 'crew' ? 'on' : ''}"><span class="ti">✔</span>Crew</a>` : ''}
        <a href="#/emp/profile" class="${active === 'profile' ? 'on' : ''}"><span class="ti">◉</span>Profile</a>
      </nav></div>`;
  }

  // ---------- Pending / rejected ----------
  function pendingView(uid) {
    const me = E().me(uid);
    const rejected = me.status === 'rejected';
    return `<div class="emp"><header class="topbar">${CJ.logo()}<div class="topbar-r">${CJ.themeBtn()}</div></header>
      <main class="emp-main"><div class="card pending-card">
        <div class="pending-icon">${rejected ? '✕' : '⏳'}</div>
        <h1>${rejected ? 'Account not approved' : 'Waiting for approval'}</h1>
        <p class="lead">Hi ${esc(me.name)}, ${rejected ? 'the Chief Janitorial office did not approve this account.' : 'your account was created and is waiting for the Chief Janitorial office to approve it.'}</p>
        ${rejected ? '<p class="muted">If you think this is a mistake, please talk to your supervisor.</p>' : `
        <ol class="steps">
          <li class="done"><b>Account created</b><span>${fmtDate(me.createdAt)}, ${fmtTime(me.createdAt)}</span></li>
          <li class="now"><b>Office approval</b><span>The office will review your account</span></li>
          <li><b>Clock in to your shifts</b><span>Available once approved</span></li>
        </ol>
        <div class="notice">You can't clock in yet. We'll unlock clock-in as soon as you're approved.</div>`}
        <div class="kv"><span>Name</span><b>${esc(me.name)}</b><span>Phone</span><b>${esc(me.phone)}</b></div>
        ${rejected ? '' : '<button class="btn primary big" data-act="recheck">Check again</button>'}
        <button class="btn ghost big" data-act="logout">Log out</button>
      </div></main></div>`;
  }

  // ---------- Crew count (required before clock-out) ----------
  const validCrew = (v) => /^\d+$/.test(String(v || '').trim()) && +v >= 1 && +v <= 50;
  function crewPicker(siteNumber, value) {
    return `<div class="crew-box">
      <div class="crew-q">How many workers were at ${siteLabel(siteNumber)} this shift? <span class="req">*</span></div>
      <div class="muted small">Count everyone working there with you, including yourself (1–50).</div>
      <div class="stepper"><button type="button" class="step" data-step="-1" aria-label="One less">−</button><input id="crew" name="crewCount" type="number" inputmode="numeric" min="1" max="50" step="1" placeholder="?" value="${esc(value)}" aria-label="Workers on site"><button type="button" class="step" data-step="1" aria-label="One more">+</button></div>
    </div>`;
  }
  function bindCrew(root, onChange) {
    const inp = root.querySelector('#crew'); if (!inp) return;
    const fire = () => onChange && onChange(validCrew(inp.value) ? +inp.value : null);
    root.querySelectorAll('.step').forEach((b) => b.addEventListener('click', () => { const cur = parseInt(inp.value, 10); const n = isNaN(cur) ? 1 : Math.min(50, Math.max(1, cur + +b.dataset.step)); inp.value = n; fire(); }));
    inp.addEventListener('input', fire); fire();
  }

  // ---------- In-app reminders (nothing is texted or emailed) ----------
  function reminders(uid) {
    return E().notifications(uid).map((n) => `<div class="reminder" data-nid="${n.id}"><span class="ri">🔔</span><div>${esc(n.text)}<div class="muted small">Reminder from the office app · ${fmtDate(n.at)}, ${fmtTime(n.at)}</div></div><button class="x" data-dismiss="${n.id}" aria-label="Dismiss">✕</button></div>`).join('');
  }
  function bindReminders(root, uid) { root.querySelectorAll('[data-dismiss]').forEach((b) => b.addEventListener('click', () => { E().dismiss(uid, b.dataset.dismiss); b.closest('.reminder').remove(); })); }

  // ---------- Location check (clock-in only; simulated in the prototype) ----------
  const LOC_MODES = [['onsite', 'At the site'], ['near', 'Nearby'], ['far', 'Far away'], ['off', 'Location off']];
  const PRIVACY = '📍 <b>Privacy:</b> your phone location is checked <b>once, when you tap Clock in</b>, to confirm you are at the site. It is not tracked during your shift or after you clock out.';
  function locMsg(siteNumber, p) {
    if (!p) return '';
    if (p.status === 'ok') return `<div class="loc ok">✓ You're at ${siteLabel(siteNumber)}.</div>`;
    if (p.status === 'none') return `<div class="loc warn">⚠ Location is off or not available. You can still clock in — the office will check it.</div>`;
    const d = p.distanceM >= 1000 ? (p.distanceM / 1000).toFixed(1) + ' km' : p.distanceM + ' m';
    return `<div class="loc warn">⚠ You seem to be about <b>${d}</b> from ${siteLabel(siteNumber)}. You can still clock in — the office will review it.</div>`;
  }

  // ---------- Optional safety / incident note at clock-out ----------
  const INC = ['Injury', 'Near miss', 'Chemical', 'Other'];
  function incidentPanel(demo) {
    const t = demo ? 'Chemical' : ''; const txt = demo ? 'Splash of degreaser on my arm while refilling the sprayer. Rinsed at the eyewash for 15 min.' : '';
    return `<details class="incident" ${demo ? 'open' : ''}><summary>⚠ Report a safety issue <span class="muted">(optional)</span></summary>
      <div class="muted small">Anything happen this shift? This goes to the office only.</div>
      <div class="chips" id="incType">${INC.map((x) => `<button type="button" class="chip ${x === t ? 'on' : ''}" data-type="${x}">${x}</button>`).join('')}</div>
      <label class="field"><span>What happened?</span><textarea id="incText" rows="3" maxlength="500" placeholder="Where, what happened, any first aid">${esc(txt)}</textarea></label>
      <label class="field"><span>Photo (optional)</span><input type="file" id="incPhoto" accept="image/*" capture="environment"></label>
      <div id="incPrev">${demo ? `<img class="inc-photo" alt="photo preview" src="${CJ.samplePhoto('Chemical')}">` : ''}</div>
    </details>`;
  }
  function readIncident(root) {
    const on = root.querySelector('#incType .chip.on'); if (!on) return null;
    const img = root.querySelector('#incPrev img');
    return { type: on.dataset.type, text: root.querySelector('#incText').value.trim(), photo: img ? img.src : null };
  }
  function bindIncident(root) {
    root.querySelectorAll('#incType .chip').forEach((c) => c.addEventListener('click', () => { const was = c.classList.contains('on'); root.querySelectorAll('#incType .chip').forEach((x) => x.classList.remove('on')); if (!was) c.classList.add('on'); }));
    const f = root.querySelector('#incPhoto'); f && f.addEventListener('change', () => { const file = f.files[0]; if (!file) return; const rd = new FileReader(); rd.onload = () => (root.querySelector('#incPrev').innerHTML = `<img class="inc-photo" alt="photo preview" src="${rd.result}">`); rd.readAsDataURL(file); });
  }

  // ---------- Optional clock-out note (one time, 120 chars, read-only after saving) ----------
  function outNoteField(v) {
    const val = String(v).slice(0, 120);
    return `<label class="field outnote"><span>Clock-out note (optional) <em id="onCnt" class="${val.length >= 110 ? 'near' : ''}">${val.length}/120</em></span>
      <textarea id="outNote" maxlength="120" rows="2" placeholder="e.g. finished early, supplies low, gate left open">${esc(val)}</textarea>
      <small class="muted">Saved when you clock out. You can't change it afterwards.</small></label>`;
  }
  function bindOutNote(root) {
    const t = root.querySelector('#outNote'); if (!t) return;
    t.addEventListener('input', () => { if (t.value.length > 120) t.value = t.value.slice(0, 120); const c = root.querySelector('#onCnt'); c.textContent = t.value.length + '/120'; c.classList.toggle('near', t.value.length >= 110); });
  }

  // ---------- Clock in / out ----------
  function clockView(uid) {
    const me = E().me(uid); const open = E().openShift(uid); const now = new Date().toISOString();
    if (open) {
      const longOpen = hours(open.clockIn, now) > 14;
      return shell(uid, 'clock', `
        <h1 class="h1">Hi, ${esc(me.name.split(' ')[0])}</h1>
        <div class="card clock-card on">
          <div class="status-pill on">● On shift</div>
          <div class="site-big">${siteLabel(open.siteNumber)}</div>
          <div class="since">Clocked in at <b>${fmtTime(open.clockIn)}</b>${mBadge(open.inEdited, 'Changed by hand')}</div>
          <div class="elapsed" data-elapsed="${open.clockIn}">${fmtDur(hours(open.clockIn, now))}</div>
          ${longOpen ? '<div class="warn">You have been clocked in for over 14 hours. Did you forget to clock out? Use <b>Edit times</b>.</div>' : ''}
          ${open.notes ? `<div class="note">📝 ${esc(open.notes)}</div>` : ''}
          ${crewPicker(open.siteNumber, CJ.query().get('crew') || '')}
          ${outNoteField(CJ.query().get('outnote') || '')}
          ${incidentPanel(CJ.query().get('incident') === 'demo')}
          <button class="btn danger huge" data-act="clockout" ${validCrew(CJ.query().get('crew')) ? '' : 'disabled'}>${validCrew(CJ.query().get('crew')) ? 'Clock out' : 'Enter workers on site to clock out'}</button>
          <a class="btn ghost" href="#/emp/edit/${open.id}">Wrong start time? Edit times</a>
        </div>`);
    }
    const sites = E().sites(); const recent = E().recentSiteNumbers(uid); const locMode = CJ.query().get('loc') || 'onsite';
    const pre = CJ.query().get('site'); const sel = pre ? (sites.find((s) => String(s.number) === pre) || {}).id : '';
    const tile = (s) => `<button type="button" class="site-tile ${s.id === sel ? 'sel' : ''}" data-site="${s.id}" data-num="${s.number}">${siteLabel(s.number)}</button>`;
    return shell(uid, 'clock', `
      <h1 class="h1">Hi, ${esc(me.name.split(' ')[0])}</h1>
      <div class="card clock-card">
        <div class="row-between"><div class="status-pill">○ Off shift</div><div class="muted">${fmtDate(now)}</div></div>
        <div class="bigclock" data-live-clock>${fmtTime(now)}</div>
        <div class="label">Which site are you at? <span class="req">*</span></div>
        ${recent.length ? `<div class="sub">Your recent sites</div><div class="tiles recent">${recent.map((n) => tile(sites.find((s) => s.number === n))).join('')}</div>` : ''}
        <input class="site-search" id="siteSearch" inputmode="numeric" placeholder="Type a site number…">
        <div class="tiles all" id="allTiles">${sites.map(tile).join('')}</div>
        <div class="muted small">Site number not listed? Ask your supervisor — don't guess.</div>
        <div class="label">Location check</div>
        <div class="loc-sim"><span class="muted small">Prototype only — simulate where your phone is:</span><div class="chips" id="locSim">${LOC_MODES.map(([k, l]) => `<button type="button" class="chip ${k === locMode ? 'on' : ''}" data-loc="${k}">${l}</button>`).join('')}</div></div>
        <div id="locMsg">${sel ? locMsg(sites.find((s) => s.id === sel).number, E().locPreview(sel, locMode)) : ''}</div>
        <div class="privacy small">${PRIVACY}</div>
        <label class="field"><span>Notes (optional) <em id="cnt">0/120</em></span><textarea id="notes" maxlength="120" rows="2" placeholder="e.g. ride partner"></textarea></label>
        <div class="sticky-cta"><button class="btn primary huge" id="clockinBtn" ${sel ? '' : 'disabled'}>${sel ? 'Clock in at ' + siteLabel(sites.find((s) => s.id === sel).number) : 'Pick a site to clock in'}</button></div>
      </div>`);
  }
  function bindClock(root, uid) {
    let sel = (root.querySelector('.site-tile.sel') || {}).dataset ? root.querySelector('.site-tile.sel').dataset.site : '';
    const btn = root.querySelector('#clockinBtn'); bindReminders(root, uid); bindIncident(root); bindOutNote(root);
    let loc = (root.querySelector('#locSim .chip.on') || { dataset: {} }).dataset.loc || 'onsite';
    const num = () => (root.querySelector('.site-tile.sel') || { dataset: {} }).dataset.num;
    const showLoc = () => { const m = root.querySelector('#locMsg'); if (m) m.innerHTML = sel ? locMsg(num(), E().locPreview(sel, loc)) : ''; };
    root.querySelectorAll('#locSim .chip').forEach((c) => c.addEventListener('click', () => { loc = c.dataset.loc; root.querySelectorAll('#locSim .chip').forEach((x) => x.classList.toggle('on', x === c)); showLoc(); }));
    root.querySelectorAll('.site-tile').forEach((t) => t.addEventListener('click', () => {
      sel = t.dataset.site; root.querySelectorAll('.site-tile').forEach((x) => x.classList.toggle('sel', x.dataset.site === sel));
      btn.disabled = false; btn.textContent = 'Clock in at ' + siteLabel(t.dataset.num); showLoc();
    }));
    const ss = root.querySelector('#siteSearch');
    ss && ss.addEventListener('input', () => { const q = ss.value.replace(/\D/g, ''); root.querySelectorAll('#allTiles .site-tile').forEach((t) => (t.style.display = !q || t.dataset.num.startsWith(q) ? '' : 'none')); });
    const notes = root.querySelector('#notes'); notes && notes.addEventListener('input', () => (root.querySelector('#cnt').textContent = notes.value.length + '/120'));
    btn && btn.addEventListener('click', () => { const r = E().clockIn(uid, sel, notes.value, loc); if (r.error) return CJ.toast(r.error, 'bad'); CJ.toast(r.loc && r.loc.status !== 'ok' ? 'Clocked in ✓ — location sent to the office for review' : 'Clocked in ✓', 'good'); CJ.render(); });
    const co = root.querySelector('[data-act="clockout"]'); let crew = null;
    bindCrew(root, (n) => { crew = n; if (co) { co.disabled = !n; co.textContent = n ? 'Clock out' : 'Enter workers on site to clock out'; } });
    co && co.addEventListener('click', () => { if (!crew) return CJ.toast('Enter how many workers were on site', 'bad'); CJ.modal(`<h2>Clock out now?</h2><p>Your shift will end at ${fmtTime(new Date().toISOString())}.<br>Workers on site: <b>${crew}</b>${(root.querySelector('#outNote') || {}).value ? '<br>Note: “' + esc(root.querySelector('#outNote').value.trim()) + '” <span class=\'muted small\'>(can\'t be changed later)</span>' : ''}${readIncident(root) ? '<br>Safety report: <b>' + esc(readIncident(root).type) + '</b>' : ''}</p><div class="row-end"><button class="btn ghost" data-close>Cancel</button><button class="btn danger" id="yes">Clock out</button></div>`, (w, close) => w.querySelector('#yes').addEventListener('click', () => { const r = E().clockOut(uid, crew, readIncident(root), (root.querySelector('#outNote') || {}).value || ''); close(); if (r.error) return CJ.toast(r.error, 'bad'); CJ.toast('Clocked out ✓', 'good'); CJ.render(); })); });
  }

  // ---------- My shifts ----------
  function editedLine(s) {
    const parts = [];
    [['inEdit', 'start'], ['outEdit', 'finish']].forEach(([k, label]) => { if (s[k]) parts.push(`${label} changed by ${s[k].byMe ? 'you' : 'the office'} on ${fmtDate(s[k].at)}`); });
    return parts.length ? `<div class="edited-line"><span class="mbadge sm">M</span> ${esc(parts.join(' · '))}</div>` : '';
  }
  function shiftsView(uid) {
    const all = E().shifts(uid); const now = new Date().toISOString(); const ws = E().weekSummary(uid);
    // Pay view per day per site (owner confirmed Oct 3 9:14 AM): Worked, Unpaid break, Paid. Nothing farm-side is shown.
    const days = E().payDays(uid); const dayOf = {}; days.forEach((d) => d.shiftIds.forEach((id) => (dayOf[id] = d)));
    const brk = (h) => (h > 0 ? '−' + fmtDur(h) : 'none');
    const payline = (d) => `<div class="payline"><div><small>Worked</small><b>${fmtDur(d.worked)}</b></div><div><small>Unpaid break</small><b class="brk">${brk(d.unpaidBreak)}</b></div><div><small>Paid</small><b class="pd">${fmtDur(d.paid)}</b></div></div>`;
    const punch = (s) => {
      const open = !s.clockOut; const missed = open && hours(s.clockIn, now) > 14;
      return `<div class="punch">
        <div class="times"><div><span class="tl">In</span><b>${fmtTime(s.clockIn)}</b>${mBadge(s.inEdited)}</div><span class="arrow">→</span><div><span class="tl">Out</span><b>${open ? '—' : fmtTime(s.clockOut)}</b>${mBadge(s.outEdited)}</div>
          ${E().canEdit(uid, s.id) ? `<a class="btn small edit" href="#/emp/edit/${s.id}">✎ Edit</a>` : ''}</div>
        ${editedLine(s)}
        ${missed ? '<div class="warn sm">Forgot to clock out? Tap Edit to add your finish time.</div>' : ''}
        ${s.notes ? `<div class="note sm">📝 ${esc(s.notes)}</div>` : ''}
        ${s.outNote ? `<div class="note sm outnote-ro">🗒 Clock-out note: “${esc(s.outNote)}” <span class="lock" title="Saved at clock-out — can't be changed">🔒</span></div>` : ''}
      </div>`;
    };
    const seen = new Set(); const cards = [];
    all.slice(0, 20).forEach((s) => {
      const d = dayOf[s.id];
      if (!d) { const missed = hours(s.clockIn, now) > 14; cards.push(`<div class="shift ${missed ? 'missed' : ''}"><div class="shift-top"><div><div class="shift-date">${fmtDate(s.clockIn)}</div><div class="shift-site">${siteLabel(s.siteNumber)}</div></div>
        <div class="shift-hrs">${missed ? '<span class="tag bad">No clock-out</span>' : '<span class="tag on">On shift</span>'}</div></div>${punch(s)}</div>`); return; }
      const key = d.day + '|' + d.siteNumber; if (seen.has(key)) return; seen.add(key);
      const ps = all.filter((x) => d.shiftIds.includes(x.id)).sort((a, b) => a.clockIn.localeCompare(b.clockIn));
      cards.push(`<div class="shift"><div class="shift-top"><div><div class="shift-date">${fmtDate(ps[0].clockIn)}</div><div class="shift-site">${siteLabel(d.siteNumber)}${ps.length > 1 ? ' <span class="tag">' + ps.length + ' punches · added together</span>' : ''}</div></div></div>
        ${payline(d)}${ps.map(punch).join('')}</div>`);
    });
    const wk = (l, w) => `<div><span>${l} <em>${w.shifts} shift${w.shifts === 1 ? '' : 's'}</em></span><div class="wp3"><div><small>Worked</small><b>${fmtDur(w.worked)}</b></div><div><small>Unpaid break</small><b class="brk">${brk(w.unpaidBreak)}</b></div><div><small>Paid</small><b class="pd">${fmtDur(w.paid)}</b></div></div></div>`;
    return shell(uid, 'shifts', `
      <h1 class="h1">My shifts</h1>
      <div class="summary">${wk('This week', ws.thisWeek)}${wk('Last week', ws.lastWeek)}</div>
      <div class="rule-line">ℹ ${esc(E().breakRule())}</div>
      <div class="legend"><span class="mbadge sm">M</span> = time changed by hand (the original time is kept on record)</div>
      <div class="shift-list">${cards.join('') || '<div class="empty">No shifts yet.</div>'}</div>
      <p class="muted small center">You can fix your own times for shifts in the last ${E().editWindowDays()} days. For older shifts, ask the office.</p>`);
  }

  // ---------- Edit times ----------
  function editView(uid, id) {
    const s = E().shift(uid, id);
    if (!s) return shell(uid, 'shifts', '<div class="card">Shift not found.</div>');
    if (!E().canEdit(uid, id)) return shell(uid, 'shifts', `<div class="card"><h2>Can't edit this shift</h2><p>It's older than ${E().editWindowDays()} days. Please ask the office.</p><a class="btn" href="#/emp/shifts">Back</a></div>`);
    const reasons = ['Forgot to clock in', 'Forgot to clock out', 'Phone / app problem', 'Clocked the wrong time', 'Other'];
    return shell(uid, 'shifts', `
      <a class="back" href="#/emp/shifts">‹ My shifts</a>
      <h1 class="h1">Edit shift times</h1>
      <div class="card">
        <div class="edit-head"><div><div class="muted small">${fmtDateLong(s.clockIn)}</div><div class="site-mid">${siteLabel(s.siteNumber)}</div></div></div>
        <form id="editForm" class="stack">
          <label class="field"><span>Clock-in ${mBadge(s.inEdited)} <em>now ${fmtTime(s.clockIn)}</em></span><input type="datetime-local" name="clockIn" value="${toLocalInput(s.clockIn)}"></label>
          <label class="field"><span>Clock-out ${mBadge(s.outEdited)} <em>${s.clockOut ? 'now ' + fmtTime(s.clockOut) : 'not clocked out'}</em></span><input type="datetime-local" name="clockOut" value="${toLocalInput(s.clockOut)}"></label>
          ${s.crewCount == null ? crewPicker(s.siteNumber, '') : `<div class="kv"><span>Workers on site</span><b>${s.crewCount}</b></div>`}
          <label class="field"><span>Why are you changing it? <span class="req">*</span></span>
            <select name="reasonType">${reasons.map((r, i) => `<option ${i === (s.clockOut ? 0 : 1) ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
          <label class="field"><span>Details (optional)</span><input name="reasonText" maxlength="120" placeholder="e.g. phone was in the car"></label>
          <div class="info">Changed times get an <span class="mbadge sm">M</span> mark. Your original clocked times are kept, and the office can see what changed.</div>
          <div class="err" id="editErr"></div>
          <button class="btn primary big" type="submit">Save changes</button>
          <a class="btn ghost big" href="#/emp/shifts">Cancel</a>
        </form>
      </div>`);
  }
  function bindEdit(root, uid, id) {
    const f = root.querySelector('#editForm'); if (!f) return; bindCrew(root);
    f.addEventListener('submit', (e) => {
      e.preventDefault(); const d = new FormData(f);
      const reason = d.get('reasonType') + (d.get('reasonText') ? ' — ' + d.get('reasonText') : '');
      const r = E().edit(uid, id, { clockIn: CJ.tz.fromInput(d.get('clockIn')), clockOut: CJ.tz.fromInput(d.get('clockOut')) || null, crewCount: d.get('crewCount') || undefined, reason });
      if (r.error) { root.querySelector('#editErr').textContent = r.error; return; }
      CJ.toast('Saved — marked M', 'good'); CJ.go('#/emp/shifts');
    });
  }

  // ---------- Schedule (upcoming, site numbers only) ----------
  function scheduleView(uid) {
    const list = E().schedule(uid); const today = CJ.tz.todayKey(); const by = {};
    list.forEach((x) => (by[x.day] = by[x.day] || []).push(x));
    const dayHead = (d) => (d === today ? 'Today' : d === CJ.tz.addDays(today, 1) ? 'Tomorrow' : '') ;
    return shell(uid, 'schedule', `<h1 class="h1">My schedule</h1>
      <p class="muted small">Your upcoming shifts. Times are Atlantic time. Changes? Talk to your supervisor.</p>
      ${Object.keys(by).map((d) => `<div class="sched-day"><div class="sched-date">${dayHead(d) ? `<b>${dayHead(d)}</b> · ` : ''}${fmtDateLong(by[d][0].startIso)}</div>
        ${by[d].map((x) => `<div class="sched-item"><div class="site-mid">${siteLabel(x.siteNumber)}</div><div class="sched-time">${fmtTime(x.startIso)} – ${fmtTime(x.endIso)}</div></div>`).join('')}</div>`).join('') || '<div class="empty">No upcoming shifts posted yet.</div>'}
      <p class="muted small center">Please clock in when you arrive. If you can't make a shift, tell your supervisor as early as you can.</p>`);
  }

  // ---------- Crew lead daily sign-off (names + worked hours only) ----------
  function crewView(uid) {
    if (!E().isCrewLead(uid)) return shell(uid, 'clock', '<div class="card">Only crew leads can see this page.</div>');
    const days = E().crewDays(uid);
    const card = (d) => `<div class="card crew-day">
      <div class="row-between"><div><div class="muted small">${fmtDateLong(CJ.tz.zoned(d.day, 12, 0).toISOString())}</div><div class="site-mid">${siteLabel(d.siteNumber)}</div></div>
        ${d.signed ? '<span class="tag on">Signed off</span>' : d.locked ? '<span class="tag">Closed</span>' : '<span class="tag warn">Needs sign-off</span>'}</div>
      <table class="crew-tbl"><thead><tr><th>Crew member</th><th class="r">Hours worked</th></tr></thead><tbody>
        ${d.members.map((m) => `<tr><td>${esc(m.name)}</td><td class="r">${m.open ? '<span class="tag bad">Still clocked in</span>' : fmtDur(m.worked)}</td></tr>`).join('')}
        <tr class="tot"><td>${d.members.length} ${d.members.length === 1 ? 'person' : 'people'}</td><td class="r">${fmtDur(d.members.reduce((a, m) => a + m.worked, 0))}</td></tr></tbody></table>
      ${d.signed ? `<div class="muted small">Signed by ${esc(d.signed.byName)} · ${fmtDate(d.signed.at)}, ${fmtTime(d.signed.at)}</div>` : d.locked ? '' : d.anyOpen ? '<div class="warn sm">Someone is still clocked in. Ask them to clock out or fix their time first.</div>' : `<button class="btn primary big" data-sign="${d.key}">Confirm crew &amp; hours</button>`}
    </div>`;
    return shell(uid, 'crew', `<h1 class="h1">Crew sign-off</h1>
      <p class="muted small">You're a crew lead. Each day, check that everyone who worked with you is listed with the right hours, then confirm. If something is wrong, ask that person to fix their time in the app (or tell the office) before you confirm.</p>
      ${days.map(card).join('') || '<div class="empty">No crew days in the last 2 weeks.</div>'}`);
  }
  function bindCrewView(root, uid) {
    root.querySelectorAll('[data-sign]').forEach((b) => b.addEventListener('click', () => CJ.modal(`<h2>Confirm crew & hours?</h2><p>You're confirming the people and hours listed for this day are correct.</p><div class="row-end"><button class="btn ghost" data-close>Cancel</button><button class="btn primary" id="yes">Confirm</button></div>`, (w, close) => w.querySelector('#yes').addEventListener('click', () => { const r = E().signOff(uid, b.dataset.sign); close(); if (r.error) return CJ.toast(r.error, 'bad'); CJ.toast('Signed off ✓', 'good'); CJ.render(); }))));
  }

  // ---------- Profile ----------
  function profileView(uid) {
    const me = E().me(uid);
    return shell(uid, 'profile', `<h1 class="h1">My profile</h1>
      <div class="card"><div class="kv"><span>Name</span><b>${esc(me.name)}</b><span>Phone</span><b>${esc(me.phone)}</b><span>Account</span><b><span class="tag on">Approved</span></b></div>
      <button class="btn ghost" onclick="CJ.toast('Prototype: would open the phone-change request form')">Request phone change</button></div>
      <div class="card"><h2>Change password</h2><div class="stack"><label class="field"><span>Current password</span><input type="password"></label><label class="field"><span>New password</span><input type="password"></label><button class="btn" onclick="CJ.toast('Prototype only — not saved')">Update password</button></div></div>
      <button class="btn ghost big" data-act="logout">Log out</button>`);
  }

  CJ.employeeView = function (app, parts, uid) {
    const me = E().me(uid);
    if (me.status !== 'active') {
      app.innerHTML = pendingView(uid);
      const rc = app.querySelector('[data-act="recheck"]'); rc && rc.addEventListener('click', () => { CJ.api.load(); if (E().me(uid).status === 'active') CJ.go('#/emp/clock'); else CJ.toast('Still waiting for approval'); });
      if (parts[0] !== 'pending') history.replaceState(null, '', location.pathname + location.search + '#/pending');
      return;
    }
    const [a, b, c] = parts;
    if (a === 'emp' && b === 'shifts') { app.innerHTML = shiftsView(uid); bindReminders(app, uid); }
    else if (a === 'emp' && b === 'schedule') { app.innerHTML = scheduleView(uid); bindReminders(app, uid); }
    else if (a === 'emp' && b === 'crew') { app.innerHTML = crewView(uid); bindCrewView(app, uid); bindReminders(app, uid); }
    else if (a === 'emp' && b === 'edit') { app.innerHTML = editView(uid, c); bindEdit(app, uid, c); }
    else if (a === 'emp' && b === 'profile') { app.innerHTML = profileView(uid); }
    else { app.innerHTML = clockView(uid); bindClock(app, uid); }
  };
})();
