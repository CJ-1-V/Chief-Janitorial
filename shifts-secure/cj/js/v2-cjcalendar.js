/* v2-cjcalendar.js – CJ twin (TEST): phone-style CLEANING CALENDAR for clients, office and assigned cleaners. calendar1, Oct 21 2026.
   Owner (Oct 21 2026): "in the client side we need a calender with marked cleaning dated that can be changed or request to cancel
   cleaning or they can specify 3 days advance when they dont want cleaners to be in ... just like how calenders are on phone with
   option to open week and today options. the same should be on office side and worker side who is assigned to the site".
   Owner addition: the calendar is the CLIENT'S HOME screen, with infographics (next cleaning, month ring, hours, requests, invoice, week strip).
   - Visits are GENERATED from each site's regular hours (DB.sites[].regHours [Mon..Sun], v2-cjsitehours.js) + DB.sites[].visitStart
     (start time, new). Nothing is stored per visit unless something changes (DB.calOv overrides: cancel / move).
   - Client (firm): own sites only. Request a change (needs office OK), request a cancellation, or "No cleaners on these dates"
     (DB.calBlocks). All need >= 3 days' notice (UI + logic). Statuses pending / approved / declined (DB.calReqs).
     ONE switch DB.settings.calAutoApply (default ON): cancellations + blocks made >= 3 days ahead apply at once and the office is
     notified; date changes always need the office. Switch OFF = everything waits for the office.
   - Office (owner / admin / ops; office logins with no roles in the mock): all sites + site filter, requests inbox (approve / decline
     + note), move / cancel / restore a visit directly. Every action audited. Other office roles see the calendar read-only.
   - Cleaners (employee / worker incl. crew leads and subcontractor workers): only sites where they are in DB.sites[].crew (the assignment
     list from v2-cjlean1.js, edited in Office › Site checklists). Subcontractor company login: sites where its workers are assigned.
   - Notifications use the app's simulated outbox notify() (email + push); the client home shows them in "Updates".
   - Invoices are NOT changed. Live: migrations/cj-calendar-001.sql (DRAFT, NOT RUN). Loads LAST. TEST COPY ONLY. */
'use strict';
(function () {
  if (typeof NAV === 'undefined' || typeof VIEWS === 'undefined') return;
  var LEAD = 3, DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], DOWL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  var MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var ST = window.CALST = window.CALST || { view: 'month', cur: null, sel: null, site: '' };
  function CO() { return window.CJ_COMPANY || {}; }
  function sites() { return (DB.sites || []).filter(function (s) { return s.code !== 'TEST-PRACTICE' && (s.companyId || 'cj') === 'cj' && s.active !== false; }); }
  function site(c) { return (DB.sites || []).filter(function (s) { return s.code === c; })[0] || null; }
  /* schedules, the calendar and clock-in count only cleaners the office has ticked Active (v2-cjactive.js). site.crew itself is not changed. */
  function liveCrew(s) { var ids = (s && s.crew) ? s.crew.slice() : []; return typeof window.cjScheduleCrew === 'function' ? window.cjScheduleCrew(ids) : ids; }
  function dIdx(d) { return (parseD(d).getDay() + 6) % 7; }
  function reg(s, d) { return s && s.regHours ? (+s.regHours[dIdx(d)] || 0) : 0; }
  function ov() { return DB.calOv = DB.calOv || []; }
  function blocks() { return DB.calBlocks = DB.calBlocks || []; }
  function reqs() { return DB.calReqs = DB.calReqs || []; }
  function auto() { return !DB.settings || DB.settings.calAutoApply !== false; }
  function hh(h) { h = Math.round((+h || 0) * 100) / 100; return h % 1 ? String(h) : h + '.0'; }
  function addH(t, h) { var m = Math.round((+t.slice(0, 2)) * 60 + (+t.slice(3, 5)) + h * 60); m = m % 1440; return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  function t12(t) { if (!t) return ''; var H = +t.slice(0, 2), M = t.slice(3, 5); return ((H % 12) || 12) + (M !== '00' ? ':' + M : '') + (H < 12 ? ' am' : ' pm'); }
  function dLong(d) { var x = parseD(d); return DOWL[dIdx(d)] + ', ' + MON[x.getMonth()].slice(0, 3) + ' ' + x.getDate(); }
  function dShort(d) { var x = parseD(d); return DOW[dIdx(d)] + ' ' + MON[x.getMonth()].slice(0, 3) + ' ' + x.getDate(); }
  function lead(d) { return daysBetween(today(), d); }
  function leadOk(d) { return !!d && lead(d) >= LEAD; }
  function leadMsg() { return 'Less than ' + LEAD + ' days’ notice – this can’t be done in the app. Please contact the office: ' + (CO().phoneShort || '902-200-4888') + ' · ' + (CO().email || 'admin@chiefjanitorial.com') + '.'; }
  window.CAL_LEAD = LEAD; window.calLeadOk = leadOk;
  function roles() { return (ME && ME.officeRoles) || (ME && ME.officeRole ? [ME.officeRole] : []); }
  function canManage() { if (!ME || ME.type !== 'admin') return false; var r = roles(); return !r.length || r.some(function (x) { return ['owner', 'admin', 'ops'].indexOf(x) >= 0; }); }
  function isCleaner() { return ME && (ME.type === 'employee' || ME.type === 'worker'); }
  /* which sites this login may see */
  function seedLate() { return; }   /* live build: TEST seed stripped */
  function mySites() {
    if (!ME) return [];
    seedLate();
    if (ME.type === 'admin') return sites();
    if (ME.type === 'firm') { var ts = typeof cjtTeamSites === 'function' ? cjtTeamSites() : null; return sites().filter(function (s) { return s.firmId === ME.id && (!ts || ts.indexOf(s.code) >= 0); }); }
    if (isCleaner()) { if (typeof window.cjActiveCleaner === 'function' && !window.cjActiveCleaner(ME)) return []; var hx = typeof window.calHandSites === 'function' ? window.calHandSites(ME.id) : []; return sites().filter(function (s) { return (s.crew || []).indexOf(ME.id) >= 0 || hx.indexOf(s.code) >= 0; }); }   // + visits handed to me (approved); inactive cleaners see no sites
    if (ME.type === 'sub') { var ids = DB.users.filter(function (u) { return u.subId === ME.id && (typeof window.cjActiveCleaner !== 'function' || window.cjActiveCleaner(u)); }).map(function (u) { return u.id; }); return sites().filter(function (s) { return (s.crew || []).some(function (i) { return ids.indexOf(i) >= 0; }); }); }
    return [];
  }
  window.calCanSite = function (c) { return canSite(c); }; window.calCanVisit = function (v) { return canVisit(v); }; window.calMySitesFull = function () { return crewSites(); };
  window.calMySites = function () { return crewSites().map(function (s) { return s.code; }); };
  function crewSites() { return isCleaner() ? mySites().filter(function (s) { return (s.crew || []).indexOf(ME.id) >= 0; }) : mySites(); }   // owner Oct 21: employees see ONLY assigned sites
  function canSite(code) { return crewSites().some(function (s) { return s.code === code; }); }
  function canVisit(v) { return !!v && (canSite(v.site) || (isCleaner() && typeof window.calHandMine === 'function' && window.calHandMine(v.site, v.date))); }
  function ovFor(code, d) { return ov().filter(function (o) { return o.site === code && o.date === d; })[0] || null; }
  function blockFor(s, d) { return blocks().filter(function (b) { return b.status === 'approved' && b.from <= d && b.to >= d && (b.sites || []).indexOf(s.code) >= 0; })[0] || null; }
  function pendFor(code, d) { return reqs().filter(function (r) { return r.status === 'pending' && r.site === code && r.date === d; })[0] || null; }
  function doneFor(code, d) { var l = (DB.visitLogs || []).filter(function (x) { return x.site === code && x.date === d; }); return l.length ? (l.some(function (x) { return x.status === 'Done'; }) ? 'Done' : l[0].status) : ''; }
  /* all visits in [from,to] for the given sites, with every change applied */
  function visits(from, to, list) {
    var out = [], codes = list.map(function (s) { return s.code; });
    list.forEach(function (s) {
      if (!s.regHours) return;
      for (var d = from; d <= to; d = addDays(d, 1)) {
        var h = reg(s, d); if (!(h > 0)) continue;
        var v = { id: s.code + '|' + d, site: s.code, name: s.name, date: d, orig: d, start: s.visitStart || '', hours: h, crew: liveCrew(s).length, status: 'scheduled' };
        var o = ovFor(s.code, d), b = blockFor(s, d);
        if (o && o.type === 'cancel') { v.status = 'cancelled'; v.reason = o.reason; }
        else if (o && o.type === 'move') { v.status = 'moved'; v.movedTo = o.newDate; v.movedStart = o.newStart; }
        else if (b) { v.status = 'blocked'; v.reason = b.note; }
        v.pending = pendFor(s.code, d);
        if (v.status === 'scheduled' && d < today()) v.done = doneFor(s.code, d) || 'Not marked';
        out.push(v);
      }
    });
    ov().forEach(function (o) {
      if (o.type !== 'move' || o.newDate < from || o.newDate > to || codes.indexOf(o.site) < 0) return;
      var s = site(o.site); if (!s) return;
      var v = { id: o.site + '|' + o.date, site: o.site, name: s.name, date: o.newDate, orig: o.date, start: o.newStart || s.visitStart || '', hours: reg(s, o.date), crew: liveCrew(s).length, status: 'scheduled', movedFrom: o.date };
      var b = blockFor(s, o.newDate); if (b) { v.status = 'blocked'; v.reason = b.note; }
      if (v.status === 'scheduled' && o.newDate < today()) v.done = doneFor(o.site, o.newDate) || 'Not marked';
      out.push(v);
    });
    if (typeof window.calHandFilter === 'function') out = window.calHandFilter(out);   // owner Oct 21: crew handovers
    if (typeof window.calWaxVisits === 'function') out = out.concat(window.calWaxVisits(from, to, codes));   // owner Oct 21: confirmed waxing visits
    return out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.start < b.start ? -1 : 1); });
  }
  window.calVisits = function (from, to) { return visits(from, to, mySites()); };
  function viewSites() { var l = mySites(); return ST.site ? l.filter(function (s) { return s.code === ST.site; }) : l; }
  function findVisit(id, date) { var p = id.split('|'), s = site(p[0]); if (!s) return null; var l = visits(addDays(date, -1), addDays(date, 1), [s]).filter(function (v) { return v.id === id && v.date === date; }); return l[0] || null; }
  function crewIds(code) { return liveCrew(site(code)); }
  function firmOf(code) { var s = site(code); return s ? s.firmId : null; }
  function reqNo() { DB.calSeq = (DB.calSeq || 0) + 1; return 'CR-' + String(DB.calSeq).padStart(4, '0'); }
  function setOv(o) { DB.calOv = ov().filter(function (x) { return !(x.site === o.site && x.date === o.date); }); if (o.type) DB.calOv.push(o); }
  function tellCrew(code, text, key) { var c = crewIds(code); if (c.length) notify(c, text, key); }

  /* ---------- logic (also used by the tests) ---------- */
  // client: request. kind 'cancel' | 'change' | 'block'. Returns {ok, msg, req}
  window.calRequest = function (o) {
    if (!ME || ME.type !== 'firm') return { ok: false, msg: 'Only a client login can send this request.' };
    var note = String(o.note || '').trim().slice(0, 300), r = { id: uid('cr'), firmId: ME.id, firmName: ME.name, kind: o.kind, note: note, createdAt: new Date().toISOString(), createdBy: whoBy(), history: [] };
    if (o.kind === 'block') {
      var codes = (o.sites || []).filter(canSite), from = o.from, to = o.to || o.from;
      if (!codes.length) return { ok: false, msg: 'Pick at least one of your sites.' };
      if (!from || !/^\d{4}-\d\d-\d\d$/.test(from) || !/^\d{4}-\d\d-\d\d$/.test(to)) return { ok: false, msg: 'Pick the dates.' };
      if (to < from) return { ok: false, msg: 'The last day is before the first day.' };
      if (daysBetween(from, to) > 92) return { ok: false, msg: 'Pick at most 3 months at a time.' };
      if (!leadOk(from)) return { ok: false, lead: true, msg: leadMsg() };
      r.sites = codes; r.from = from; r.to = to; r.site = codes.join(', ');
    } else {
      if (!canSite(o.site)) { audit('Blocked calendar request (not own site)', ME.name, o.site || ''); save(); return { ok: false, msg: 'Not allowed – you can only change your own sites.' }; }
      var v = findVisit(o.site + '|' + o.date, o.date);
      if (!v || v.status !== 'scheduled') return { ok: false, msg: 'That visit is not on the schedule any more.' };
      if (!leadOk(v.date)) return { ok: false, lead: true, msg: leadMsg() };
      if (pendFor(o.site, v.orig)) return { ok: false, msg: 'This visit already has a request waiting for the office.' };
      r.site = o.site; r.date = v.orig; r.visitDate = v.date;
      if (o.kind === 'change') {
        if (!o.newDate || !/^\d{4}-\d\d-\d\d$/.test(o.newDate)) return { ok: false, msg: 'Pick the new date.' };
        if (o.newStart && !/^\d\d:\d\d$/.test(o.newStart)) return { ok: false, msg: 'Pick a valid time.' };
        if (!leadOk(o.newDate)) return { ok: false, lead: true, msg: leadMsg() };
        if (o.newDate === v.date && (!o.newStart || o.newStart === v.start)) return { ok: false, msg: 'Pick a different date or time.' };
        r.newDate = o.newDate; r.newStart = o.newStart || v.start;
      } else if (o.kind !== 'cancel') return { ok: false, msg: 'Unknown request.' };
    }
    var applyNow = auto() && (r.kind === 'cancel' || r.kind === 'block');
    r.no = reqNo(); r.status = applyNow ? 'approved' : 'pending'; r.auto = applyNow;
    reqs().unshift(r);
    var what = desc(r);
    audit('Calendar request ' + (applyNow ? '(applied – ' + LEAD + '+ days notice)' : 'sent'), r.site, r.no + ' ' + what);
    if (applyNow) apply(r, 'Applied automatically (' + LEAD + '+ days’ notice)');
    notify('admin', 'Calendar ' + (applyNow ? 'update' : 'request') + ' ' + r.no + ' from ' + ME.name + ': ' + what + (applyNow ? ' – applied (client gave ' + LEAD + '+ days’ notice).' : ' – waiting for the office.'), 'cal|' + r.id + '|new');
    save(); return { ok: true, req: r, msg: applyNow ? 'Done – ' + what + '. The office has been told.' : 'Sent – the office will reply. Status: pending.' };
  };
  function whoBy() { var L = typeof clLoginOf === 'function' ? clLoginOf(ME) : ME; if (L && L !== ME && L.team) return L.name + ' (' + (L.loginRole || 'Team') + ')'; return (L && L.name && L !== ME ? L.name : ME.name) + ' (main account)'; }
  window.calWhoBy = whoBy;
  function desc(r) {
    if (r.kind === 'block') return 'no cleaners ' + (r.from === r.to ? 'on ' + dShort(r.from) : dShort(r.from) + ' – ' + dShort(r.to)) + ' at ' + r.sites.join(', ');
    if (r.kind === 'cancel') return 'cancel the ' + r.site + ' visit on ' + dShort(r.visitDate || r.date);
    return 'move the ' + r.site + ' visit on ' + dShort(r.visitDate || r.date) + ' to ' + dShort(r.newDate) + (r.newStart ? ' ' + t12(r.newStart) : '');
  }
  window.calDesc = desc;
  function apply(r, why) {
    if (r.kind === 'block') {
      blocks().push({ id: uid('cb'), reqId: r.id, firmId: r.firmId, sites: r.sites.slice(), from: r.from, to: r.to, note: r.note, status: 'approved', at: new Date().toISOString() });
      r.sites.forEach(function (c) { tellCrew(c, 'Schedule change at ' + c + ': NO cleaning ' + (r.from === r.to ? 'on ' + dShort(r.from) : 'from ' + dShort(r.from) + ' to ' + dShort(r.to)) + ' – client request.', 'cal|' + r.id + '|crew'); });
    } else if (r.kind === 'cancel') {
      setOv({ id: uid('co'), site: r.site, date: r.date, type: 'cancel', reason: 'Client request' + (r.note ? ': ' + r.note : ''), reqId: r.id, by: ME ? ME.name : '', at: new Date().toISOString() });
      tellCrew(r.site, 'Schedule change at ' + r.site + ': NO cleaning on ' + dShort(r.visitDate || r.date) + ' – client request.', 'cal|' + r.id + '|crew');
    } else {
      setOv({ id: uid('co'), site: r.site, date: r.date, type: 'move', newDate: r.newDate, newStart: r.newStart, reqId: r.id, by: ME ? ME.name : '', at: new Date().toISOString() });
      tellCrew(r.site, 'Schedule change at ' + r.site + ': the ' + dShort(r.visitDate || r.date) + ' visit moved to ' + dShort(r.newDate) + (r.newStart ? ' ' + t12(r.newStart) : '') + '.', 'cal|' + r.id + '|crew');
    }
    r.history.push({ at: new Date().toISOString(), by: ME ? ME.name : 'system', what: why || 'Applied' });
  }
  // office: approve / decline a pending request
  window.calDecide = function (id, approve, note) {
    if (!canManage()) return { ok: false, msg: 'Only the owner, admin or operations can decide calendar requests.' };
    var r = reqs().filter(function (x) { return x.id === id; })[0]; if (!r) return { ok: false, msg: 'Request not found.' };
    if (r.status !== 'pending') return { ok: false, msg: 'Already ' + r.status + '.' };
    note = String(note || '').trim().slice(0, 300);
    if (approve && r.kind !== 'block') { var v = findVisit(r.site + '|' + r.date, r.visitDate || r.date); if (!v || v.status !== 'scheduled') { return { ok: false, msg: 'That visit has changed since – decline it with a note.' }; } }
    r.status = approve ? 'approved' : 'declined'; r.officeNote = note; r.decidedAt = new Date().toISOString(); r.decidedBy = ME.name;
    if (approve) apply(r, 'Approved by ' + ME.name + (note ? ': ' + note : '')); else r.history.push({ at: r.decidedAt, by: ME.name, what: 'Declined' + (note ? ': ' + note : '') });
    audit('Calendar request ' + r.status, r.site, r.no + ' ' + desc(r) + (note ? ' – note: ' + note : ''));
    notify(r.firmId, 'Your calendar request ' + r.no + ' (' + desc(r) + ') was ' + r.status.toUpperCase() + ' by the office.' + (note ? ' Note: ' + note : ''), 'cal|' + r.id + '|' + r.status);
    save(); return { ok: true, req: r };
  };
  // office: move / cancel / restore a visit directly
  window.calOffice = function (o) {
    if (!canManage()) return { ok: false, msg: 'Only the owner, admin or operations can change visits.' };
    var s = site(o.site); if (!s) return { ok: false, msg: 'Site not found.' };
    var cur = ovFor(o.site, o.date), when = dShort(o.date), note = String(o.note || '').trim().slice(0, 300), txt;
    if (o.type === 'restore') {
      if (!cur) return { ok: false, msg: 'Nothing to restore.' };
      setOv({ site: o.site, date: o.date }); txt = 'the ' + when + ' visit is back on the schedule' + (cur.type === 'move' ? ' (no longer moved to ' + dShort(cur.newDate) + ')' : '');
    } else {
      if (!(reg(s, o.date) > 0)) return { ok: false, msg: 'No regular visit that day.' };
      if (o.type === 'cancel') { setOv({ id: uid('co'), site: o.site, date: o.date, type: 'cancel', reason: 'Office' + (note ? ': ' + note : ''), by: ME.name, at: new Date().toISOString() }); txt = 'NO cleaning on ' + when + ' (cancelled by the office' + (note ? ': ' + note : '') + ')'; }
      else if (o.type === 'move') {
        if (!o.newDate || !/^\d{4}-\d\d-\d\d$/.test(o.newDate)) return { ok: false, msg: 'Pick the new date.' };
        setOv({ id: uid('co'), site: o.site, date: o.date, type: 'move', newDate: o.newDate, newStart: o.newStart || s.visitStart || '', by: ME.name, at: new Date().toISOString() });
        txt = 'the ' + when + ' visit moved to ' + dShort(o.newDate) + (o.newStart ? ' ' + t12(o.newStart) : '');
      } else return { ok: false, msg: 'Unknown action.' };
    }
    var key = 'cal|off|' + o.site + '|' + o.date + '|' + Date.now();
    audit('Calendar visit ' + (o.type === 'restore' ? 'restored' : o.type === 'move' ? 'moved' : 'cancelled') + ' by office', o.site, txt);
    if (s.firmId) notify(s.firmId, 'Schedule change at ' + o.site + ': ' + txt + '.', key);
    tellCrew(o.site, 'Schedule change at ' + o.site + ': ' + txt + '.', key + '|crew');
    save(); return { ok: true };
  };

  /* ---------- calendar UI ---------- */
  function isCl() { return !!(ME && ME.type === 'firm'); }
  function amt(v) { if (v.wax) return 'Waxing'; return isCl() ? 'Regular cleaning' : hh(v.hours) + ' h'; }   // owner Oct 21: clients never see hours
  function cls(v) { if (v.wax) return v.date < today() ? 'wax done' : 'wax'; return v.status === 'cancelled' || v.status === 'blocked' ? 'off' : v.status === 'moved' ? 'mv' : v.pending ? 'pend' : v.done === 'Done' ? 'done' : v.done === 'Missed' ? 'miss' : 'on'; }
  function label(v) {
    if (v.wax) return 'Waxing – confirmed by the office';
    if (v.hand && ME && ME.type !== 'firm') return v.hand;
    if (v.status === 'cancelled' || v.status === 'blocked') return ME && ME.type === 'firm' ? (v.status === 'blocked' ? 'No cleaners – your request' : 'Cancelled') : 'No cleaning – ' + (v.reason && /^Office/.test(v.reason) ? 'office' : 'client request');
    if (v.status === 'moved') return 'Moved to ' + dShort(v.movedTo) + (v.movedStart ? ' ' + t12(v.movedStart) : '');
    if (v.movedFrom) return 'Moved here from ' + dShort(v.movedFrom);
    if (v.pending) return 'Request pending – ' + (v.pending.kind === 'cancel' ? 'cancel' : 'change');
    if (v.done) return v.done === 'Not marked' ? 'Past visit' : v.done;
    return 'Scheduled';
  }
  function chip(v, big) {
    return '<button type="button" class="calchip c-' + cls(v) + '" data-act="calvisit" data-id="' + esc(v.id) + '" data-date="' + esc(v.date) + '"><b>' + esc(v.site) + '</b>' + (big ? '<span>' + (v.start ? t12(v.start) + ' · ' : '') + amt(v) + '</span><em>' + esc(label(v)) + '</em>' : (v.start && cls(v) !== 'off' ? '<span>' + t12(v.start) + '</span>' : '')) + '</button>';
  }
  function agendaRow(v) {
    return '<button type="button" class="calrow c-' + cls(v) + '" data-act="calvisit" data-id="' + esc(v.id) + '" data-date="' + esc(v.date) + '"><span class="calbar"></span><span class="caltime">' + (v.start ? t12(v.start) : '–') + '<small>' + (isCl() ? '' : hh(v.hours) + ' h') + '</small></span>' +
      '<span class="calwhat"><b>' + esc(v.site) + ' · ' + (v.wax ? 'Waxing' : isCl() ? 'Regular cleaning' : esc(v.name)) + '</b><small>' + esc(label(v)) + (v.crew && ME.type !== 'firm' ? '' : '') + '</small></span><span class="calgo">›</span></button>';
  }
  function header(title) {
    var vs = [['month', 'Month'], ['week', 'Week'], ['day', 'Day']];
    return '<div class="calhead"><div class="caltitle"><h2 id="caltitle">' + title + '</h2></div>' +
      '<div class="calctl"><button type="button" class="calbtn" data-act="calnav" data-dir="-1" aria-label="Previous">‹</button><button type="button" class="calbtn caltoday" data-act="caltoday">Today</button><button type="button" class="calbtn" data-act="calnav" data-dir="1" aria-label="Next">›</button></div>' +
      '<div class="calseg" role="tablist">' + vs.map(function (x) { return '<button type="button" role="tab" data-act="calview" data-v="' + x[0] + '" class="' + (ST.view === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div></div>';
  }
  function monthView() {
    var c = parseD(ST.cur), first = isoLocal(new Date(c.getFullYear(), c.getMonth(), 1)), start = addDays(first, -dIdx(first)), end = addDays(start, 41);
    var all = visits(start, end, viewSites()), by = {}; all.forEach(function (v) { (by[v.date] = by[v.date] || []).push(v); });
    var g = '<div class="calgrid calmonth"><div class="caldow">' + DOW.map(function (d) { return '<span>' + d.charAt(0) + '<i>' + d.slice(1) + '</i></span>'; }).join('') + '</div><div class="calcells">';
    for (var i = 0; i < 42; i++) {
      var d = addDays(start, i), l = by[d] || [], out = d.slice(0, 7) !== first.slice(0, 7);
      if (i === 35 && out) break;
      g += '<button type="button" class="calcell' + (out ? ' out' : '') + (d === today() ? ' today' : '') + (d === ST.sel ? ' sel' : '') + '" data-act="calday" data-date="' + d + '" data-n="' + esc(l.length) + '"><span class="calnum">' + parseD(d).getDate() + '</span>' +
        '<span class="caldots">' + l.slice(0, 4).map(function (v) { return '<i class="c-' + cls(v) + '"></i>'; }).join('') + '</span>' +
        '<span class="calchips">' + l.slice(0, 3).map(function (v) { return '<em class="c-' + cls(v) + '">' + esc(v.site) + '</em>'; }).join('') + (l.length > 3 ? '<em class="more">+' + (l.length - 3) + '</em>' : '') + '</span></button>';
    }
    g += '</div></div>';
    var sel = (by[ST.sel] || []);
    return '<div class="calsplit">' + g + '<div class="calagenda" id="calagenda"><h3>' + dLong(ST.sel) + (ST.sel === today() ? ' <span class="pill s-ok">Today</span>' : '') + '</h3>' + (sel.length ? sel.map(agendaRow).join('') : '<p class="muted calempty">No cleaning scheduled.</p>') + '</div></div>';
  }
  function weekView() {
    var s = addDays(ST.cur, -dIdx(ST.cur)), all = visits(s, addDays(s, 6), viewSites());
    var x = '<div class="calweek">';
    for (var i = 0; i < 7; i++) {
      var d = addDays(s, i), l = all.filter(function (v) { return v.date === d; });
      x += '<div class="calwday' + (d === today() ? ' today' : '') + '" data-date="' + d + '"><button type="button" class="calwhead" data-act="calday" data-date="' + d + '" data-go="day"><span>' + DOW[i] + '</span><b>' + parseD(d).getDate() + '</b></button><div class="calwlist">' + (l.length ? l.map(function (v) { return chip(v, true); }).join('') : '<span class="calnone">No cleaning</span>') + '</div></div>';
    }
    return x + '</div>';
  }
  function dayView() {
    var d = ST.cur, l = visits(d, d, viewSites()), timed = l.filter(function (v) { return v.start; });
    var h0 = 16, h1 = 24; timed.forEach(function (v) { var a = +v.start.slice(0, 2); h0 = Math.min(h0, a); h1 = Math.max(h1, Math.min(24, Math.ceil(a + (+v.start.slice(3, 5)) / 60 + v.hours))); });
    var px = 56, x = '<div class="calday"><div class="caldayhd"><b>' + dLong(d) + '</b>' + (d === today() ? ' <span class="pill s-ok">Today</span>' : '') + ' <span class="muted small">' + l.filter(function (v) { return cls(v) !== 'off' && v.status !== 'moved'; }).length + ' visit(s)</span></div>';
    var off = l.filter(function (v) { return !v.start || cls(v) === 'off' || v.status === 'moved'; });
    if (off.length) x += '<div class="calallday">' + off.map(function (v) { return chip(v, true); }).join('') + '</div>';
    x += '<div class="caltl" style="height:' + ((h1 - h0) * px) + 'px">';
    for (var h = h0; h < h1; h++) x += '<div class="calhr" style="top:' + ((h - h0) * px) + 'px"><span>' + t12(pad(h % 24) + ':00') + '</span></div>';
    if (d === today()) { var n = new Date(), nm = n.getHours() + n.getMinutes() / 60; if (nm >= h0 && nm <= h1) x += '<div class="calnow" style="top:' + ((nm - h0) * px) + 'px"></div>'; }
    var lanes = timed.filter(function (v) { return cls(v) !== 'off' && v.status !== 'moved'; });
    lanes.forEach(function (v, i) { var a = +v.start.slice(0, 2) + (+v.start.slice(3, 5)) / 60; x += '<button type="button" class="calev c-' + cls(v) + '" data-act="calvisit" data-id="' + esc(v.id) + '" data-date="' + esc(v.date) + '" style="top:' + ((a - h0) * px) + 'px;height:' + Math.max(28, v.hours * px - 4) + 'px;left:calc(64px + ' + (i % 3) * 4 + '%)"><b>' + esc(v.site) + ' · ' + (v.wax ? 'Waxing' : isCl() ? 'Regular cleaning' : esc(v.name)) + '</b><span>' + t12(v.start) + (v.wax ? ' · Waxing' : isCl() ? ' · Regular cleaning' : ' – ' + t12(addH(v.start, v.hours)) + ' · ' + hh(v.hours) + ' h') + (v.movedFrom ? ' · moved from ' + dShort(v.movedFrom) : '') + (v.pending ? ' · request pending' : '') + '</span></button>'; });
    if (!l.length) x += '<p class="muted calempty" style="position:absolute;top:40%;left:0;right:0;text-align:center">No cleaning scheduled.</p>';
    return x + '</div></div>';
  }
  function legend() { return '<div class="callegend"><span><i class="c-on"></i>Scheduled</span><span><i class="c-done"></i>Done</span><span><i class="c-pend"></i>Request pending</span><span><i class="c-mv"></i>Moved</span><span><i class="c-off"></i>No cleaning</span><span><i class="c-wax"></i>Waxing</span></div>'; }
  function calendar(opts) {
    opts = opts || {};
    if (!ST.cur) ST.cur = today(); if (!ST.sel) ST.sel = ST.cur;
    var c = parseD(ST.cur), title;
    if (ST.view === 'month') title = MON[c.getMonth()] + ' <span>' + c.getFullYear() + '</span>';
    else if (ST.view === 'week') { var s = addDays(ST.cur, -dIdx(ST.cur)), e = addDays(s, 6); title = MON[parseD(s).getMonth()].slice(0, 3) + ' ' + parseD(s).getDate() + ' – ' + (s.slice(5, 7) !== e.slice(5, 7) ? MON[parseD(e).getMonth()].slice(0, 3) + ' ' : '') + parseD(e).getDate() + ' <span>' + e.slice(0, 4) + '</span>'; }
    else title = DOW[dIdx(ST.cur)] + ' ' + MON[c.getMonth()].slice(0, 3) + ' ' + c.getDate() + ' <span>' + c.getFullYear() + '</span>';
    var filt = '';
    if (ME.type === 'admin' || mySites().length > 1) filt = '<div class="calfilter"><label class="small muted" for="calsite">Site</label><select id="calsite" data-calsite="1"><option value="">All ' + (ME.type === 'admin' ? 'sites' : 'my sites') + ' (' + mySites().length + ')</option>' + mySites().map(function (s) { return '<option value="' + esc(s.code) + '"' + (ST.site === s.code ? ' selected' : '') + '>' + esc(s.code + ' – ' + s.name) + '</option>'; }).join('') + '</select></div>';
    var body = ST.view === 'month' ? monthView() : ST.view === 'week' ? weekView() : dayView();
    return '<div class="card calwrap cal-' + esc(ST.view) + '" id="calwrap" data-view="' + esc(ST.view) + '">' + header(title) + filt + '<div class="calbody" id="calbody">' + body + '</div>' + legend() + (opts.foot || '') + '</div>';
  }
  window.calendarHtml = calendar;
  function testTag() { return window.REG_STORE && window.REG_STORE.mode === 'mock' ? '<span class="caltest">TEST data</span>' : ''; }

  /* ---------- client home: infographics + calendar ---------- */
  function ring(parts, total, center, sub) {
    var R = 42, C = 2 * Math.PI * R, off = 0, segs = '';
    parts.forEach(function (p) { if (!p.n || !total) return; var len = C * p.n / total; segs += '<circle r="' + R + '" cx="50" cy="50" fill="none" stroke="' + esc(p.c) + '" stroke-width="12" stroke-dasharray="' + Math.max(0, len - 1.5).toFixed(2) + ' ' + (C - Math.max(0, len - 1.5)).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 50 50)"/>'; off += len; });
    return '<svg viewBox="0 0 100 100" class="calring" role="img" aria-label="' + esc(center + ' ' + sub) + '"><circle r="' + R + '" cx="50" cy="50" fill="none" stroke="#eef1f5" stroke-width="12"/>' + segs + '<text x="50" y="49" text-anchor="middle" class="rn">' + esc(center) + '</text><text x="50" y="63" text-anchor="middle" class="rs">' + esc(sub) + '</text></svg>';
  }
  function clientDash() {
    var my = mySites(), t = today(), m0 = t.slice(0, 8) + '01', m1 = addDays(isoLocal(new Date(+t.slice(0, 4), +t.slice(5, 7), 1)), -1);
    var mv = visits(m0, m1, my), up = visits(t, addDays(t, 60), my).filter(function (v) { return v.status === 'scheduled' && (v.date > t || !v.start || v.start >= pad(new Date().getHours()) + ':' + pad(new Date().getMinutes())); });
    var nx = up[0], live = mv.filter(function (v) { return v.status !== 'moved'; });
    var done = live.filter(function (v) { return v.done === 'Done' || v.done === 'Partial'; }), miss = live.filter(function (v) { return v.done && v.done !== 'Done' && v.done !== 'Partial'; }), upc = live.filter(function (v) { return v.status === 'scheduled' && !v.done; }), off = live.filter(function (v) { return cls(v) === 'off'; });
    var plan = live.filter(function (v) { return cls(v) !== 'off'; }).reduce(function (a, v) { return a + v.hours; }, 0), got = done.reduce(function (a, v) { return a + v.hours; }, 0), pct = plan ? Math.min(100, Math.round(got / plan * 100)) : 0;
    var open = reqs().filter(function (r) { return r.firmId === ME.id; });
    var x = '<div class="caldash" id="caldash">';
    x += '<div class="calhero" id="calnext"><div class="calhero-k">Next cleaning ' + testTag() + '</div>' + (nx ? '<div class="calhero-d">' + dLong(nx.date) + '</div><div class="calhero-t">' + (nx.start ? t12(nx.start) : 'Time not set') + '</div><div class="calhero-m"><span>' + esc(nx.site) + ' · ' + esc(nx.name) + '</span><span>Regular cleaning</span>' + (nx.crew ? '<span>' + nx.crew + ' cleaner' + (nx.crew > 1 ? 's' : '') + ' assigned</span>' : '') + (lead(nx.date) === 0 ? '<span>Today</span>' : lead(nx.date) === 1 ? '<span>Tomorrow</span>' : '<span>in ' + lead(nx.date) + ' days</span>') + '</div>' + (nx.movedFrom ? '<div class="calhero-n">Moved from ' + dShort(nx.movedFrom) + '</div>' : '') : '<div class="calhero-d">No cleaning scheduled</div><div class="calhero-m"><span>' + (my.length ? 'Your sites have no upcoming regular visits.' : 'No sites on your account yet.') + '</span></div>') +
      '<div class="calhero-a"><button type="button" class="small" data-act="calblock">No cleaners on these dates</button></div></div>';
    x += '<div class="caltiles">';
    var sched = live.filter(function (v) { return cls(v) !== 'off'; }).length, vp = sched ? Math.min(100, Math.round(done.length / sched * 100)) : 0;
    x += '<div class="caltile calwide2" id="calvisitstile"><div class="calk">Visits this month</div><div class="calbig">' + done.length + '<small> of ' + sched + ' done</small></div><div class="calmeter"><span style="width:' + vp + '%"></span></div>' +
      '<ul class="calkeys calkeys-row"><li><i style="background:#8AC53F"></i>Done <b>' + done.length + '</b></li><li><i style="background:#426CB4"></i>Upcoming <b>' + upc.length + '</b></li>' + (off.length ? '<li><i style="background:#c9ced6"></i>Cancelled <b>' + off.length + '</b></li>' : '') + (miss.length ? '<li><i style="background:#e5a33b"></i>Not confirmed <b>' + miss.length + '</b></li>' : '') + '</ul></div>';
    var pend = open.filter(function (r) { return r.status === 'pending'; }).length;
    x += '<div class="caltile" id="calreqtile"><div class="calk">My requests</div><div class="calbig">' + pend + '<small> pending</small></div>' + (open.length ? '<ul class="calreqs">' + open.slice(0, 3).map(function (r) { return '<li><span class="pill ' + (r.status === 'approved' ? 's-ok' : r.status === 'declined' ? 's-bad' : 's-pend') + '">' + r.status + '</span> ' + esc((r.createdBy ? String(r.createdBy).split(' (')[0] + ': ' : '') + (r.kind === 'block' ? 'No cleaners ' + dShort(r.from) + (r.to !== r.from ? '–' + dShort(r.to) : '') : (r.kind === 'cancel' ? 'Cancel ' : 'Move ') + r.site + ' ' + dShort(r.visitDate || r.date))) + '</li>'; }).join('') + '</ul>' : '<div class="small muted">None yet. Tap a visit to change or cancel it.</div>') + '</div>';
    var inv = null; try { if (typeof clientInvs === 'function' && !(typeof cjtIsTeam === 'function' && cjtIsTeam())) { var il = clientInvs(ME).filter(function (i) { return typeof invAllowed !== 'function' || invAllowed(i); }); inv = il.sort(function (a, b) { return (a.issued || '') < (b.issued || '') ? 1 : -1; })[0] || null; } } catch (e) { inv = null; }
    if (inv) { var st = typeof invPlain === 'function' ? invPlain(inv) : { t: inv.paidAt ? 'Paid' : 'Open', c: '' }; x += '<div class="caltile" id="calinvtile"><div class="calk">Latest invoice</div><div class="calbig">' + money(inv.total) + '</div><div><span class="pill ' + esc(st.c || '') + '">' + esc(st.t) + '</span> <span class="small muted">' + esc(inv.number || '') + '</span></div><a class="small" href="#/invoices">See invoices ›</a></div>'; }
    var wk = DOW.map(function (d, i) { var h = my.reduce(function (a, s) { return a + (s.regHours ? (+s.regHours[i] || 0) : 0); }, 0); return '<li class="' + (h > 0 ? 'on' : '') + (i === dIdx(t) ? ' now' : '') + '"><span>' + d.charAt(0) + '</span><i></i><small>' + (h > 0 ? '✓' : '–') + '</small></li>'; }).join('');
    x += '<div class="caltile calwide" id="calpattern"><div class="calk">Your regular week</div><ul class="calstrip">' + wk + '</ul></div>';
    x += '</div>';
    var nt = (DB.notes || []).filter(function (n) { return n.to === ME.id && /^(cal|cjt)\|/.test(n.key || '') && (typeof cjtNoteOk !== 'function' || cjtNoteOk(n)); }).slice(0, 3);
    if (nt.length) x += '<div class="calupd" id="calupdates"><div class="calk">Updates</div>' + nt.map(function (n) { return '<div class="calupd-i"><span>🔔</span><div>' + esc(n.text) + '<small>' + fmtStamp(n.at) + '</small></div></div>'; }).join('') + '</div>';
    return x + '</div>';
  }
  function clientHome() {
    return '<div class="calpage"><div class="calpagehd"><h2 class="calh1">Your cleaning schedule</h2><p class="muted small">Tap a cleaning to change or cancel it. Changes need at least ' + LEAD + ' days’ notice.</p><div class="calbar2"><a class="btn big" id="calchangebtn" href="#/calendar" data-act="calchange">＋ Request a day change of cleaning</a><a class="btn big sec" id="calspecialbtn" href="#/requests" data-act="cropen" data-k="special">＋ Request special cleaning</a><a class="btn big calwaxbtn" id="calwaxbtn" href="#/calendar" data-act="calwax">＋ Schedule waxing</a></div></div>' + clientDash() + calendar() + '</div>';
  }

  /* ---------- office: requests inbox ---------- */
  function inbox(compact) {
    var l = reqs(), pend = l.filter(function (r) { return r.status === 'pending'; }), rest = l.filter(function (r) { return r.status !== 'pending'; }).slice(0, compact ? 5 : 40);
    var row = function (r) {
      return '<div class="calreq st-' + esc(r.status) + '" data-req="' + esc(r.no) + '"><div class="calreq-h"><b>' + esc(r.no) + '</b> <span class="pill ' + (r.status === 'approved' ? 's-ok' : r.status === 'declined' ? 's-bad' : 's-pend') + '">' + esc(r.status) + (r.auto ? ' · applied automatically' : '') + '</span><span class="small muted"> ' + esc(r.firmName) + ' · by ' + esc(r.createdBy || r.firmName) + ' · ' + fmtStamp(r.createdAt) + '</span></div>' +
        '<div>' + esc(desc(r)) + '</div>' + (r.note ? '<div class="small muted">Client note: ' + esc(r.note) + '</div>' : '') + (r.officeNote ? '<div class="small">Office note: ' + esc(r.officeNote) + '</div>' : '') +
        (r.status === 'pending' && canManage() ? '<div class="row calreq-a"><input type="text" maxlength="300" placeholder="Note to the client (optional)" id="calnote-' + esc(r.id) + '"><button type="button" class="small" data-act="caldecide" data-id="' + esc(r.id) + '" data-ok="1">Approve</button><button type="button" class="small sec" data-act="caldecide" data-id="' + esc(r.id) + '" data-ok="0">Decline</button></div>' : '') + '</div>';
    };
    return '<div class="card calinbox" id="calinbox"><h2>Calendar requests <span class="pill ' + (pend.length ? 's-pend' : 's-ok') + '">' + pend.length + ' waiting</span></h2>' +
      (canManage() ? '<label class="calsw"><input type="checkbox" data-calauto="1"' + (auto() ? ' checked' : '') + '> Cancellations and “no cleaners” dates with ' + LEAD + '+ days’ notice apply right away (office is notified). Date changes always wait for approval.</label>' : '<p class="small muted">Read-only: only the owner, admin or operations can decide requests.</p>') +
      (pend.length ? pend.map(row).join('') : '<p class="muted">No requests waiting.</p>') + (rest.length ? '<h3>Recent</h3>' + rest.map(row).join('') : '') + '</div>';
  }
  function officePage() { return '<div class="calpage"><h1>Cleaning calendar</h1><p class="muted small">All Chief Janitorial sites, from each site’s regular hours. Tap a visit to move or cancel it' + (canManage() ? '' : ' (read-only for your office role)') + '.</p><div class="caloffice">' + calendar() + inbox(true) + '</div></div>'; }
  function workerPage() {
    var my = mySites();
    return '<div class="calpage"><h1>My site calendar</h1><p class="muted small">' + (my.length ? 'Sites you are assigned to: ' + my.map(function (s) { return esc(s.code); }).join(', ') + '. Days marked “No cleaning” are off – do not go in.' : 'You are not assigned to any site yet. Ask the office.') + '</p>' + calendar() + '</div>';
  }
  VIEWS.calendar = function () { if (!ME) return ''; return ME.type === 'firm' ? clientHome() : ME.type === 'admin' ? officePage() : workerPage(); };
  VIEWS['admin:calrequests'] = function () { return '<div class="calpage"><h1>Calendar requests</h1><p class="muted small">Client requests to change, cancel or block cleaning dates. Approving updates the calendar and tells the client and the assigned cleaners.</p>' + inbox(false) + '</div>'; };
  if (typeof VIEWS['firm:home'] === 'function') { var ofh = VIEWS['firm:home']; VIEWS['firm:home'] = function (h) { var x = ofh(h); if (!ME || ME.type !== 'firm') return x; return clientHome() + x; }; }
  /* v2-declutter regroups the client home after render: keep the calendar page at the very top (owner: it is the opening screen) */
  if (typeof afterRender === 'function') { var oar = afterRender; afterRender = function (root) { oar.apply(this, arguments); try { if (!root || root.id === 'modal' || !ME || ME.type !== 'firm') return; var c = root.querySelector('.calpage'); if (c && c.parentNode && root.firstElementChild !== c) { var host = c.closest('#app') ? (root.querySelector('main') || root) : root; host.insertBefore(c, host.firstChild); } } catch (e) {} }; }
  function addNav(list, route, label, after) { if (!list || list.some(function (n) { return n[0] === route; })) return; var k = -1; list.forEach(function (n, i) { if (n[0] === after) k = i; }); list.splice(k >= 0 ? k + 1 : list.length, 0, [route, label]); }
  addNav(NAV.firm, '#/calendar', 'Cleaning calendar', '#/home'); addNav(NAV.admin, '#/calendar', 'Cleaning calendar', '#/home'); addNav(NAV.admin, '#/calrequests', 'Calendar requests', '#/calendar');
  addNav(NAV.employee, '#/calendar', 'My site calendar', '#/home'); addNav(NAV.worker, '#/calendar', 'My site calendar', '#/home'); addNav(NAV.sub, '#/calendar', 'Site calendar', '#/home');

  /* ---------- sheets (modals) ---------- */
  function sheetVisit(v) {
    var s = site(v.site), firm = ME.type === 'firm', h = '<div class="calsheet" id="calsheet"><div class="calsheet-k c-' + cls(v) + '">' + esc(label(v)) + '</div><h2>' + esc(v.site) + ' · ' + esc(v.name) + '</h2>' +
      '<div class="calfacts"><div><small>Date</small><b>' + dLong(v.date) + '</b></div><div><small>Time</small><b>' + (v.start ? t12(v.start) + (firm ? '' : ' – ' + t12(addH(v.start, v.hours))) : 'Not set') + '</b></div><div><small>' + (firm ? 'Service' : 'Crew hours') + '</small><b>' + (firm ? 'Regular cleaning' : hh(v.hours) + ' h') + '</b></div>' + (!firm || v.crew ? '<div><small>Cleaners</small><b>' + (firm ? v.crew + ' assigned' : liveCrew(s).map(function (i) { var u = user(i); return u ? esc(u.name) : '?'; }).join(', ') || 'None assigned') + '</b></div>' : '') + '</div>';
    if (v.reason) h += '<p class="small muted">' + esc(v.reason) + '</p>';
    if (v.pending) h += '<p class="calmsg pend">Request ' + esc(v.pending.no) + ' is waiting for the office: ' + esc(desc(v.pending)) + '.</p>';
    if (firm) {
      if (v.status === 'scheduled' && !v.pending && v.date >= today()) {
        if (!leadOk(v.date)) h += '<p class="calmsg bad" id="callead">' + esc(leadMsg()) + '</p>';
        else h += '<div class="calacts"><button type="button" data-act="calform" data-k="change" data-id="' + esc(v.id) + '" data-date="' + esc(v.date) + '">Request a different date or time</button><button type="button" class="sec" data-act="calform" data-k="cancel" data-id="' + esc(v.id) + '" data-date="' + esc(v.date) + '">Request cancellation</button><button type="button" class="sec" data-act="calblock" data-from="' + esc(v.date) + '">No cleaners on these dates…</button></div>';
      }
    } else if (ME.type === 'admin' && canManage() && v.date >= today()) {
      var o = ovFor(v.site, v.orig);
      h += '<form class="calform" onsubmit="return false"><div class="calfacts2"><label>Move to<input type="date" id="calmvdate" value="' + esc(v.date) + '"></label><label>Start<input type="time" id="calmvtime" value="' + esc(v.start) + '"></label></div><label>Note (optional)<input type="text" id="calofnote" maxlength="300"></label>' +
        '<div class="calacts">' + (o ? '<button type="button" data-act="caloff" data-t="restore" data-site="' + esc(v.site) + '" data-date="' + esc(v.orig) + '">Restore the regular visit</button>' : '') + (v.status === 'scheduled' ? '<button type="button" data-act="caloff" data-t="move" data-site="' + esc(v.site) + '" data-date="' + esc(v.orig) + '">Move visit</button><button type="button" class="danger" data-act="caloff" data-t="cancel" data-site="' + esc(v.site) + '" data-date="' + esc(v.orig) + '">Cancel visit</button>' : '') + '</div></form>';
    }
    return h + '</div>';
  }
  function sheetForm(v, k) {
    var min = addDays(today(), LEAD);
    return '<div class="calsheet" id="calsheet"><h2>' + (k === 'cancel' ? 'Request cancellation' : 'Request a different date or time') + '</h2><p class="small muted">' + esc(v.site) + ' · ' + dLong(v.date) + (v.start ? ' · ' + t12(v.start) : '') + '</p>' +
      '<form data-form="calreq" id="calreqform"><input type="hidden" name="kind" value="' + k + '"><input type="hidden" name="site" value="' + esc(v.site) + '"><input type="hidden" name="date" value="' + esc(v.orig) + '">' +
      (k === 'change' ? '<div class="calfacts2"><label>New date<input type="date" name="newDate" min="' + min + '" value="" required data-callead="1"></label><label>Start time<input type="time" name="newStart" value="' + esc(v.start) + '"></label></div>' : '') +
      '<label>Note to the office (optional)<textarea name="note" maxlength="300" placeholder="' + (k === 'cancel' ? 'e.g. store closed for inventory' : 'e.g. floors being waxed that night') + '"></textarea></label>' +
      '<p class="calmsg bad" id="callead" hidden></p>' + (k === 'cancel' ? '<p class="calmsg info" id="calpricenote">Your monthly price stays the same.</p>' : '') +
      '<p class="small muted">' + (k === 'change' ? 'The office approves date changes. You’ll get a notification.' : auto() ? 'With ' + LEAD + '+ days’ notice this applies right away and the office is told.' : 'The office will approve or decline it.') + '</p>' +
      '<div class="calacts"><button type="submit">' + (k === 'cancel' ? 'Cancel this cleaning' : 'Send request') + '</button><button type="button" class="sec" data-act="closeModal">Back</button></div></form></div>';
  }
  function sheetBlock(from) {
    var min = addDays(today(), LEAD), my = mySites(); from = from && from >= min ? from : '';
    return '<div class="calsheet" id="calsheet"><h2>No cleaners on these dates</h2><p class="small muted">Pick one day or a range. At least ' + LEAD + ' days’ notice (earliest ' + dLong(min) + ').</p>' +
      '<form data-form="calreq" id="calblockform"><input type="hidden" name="kind" value="block"><div class="calfacts2"><label>First day<input type="date" name="from" min="' + min + '" value="' + from + '" required data-callead="1"></label><label>Last day<input type="date" name="to" min="' + min + '" value="' + from + '" data-callead="1"></label></div>' +
      '<fieldset class="calsites"><legend class="small muted">Sites</legend>' + my.map(function (s) { return '<label class="calck"><input type="checkbox" name="site_' + esc(s.code) + '" value="1" checked> ' + esc(s.code + ' – ' + s.name) + '</label>'; }).join('') + '</fieldset>' +
      '<label>Reason (optional)<textarea name="note" maxlength="300" placeholder="e.g. holiday closure"></textarea></label><p class="calmsg bad" id="callead" hidden></p><p class="calmsg info" id="calpricenote">Your monthly price stays the same.</p>' +
      '<p class="small muted">' + (auto() ? 'This applies right away and the office and cleaners are told.' : 'The office will approve or decline it.') + '</p><div class="calacts"><button type="submit">Save – no cleaners</button><button type="button" class="sec" data-act="closeModal">Back</button></div></form></div>';
  }
  function sheetPick() {
    var t = today(), l = visits(addDays(t, LEAD), addDays(t, 60), mySites()).filter(function (v) { return v.status === 'scheduled' && !v.pending; }).slice(0, 80);
    return '<div class="calsheet" id="calsheet"><h2>Request a day change of cleaning</h2><p class="small muted">Pick the cleaning to move, then the new day. At least ' + LEAD + ' days’ notice. The office approves day changes. For anything sooner, contact the office: ' + esc(CO().phoneShort || '902-200-4888') + '.</p>' +
      '<form data-form="calreq" id="calpickform"><input type="hidden" name="kind" value="change"><label>Cleaning to move<select name="visit" required>' + (l.length ? l.map(function (v) { return '<option value="' + esc(v.site + '|' + v.orig) + '">' + esc(dShort(v.date) + (v.start ? ' ' + t12(v.start) : '') + ' – ' + v.site + ' · ' + v.name) + '</option>'; }).join('') : '<option value="">No cleanings 3+ days ahead</option>') + '</select></label>' +
      '<div class="calfacts2"><label>New day<input type="date" name="newDate" min="' + addDays(t, LEAD) + '" required data-callead="1"></label><label>Start time<input type="time" name="newStart"></label></div>' +
      '<label>Note to the office (optional)<textarea name="note" maxlength="300"></textarea></label><p class="calmsg bad" id="callead" hidden></p>' +
      '<div class="calacts"><button type="submit">Send request</button><button type="button" class="sec" data-act="closeModal">Back</button></div></form></div>';
  }
  ACT.calchange = function () { if (!ME || ME.type !== 'firm') return; modal(sheetPick()); };
  function leadCheck(form) {
    var m = form && form.querySelector('#callead'); if (!m) return true;
    var d = form.querySelector('[name=newDate]') || form.querySelector('[name=from]'), bad = d && d.value && !leadOk(d.value);
    m.hidden = !bad; m.textContent = bad ? leadMsg() : ''; var b = form.querySelector('button[type=submit]'); if (b) b.disabled = !!bad; return !bad;
  }
  ACT.calnav = function (el) { var n = +el.dataset.dir; if (ST.view === 'month') { var c = parseD(ST.cur); ST.cur = isoLocal(new Date(c.getFullYear(), c.getMonth() + n, 1)); ST.sel = ST.cur.slice(0, 7) === today().slice(0, 7) ? today() : ST.cur; } else { ST.cur = addDays(ST.cur, ST.view === 'week' ? 7 * n : n); ST.sel = ST.cur; } render(); };
  ACT.caltoday = function () { ST.cur = ST.sel = today(); render(); };
  ACT.calview = function (el) { ST.view = el.dataset.v; ST.cur = ST.sel || ST.cur; render(); };
  ACT.calday = function (el) { var d = el.dataset.date; ST.sel = d; if (el.dataset.go === 'day') { ST.view = 'day'; ST.cur = d; } else if (ST.view === 'month' && d.slice(0, 7) !== ST.cur.slice(0, 7)) ST.cur = d; render(); var a = document.getElementById('calagenda'); if (a && window.innerWidth < 900 && a.scrollIntoView) a.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); };
  ACT.calvisit = function (el) { var v = findVisit(el.dataset.id, el.dataset.date); if (!canVisit(v)) { toast('Not allowed – you can only see your own sites.'); return; } modal(sheetVisit(v)); };
  ACT.calform = function (el) { var v = findVisit(el.dataset.id, el.dataset.date); if (!v || ME.type !== 'firm') return; if (!leadOk(v.date)) { modal(sheetVisit(v)); return; } modal(sheetForm(v, el.dataset.k)); };
  ACT.calblock = function (el) { if (!ME || ME.type !== 'firm') return; modal(sheetBlock(el.dataset ? el.dataset.from : '')); };
  ACT.caldecide = function (el) { var n = document.getElementById('calnote-' + el.dataset.id), r = calDecide(el.dataset.id, el.dataset.ok === '1', n ? n.value : ''); toast(r.ok ? 'Request ' + r.req.no + ' ' + r.req.status + ' ✓ – client notified' : r.msg); render(); };
  ACT.caloff = function (el) { var g = function (i) { var e = document.getElementById(i); return e ? e.value : ''; }; var r = calOffice({ type: el.dataset.t, site: el.dataset.site, date: el.dataset.date, newDate: g('calmvdate'), newStart: g('calmvtime'), note: g('calofnote') }); toast(r.ok ? 'Saved ✓ – client and cleaners notified' : r.msg); if (r.ok) { closeModal(); render(); } };
  FORMS.calreq = function (f, d) {
    if (d.visit) { var pv = String(d.visit).split('|'); d.site = pv[0]; d.date = pv[1]; }
    var o = { kind: d.kind, site: d.site, date: d.date, newDate: d.newDate, newStart: d.newStart, from: d.from, to: d.to || d.from, note: d.note };
    if (d.kind === 'block') o.sites = mySites().filter(function (s) { return d['site_' + s.code]; }).map(function (s) { return s.code; });
    var r = calRequest(o);
    if (!r.ok) { var m = f.querySelector('#callead'); if (m) { m.hidden = false; m.textContent = r.msg; } toast(r.msg); return; }
    closeModal(); toast(r.msg); render();
  };
  if (!window.__calListen) {
    window.__calListen = 1;
    document.addEventListener('input', function (e) { var t = e.target; if (t && t.dataset && t.dataset.callead) { var f = t.form; if (t.name === 'from' && f.to && (!f.to.value || f.to.value < t.value)) f.to.value = t.value; leadCheck(f); } });
    document.addEventListener('change', function (e) {
      var t = e.target; if (!t || !t.dataset) return;
      if (t.dataset.callead) leadCheck(t.form);
      if (t.dataset.calsite) { ST.site = t.value; render(); }
      if (t.dataset.calauto && canManage()) { DB.settings.calAutoApply = !!t.checked; audit('Calendar setting changed', 'calAutoApply', t.checked ? 'Cancellations/blocks with ' + LEAD + '+ days notice apply right away' : 'All client requests wait for office approval'); save(); toast('Saved ✓'); render(); }
    });
    var sx = null, sy = null;
    document.addEventListener('touchstart', function (e) { var w = e.target.closest && e.target.closest('.calbody'); if (!w || e.touches.length !== 1) { sx = null; return; } sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    document.addEventListener('touchend', function (e) { if (sx == null) return; var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy; sx = null; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) ACT.calnav({ dataset: { dir: dx < 0 ? 1 : -1 } }); }, { passive: true });
  }

  /* ---------- mock seed (once; mock store only; FAKE data) ---------- */
  window.calSeed = function () { return false; };   /* live build: TEST seed stripped */
  if (typeof load === 'function') { var _ld = load; load = function () { var r = _ld.apply(this, arguments); try { if (calSeed()) save(); } catch (e) {} return r; }; }
  if (typeof resetData === 'function') { var _rd = resetData; resetData = function () { var r = _rd.apply(this, arguments); try { if (calSeed()) save(); } catch (e) {} return r; }; }
  try { if (typeof DB !== 'undefined' && DB && calSeed()) save(); } catch (e) {}
})();
