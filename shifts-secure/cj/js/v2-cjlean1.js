/* v2-cjlean1.js – CJ twin (TEST ONLY): "lean phase 1" (owner approved Oct 19 2026, 1:34 AM ET – test copy only).
   1. Visit checklist – cleaner #/visits "Today's visits": the CJ sites the cleaner is assigned to that have regular hours today
      (DB.sites[].regHours from v2-cjsitehours.js). Each visit has a short per-site checklist (DB.sites[].checklist, default list
      until the office edits it), Done / Partial / Missed, an optional note and a timestamp. Done/Partial also records the regular
      clean for the hours split (same as "I cleaned this site today"). Office #/dayvisits: the day's visits with status;
      office #/checklists: edit each site's checklist and assigned cleaners.
   2. Weekly client sign-off #/signoff (client + office): per site per week (Mon–Sun) – visits done (date, status, crew hours),
      sign with typed name + initials + date. Print / Save as PDF with the CJ company block (js/cj-company.js).
      Clients only see their own sites (same rule as invoices: office/owner + that client only).
   3. Complaints log – client #/issues "Report an issue" (site, what's wrong, optional photo name + notes) → office #/issuequeue
      with status New / In progress / Fixed, office note and optional follow-up visit date. Client sees own issues + status.
   Data (mock / browser only): DB.sites[].checklist, DB.sites[].crew, DB.visitLogs, DB.signoffs, DB.issues (+ DB.issueSeq).
   Live tables: migrations/cj-lean1-001.sql (draft, NOT RUN, needs owner OK). Loads after v2-cjinvowner.js. */
'use strict';
(function () {
  if (typeof NAV === 'undefined' || typeof VIEWS === 'undefined') return;
  var LN_DEFAULT = ['Empty garbage and replace liners', 'Clean and stock washrooms', 'Sweep and mop floors', 'Wipe counters, desks and touch points', 'Vacuum mats and carpets', 'Lock up and set the alarm'];
  var LN_ST = ['Done', 'Partial', 'Missed'], LN_PILL = { Done: 's-ok', Partial: 's-warn', Missed: 's-bad', '': 's-pend' };
  var IS_ST = ['New', 'In progress', 'Fixed'], IS_PILL = { New: 's-pend', 'In progress': 's-warn', Fixed: 's-ok' };
  var DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  function dIdx(d) { return (parseD(d).getDay() + 6) % 7; }
  function weekStart(d) { return addDays(d, -dIdx(d)); }
  function site(code) { return (DB.sites || []).filter(function (s) { return s.code === code; })[0] || null; }
  function sites() { return (typeof companySites === 'function' ? companySites({ skipPractice: true }) : (DB.sites || []).filter(function (s) { return s.code !== 'TEST-PRACTICE'; })); }
  function reg(code, d) { return typeof shReg === 'function' ? shReg(code, d) : 0; }
  function hh(h) { return typeof shH === 'function' ? shH(h) : String(h); }
  function tasks(s) { return s && s.checklist && s.checklist.length ? s.checklist : LN_DEFAULT; }
  function logs() { return DB.visitLogs = DB.visitLogs || []; }
  function sos() { return DB.signoffs = DB.signoffs || []; }
  function issues() { return DB.issues = DB.issues || []; }
  function isCleaner(u) { return u && (u.type === 'employee' || u.type === 'worker'); }
  function logFor(uid, code, d) { return logs().filter(function (l) { return l.userId === uid && l.site === code && l.date === d; })[0] || null; }
  function canSite(code) { var s = site(code); return !!(s && ME && (ME.type === 'admin' || (ME.type === 'firm' && s.firmId === ME.id))); }
  function noAccess(what) { toast('Not allowed – you can only see your own sites.'); if (ME) { audit('Blocked access (not own site)', ME.name, what || ''); save(); } }
  function hm(iso) { var d = new Date(iso); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  /* the cleaner's visits for a day: assigned sites (site.crew) with regular hours that day */
  function visitsFor(u, d) { return sites().filter(function (s) { return (s.crew || []).indexOf(u.id) >= 0 && reg(s.code, d) > 0; }); }
  window.lnVisitsFor = visitsFor; window.LN_DEFAULT_TASKS = LN_DEFAULT;

  /* ---------- 1a. cleaner: Today's visits ---------- */
  function visitCard(u, s, d) {
    var l = logFor(u.id, s.code, d), t = tasks(s), done = (l && l.tasks) || [];
    return '<div class="crcard lnvisit' + (l ? ' st-' + l.status.toLowerCase() : '') + '" data-site="' + esc(s.code) + '"><form class="lnform" onsubmit="return false">' +
      '<div class="cr-head"><b>' + esc(typeof cjSiteLabel === 'function' ? cjSiteLabel(s) : s.code) + '</b><span class="pill ' + LN_PILL[l ? l.status : ''] + '">' + (l ? esc(l.status) + ' · ' + hm(l.at) : 'Not marked yet') + '</span></div>' +
      '<div class="small muted">' + hh(reg(s.code, d)) + ' h regular clean today</div>' +
      '<div class="lntasks">' + t.map(function (x, i) { return chk('t' + i, esc(x), l ? done.indexOf(x) >= 0 : false, { value: '1' }); }).join('') + '</div>' +
      '<div><label>Note (optional)</label><textarea name="note" maxlength="500" placeholder="e.g. back room locked, could not mop">' + esc(l ? l.note || '' : '') + '</textarea></div>' +
      '<div class="row lnbtns">' + LN_ST.map(function (st) { return '<button type="button" class="small' + (st === 'Done' ? '' : ' sec') + '" data-act="lnmark" data-st="' + st + '" data-site="' + esc(s.code) + '">' + (st === 'Done' ? '✓ ' : st === 'Partial' ? '◐ ' : '✗ ') + st + '</button>'; }).join('') + '</div>' +
      (l ? '<div class="small muted">Marked ' + esc(l.status) + ' at ' + fmtStamp(l.at) + (l.edits ? ' (changed ' + l.edits + '×)' : '') + '</div>' : '') + '</form></div>';
  }
  function visitsView() {
    var u = ME, d = today(), v = visitsFor(u, d);
    var x = '<h1>Today’s visits</h1><p class="muted">' + esc(shortDay(d)) + ' · your assigned Chief Janitorial sites with a regular clean today. Tick the tasks you did and mark each visit Done, Partial or Missed.</p>';
    if (PAGE_STATE.lnDone) { x += '<div class="alert ok small" id="lndone">' + PAGE_STATE.lnDone + '</div>'; PAGE_STATE.lnDone = null; }
    if (!v.length) return x + '<p class="muted" id="lnnone">No visits assigned to you today. If you cleaned a site anyway, use “Unusual day – log my hours” on your home screen.</p>';
    var n = v.filter(function (s) { return logFor(u.id, s.code, d); }).length;
    return x + '<p class="small" id="lncount"><b>' + n + ' of ' + v.length + '</b> marked</p><div id="lnvisits">' + v.map(function (s) { return visitCard(u, s, d); }).join('') + '</div>';
  }
  VIEWS['employee:visits'] = VIEWS['worker:visits'] = visitsView;
  ACT.lnmark = function (el) {
    var u = ME; if (!isCleaner(u)) { denied('lnmark'); return; }
    var st = el.dataset.st, code = el.dataset.site, d = today(), s = site(code);
    if (LN_ST.indexOf(st) < 0 || !s || visitsFor(u, d).indexOf(s) < 0) { toast('This visit is not assigned to you today.'); return; }
    var f = el.closest('form'), t = tasks(s), ticked = t.filter(function (x, i) { var c = f.querySelector('[name=t' + i + ']'); return c && c.checked; });
    var note = String((f.querySelector('[name=note]') || {}).value || '').trim().slice(0, 500);
    if (st === 'Done' && ticked.length < t.length && !note) { toast('Not every task is ticked – mark it Partial, or add a note.'); return; }
    if (st !== 'Done' && !note) { toast('Please add a short note for a ' + st.toLowerCase() + ' visit.'); return; }
    var l = logFor(u.id, code, d), at = new Date().toISOString();
    if (l) { l.status = st; l.tasks = ticked; l.note = note; l.at = at; l.edits = (l.edits || 0) + 1; }
    else { l = { id: uid('vl'), userId: u.id, site: code, date: d, status: st, tasks: ticked, taskCount: t.length, note: note, at: at }; logs().push(l); }
    /* Done / Partial also counts as the regular clean for the hours split (v2-cjsitehours.js) */
    if (st !== 'Missed' && typeof shAttend === 'function' && shAttend(code, d).indexOf(u.id) < 0) (DB.shVisits = DB.shVisits || []).push({ id: uid('sv'), userId: u.id, site: code, date: d, at: at, kind: 'regular', fromVisit: l.id });
    audit('Visit marked ' + st, u.name, code + ' ' + d + ' (' + ticked.length + '/' + t.length + ' tasks)' + (note ? ' – ' + note.slice(0, 80) : ''));
    if (st === 'Missed') notify('admin', u.name + ' marked the visit at ' + code + ' on ' + d + ' as MISSED: ' + note.slice(0, 160), 'lnmiss-' + l.id);
    save(); PAGE_STATE.lnDone = esc(code) + ' marked <b>' + st + '</b> ✓ at ' + hm(at) + '.'; render();
  };
  ['employee:home', 'worker:home'].forEach(function (k) {
    var ov = VIEWS[k]; if (typeof ov !== 'function') return;
    VIEWS[k] = function (h) { var x = ov(h); if (!isCleaner(ME)) return x; var v = visitsFor(ME, today()); if (!v.length) return x;
      var n = v.filter(function (s) { return logFor(ME.id, s.code, today()); }).length;
      return '<div class="card lnhome" id="lnhome"><a class="btn" href="#/visits">Today’s visits (' + n + '/' + v.length + ' marked)</a> <span class="small muted">Checklist for each site.</span></div>' + x; };
  });

  /* ---------- 1b. office: day view + checklist editor ---------- */
  VIEWS['admin:dayvisits'] = function () {
    var d = PAGE_STATE.lnDay || today(), rows = [];
    sites().forEach(function (s) {
      var r = reg(s.code, d), crew = (s.crew || []).filter(function (id) { var u = user(id); return typeof window.cjActiveCleaner !== 'function' || window.cjActiveCleaner(u); }), ls = logs().filter(function (l) { return l.site === s.code && l.date === d; });
      if (!r && !ls.length) return;
      var ids = crew.slice(); ls.forEach(function (l) { if (ids.indexOf(l.userId) < 0) ids.push(l.userId); });
      if (!ids.length) rows.push({ s: s, r: r, uid: null, l: null });
      ids.forEach(function (id) { rows.push({ s: s, r: r, uid: id, l: ls.filter(function (l) { return l.userId === id; })[0] || null }); });
    });
    var c = function (st) { return rows.filter(function (x) { return st ? x.l && x.l.status === st : !x.l; }).length; };
    return '<h1>Visits by day</h1><p class="muted">Each assigned cleaner’s visit at each site with a regular clean that day, and what they marked. Edit checklists and who is assigned in <a href="#/checklists">Site checklists</a>.</p>' +
      '<div class="row"><label>Day <input type="date" id="lnday" value="' + esc(d) + '" data-act="lnday"></label><button class="small sec" data-act="lndayset" data-d="' + addDays(d, -1) + '">◀ Previous</button><button class="small sec" data-act="lndayset" data-d="' + today() + '">Today</button><button class="small sec" data-act="lndayset" data-d="' + addDays(d, 1) + '">Next ▶</button></div>' +
      '<p id="lnsum"><b>' + esc(shortDay(d)) + '</b> · <span class="pill s-ok">Done ' + c('Done') + '</span> <span class="pill s-warn">Partial ' + c('Partial') + '</span> <span class="pill s-bad">Missed ' + c('Missed') + '</span> <span class="pill s-pend">Not marked ' + c(null) + '</span></p>' +
      (rows.length ? '<div class="tw"><table id="lndaytable"><tr><th>Site</th><th>Cleaner</th><th>Status</th><th>Tasks</th><th>Time</th><th>Note</th></tr>' + rows.map(function (x) {
        var u = x.uid ? user(x.uid) : null, l = x.l;
        return '<tr data-site="' + esc(x.s.code) + '"><td><b>' + esc(typeof cjSiteLabel === 'function' ? cjSiteLabel(x.s) : x.s.code) + '</b><div class="small muted">' + hh(x.r) + ' h</div></td><td>' + (u ? esc(u.name) : '<span class="pill s-bad">No cleaner assigned</span>') + '</td><td><span class="pill ' + LN_PILL[l ? l.status : ''] + '">' + (l ? esc(l.status) : 'Not marked') + '</span></td><td>' + (l ? esc(l.tasks.length) + '/' + esc(l.taskCount || tasks(x.s).length) : '–') + '</td><td>' + (l ? hm(l.at) : '–') + '</td><td class="small">' + (l && l.note ? esc(l.note) : '') + '</td></tr>';
      }).join('') + '</table></div>' : '<p class="muted" id="lndaytable">No regular cleans that day.</p>');
  };
  ACT.lndayset = function (el) { PAGE_STATE.lnDay = el.dataset.d; render(); };
  document.addEventListener('change', function (e) { if (e.target && e.target.id === 'lnday' && e.target.value) { PAGE_STATE.lnDay = e.target.value; render(); } });
  VIEWS['admin:checklists'] = function () {
    var cl = DB.users.filter(function (u) { return isCleaner(u) && !u.test && (typeof window.cjActiveCleaner !== 'function' || window.cjActiveCleaner(u)); });
    return '<h1>Site checklists</h1><p class="muted">The short checklist a cleaner sees for each visit, and which cleaners are assigned to the site. One task per line. Leave empty to use the default list.</p>' +
      sites().map(function (s) {
        return '<div class="card lnedit" data-site="' + esc(s.code) + '"><form data-form="lnsave"><input type="hidden" name="site" value="' + esc(s.code) + '"><h3 style="margin-top:0">' + esc(typeof cjSiteLabel === 'function' ? cjSiteLabel(s) : s.code) + '</h3>' +
          '<div class="small muted">' + esc(typeof shSummary === 'function' ? shSummary(s) : '') + '</div><div class="grid2"><div><label>Checklist (one task per line)</label><textarea name="tasks" rows="6" maxlength="1500">' + esc(tasks(s).join('\n')) + '</textarea></div>' +
          '<div><label>Assigned cleaners</label>' + cl.map(function (u) { return chk('crew[]', esc(u.name), (s.crew || []).indexOf(u.id) >= 0, { value: u.id }); }).join('') + '</div></div><button class="small">Save ' + esc(s.code) + '</button></form></div>';
      }).join('');
  };
  FORMS.lnsave = function (f, d) {
    if (!ME || ME.type !== 'admin') { denied('lnsave'); return; }
    var s = site(d.site); if (!s) return;
    var t = String(d.tasks || '').split('\n').map(function (x) { return x.trim().slice(0, 120); }).filter(Boolean).slice(0, 15);
    var crew = (d.crew || []).filter(function (id) { return isCleaner(user(id)); });
    (s.crew || []).forEach(function (id) { var u = user(id); if (u && typeof window.cjActiveCleaner === 'function' && !window.cjActiveCleaner(u) && crew.indexOf(id) < 0) crew.push(id); });
    s.checklist = t.length && t.join('|') !== LN_DEFAULT.join('|') ? t : null; s.crew = crew;
    audit('Site checklist saved', s.code, tasks(s).length + ' tasks, ' + crew.length + ' cleaner(s) assigned'); save(); toast(s.code + ' checklist saved ✓'); render();
  };

  /* ---------- 2. weekly client sign-off + PDF ---------- */
  function weekRows(code, wk) {
    var out = [];
    for (var i = 0; i < 7; i++) {
      var d = addDays(wk, i), ls = logs().filter(function (l) { return l.site === code && l.date === d; }), r = reg(code, d);
      if (!ls.length && !r) continue;
      var best = ls.some(function (l) { return l.status === 'Done'; }) ? 'Done' : ls.some(function (l) { return l.status === 'Partial'; }) ? 'Partial' : ls.length ? 'Missed' : (d <= today() ? 'Not recorded' : 'Upcoming');
      /* owner rule (Oct 8): the day's regular hours are split between the cleaners who cleaned, so the site total = that day's regular hours */
      var hrs = ls.some(function (l) { return l.status !== 'Missed'; }) ? r : 0;
      out.push({ date: d, status: best, hours: Math.round(hrs * 100) / 100, crew: ls.filter(function (l) { return l.status !== 'Missed'; }).length, notes: ls.map(function (l) { return l.note; }).filter(Boolean) });
    }
    return out;
  }
  function soFor(code, wk) { return sos().filter(function (x) { return x.site === code && x.week === wk; })[0] || null; }
  window.lnWeekRows = weekRows;
  function soDoc(code, wk) {
    var s = site(code), f = s && s.firmId ? user(s.firmId) : null, rows = weekRows(code, wk), so = soFor(code, wk), L = [];
    cjCompanyHead(L); if (cjMockInv()) L.push(['s', 'TEST VERSION – sample sign-off made by the test app with fake data']); L.push(['g']);
    L.push(['b', 'Weekly cleaning sign-off']); L.push(['t', 'Client: ' + (f ? f.name : '')]); L.push(['t', 'Site: ' + (typeof cjSiteLabel === 'function' ? cjSiteLabel(s || code) : ((s && s.name && s.name !== code) ? code + ' – ' + s.name : code))]);
    L.push(['t', 'Week: ' + shortDay(wk) + ' to ' + shortDay(addDays(wk, 6)) + ' (' + wk + ' to ' + addDays(wk, 6) + ')']); L.push(['g']);
    var CLX = ME && ME.type === 'firm';   // owner Oct 21: clients see no hours
    L.push(['r', 'Date – status', CLX ? 'Service' : 'Crew hours']);
    rows.forEach(function (r) { L.push(['r', shortDay(r.date) + ' ' + r.date + ' – ' + r.status + (r.crew > 1 ? ' (' + r.crew + ' cleaners)' : ''), CLX ? 'Regular cleaning' : hh(r.hours) + ' h']); });
    var tot = rows.reduce(function (a, r) { return a + r.hours; }, 0), nd = rows.filter(function (r) { return r.status === 'Done' || r.status === 'Partial'; }).length;
    L.push(['rb', 'Visits done: ' + nd + ' of ' + rows.length, CLX ? '' : hh(Math.round(tot * 100) / 100) + ' h']); L.push(['g']);
    if (so) { L.push(['b', 'Signed off']); L.push(['t', 'Name: ' + so.name]); L.push(['t', 'Initials: ' + so.initials + '    Date: ' + so.date]); L.push(['s', 'Signed in the app by ' + so.byName + ' (' + (so.byType === 'admin' ? 'Chief Janitorial office' : 'client login') + ') at ' + fmtStamp(so.at)]); }
    else L.push(['t', 'Not signed yet.   Name: ____________________   Initials: ______   Date: __________']);
    L.push(['s', 'Cleaner names are not shown to clients.']);
    return L;
  }
  function docHtml(L) { return typeof invHtml === 'function' ? invHtml({}).replace(/<div class="invdoc">[\s\S]*<\/div>$/, '') + '<div class="invdoc">' + L.map(function (l) { var k = l[0]; if (k === 'h') return '<h2 style="margin:0">' + esc(l[1]) + '</h2>'; if (k === 's') return '<div class="small muted">' + esc(l[1]) + '</div>'; if (k === 'g') return '<hr>'; if (k === 'b') return '<h3 style="margin:4px 0">' + esc(l[1]) + '</h3>'; if (k === 't') return '<div>' + esc(l[1]) + '</div>'; return '<div class="invrow' + (k === 'rb' ? ' tot' : '') + '"><span>' + esc(l[1]) + '</span><b>' + esc(l[2]) + '</b></div>'; }).join('') + '</div>' : ''; }
  function soHtml(code, wk) { return '<div class="invdoc">' + soDoc(code, wk).map(function (l) { var k = l[0]; if (k === 'h') return '<h2 style="margin:0">' + esc(l[1]) + '</h2>'; if (k === 's') return '<div class="small muted">' + esc(l[1]) + '</div>'; if (k === 'g') return '<hr>'; if (k === 'b') return '<h3 style="margin:4px 0">' + esc(l[1]) + '</h3>'; if (k === 't') return '<div>' + esc(l[1]) + '</div>'; return '<div class="invrow' + (k === 'rb' ? ' tot' : '') + '"><span>' + esc(l[1]) + '</span><b>' + esc(l[2]) + '</b></div>'; }).join('') + '</div>'; }
  /* small local PDF writer (same approach as invPdf in v2-clientinvoices.js; text only, nothing leaves the browser) */
  function linesPdf(L, title) {
    var ops = [], pages = [], y = 790, flush = function () { pages.push(ops.join('\n')); ops = []; y = 790; };
    var T = function (x, yy, size, bold, s) { ops.push('BT /' + (bold ? 'F2' : 'F1') + ' ' + size + ' Tf ' + x + ' ' + yy + ' Td (' + pdfTxt(s) + ') Tj ET'); };
    var wrap = function (s, n) { var out = [], line = ''; String(s).split(' ').forEach(function (w) { if ((line + ' ' + w).trim().length > n) { out.push(line.trim()); line = w; } else line += ' ' + w; }); if (line.trim()) out.push(line.trim()); return out; };
    L.forEach(function (l) { var k = l[0]; if (y < 70) flush();
      if (k === 'h') { T(50, y, 16, true, l[1]); y -= 22; } else if (k === 'b') { T(50, y, 13, true, l[1]); y -= 18; } else if (k === 'g') { ops.push('0.8 G 50 ' + (y + 6) + ' m 545 ' + (y + 6) + ' l S 0 G'); y -= 12; }
      else if (k === 's' || k === 't') { wrap(l[1], k === 's' ? 100 : 85).forEach(function (w) { if (y < 70) flush(); T(50, y, k === 's' ? 8.5 : 10.5, false, w); y -= k === 's' ? 12 : 15; }); }
      else { wrap(l[1], 70).forEach(function (w, ix) { if (y < 70) flush(); T(50, y, 10.5, k === 'rb', w); if (ix === 0) T(470, y, 10.5, k === 'rb', l[2]); y -= 15; }); } });
    flush(); var objs = [];
    objs[1] = '<< /Type /Catalog /Pages 2 0 R >>'; objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'; objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
    var kids = []; pages.forEach(function (c, ix) { var po = 5 + ix * 2, co = po + 1; kids.push(po + ' 0 R'); objs[po] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + co + ' 0 R >>'; objs[co] = '<< /Length ' + c.length + ' >>\nstream\n' + c + '\nendstream'; });
    objs[2] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + pages.length + ' >>';
    var out = '%PDF-1.4\n', off = []; for (var k = 1; k < objs.length; k++) { off[k] = out.length; out += k + ' 0 obj\n' + objs[k] + '\nendobj\n'; }
    var xref = out.length; out += 'xref\n0 ' + objs.length + '\n0000000000 65535 f \n'; for (k = 1; k < objs.length; k++) out += String(off[k]).padStart(10, '0') + ' 00000 n \n';
    return out + 'trailer\n<< /Size ' + objs.length + ' /Root 1 0 R /Info << /Title (' + pdfTxt(title) + ') /Producer (Chief Janitorial Inc. - test app) >> >>\nstartxref\n' + xref + '\n%%EOF';
  }
  window.lnSignoffPdf = function (code, wk) { return linesPdf(soDoc(code, wk), 'Sign-off ' + code + ' week of ' + wk); };
  function soSites() { return ME.type === 'admin' ? sites() : sites().filter(function (s) { return s.firmId === ME.id; }); }
  function soView() {
    var my = soSites(); if (!my.length) return '<h1>Weekly sign-off</h1><p class="muted">No sites on this account.</p>';
    var code = PAGE_STATE.soSite && my.some(function (s) { return s.code === PAGE_STATE.soSite; }) ? PAGE_STATE.soSite : my[0].code;
    var wk = PAGE_STATE.soWeek || weekStart(addDays(today(), -7)), rows = weekRows(code, wk), so = soFor(code, wk), me = ME;
    var x = '<h1>Weekly sign-off</h1><p class="muted">Cleaning visits for one site and one week (Monday to Sunday). ' + (me.type === 'firm' ? 'Please check them and sign off with your name, initials and the date.' : 'The client (or you, the office) signs off with name, initials and date.') + ' Print or save it as a PDF for your records.</p>';
    if (PAGE_STATE.soDone) { x += '<div class="alert ok small" id="sodone">' + PAGE_STATE.soDone + '</div>'; PAGE_STATE.soDone = null; }
    x += '<div class="row sopick">' + '<label>Site <select id="sosite" data-act="sopick">' + opt(my.map(function (s) { return typeof cjSiteOpt === 'function' ? cjSiteOpt(s) : [s.code, (s.name && s.name !== s.code ? s.code + ' – ' + s.name : s.code)]; }), code) + '</select></label>' +
      '<button class="small sec" data-act="soweek" data-w="' + addDays(wk, -7) + '">◀ Week before</button><b id="soweeklbl">' + esc(shortDay(wk)) + ' – ' + esc(shortDay(addDays(wk, 6))) + '</b><button class="small sec" data-act="soweek" data-w="' + addDays(wk, 7) + '"' + (addDays(wk, 7) > today() ? ' disabled' : '') + '>Next week ▶</button></div>';
    var tot = rows.reduce(function (a, r) { return a + r.hours; }, 0);
    x += '<div class="card"><div class="tw"><table id="sotable"><tr><th>Date</th><th>Status</th><th>' + (me.type === 'firm' ? 'Service' : 'Crew hours') + '</th>' + (me.type === 'admin' ? '<th>Notes</th>' : '') + '</tr>' + rows.map(function (r) {
      return '<tr><td>' + esc(shortDay(r.date)) + '</td><td><span class="pill ' + (LN_PILL[r.status] || 's-mut') + '">' + esc(r.status) + '</span></td><td>' + (me.type === 'firm' ? 'Regular cleaning' : hh(r.hours) + ' h') + (r.crew > 1 ? ' <span class="small muted">(' + r.crew + ' cleaners)</span>' : '') + '</td>' + (me.type === 'admin' ? '<td class="small">' + esc(r.notes.join(' · ')) + '</td>' : '') + '</tr>';
    }).join('') + '<tr class="tot"><td><b>Total</b></td><td>' + rows.filter(function (r) { return r.status === 'Done' || r.status === 'Partial'; }).length + ' of ' + rows.length + ' visits done</td><td><b>' + (me.type === 'firm' ? '' : hh(Math.round(tot * 100) / 100) + ' h') + '</b></td>' + (me.type === 'admin' ? '<td></td>' : '') + '</tr></table></div>';
    if (so) x += '<div class="alert ok" id="sosigned"><b>Signed off ✓</b> ' + esc(so.name) + ' · initials <b>' + esc(so.initials) + '</b> · ' + esc(so.date) + '<div class="small muted">by ' + esc(so.byName) + ' at ' + fmtStamp(so.at) + '</div></div>';
    else if (rows.some(function (r) { return r.date <= today(); })) x += '<form data-form="sosign" id="soform"><input type="hidden" name="site" value="' + esc(code) + '"><input type="hidden" name="week" value="' + esc(wk) + '"><h3>Sign off this week</h3><div class="grid3">' +
      inp('name', 'Your name (typed signature)', '', { req: true, extra: ' maxlength="80" autocomplete="name"' }) + inp('initials', 'Initials', '', { req: true, extra: ' maxlength="5" style="text-transform:uppercase"' }) + inp('date', 'Date', today(), { type: 'date', req: true, extra: ' max="' + today() + '"' }) +
      '</div>' + chk('agree', 'I confirm the visits above for this week.', false, { req: true }) + '<div class="row"><button id="sosign">Sign off</button></div></form>';
    x += '<div class="row"><button class="sec" data-act="soprint" data-site="' + esc(code) + '" data-w="' + esc(wk) + '" id="soprint">Print / preview</button><button class="sec" data-act="sopdf" data-site="' + esc(code) + '" data-w="' + esc(wk) + '" id="sopdf">Download PDF</button></div></div>';
    return x;
  }
  VIEWS['firm:signoff'] = VIEWS['admin:signoff'] = soView;
  ACT.soweek = function (el) { PAGE_STATE.soWeek = el.dataset.w; render(); };
  document.addEventListener('change', function (e) { if (e.target && e.target.id === 'sosite') { PAGE_STATE.soSite = e.target.value; render(); } });
  FORMS.sosign = function (f, d) {
    if (!ME || (ME.type !== 'firm' && ME.type !== 'admin')) { denied('sosign'); return; }
    if (!canSite(d.site)) { noAccess('sign-off ' + d.site); return; }
    var name = String(d.name || '').trim(), ini = String(d.initials || '').trim().toUpperCase();
    if (name.length < 2) { toast('Please type your name.'); return; }
    if (!/^[A-Z]{1,4}\.?$/.test(ini.replace(/\./g, '')) ) { toast('Initials: 1 to 4 letters.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date || '') || d.date > today()) { toast('Please choose the date (today or earlier).'); return; }
    if (!d.agree) { toast('Please tick the box to confirm.'); return; }
    if (soFor(d.site, d.week)) { toast('This week is already signed off.'); render(); return; }
    var so = { id: uid('so'), site: d.site, week: d.week, name: name.slice(0, 80), initials: ini.replace(/\./g, '').slice(0, 4), date: d.date, byId: ME.id, byName: ME.name, byType: ME.type, at: new Date().toISOString(), rows: weekRows(d.site, d.week) };
    sos().push(so); audit('Weekly sign-off', d.site, 'Week of ' + d.week + ' signed by ' + so.name + ' (' + so.initials + ') ' + so.date);
    if (ME.type === 'firm') notify('admin', ME.name + ' signed off ' + d.site + ' for the week of ' + d.week + ' (' + so.name + ', ' + so.initials + ').', 'so-' + so.id);
    save(); PAGE_STATE.soDone = 'Week of ' + esc(shortDay(d.week)) + ' at ' + esc(d.site) + ' signed off ✓'; render();
  };
  ACT.soprint = function (el) {
    if (!canSite(el.dataset.site)) { noAccess('sign-off print'); return; }
    var html = soHtml(el.dataset.site, el.dataset.w);
    modal('<div id="soprev">' + html + '</div><p class="row"><button data-act="sopdf" data-site="' + esc(el.dataset.site) + '" data-w="' + esc(el.dataset.w) + '">Download PDF</button><button class="sec" data-act="soprintgo" data-site="' + esc(el.dataset.site) + '" data-w="' + esc(el.dataset.w) + '">Print</button></p>');
  };
  ACT.soprintgo = function (el) {
    if (!canSite(el.dataset.site)) { noAccess('sign-off print'); return; }
    var w = window.open('', '_blank'); if (!w) { toast('Pop-up blocked – use Download PDF instead.'); return; }
    w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sign-off ' + esc(el.dataset.site) + ' ' + esc(el.dataset.w) + '</title><style>body{font:14px/1.5 Arial,sans-serif;max-width:720px;margin:24px auto;color:#111}.invrow{display:flex;justify-content:space-between;border-bottom:1px solid #eee;padding:4px 0}.tot{font-weight:bold}.small{font-size:12px;color:#555}</style></head><body>' + soHtml(el.dataset.site, el.dataset.w) + '</body></html>');
    w.document.close(); w.focus(); setTimeout(function () { try { w.print(); } catch (e) {} }, 300);
  };
  ACT.sopdf = function (el) {
    var code = el.dataset.site, wk = el.dataset.w; if (!canSite(code)) { noAccess('sign-off pdf'); return; }
    var pdf = window.lnSignoffPdf(code, wk), name = 'Signoff-' + code + '-week-' + wk + '-TEST.pdf';
    var url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' })), a = document.createElement('a'); a.href = url; a.download = name; a.style.display = 'none'; document.body.appendChild(a);
    if ('download' in a) a.click(); else { var w = window.open(url, '_blank'); if (!w) location.href = url; }
    setTimeout(function () { a.remove(); }, 2000); setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 60000);
    PAGE_STATE.lastDownload = { name: name, size: pdf.length, pdf: pdf }; audit('Downloaded sign-off PDF', code, wk); save(); toast('PDF downloaded: ' + name);
  };

  /* ---------- 3. complaints log: Report an issue ---------- */
  function isNo() { DB.issueSeq = (DB.issueSeq || 0) + 1; return 'I-' + String(DB.issueSeq).padStart(4, '0'); }
  function isById(id) { return issues().filter(function (i) { return i.id === id; })[0] || null; }
  function isCard(i, office) {
    return '<div class="crcard issue' + (office ? ' office' : '') + '" data-id="' + esc(i.id) + '"><div class="cr-head"><b>' + esc(i.no) + ' · ' + esc(i.site) + (office ? ' <span>' + esc(i.firmName) + '</span>' : '') + '</b><span class="pill ' + IS_PILL[i.status] + '">' + esc(i.status) + '</span></div>' +
      '<div class="cmtext">' + esc(i.text) + '</div>' + (i.photoName || i.photoNote ? '<div class="small">📷 ' + esc(i.photoName || '') + (i.photoNote ? ' – ' + esc(i.photoNote) : '') + '</div>' : '') +
      '<div class="small muted">Reported ' + fmtStamp(i.createdAt) + (i.updatedAt ? ' · updated ' + fmtStamp(i.updatedAt) : '') + '</div>' +
      (i.followUp ? '<div class="small"><b>Follow-up visit:</b> ' + esc(shortDay(i.followUp)) + '</div>' : '') + (i.officeNote ? '<div class="cmreply office"><div class="small muted">Chief Janitorial office</div>' + esc(i.officeNote) + '</div>' : '') +
      (office ? '<div class="cmact isact"><textarea name="isnote" maxlength="1000" placeholder="Office note (the client sees this)">' + esc(i.officeNote || '') + '</textarea><div class="row"><select name="isstatus" aria-label="Status">' + opt(IS_ST, i.status) + '</select><label class="small">Follow-up visit <input type="date" name="isfollow" value="' + esc(i.followUp || '') + '"></label><button type="button" class="small" data-act="issave" data-id="' + esc(i.id) + '">Save</button></div></div>' : '') + '</div>';
  }
  VIEWS['firm:issues'] = function () {
    var codes = firmCodes(ME), d = PAGE_STATE.isDraft || {}, mine = issues().filter(function (i) { return i.firmId === ME.id; }).sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
    var x = '<h1>Report an issue</h1><p class="muted">Something not right at one of your sites? Tell us here. The Chief Janitorial office sees it right away and you can follow its status below.</p>';
    if (PAGE_STATE.isSent) { x += '<div class="alert ok" id="isdone"><b>Issue ' + esc(PAGE_STATE.isSent) + ' sent ✓</b> The office will update the status here.</div>'; PAGE_STATE.isSent = null; }
    x += '<div class="card"><form data-form="isreport" id="isform"><div class="grid2">' + sel('site', 'Site', codes.map(function (c) { return [c, siteName(c)]; }), d.site || (codes.length === 1 ? codes[0] : ''), { req: true, blank: codes.length > 1 }) +
      inp('photoName', 'Photo name (optional)', d.photoName || '', { ph: 'e.g. IMG_2041.jpg', extra: ' maxlength="120"' }) + '</div>' +
      '<div><label class="req">What’s wrong?</label><textarea name="text" required maxlength="1500" placeholder="e.g. garbage in the staff room was not emptied Tuesday night">' + esc(d.text || '') + '</textarea></div>' +
      '<div><label>Photo notes (optional)</label><input type="text" name="photoNote" maxlength="300" value="' + esc(d.photoNote || '') + '" placeholder="what the photo shows"></div>' +
      '<div class="row"><button id="issend">Send to the office</button></div></form></div>';
    return x + '<h2>My issues</h2>' + (mine.length ? '<div id="islist">' + mine.map(function (i) { return isCard(i, false); }).join('') + '</div>' : '<p class="muted" id="islist">No issues reported yet.</p>');
  };
  FORMS.isreport = function (f, d) {
    if (!ME || ME.type !== 'firm') { denied('isreport'); return; }
    PAGE_STATE.isDraft = d; var text = String(d.text || '').trim();
    if (firmCodes(ME).indexOf(d.site) < 0) { toast('Please choose one of your sites.'); return; }
    if (text.length < 3) { toast('Please say what’s wrong.'); return; }
    var i = { id: uid('is'), no: isNo(), firmId: ME.id, firmName: ME.name, site: d.site, text: text.slice(0, 1500), photoName: String(d.photoName || '').slice(0, 120), photoNote: String(d.photoNote || '').slice(0, 300), status: 'New', officeNote: '', followUp: '', createdAt: new Date().toISOString(), history: [] };
    issues().push(i); audit('Client reported an issue', i.firmName, i.no + ' at ' + i.site);
    notify('admin', 'New issue ' + i.no + ' from ' + i.firmName + ' at ' + i.site + ': ' + text.slice(0, 160), 'is-' + i.id);
    if (!save()) return; PAGE_STATE.isDraft = null; PAGE_STATE.isSent = i.no; toast(i.no + ' sent ✓'); render();
  };
  VIEWS['admin:issuequeue'] = function () {
    var tab = PAGE_STATE.isTab || 'open', all = issues().slice().sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
    var c = function (s) { return all.filter(function (i) { return i.status === s; }).length; };
    var l = tab === 'open' ? all.filter(function (i) { return i.status !== 'Fixed'; }) : tab === 'fixed' ? all.filter(function (i) { return i.status === 'Fixed'; }) : all;
    return '<h1>Issues queue</h1><p class="muted">Issues reported by clients with “Report an issue”. Set the status, add a note the client sees, and book a follow-up visit if needed.</p>' +
      '<div class="row crtabs" id="istabs"><button class="small' + (tab === 'open' ? '' : ' sec') + '" data-act="istab" data-t="open">New ' + c('New') + ' · In progress ' + c('In progress') + '</button><button class="small' + (tab === 'fixed' ? '' : ' sec') + '" data-act="istab" data-t="fixed">Fixed (' + c('Fixed') + ')</button><button class="small' + (tab === 'all' ? '' : ' sec') + '" data-act="istab" data-t="all">All (' + all.length + ')</button></div>' +
      (l.length ? '<div id="isqueue">' + l.map(function (i) { return isCard(i, true); }).join('') + '</div>' : '<p class="muted" id="isqueue">Nothing here.</p>');
  };
  ACT.istab = function (el) { PAGE_STATE.isTab = el.dataset.t; render(); };
  ACT.issave = function (el) {
    if (!ME || ME.type !== 'admin') { denied('issave'); return; }
    var i = isById(el.dataset.id); if (!i) return; var box = el.closest('.isact');
    var st = box.querySelector('[name=isstatus]').value, note = String(box.querySelector('[name=isnote]').value || '').trim().slice(0, 1000), fu = box.querySelector('[name=isfollow]').value || '';
    if (IS_ST.indexOf(st) < 0) return; if (fu && !/^\d{4}-\d{2}-\d{2}$/.test(fu)) { toast('Follow-up date is not valid.'); return; }
    if (st === i.status && note === (i.officeNote || '') && fu === (i.followUp || '')) { toast('Nothing changed.'); return; }
    var old = i.status; i.history = i.history || []; i.history.push({ at: new Date().toISOString(), by: ME.name, from: old, to: st });
    i.status = st; i.officeNote = note; i.followUp = fu; i.updatedAt = new Date().toISOString();
    audit('Issue updated', i.firmName, i.no + ': ' + old + ' → ' + st + (fu ? ', follow-up ' + fu : ''));
    notify(i.firmId, 'Your issue ' + i.no + ' at ' + i.site + ' is now: ' + st + (fu ? ' (follow-up visit ' + fu + ')' : '') + (note ? '. Office note: ' + note.slice(0, 200) : '.'), 'isu-' + i.id + '-' + i.history.length);
    save(); toast(i.no + ' saved ✓'); render();
  };

  /* ---------- permissions, menus, flags ---------- */
  if (typeof ADMIN_ONLY_ACT !== 'undefined') ADMIN_ONLY_ACT.push('issave', 'istab', 'lndayset');
  if (typeof ADMIN_ONLY_FORM !== 'undefined') ADMIN_ONLY_FORM.push('lnsave');
  if (typeof ROLE_ONLY !== 'undefined') { ROLE_ONLY.lnmark = ['employee', 'worker']; ROLE_ONLY.isreport = ['firm']; ROLE_ONLY.sosign = ['firm', 'admin']; }
  function addNav(list, route, label, after) { if (!list || list.some(function (n) { return n[0] === route; })) return; var i = -1; list.forEach(function (n, k) { if (n[0] === after) i = k; }); list.splice(i >= 0 ? i + 1 : list.length, 0, [route, label]); }
  addNav(NAV.employee, '#/visits', 'Today’s visits', '#/home'); addNav(NAV.worker, '#/visits', 'Today’s visits', '#/home');
  addNav(NAV.firm, '#/signoff', 'Weekly sign-off', '#/invoices'); addNav(NAV.firm, '#/issues', 'Report an issue', '#/contact');
  addNav(NAV.admin, '#/dayvisits', 'Visits by day', '#/review'); addNav(NAV.admin, '#/issuequeue', 'Issues queue', '#/clientmsgs');
  addNav(NAV.admin, '#/signoff', 'Weekly sign-off', '#/sitehours'); addNav(NAV.admin, '#/checklists', 'Site checklists', '#/sitehours');
  if (typeof MENU_GROUPS !== 'undefined' && MENU_GROUPS) {
    var g0 = MENU_GROUPS[0][1]; ['#/dayvisits', '#/issuequeue'].forEach(function (r) { if (g0.indexOf(r) < 0) g0.splice(1, 0, r); });
    var g2 = (MENU_GROUPS[2] || [0, []])[1]; ['#/checklists', '#/signoff'].forEach(function (r) { if (g2.indexOf(r) < 0) g2.push(r); });
  }
  if (typeof adminFlags === 'function') { var oaf = adminFlags; adminFlags = function () { var f = oaf(), n = issues().filter(function (i) { return i.status === 'New'; }).length, m = logs().filter(function (l) { return l.date === today() && l.status === 'Missed'; }).length;
    if (n) f.unshift({ t: 'Client issues', c: 's-bad', h: n + ' new client issue' + (n === 1 ? '' : 's') + '. <a href="#/issuequeue">Open →</a>' });
    if (m) f.unshift({ t: 'Missed visits', c: 's-bad', h: m + ' visit' + (m === 1 ? '' : 's') + ' marked Missed today. <a href="#/dayvisits">Open →</a>' }); return f; }; }
  if (typeof VIEWS['firm:home'] === 'function') { var ofh = VIEWS['firm:home']; VIEWS['firm:home'] = function (h) { var x = ofh(h); if (!ME || ME.type !== 'firm') return x;
    var open = issues().filter(function (i) { return i.firmId === ME.id && i.status !== 'Fixed'; }).length;
    return x + '<div class="card lnfirmhome" id="lnfirmhome"><a class="btn sec" href="#/signoff">Weekly sign-off</a> <a class="btn sec" href="#/issues">Report an issue</a> <span class="small muted">' + (open ? open + ' open issue' + (open === 1 ? '' : 's') + '.' : 'Check and sign each week’s visits.') + '</span></div>'; }; }

  /* ---------- mock seed (once; mock store only; fake data) ---------- */
  window.lnSeed = function () { return false; };   /* live build: TEST seed stripped */
  if (typeof load === 'function') { var _ld = load; load = function () { var r = _ld.apply(this, arguments); try { if (lnSeed()) save(); } catch (e) {} return r; }; }
  if (typeof resetData === 'function') { var _rd = resetData; resetData = function () { var r = _rd.apply(this, arguments); try { if (lnSeed()) save(); } catch (e) {} return r; }; }
})();
