/* calendar1 – crew "Schedule" page + visit handovers (owner, Oct 21 2026). TEST copy, mock store, FAKE data only.
   Cleaners (CJ employees), crew leads and subcontractor workers get #/schedule: their assigned sites with each site's tasks,
   and their visits in the phone calendar (Month / Week / Day, Today).
   "Hand over this visit": request → the other person accepts/declines → the office (owner/admin/ops) approves/declines
   → only then the visit is reassigned (DB.calAssign). Until then the original person stays responsible ("Handover pending").
   RULE (who can take a visit): people already on that site's crew. The office can switch on "allow anyone"
   (DB.settings.handAnyone) so any active CJ cleaner / crew lead / sub worker can be chosen. Clients are never told; all audited. */
(function () {
  if (typeof VIEWS === 'undefined' || typeof ACT === 'undefined') return;
  var DOWL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function H() { return DB.calHand = DB.calHand || []; }
  function A() { return DB.calAssign = DB.calAssign || []; }
  function site(c) { return (DB.sites || []).filter(function (s) { return s.code === c; })[0] || null; }
  function nm(id) { var u = user(id); return u ? u.name : '?'; }
  function isCleaner(u) { u = u || ME; return !!u && (u.type === 'employee' || u.type === 'worker'); }
  function activeU(u) { return u && !u.inactive && u.status !== 'inactive' && u.active !== false; }
  function roles() { return (ME && ME.officeRoles) || (ME && ME.officeRole ? [ME.officeRole] : []); }
  function canManage() { if (!ME || ME.type !== 'admin') return false; var r = roles(); return !r.length || r.some(function (x) { return ['owner', 'admin', 'ops'].indexOf(x) >= 0; }); }
  function anyone() { return !!(DB.settings && DB.settings.handAnyone); }
  function dLong(d) { var x = parseD(d); return DOWL[(x.getDay() + 6) % 7] + ', ' + MON[x.getMonth()] + ' ' + x.getDate(); }
  function no() { DB.handSeq = (DB.handSeq || 0) + 1; return 'HO-' + String(DB.handSeq).padStart(4, '0'); }
  function roleTxt(u) { var r = (u.addedByOffice || {}).role; return r === 'crewlead' ? 'crew lead' : u.type === 'worker' ? 'sub worker' : 'CJ cleaner'; }
  function assigned(code, d) { return A().filter(function (a) { return a.site === code && a.date === d; }); }
  function openFor(code, d) { return H().filter(function (h) { return h.site === code && h.date === d && (h.status === 'awaiting-person' || h.status === 'awaiting-office'); })[0] || null; }
  /* who is responsible for one visit (crew, plus approved handovers) */
  window.calResponsible = function (code, d) {
    var s = site(code), l = s ? (s.crew || []).slice() : [];
    assigned(code, d).forEach(function (a) { l = l.filter(function (i) { return i !== a.fromId; }); if (l.indexOf(a.toId) < 0) l.push(a.toId); });
    return l;
  };
  window.calHandMine = function (code, d) { return A().some(function (a) { return a.site === code && a.date === d && a.toId === (ME && ME.id) && calResponsible(code, d).indexOf(ME.id) >= 0; }); };
  window.calHandSites = function (uid) { return A().filter(function (a) { return a.toId === uid; }).map(function (a) { return a.site; }); };
  window.calHandEligible = function (code, fromId) {
    var s = site(code), crew = s ? (s.crew || []) : [];
    return (DB.users || []).filter(function (u) { return isCleaner(u) && activeU(u) && u.id !== fromId && !/^TEST-PRACTICE/.test(u.username || '') && (anyone() || crew.indexOf(u.id) >= 0); });
  };
  /* annotate / filter visits (called from v2-cjcalendar.js visits()) */
  window.calHandFilter = function (out) {
    if (!ME || ME.type === 'firm') return out;   // clients never see crew swaps
    return out.filter(function (v) {
      var onCrew = ((site(v.site) || {}).crew || []).indexOf(ME.id) >= 0;
      if (v.wax) return !isCleaner() || onCrew;   // never leak another site's waxing
      if (v.status !== 'scheduled') return !isCleaner() || ((site(v.site) || {}).crew || []).indexOf(ME.id) >= 0;
      var resp = calResponsible(v.site, v.date), o = openFor(v.site, v.date), a = assigned(v.site, v.date);
      if (isCleaner()) {
        var mine = a.filter(function (x) { return x.fromId === ME.id; })[0], tome = a.filter(function (x) { return x.toId === ME.id; })[0];
        if (mine && resp.indexOf(ME.id) < 0) { v.hand = 'Handed over to ' + nm(mine.toId); v.handedAway = true; }
        else if (tome) v.hand = 'Handed to you by ' + nm(tome.fromId);
        else if (resp.indexOf(ME.id) < 0) return false;   // a site I only cover on handed dates
        if (o && (o.fromId === ME.id || o.toId === ME.id)) v.hand = 'Handover pending – ' + (o.fromId === ME.id ? 'to ' + nm(o.toId) : 'from ' + nm(o.fromId)) + (o.status === 'awaiting-office' ? ' (waiting for the office)' : '');
      } else {
        if (o) v.hand = 'Handover pending – ' + nm(o.fromId) + ' → ' + nm(o.toId);
        else if (a.length) v.hand = 'Covered by ' + a.map(function (x) { return nm(x.toId); }).join(', ') + ' (handover)';
      }
      return true;
    });
  };

  /* ---------- logic (also used by the tests) ---------- */
  window.calHandRequest = function (o) {
    if (!isCleaner()) return { ok: false, msg: 'Only cleaners, crew leads and sub workers can hand over a visit.' };
    o = o || {}; var s = site(o.site); if (!s) return { ok: false, msg: 'Site not found.' };
    if (!/^\d{4}-\d\d-\d\d$/.test(o.date || '') || o.date < today()) return { ok: false, msg: 'Pick an upcoming visit.' };
    var v = (calVisits(o.date, o.date) || []).filter(function (x) { return x.site === o.site && !x.wax && x.status === 'scheduled'; })[0];
    if (!v) return { ok: false, msg: 'No scheduled visit at ' + o.site + ' on that day.' };
    if (calResponsible(o.site, o.date).indexOf(ME.id) < 0) return { ok: false, msg: 'You are not on this visit.' };
    if (openFor(o.site, o.date)) return { ok: false, msg: 'A handover for this visit is already waiting.' };
    var el = calHandEligible(o.site, ME.id), to = null, t = String(o.to || '').trim();
    to = el.filter(function (u) { return u.id === t; })[0] || el.filter(function (u) { return u.name.toLowerCase() === t.toLowerCase(); })[0] || null;
    if (!to) return { ok: false, msg: t ? '“' + t + '” can’t take this visit. Pick someone on this site’s crew' + (anyone() ? ' or another active cleaner' : ' (the office can allow anyone)') + '.' : 'Enter or choose the person taking the visit.' };
    var r = { id: 'ho' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), no: no(), site: o.site, date: o.date, start: v.start, fromId: ME.id, toId: to.id, reason: String(o.reason || '').slice(0, 300), status: 'awaiting-person', createdAt: new Date().toISOString(), log: [] };
    H().unshift(r);
    audit('Visit handover requested', r.site, r.no + ' ' + r.date + ' ' + ME.name + ' → ' + to.name);
    notify([to.id], 'Handover ' + r.no + ': ' + ME.name + ' asks you to take the ' + r.site + ' visit on ' + dLong(r.date) + '. Open Schedule to accept or decline.', 'ho|' + r.id + '|ask');
    save(); return { ok: true, req: r, msg: 'Sent to ' + to.name + '. You stay responsible until they accept and the office approves.' };
  };
  window.calHandAnswer = function (id, accept, note) {
    var r = H().filter(function (x) { return x.id === id || x.no === id; })[0]; if (!r) return { ok: false, msg: 'Not found.' };
    if (!ME || ME.id !== r.toId) return { ok: false, msg: 'Only ' + nm(r.toId) + ' can answer this.' };
    if (r.status !== 'awaiting-person') return { ok: false, msg: 'Already answered.' };
    r.personNote = String(note || '').slice(0, 300); r.personAt = new Date().toISOString();
    if (accept) {
      r.status = 'awaiting-office';
      audit('Visit handover accepted by the other person', r.site, r.no + ' ' + nm(r.toId));
      notify([r.fromId], 'Handover ' + r.no + ': ' + nm(r.toId) + ' accepted the ' + r.site + ' visit on ' + dLong(r.date) + '. Waiting for the office – you are still responsible until then.', 'ho|' + r.id + '|acc');
      notify('admin', 'Handover ' + r.no + ' to approve: ' + r.site + ' ' + dLong(r.date) + ' – ' + nm(r.fromId) + ' → ' + nm(r.toId) + ' (accepted).', 'ho|' + r.id + '|office');
    } else {
      r.status = 'declined-person';
      audit('Visit handover declined by the other person', r.site, r.no + ' ' + nm(r.toId) + (r.personNote ? ' – ' + r.personNote : ''));
      notify([r.fromId], 'Handover ' + r.no + ': ' + nm(r.toId) + ' declined the ' + r.site + ' visit on ' + dLong(r.date) + '. You are still on this visit.' + (r.personNote ? ' Note: ' + r.personNote : ''), 'ho|' + r.id + '|dec');
    }
    save(); return { ok: true, req: r };
  };
  window.calHandDecide = function (id, approve, note) {
    if (!canManage()) return { ok: false, msg: 'Only the owner, admin or operations can approve handovers.' };
    var r = H().filter(function (x) { return x.id === id || x.no === id; })[0]; if (!r) return { ok: false, msg: 'Not found.' };
    if (r.status !== 'awaiting-office') return { ok: false, msg: r.status === 'awaiting-person' ? 'Waiting for ' + nm(r.toId) + ' to accept first.' : 'Already decided.' };
    r.officeNote = String(note || '').slice(0, 300); r.decidedBy = ME.name; r.decidedAt = new Date().toISOString();
    var both = [r.fromId, r.toId], what = r.site + ' visit on ' + dLong(r.date);
    if (approve) {
      r.status = 'approved'; A().push({ site: r.site, date: r.date, fromId: r.fromId, toId: r.toId, no: r.no });
      audit('Visit handover approved – reassigned', r.site, r.no + ' ' + r.date + ' ' + nm(r.fromId) + ' → ' + nm(r.toId) + ' by ' + ME.name);
      notify([r.fromId], 'Handover ' + r.no + ' approved: the ' + what + ' is now ' + nm(r.toId) + '’s. It is off your schedule.', 'ho|' + r.id + '|ok');
      notify([r.toId], 'Handover ' + r.no + ' approved: the ' + what + ' is now yours. It is on your schedule.', 'ho|' + r.id + '|ok');
    } else {
      r.status = 'declined-office';
      audit('Visit handover declined by the office', r.site, r.no + ' by ' + ME.name + (r.officeNote ? ' – ' + r.officeNote : ''));
      notify(both, 'Handover ' + r.no + ' declined by the office: ' + nm(r.fromId) + ' stays on the ' + what + '.' + (r.officeNote ? ' Note: ' + r.officeNote : ''), 'ho|' + r.id + '|no');
    }
    save(); return { ok: true, req: r };
  };
  var ST = { 'awaiting-person': 'waiting for the other person', 'awaiting-office': 'waiting for the office', approved: 'approved – reassigned', 'declined-person': 'declined by the other person', 'declined-office': 'declined by the office' };
  function pill(r) { return '<span class="pill ' + (r.status === 'approved' ? 's-ok' : /declined/.test(r.status) ? 's-bad' : 's-pend') + '">' + ST[r.status] + '</span>'; }

  /* ---------- crew Schedule page ---------- */
  function taskList(s) { var t = s.checklist && s.checklist.length ? s.checklist : (window.LN_DEFAULT_TASKS || []); return t.map(function (x) { return '<li>' + esc(typeof x === 'string' ? x : x.label || x.name || x.text || '') + '</li>'; }).join(''); }
  function schedule() {
    var my = calMySitesFull().filter(function (s) { return (s.crew || []).indexOf(ME.id) >= 0; }), ask = H().filter(function (h) { return h.toId === ME.id && h.status === 'awaiting-person'; }), mine = H().filter(function (h) { return (h.fromId === ME.id || h.toId === ME.id) && h.status !== 'awaiting-person' || h.fromId === ME.id && h.status === 'awaiting-person'; }).slice(0, 10);
    var x = '<div class="calpage" id="crewsched"><h1>Schedule</h1><p class="muted small">Your sites and upcoming visits. Can’t do a visit? Tap it and choose <b>Hand over this visit</b> – the other person and the office must both approve; until then it stays yours.</p>';
    if (ask.length) x += '<div class="card calinbox" id="handask"><h2>Handover requests for you <span class="pill s-pend">' + ask.length + '</span></h2>' + ask.map(function (r) {
      return '<div class="calreq" data-ho="' + esc(r.no) + '"><div><b>' + esc(r.no) + '</b> · ' + esc(nm(r.fromId)) + ' asks you to take <b>' + esc(r.site) + ' · ' + esc((site(r.site) || {}).name || '') + '</b> on <b>' + dLong(r.date) + (r.start ? ' ' + t12(r.start) : '') + '</b></div>' + (r.reason ? '<div class="small muted">Reason: ' + esc(r.reason) + '</div>' : '') + '<div class="small"><b>Tasks</b><ol class="small">' + (typeof window.cjTasksFor === 'function' ? window.cjTasksFor(r.site, r.date) : taskList(site(r.site) || {})) + '</ol></div>' +
        '<div class="row calreq-a"><input type="text" maxlength="300" id="hon-' + r.id + '" placeholder="Note (optional)"><button type="button" class="small" data-act="hoans" data-ok="1" data-id="' + r.id + '">Accept</button><button type="button" class="small sec" data-act="hoans" data-ok="0" data-id="' + r.id + '">Decline</button></div><p class="small muted">After you accept, the office still has to approve.</p></div>';
    }).join('') + '</div>';
    x += '<div class="card" id="crewsites"><h2>My sites</h2>' + (my.length ? my.map(function (s) { return '<details class="crewsite"><summary><b>' + esc(s.code) + '</b> · ' + esc(s.name) + (s.visitStart ? ' · starts ' + t12(s.visitStart) : '') + '</summary><ol class="small">' + taskList(s) + '</ol></details>'; }).join('') : '<p class="muted">You are not assigned to any site yet. Ask the office.</p>') + '</div>';
    x += calendarHtml();
    if (mine.length) x += '<div class="card" id="handmine"><h2>My handovers</h2>' + mine.map(function (r) { var hide = r.toId === ME.id && r.status !== 'approved' && ((site(r.site) || {}).crew || []).indexOf(ME.id) < 0; return '<div class="small">' + esc(r.no) + ' · ' + (hide ? 'a visit' : esc(r.site)) + ' ' + dLong(r.date) + ' · ' + esc(nm(r.fromId)) + ' → ' + esc(nm(r.toId)) + ' ' + pill(r) + '</div>'; }).join('') + '</div>';
    return x + '</div>';
  }
  function t12(t) { if (!t) return ''; var h = +t.slice(0, 2), m = t.slice(3, 5); return ((h % 12) || 12) + (m !== '00' ? ':' + m : '') + (h < 12 ? ' am' : ' pm'); }
  VIEWS.schedule = function () { if (!ME) return ''; if (!isCleaner()) return '<div class="card"><p>The Schedule page is for cleaners, crew leads and sub workers.</p></div>'; return schedule(); };
  ['employee', 'worker'].forEach(function (k) { var L = NAV[k]; if (!L || L.some(function (n) { return n[0] === '#/schedule'; })) return; L.splice(1, 0, ['#/schedule', 'Schedule']); });

  /* visit sheet: "Hand over this visit" */
  var ocv = ACT.calvisit; ACT.calvisit = function (el) {
    ocv.apply(this, arguments);
    if (!isCleaner() || String(el.dataset.id || '').indexOf('WAX:') === 0) return;
    var sh = document.getElementById('calsheet'); if (!sh) return;
    var code = String(el.dataset.id).split('|')[0], d = el.dataset.date, o = openFor(code, d);
    var v = (calVisits(d, d) || []).filter(function (x) { return x.site === code && x.date === d; })[0];
    var p = document.createElement('div'); p.className = 'calacts'; p.id = 'handbox';
    if (o) p.innerHTML = '<p class="calmsg pend">Handover pending (' + esc(o.no) + '): ' + esc(nm(o.fromId)) + ' → ' + esc(nm(o.toId)) + ' – ' + ST[o.status] + '. ' + esc(nm(o.fromId)) + ' stays responsible until it is approved.</p>';
    else if (v && v.status === 'scheduled' && d >= today() && calResponsible(code, d).indexOf(ME.id) >= 0) p.innerHTML = '<button type="button" data-act="hoopen" data-site="' + esc(code) + '" data-date="' + d + '">Hand over this visit…</button>';
    else return;
    sh.appendChild(p);
  };
  function sheet(code, d) {
    var el = calHandEligible(code, ME.id);
    return '<div class="calsheet" id="handsheet"><h2>Hand over this visit</h2><p class="small muted">' + esc(code) + ' · ' + dLong(d) + '</p><p class="small">Enter or choose who takes it. ' + (anyone() ? 'Any active cleaner can be chosen (office setting).' : 'Only people on this site’s crew can be chosen.') + ' They must accept, then the office approves. Until then you stay responsible.</p>' +
      '<form data-form="handover" data-site="' + esc(code) + '" data-date="' + d + '"><label>Person taking the visit<input name="to" list="handlist" autocomplete="off" placeholder="Type or choose a name"></label><datalist id="handlist">' + el.map(function (u) { return '<option value="' + esc(u.name) + '">' + esc(roleTxt(u)) + '</option>'; }).join('') + '</datalist>' +
      (el.length ? '<div class="calwaxdays">' + el.map(function (u) { return '<label><input type="radio" name="pick" value="' + esc(u.name) + '" onclick="this.form.to.value=this.value"> ' + esc(u.name) + ' <span class="muted">(' + esc(roleTxt(u)) + ')</span></label>'; }).join('') + '</div>' : '<p class="calmsg bad">Nobody else is on this site’s crew. Ask the office.</p>') +
      '<label>Reason (optional)<input name="reason" maxlength="300"></label><p class="small muted" id="handmsg"></p><div class="row"><button type="submit">Send handover request</button><button type="button" class="sec" data-act="closeModal">Close</button></div></form></div>';
  }
  ACT.hoopen = function (el) { modal(sheet(el.dataset.site, el.dataset.date)); };
  FORMS.handover = function (f) { var r = calHandRequest({ site: f.dataset.site, date: f.dataset.date, to: f.to.value, reason: f.reason.value }); if (!r.ok) { document.getElementById('handmsg').textContent = r.msg; return; } closeModal(); toast(r.msg); render(); };
  var g = function (i) { var e = document.getElementById(i); return e ? e.value : ''; };
  ACT.hoans = function (el) { var r = calHandAnswer(el.dataset.id, el.dataset.ok === '1', g('hon-' + el.dataset.id)); toast(r.ok ? (el.dataset.ok === '1' ? 'Accepted – the office will approve.' : 'Declined.') : r.msg); render(); };
  ACT.hodec = function (el) { var r = calHandDecide(el.dataset.id, el.dataset.ok === '1', g('hod-' + el.dataset.id)); toast(r.ok ? (el.dataset.ok === '1' ? 'Approved – visit reassigned.' : 'Declined.') : r.msg); render(); };
  ACT.hoanyone = function (el) { if (!canManage()) return; DB.settings = DB.settings || {}; DB.settings.handAnyone = !!el.checked; audit('Handover rule changed', '', el.checked ? 'Any active cleaner can take a handed-over visit' : 'Only the site crew can take a handed-over visit'); save(); render(); };
  document.addEventListener('change', function (e) { if (e.target && e.target.dataset && e.target.dataset.hoanyone) ACT.hoanyone(e.target); });

  /* office inbox */
  function inbox() {
    var l = H(), open = l.filter(function (r) { return r.status === 'awaiting-person' || r.status === 'awaiting-office'; }), rest = l.filter(function (r) { return open.indexOf(r) < 0; }).slice(0, 20);
    var row = function (r) {
      return '<div class="calreq st-' + r.status + '" data-ho="' + esc(r.no) + '"><div class="calreq-h"><b>' + esc(r.no) + ' · Crew handover</b> ' + pill(r) + '<span class="small muted"> ' + fmtStamp(r.createdAt) + '</span></div>' +
        '<div><b>' + esc(r.site) + '</b> · ' + dLong(r.date) + (r.start ? ' ' + t12(r.start) : '') + ' · from <b>' + esc(nm(r.fromId)) + '</b> to <b>' + esc(nm(r.toId)) + '</b>' + (r.status === 'awaiting-person' ? '' : r.status !== 'declined-person' ? ' (accepted by ' + esc(nm(r.toId)) + ')' : '') + '</div>' +
        (r.reason ? '<div class="small muted">Reason: ' + esc(r.reason) + '</div>' : '') + (r.personNote ? '<div class="small muted">' + esc(nm(r.toId)) + ': ' + esc(r.personNote) + '</div>' : '') + (r.officeNote ? '<div class="small">Office note: ' + esc(r.officeNote) + '</div>' : '') +
        (r.status === 'awaiting-office' && canManage() ? '<div class="row calreq-a"><input type="text" maxlength="300" id="hod-' + r.id + '" placeholder="Note (optional)"><button type="button" class="small" data-act="hodec" data-ok="1" data-id="' + r.id + '">Approve handover</button><button type="button" class="small sec" data-act="hodec" data-ok="0" data-id="' + r.id + '">Decline</button></div>' : '') + '</div>';
    };
    return '<div class="card calinbox" id="handinbox"><h2>Crew handovers <span class="pill ' + (open.length ? 's-pend' : 's-ok') + '">' + open.length + ' open</span></h2><p class="small muted">The other person accepts first, then the office approves. Nothing changes until both have. Clients are not told about crew swaps.</p>' +
      (canManage() ? '<label class="calsw"><input type="checkbox" data-hoanyone="1"' + (anyone() ? ' checked' : '') + '> Allow handing a visit to any active cleaner (off: only people on that site’s crew)</label>' : '') +
      (open.length ? open.map(row).join('') : '<p class="muted">No handovers waiting.</p>') + (rest.length ? '<h3>Recent</h3>' + rest.map(row).join('') : '') + '</div>';
  }
  window.calHandInbox = inbox;
  ['admin:calrequests', 'calendar'].forEach(function (k) { if (typeof VIEWS[k] !== 'function') return; var o = VIEWS[k]; VIEWS[k] = function () { var x = o.apply(this, arguments); if (!ME || ME.type !== 'admin') return x; return x.replace(/(<div class="card calinbox" id="calinbox">)/, inbox() + '$1'); }; });
})();
