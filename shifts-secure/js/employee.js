/* EMPLOYEE screens (phone-first). Shows SITE NUMBERS ONLY and Worked / Break / hrs (no paid/unpaid wording).
 * Never shows rates, money, billable hours, the billing minimum or any client name. */
(function () {
  const ST = window.ST; const { sb, esc, fmtTime, fmtDate, fmtDateLong, fmtDur, hours, mBadge, q, toast, modal, unpaidBreak, errMsg } = ST;
  const C = window.ST_CONFIG; const T = () => ST.tz();
  const siteLabel = (n) => (n == null ? 'Site ?' : /^UNK/.test((cache.codeOf && cache.codeOf[n]) || '') ? 'Unknown site' : (cache.codeOf && cache.codeOf[n]) || 'Site ' + n);  // code (e.g. CVF217) when the site has one
  const PRIVACY = '📍 <b>Privacy:</b> your phone location is checked <b>once, when you tap Clock in</b>, to confirm you are at the site. It is not tracked during your shift or after you clock out.';
  let cache = {};

  async function load() {
    const uid = ST.me.id;
    const [sites, shifts, edits] = await Promise.all([
      q(sb.from('employee_sites').select('id, site_no, site_code, label, lat, lng, radius_m, company_id').order('site_no')),
      q(sb.from('shifts').select('id, site_id, clock_in, clock_out, recorded_in, recorded_out, crew_count, in_note, out_note, loc_status, locked').eq('user_id', uid).order('clock_in', { ascending: false }).limit(200)),
      q(sb.from('shift_edits').select('shift_id, field, by_kind, at')),
    ]);
    const num = {}; const codeOf = {}; sites.forEach((s) => { num[s.id] = s.site_no; if (s.site_code) codeOf[s.site_no] = s.site_code; });
    shifts.forEach((s) => { s.site_no = num[s.site_id]; s.edits = edits.filter((e) => e.shift_id === s.id); s.inEdited = s.edits.some((e) => e.field === 'clock_in'); s.outEdited = s.edits.some((e) => e.field === 'clock_out'); });
    // Company picker: show only the picked company's sites/shifts (an open shift anywhere always stays visible so it can be clocked out).
    const c = co(); const coSite = {}; sites.forEach((s) => { coSite[s.id] = s.company_id; });
    const mine = sites.filter((s) => s.company_id === c);
    cache = { allSites: sites, sites: mine.filter((s) => !ST.isUnknownSite(s)), unknown: mine.find((s) => ST.isUnknownSite(s)), allShifts: shifts, shifts: shifts.filter((s) => !s.clock_out || coSite[s.site_id] === c), num, codeOf };
  }
  const canEdit = (s) => !s.locked && (Date.now() - new Date(s.clock_in)) / 86400000 <= C.editDays;
  const co = () => ST.company() || ST.me.profile.company_id; const coName = () => ST.COMPANIES[co()].name;

  function shell(active, body) {
    const me = ST.me.profile; document.title = 'Shift Tracker — ' + coName();
    const open = cache.shifts.find((s) => !s.clock_out);
    const missed = open && hours(open.clock_in, new Date().toISOString()) > 14;
    return `<div class="emp co-${co()}">
      <header class="topbar"><a href="#/emp/clock" class="emp-brand">${ST.logo(co())}<span class="emp-co">${esc(coName())}</span></a><div class="topbar-r"><button class="btn small ghost" data-act="switchco" title="Switch company" aria-label="Switch company">⇄ Switch</button>${ST.themeBtn()}<a class="avatar" href="#/emp/profile" title="${esc(ST.who(me))}">${esc(ST.initials(ST.who(me)))}</a></div></header>
      <main class="emp-main">${missed ? `<div class="reminder"><span class="ri">🔔</span><div>You're still clocked in at ${siteLabel(open.site_no)} since ${fmtDate(open.clock_in)} ${fmtTime(open.clock_in)}. Please clock out, or fix your time in My shifts.</div></div>` : ''}${body}</main>
      <nav class="tabbar">
        <a href="#/emp/clock" class="${active === 'clock' ? 'on' : ''}"><span class="ti">⏱</span>Clock</a>
        <a href="#/emp/shifts" class="${active === 'shifts' ? 'on' : ''}"><span class="ti">☰</span>My shifts</a>
        <a href="#/emp/profile" class="${active === 'profile' ? 'on' : ''}"><span class="ti">◉</span>Profile</a>
      </nav></div>`;
  }

  function pendingView() {
    const me = ST.me.profile;
    return `<div class="emp co-${co()}"><header class="topbar">${ST.logo(co())}<div class="topbar-r">${ST.themeBtn()}</div></header>
      <main class="emp-main"><div class="card pending-card">
        <div class="pending-icon">⏳</div><h1>Waiting for approval</h1>
        <p class="lead">Hi ${esc(ST.who(me))}! Your account was created and is waiting for the ${esc(coName())} office to approve it.</p>
        <ol class="steps"><li class="done"><b>Account created</b><span>${fmtDate(me.created_at)}, ${fmtTime(me.created_at)}</span></li><li class="now"><b>Office approval</b><span>The office will review your account</span></li><li><b>Clock in to your shifts</b><span>Available once approved</span></li></ol>
        <div class="notice">You can't clock in yet. We'll unlock clock-in as soon as you're approved.</div>
        <div class="kv"><span>Nickname</span><b>${esc(ST.who(me))}</b><span>Phone</span><b>${esc(me.phone || '')}</b></div>
        <button class="btn primary big" data-act="recheck">Check again</button>
        <button class="btn ghost big" data-act="chpw">Change my password</button>
        <button class="btn ghost big" data-act="switchco">Switch company</button>
        <button class="btn ghost big" data-act="logout">Log out</button>
      </div></main></div>`;
  }

  const crewPicker = (n) => `<div class="crew-box"><div class="crew-q">How many workers were at ${siteLabel(n)} this shift? <span class="req">*</span></div>
    <div class="muted small">Count everyone working there with you, including yourself (1–50).</div>
    <div class="stepper"><button type="button" class="step" data-step="-1" aria-label="One less">−</button><input id="crew" type="number" inputmode="numeric" min="1" max="50" placeholder="?" aria-label="Workers on site"><button type="button" class="step" data-step="1" aria-label="One more">+</button></div></div>`;
  const validCrew = (v) => /^\d+$/.test(String(v || '').trim()) && +v >= 1 && +v <= 50;
  function bindCrew(root, cb) {
    const inp = root.querySelector('#crew'); if (!inp) return;
    const fire = () => cb(validCrew(inp.value) ? +inp.value : null);
    root.querySelectorAll('.step').forEach((b) => b.addEventListener('click', () => { const c = parseInt(inp.value, 10); inp.value = isNaN(c) ? 1 : Math.min(50, Math.max(1, c + +b.dataset.step)); fire(); }));
    inp.addEventListener('input', fire); fire();
  }
  function counter(root, id, cid) { const t = root.querySelector('#' + id); t && t.addEventListener('input', () => { if (t.value.length > 120) t.value = t.value.slice(0, 120); root.querySelector('#' + cid).textContent = t.value.length + '/120'; }); }

  function getPosition() {
    return new Promise((res) => {
      if (!navigator.geolocation) return res(null);
      navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res(null), { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    });
  }

  function clockView() {
    const me = ST.me.profile; const open = cache.shifts.find((s) => !s.clock_out); const now = new Date().toISOString();
    if (open) {
      return shell('clock', `<h1 class="h1">Hi, ${esc(ST.who(me))}</h1>
        <div class="card clock-card on">
          <div class="status-pill on">● On shift</div>
          <div class="site-big">${siteLabel(open.site_no)}</div>
          <div class="since">Clocked in at <b>${fmtTime(open.clock_in)}</b>${mBadge(open.inEdited)}</div>
          <div class="elapsed" data-elapsed="${open.clock_in}">${fmtDur(hours(open.clock_in, now))}</div>
          ${hours(open.clock_in, now) > 14 ? '<div class="warn">You have been clocked in for over 14 hours. Did you forget to clock out? Use <b>Edit times</b>.</div>' : ''}
          ${open.loc_status === 'off' ? '<div class="warn sm">Your clock-in location was away from the site. The office will review it.</div>' : ''}
          ${open.in_note ? `<div class="note">📝 ${esc(open.in_note)}</div>` : ''}
          ${crewPicker(open.site_no)}
          <label class="field outnote"><span>Clock-out note (optional) <em id="onCnt">0/120</em></span><textarea id="outNote" maxlength="120" rows="2" placeholder="e.g. finished early, supplies low, gate left open"></textarea><small class="muted">Saved when you clock out. You can't change it afterwards.</small></label>
          <button class="btn danger huge" data-act="clockout" disabled>Enter workers on site to clock out</button>
          <a class="btn ghost" href="#/emp/edit/${open.id}">Wrong start time? Edit times</a>
        </div>`);
    }
    const recent = [...new Set(cache.shifts.map((s) => s.site_no))].filter((n) => cache.sites.some((s) => s.site_no === n)).slice(0, 3);
    const tile = (s) => `<button type="button" class="site-tile" data-num="${s.site_no}" data-code="${esc(s.site_code || '')}">${esc(siteLabel(s.site_no))}<small class="tile-co co-${s.company_id}">${ST.COMPANIES[s.company_id] ? ST.COMPANIES[s.company_id].short : ''}</small></button>`;
    const bySite = (n) => cache.sites.find((s) => s.site_no === n);
    return shell('clock', `<h1 class="h1">Hi, ${esc(ST.who(me))}</h1>
      <div class="card clock-card">
        <div class="row-between"><div class="status-pill">○ Off shift</div><div class="muted">${fmtDate(now)}</div></div>
        <div class="bigclock" data-live-clock>${fmtTime(now)}</div>
        <div class="label">Which site are you at? <span class="req">*</span></div>
        ${recent.length ? `<div class="sub">Your recent sites</div><div class="tiles recent">${recent.map((n) => tile(bySite(n))).join('')}</div>` : ''}
        ${cache.unknown ? `<div class="unk-row"><button type="button" class="site-tile unk-tile" data-num="${cache.unknown.site_no}" data-code="">❓ Unknown site<small>Your site isn&apos;t in the list? Tap here. The office will set the right site later.</small></button></div>` : ''}
        <input class="site-search" id="siteSearch" autocapitalize="characters" autocomplete="off" placeholder="Type a site code or number (e.g. CVF217 or 217)…">
        <div class="tiles all" id="allTiles">${cache.sites.map(tile).join('') || `<div class="empty">No ${esc(coName())} sites yet. Switch company or ask the office.</div>`}</div>
        <div class="muted small">Site not listed? Ask your driver or call the office.</div>
        <div class="label">Location check</div>
        <div class="privacy small">${PRIVACY}</div>
        <label class="field"><span>Notes (optional) <em id="cnt">0/120</em></span><textarea id="notes" maxlength="120" rows="2" placeholder="e.g. ride partner"></textarea></label>
        <div class="sticky-cta"><button class="btn primary huge" id="clockinBtn" disabled>Pick a site to clock in</button></div>
      </div>`);
  }
  function bindClock(root) {
    let sel = null; const btn = root.querySelector('#clockinBtn');
    root.querySelectorAll('.site-tile').forEach((t) => t.addEventListener('click', () => { sel = +t.dataset.num; root.querySelectorAll('.site-tile').forEach((x) => x.classList.toggle('sel', +x.dataset.num === sel)); btn.disabled = false; btn.textContent = 'Clock in at ' + siteLabel(sel); }));
    const ss = root.querySelector('#siteSearch');
    ss && ss.addEventListener('input', () => { const v = ss.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); const d = v.replace(/\D/g, ''); root.querySelectorAll('#allTiles .site-tile').forEach((t) => { const ok = !v || t.dataset.code.includes(v) || (d && d === v && t.dataset.num.startsWith(d)); t.style.display = ok ? '' : 'none'; }); });
    counter(root, 'notes', 'cnt'); counter(root, 'outNote', 'onCnt');
    btn && btn.addEventListener('click', async () => {
      if (!sel) return; btn.disabled = true; btn.textContent = 'Checking location…';
      const site = cache.sites.find((s) => s.site_no === sel);
      const pos = site && site.lat != null ? await getPosition() : null; // GPS only when the site has a GPS point
      try {
        await q(sb.rpc('clock_in', { p_site_no: sel, p_lat: pos ? pos.lat : null, p_lng: pos ? pos.lng : null, p_note: root.querySelector('#notes').value.trim() || null }));
        toast('Clocked in ✓', 'good'); ST.render();
      } catch (e) { toast(errMsg(e), 'bad'); btn.disabled = false; btn.textContent = 'Clock in at ' + siteLabel(sel); }
    });
    const cob = root.querySelector('[data-act="clockout"]'); let crew = null;
    bindCrew(root, (n) => { crew = n; if (cob) { cob.disabled = !n; cob.textContent = n ? 'Clock out' : 'Enter workers on site to clock out'; } });
    cob && cob.addEventListener('click', () => {
      const note = (root.querySelector('#outNote').value || '').trim();
      modal(`<h2>Clock out now?</h2><p>Your shift will end at ${fmtTime(new Date().toISOString())}.<br>Workers on site: <b>${crew}</b>${note ? '<br>Note: “' + esc(note) + '” <span class="muted small">(can\'t be changed later)</span>' : ''}</p><div class="row-end"><button class="btn ghost" data-close>Cancel</button><button class="btn danger" id="yes">Clock out</button></div>`, (w, close) => {
        w.querySelector('#yes').addEventListener('click', async () => {
          try { await q(sb.rpc('clock_out', { p_crew: crew, p_note: note || null })); close(); toast('Clocked out ✓', 'good'); ST.render(); }
          catch (e) { toast(errMsg(e), 'bad'); }
        });
      });
    });
  }

  // ---------- My shifts: Worked / Break / hrs ----------
  function payDays(shifts) {
    const m = {};
    shifts.filter((s) => s.clock_out).forEach((s) => { const k = T().dayKey(s.clock_in) + '|' + s.site_no; (m[k] = m[k] || { day: T().dayKey(s.clock_in), site_no: s.site_no, worked: 0, ids: [] }); m[k].worked += hours(s.clock_in, s.clock_out); m[k].ids.push(s.id); });
    return Object.values(m).map((d) => ({ ...d, unpaid: unpaidBreak(d.worked), paid: d.worked - unpaidBreak(d.worked) })).sort((a, b) => b.day.localeCompare(a.day));
  }
  function shiftsView() {
    const now = new Date().toISOString(); const days = payDays(cache.shifts); const tk = T().todayKey(); const ws = T().weekStart(tk); const lws = T().addDays(ws, -7);
    const sum = (from, to) => { const d = days.filter((x) => x.day >= from && x.day <= to); return { n: cache.shifts.filter((s) => s.clock_out && T().dayKey(s.clock_in) >= from && T().dayKey(s.clock_in) <= to).length, worked: d.reduce((a, x) => a + x.worked, 0), unpaid: d.reduce((a, x) => a + x.unpaid, 0), paid: d.reduce((a, x) => a + x.paid, 0) }; };
    const brk = (h) => (h > 0 ? fmtDur(h) : 'none');
    const hrs = (h) => (Math.round(h * 100) / 100).toString() + ' hrs';   // e.g. 7.5 hrs (employees see no paid/unpaid wording)
    const wk = (l, w) => `<div><span>${l} <em>${w.n} shift${w.n === 1 ? '' : 's'}</em></span><div class="wp3"><div><small>Worked</small><b>${fmtDur(w.worked)}</b></div><div><small>Break</small><b class="brk">${brk(w.unpaid)}</b></div><div><small>&nbsp;</small><b class="pd">${hrs(w.paid)}</b></div></div></div>`;
    const edLine = (s) => { const p = []; s.edits.forEach((e) => p.push(`${e.field.replace('_', '-')} changed by ${e.by_kind === 'worker' ? 'you' : 'the office'} on ${fmtDate(e.at)}`)); return p.length ? `<div class="edited-line"><span class="mbadge sm">M</span> ${esc(p.join(' · '))}</div>` : ''; };
    const punch = (s) => { const open = !s.clock_out; const missed = open && hours(s.clock_in, now) > 14;
      return `<div class="punch"><div class="times"><div><span class="tl">In</span><b>${fmtTime(s.clock_in)}</b>${mBadge(s.inEdited)}</div><span class="arrow">→</span><div><span class="tl">Out</span><b>${open ? '—' : fmtTime(s.clock_out)}</b>${mBadge(s.outEdited)}</div>${canEdit(s) ? `<a class="btn small edit" href="#/emp/edit/${s.id}">✎ Edit</a>` : ''}</div>
        ${edLine(s)}${missed ? '<div class="warn sm">Forgot to clock out? Tap Edit to add your finish time.</div>' : ''}
        ${s.in_note ? `<div class="note sm">📝 ${esc(s.in_note)}</div>` : ''}${s.out_note ? `<div class="note sm outnote-ro">🗒 Clock-out note: “${esc(s.out_note)}” <span class="lock" title="Saved at clock-out — can't be changed">🔒</span></div>` : ''}</div>`; };
    const cards = [];
    cache.shifts.filter((s) => !s.clock_out).forEach((s) => { const missed = hours(s.clock_in, now) > 14; cards.push(`<div class="shift ${missed ? 'missed' : ''}"><div class="shift-top"><div><div class="shift-date">${fmtDate(s.clock_in)}</div><div class="shift-site">${siteLabel(s.site_no)}</div></div><div class="shift-hrs">${missed ? '<span class="tag bad">No clock-out</span>' : '<span class="tag on">On shift</span>'}</div></div>${punch(s)}</div>`); });
    days.slice(0, 30).forEach((d) => { const ps = cache.shifts.filter((x) => d.ids.includes(x.id)).sort((a, b) => a.clock_in.localeCompare(b.clock_in));
      cards.push(`<div class="shift"><div class="shift-top"><div><div class="shift-date">${fmtDate(ps[0].clock_in)}</div><div class="shift-site">${siteLabel(d.site_no)}${ps.length > 1 ? ' <span class="tag">' + ps.length + ' punches · added together</span>' : ''}</div></div></div>
        <div class="payline"><div><small>Worked</small><b>${fmtDur(d.worked)}</b></div><div><small>Break</small><b class="brk">${brk(d.unpaid)}</b></div><div><small>&nbsp;</small><b class="pd">${hrs(d.paid)}</b></div></div>${ps.map(punch).join('')}</div>`); });
    return shell('shifts', `<h1 class="h1">My shifts</h1>
      <div class="summary">${wk('This week', sum(ws, tk))}${wk('Last week', sum(lws, T().addDays(ws, -1)))}</div>
      <div class="rule-line">ℹ Break: over 5 h worked = 0.5 h break; 8 h or more = 1 h break. Worked out once per day per site (split shifts are added together).</div>
      <div class="legend"><span class="mbadge sm">M</span> = time changed by hand (the original time is kept on record)</div>
      <div class="shift-list">${cards.join('') || '<div class="empty">No shifts yet.</div>'}</div>
      <p class="muted small center">You can fix your own times for shifts in the last ${C.editDays} days. For older shifts, ask the office.</p>`);
  }

  function editView(id) {
    const s = cache.shifts.find((x) => x.id === id);
    if (!s) return shell('shifts', '<div class="card">Shift not found.</div>');
    if (!canEdit(s)) return shell('shifts', `<div class="card"><h2>Can't edit this shift</h2><p>It's older than ${C.editDays} days or already signed off. Please ask the office.</p><a class="btn" href="#/emp/shifts">Back</a></div>`);
    const reasons = ['Forgot to clock in', 'Forgot to clock out', 'Phone / app problem', 'Clocked the wrong time', 'Other'];
    return shell('shifts', `<a class="back" href="#/emp/shifts">‹ My shifts</a><h1 class="h1">Edit shift times</h1>
      <div class="card"><div class="muted small">${fmtDateLong(s.clock_in)}</div><div class="site-mid">${siteLabel(s.site_no)}</div>
        <form id="editForm" class="stack">
          <label class="field"><span>Clock-in ${mBadge(s.inEdited)} <em>now ${fmtTime(s.clock_in)}</em></span><input type="datetime-local" name="clockIn" value="${T().toInput(s.clock_in)}" required></label>
          <label class="field"><span>Clock-out ${mBadge(s.outEdited)} <em>${s.clock_out ? 'now ' + fmtTime(s.clock_out) : 'not clocked out'}</em></span><input type="datetime-local" name="clockOut" value="${T().toInput(s.clock_out)}"></label>
          ${s.crew_count == null ? crewPicker(s.site_no) : `<div class="kv"><span>Workers on site</span><b>${s.crew_count}</b></div>`}
          <label class="field"><span>Why are you changing it? <span class="req">*</span></span><select name="reason">${reasons.map((r, i) => `<option ${i === (s.clock_out ? 0 : 1) ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
          <label class="field"><span>Details (optional)</span><input name="details" maxlength="200" placeholder="e.g. phone was in the car"></label>
          <div class="info small">Changed times get an <span class="mbadge sm">M</span> mark. Your original clocked times are kept, and the office can see what changed.</div>
          <div class="err" id="editErr"></div>
          <button class="btn primary big" type="submit">Save changes</button><a class="btn ghost big" href="#/emp/shifts">Cancel</a>
        </form></div>`);
  }
  function bindEdit(root, id) {
    const f = root.querySelector('#editForm'); if (!f) return; let crew = null; bindCrew(root, (n) => (crew = n));
    f.addEventListener('submit', async (e) => {
      e.preventDefault(); const d = new FormData(f);
      const sh = cache.shifts.find((x) => x.id === id); const ci = d.get('clockIn') === T().toInput(sh.clock_in) ? sh.clock_in : T().fromInput(d.get('clockIn')); const co = !d.get('clockOut') ? null : d.get('clockOut') === T().toInput(sh.clock_out) ? sh.clock_out : T().fromInput(d.get('clockOut'));
      try { await q(sb.rpc('edit_my_shift', { p_shift: id, p_clock_in: ci, p_clock_out: co, p_reason: d.get('reason'), p_details: d.get('details') || null, p_crew: crew })); toast('Saved ✓ (marked M)', 'good'); location.hash = '#/emp/shifts'; }
      catch (err) { root.querySelector('#editErr').textContent = errMsg(err); }
    });
  }

  function profileView() {
    const me = ST.me.profile;
    return shell('profile', `<h1 class="h1">Profile</h1><div class="card"><div class="kv"><span>Nickname</span><b>${esc(ST.who(me))}</b><span>Phone</span><b>${esc(me.phone || '')}</b><span>Company</span><b>${esc(coName())}</b></div>
      <p class="muted small">Your nickname is how the office sees you. To change your phone number, ask the office.</p><button class="btn big" data-act="chnick">Change nickname</button> <button class="btn big" data-act="chpw">Change my password</button> <button class="btn big" data-act="switchco">Switch company</button> <button class="btn ghost big" data-act="logout">Log out</button></div>`);
  }

  // Change nickname: type one (checked by the server: 2-30 chars, letters/numbers/basic punctuation, unique, no rude words,
  // 5 changes a day) or tap "Suggest one" for a random funny one from the safe word lists.
  function changeNickname() {
    modal(`<h2>Change nickname</h2><form id="nickForm" class="stack">
      <label class="field"><span>Your nickname (2–30 characters)</span><input name="nick" id="nickInput" maxlength="30" autocomplete="off" autocapitalize="words" value="${esc(ST.who(ST.me.profile))}" required></label>
      <button class="btn" type="button" id="nickSuggest">🎲 Suggest one</button>
      <p class="muted small" id="nickLeft">Letters, numbers, spaces and . , ' ! ? &amp; ( ) _ - only.</p><div class="err" id="nickErr"></div>
      <div class="row-between"><button class="btn ghost" type="button" data-close>Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`, (w, close) => {
      const f = w.querySelector('#nickForm'); const inp = w.querySelector('#nickInput'); const errEl = w.querySelector('#nickErr');
      inp.addEventListener('input', () => (errEl.textContent = ''));
      q(sb.rpc('my_nickname_changes_left')).then((n) => { w.querySelector('#nickLeft').textContent += ` ${n} change${n === 1 ? '' : 's'} left today.`; }).catch(() => {});
      w.querySelector('#nickSuggest').addEventListener('click', async () => {
        errEl.textContent = ''; try { inp.value = await q(sb.rpc('suggest_my_nickname')); inp.focus(); } catch (e) { errEl.textContent = errMsg(e); }
      });
      f.addEventListener('submit', async (e) => {
        e.preventDefault(); errEl.textContent = ''; const v = inp.value.trim().replace(/\s+/g, ' ');
        if (v.length < 2 || v.length > 30) { errEl.textContent = 'Nickname must be 2 to 30 characters.'; return; }
        f.classList.add('loading');
        try { const n = await q(sb.rpc('set_my_nickname', { p_nick: v })); close(); toast('You are now ' + n + ' ✓', 'good'); ST.render(); }
        catch (e2) { errEl.textContent = errMsg(e2); } finally { f.classList.remove('loading'); }
      });
    });
  }

  ST.employeeView = async function (app, p) {
    if (ST.me.profile.status !== 'active') { app.innerHTML = pendingView(); app.querySelector('[data-act="recheck"]').addEventListener('click', () => ST.render()); return; }
    await load();
    const v = p[0] || 'clock';
    if (v === 'shifts') app.innerHTML = shiftsView();
    else if (v === 'edit') { app.innerHTML = editView(p[1]); bindEdit(app, p[1]); }
    else if (v === 'profile') { app.innerHTML = profileView(); app.querySelector('[data-act="chnick"]').addEventListener('click', changeNickname); }
    else { app.innerHTML = clockView(); bindClock(app); }
  };
})();
