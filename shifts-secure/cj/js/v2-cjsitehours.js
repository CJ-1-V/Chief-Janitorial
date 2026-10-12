/* v2-cjsitehours.js – CJ twin (TEST): regular site hours split between cleaners + unusual-day hours. sitehours1, Oct 8 2026.
   Owner rule (Oct 8 12:01 PM): each site has set hours for its regular daily clean; if 2 people clean the same site the hours are
   divided equally; on unusual days people can log their own hours.
   - Office #/sitehours: "Regular hours per day" for each site (Mon–Sun, quarter-hour steps). Summary also shown on Clients & sites.
   - Cleaner (Clock screen): "Regular clean today" card – "I cleaned this site today" records the visit (a normal clock in/out at a
     site with regular hours counts too). Credited hours = site hours for that day ÷ cleaners who cleaned it that day (live split).
   - "Unusual day – log my hours": start/finish (quarter hour) + required reason. Goes to the office (Late entries & unusual days
     queue); once approved it replaces that cleaner's split hours for that site and day. Others keep the same split.
   - Special jobs (v2-cjspecial.js) are logged here too as actual hours (never split), also approved by the office.
   - Office #/sitetimesheet: per cleaner per day – site, split or approved unusual/special hours, flags. Payroll page links to it.
   - Data (mock / browser only): DB.sites[].regHours [Mon..Sun], DB.shVisits, DB.shLogs. Client invoices are NOT changed.
   Live tables: migrations/cj-sitehours-001.sql (file only, not run). Loads after v2-cjrequest.js. */
'use strict';
(function () {
  if (typeof NAV === 'undefined' || typeof VIEWS === 'undefined') return;
  var SH_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var SH_REASONS = ['Extra mess', 'Event at the site', 'Short-staffed', 'Extra areas asked by the client', 'Other (explain below)'];
  window.SH_REASONS = SH_REASONS;
  function shDayIdx(d) { return (parseD(d).getDay() + 6) % 7; }
  function shSite(code) { return (DB.sites || []).filter(function (s) { return s.code === code; })[0] || null; }
  function shReg(code, date) { var s = shSite(code); return s && s.regHours ? (+s.regHours[shDayIdx(date)] || 0) : 0; }
  function shH(h) { h = Math.round((+h || 0) * 100) / 100; var s = String(h); return s.indexOf('.') < 0 ? s + '.0' : s; }
  function shVisits() { return DB.shVisits = DB.shVisits || []; }
  function shLogs() { return DB.shLogs = DB.shLogs || []; }
  function shLogHours(l) { var a = l['in'], b = l.out, h = b > a ? hrs(a, b) : hrs(a, '24:00') + hrs('00:00', b); return Math.round(h * 100) / 100; }
  function shName(id) { var u = user(id); return u ? u.name : '?'; }
  function shSummary(s) {
    var r = s && s.regHours; if (!r || !r.some(function (h) { return +h > 0; })) return 'No regular hours set';
    var out = [], i = 0;
    while (i < 7) { var j = i; while (j + 1 < 7 && +r[j + 1] === +r[i]) j++; out.push((i === j ? SH_DAYS[i] : SH_DAYS[i] + '–' + SH_DAYS[j]) + ' ' + (+r[i] > 0 ? shH(r[i]) + ' h' : 'off')); i = j + 1; }
    return out.join(' · ');
  }
  window.shSummary = shSummary; window.shReg = shReg; window.shH = shH;
  /* who cleaned a site on a day (regular clean): check-ins + clock entries (if the site has hours that day) + unusual-day logs */
  function shAttend(site, date) {
    var ids = [], add = function (id) { if (id && ids.indexOf(id) < 0) ids.push(id); };
    shVisits().forEach(function (v) { if (v.site === site && v.date === date) add(v.userId); });
    if (shReg(site, date) > 0) (DB.time || []).forEach(function (t) { if (t.site === site && t.date === date && !t.test && t.clock && !t.special) add(t.userId); });
    shLogs().forEach(function (l) { if (l.kind === 'unusual' && l.site === site && l.date === date && l.status !== 'rejected') add(l.userId); });
    return ids;
  }
  function shLogFor(uid, site, date, kind) { return shLogs().filter(function (l) { return l.userId === uid && l.site === site && l.date === date && l.kind === (kind || 'unusual') && l.status !== 'rejected'; })[0] || null; }
  function shSplitText(reg, n) { return shH(reg) + ' h ÷ ' + n + ' cleaner' + (n === 1 ? '' : 's') + ' = ' + shH(reg / n) + ' h' + (n === 1 ? '' : ' each'); }
  function shCredit(uid, site, date) {
    var reg = shReg(site, date), att = shAttend(site, date), n = att.length || 1, split = reg / n, l = shLogFor(uid, site, date);
    if (l && l.status === 'approved') return { hours: shLogHours(l), how: 'Unusual day (approved): ' + l['in'] + '–' + l.out + ' = ' + shH(shLogHours(l)) + ' h', flag: 'unusual', log: l, reg: reg, n: n };
    return { hours: split, how: reg > 0 ? shSplitText(reg, n) : 'No regular hours set for this day', flag: l ? 'pending' : (reg > 0 ? '' : 'nohours'), log: l, reg: reg, n: n };
  }
  window.shCredit = shCredit; window.shAttend = shAttend;

  /* ---------- office: site hours editor ---------- */
  function shSites() { return (typeof companySites === 'function' ? companySites({ skipPractice: true }) : (DB.sites || []).filter(function (s) { return s.code !== 'TEST-PRACTICE'; })); }
  VIEWS['admin:sitehours'] = function () {
    var sites = shSites();
    return '<h1>Site regular hours</h1><p class="muted">Hours set for the regular daily clean at each site. When more than one cleaner does the regular clean on the same day, the hours are divided equally between them. Unusual days are logged by the cleaner and approved in <a href="#/lateentries">Late entries &amp; unusual days</a>. Client invoices do not change.</p>' +
      '<div class="tw"><table id="shedit" class="shedit"><tr><th>Site</th>' + SH_DAYS.map(function (d) { return '<th>' + d + '</th>'; }).join('') + '<th>Week</th><th></th></tr>' +
      sites.map(function (s) {
        var r = s.regHours || [0, 0, 0, 0, 0, 0, 0], f = s.firmId ? user(s.firmId) : null, wk = r.reduce(function (a, b) { return a + (+b || 0); }, 0);
        return '<tr data-site="' + esc(s.code) + '"><td><b>' + esc(s.code) + '</b><div class="small muted">' + esc(s.name) + (f ? ' · ' + esc(f.name) : '') + '</div></td>' +
          r.map(function (h, i) { return '<td><input class="shh" type="number" min="0" max="24" step="0.25" name="d' + i + '" form="shf-' + esc(s.code) + '" value="' + (+h || 0) + '" aria-label="' + esc(s.code) + ' ' + SH_DAYS[i] + ' hours"></td>'; }).join('') +
          '<td><b>' + shH(wk) + ' h</b></td><td><form data-form="shsave" id="shf-' + esc(s.code) + '"><input type="hidden" name="code" value="' + esc(s.code) + '"><button class="small">Save</button></form></td></tr>';
      }).join('') + '</table></div><p class="small muted">Quarter-hour steps (0.25 = 15 minutes). 0 = no regular clean that day.</p>';
  };
  FORMS.shsave = function (f, d) {
    var s = shSite(d.code); if (!s) return; var r = [], bad = false;
    for (var i = 0; i < 7; i++) { var el = document.querySelector('input[name=d' + i + '][form="shf-' + s.code + '"]'), v = el ? +el.value : 0; if (!(v >= 0 && v <= 24) || Math.round(v * 4) !== v * 4) bad = true; r.push(v || 0); }
    if (bad) { toast('Use hours from 0 to 24 in quarter-hour steps (e.g. 2.75).'); return; }
    var before = shSummary(s); s.regHours = r; audit('Site regular hours set', s.code, before + ' → ' + shSummary(s)); save(); toast(s.code + ' regular hours saved ✓'); render();
  };
  if (typeof VIEWS['admin:firms'] === 'function') {
    var ofi = VIEWS['admin:firms'];
    VIEWS['admin:firms'] = function () {
      var x = ofi();
      (DB.sites || []).forEach(function (s) {
        var key = esc(s.code + ' – ' + s.name), tag = '<span class="shsum small" data-site="' + esc(s.code) + '"> · Regular: ' + esc(shSummary(s)) + '</span>';
        x = x.split(key + '<br>').join(key + tag + '<br>').split(key + '<form').join(key + tag + '<form');
      });
      return x.replace('<h1>Clients &amp; sites</h1>', '<h1>Clients &amp; sites</h1><p class="small"><a href="#/sitehours">Set regular hours per site →</a></p>').replace('<h1>Clients & sites</h1>', '<h1>Clients & sites</h1><p class="small"><a href="#/sitehours">Set regular hours per site →</a></p>');
    };
  }

  /* ---------- cleaner: regular clean card + unusual-day form ---------- */
  function shMyPending(u) { return shLogs().filter(function (l) { return l.userId === u.id; }).sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; }).slice(0, 5); }
  function shSpecialChoices() { return typeof spJobsForLog === 'function' ? spJobsForLog() : []; }
  function shUnusualForm(u) {
    var sites = (typeof clockSites === 'function' ? clockSites() : shSites()), d = PAGE_STATE.shDraft || {}, sj = shSpecialChoices();
    var kinds = [['unusual', 'Unusual day at a regular site']].concat(sj.map(function (r) { return ['sp:' + r.id, 'Special job ' + r.no + ' – ' + r.kind + ' at ' + r.site + ' (' + shortDay(r.schedDate || r.date) + ')']; }));
    return '<form data-form="shunusual" id="shform" class="shform"><h3>Unusual day – log my hours</h3>' +
      '<p class="small muted">Use this when today was not a normal clean (more work, an event, short-staffed). The office checks it; once approved it replaces your split hours for that site and day.</p>' +
      '<div class="grid2">' + sel('kind', 'What was it?', kinds, d.kind || 'unusual', { req: true }) + sel('site', 'Site', sites.map(function (s) { return [s.code, s.code + ' – ' + s.name]; }), d.site || PAGE_STATE.shSite || '', { req: true }) +
      inp('date', 'Day', d.date || today(), { type: 'date', req: true, extra: ' max="' + today() + '" min="' + addDays(today(), -7) + '"' }) +
      inp('in', 'Start (quarter hour)', d['in'] || '', { type: 'time', req: true, extra: ' step="900"' }) + inp('out', 'Finish (quarter hour)', d.out || '', { type: 'time', req: true, extra: ' step="900"' }) + '</div>' +
      '<div id="shreasonbox">' + sel('reason', 'Reason', SH_REASONS, d.reason || '', { req: true }) + '</div>' +
      '<div><label>Details</label><textarea name="note" maxlength="300" placeholder="What happened? e.g. event last night, lots of garbage and floors">' + esc(d.note || '') + '</textarea><div class="hint">Required if you choose “Other”.</div></div>' +
      '<div class="row"><button type="submit" id="shsend">Send to the office</button><button type="button" class="sec" data-act="shclose">Cancel</button></div></form>';
  }
  function shCard(u) {
    var d = today(), sites = (typeof clockSites === 'function' ? clockSites() : shSites()).filter(function (s) { return shReg(s.code, d) > 0; });
    var x = '<div class="card shcard" id="shcard"><div class="row-between"><h2 class="shh2">Regular clean today</h2><span class="muted small">' + esc(shortDay(d)) + '</span></div>';
    if (PAGE_STATE.shDone) { x += '<div class="alert ok small" id="shdone">' + PAGE_STATE.shDone + '</div>'; PAGE_STATE.shDone = null; }
    if (!sites.length) x += '<p class="muted small">No site has regular hours today. Worked anyway? Use “Unusual day – log my hours”.</p>';
    x += sites.map(function (s) {
      var reg = shReg(s.code, d), att = shAttend(s.code, d), me = att.indexOf(u.id) >= 0, n = att.length, c = me ? shCredit(u.id, s.code, d) : null;
      return '<div class="shsite' + (me ? ' done' : '') + '" data-site="' + esc(s.code) + '"><div class="shsite-h"><b>' + esc(s.code) + '</b> <span class="small muted">' + esc(s.name) + '</span><span class="shreg">' + shH(reg) + ' h today</span></div>' +
        (me ? '<div class="shsplit" id="shsplit-' + esc(s.code) + '">✓ You cleaned this site today · <b>' + esc(shSplitText(reg, n)) + '</b></div>' +
          (c.flag === 'pending' ? '<div class="small"><span class="pill s-pend">Unusual day sent – waiting for the office</span> Until it is approved, the split hours count.</div>' : c.flag === 'unusual' ? '<div class="small"><span class="pill s-ok">' + esc(c.how) + '</span></div>' : '')
          : '<div class="row"><button class="small" data-act="shregular" data-site="' + esc(s.code) + '">I cleaned this site today</button><span class="small muted">' + (n ? n + ' cleaner' + (n === 1 ? '' : 's') + ' checked in so far – the ' + shH(reg) + ' h will be split ' + (n + 1) + ' ways.' : 'You will get the ' + shH(reg) + ' h unless someone else cleans it too.') + '</span></div>') + '</div>';
    }).join('');
    x += PAGE_STATE.shForm ? shUnusualForm(u) : '<button class="sec shunbtn" data-act="shopen" id="shunbtn">Unusual day – log my hours</button>';
    var mine = shMyPending(u);
    if (mine.length) x += '<details class="small shmine"><summary>My logged hours (' + mine.length + ')</summary><ul>' + mine.map(function (l) { return '<li>' + esc(shortDay(l.date) + ' · ' + l.site + ' · ' + l['in'] + '–' + l.out + ' (' + shH(shLogHours(l)) + ' h)') + (l.kind === 'special' ? ' · special job ' + esc(l.jobNo || '') : '') + ' – ' + (l.status === 'pending' ? '<span class="pill s-pend">waiting for the office</span>' : l.status === 'approved' ? '<span class="pill s-ok">approved</span>' : '<span class="pill s-bad">not approved</span>' + (l.officeNote ? ' “' + esc(l.officeNote) + '”' : '')) + '</li>'; }).join('') + '</ul></details>';
    return x + '</div>';
  }
  ['employee:home', 'worker:home'].forEach(function (k) {
    var ov = VIEWS[k]; if (typeof ov !== 'function') return;
    VIEWS[k] = function (h) {
      var x = ov(h); if (!ME || !(typeof readyForClock === 'function' && readyForClock(ME))) return x;
      var i = x.indexOf('<div class="card clock-card'); return i < 0 ? shCard(ME) + x : x.slice(0, i) + shCard(ME) + x.slice(i);
    };
  });
  ACT.shregular = function (el) {
    var u = ME, site = el.dataset.site, d = today(); if (!u || (u.type !== 'employee' && u.type !== 'worker')) return;
    if (shAttend(site, d).indexOf(u.id) >= 0) { toast('Already recorded for today.'); return; }
    shVisits().push({ id: uid('sv'), userId: u.id, site: site, date: d, at: new Date().toISOString(), kind: 'regular' });
    var n = shAttend(site, d).length, reg = shReg(site, d);
    audit('Regular clean recorded', u.name, site + ' ' + d + ' – ' + shSplitText(reg, n)); save();
    PAGE_STATE.shDone = 'Regular clean at <b>' + esc(site) + '</b> recorded ✓ ' + esc(shSplitText(reg, n)) + '.'; render();
  };
  ACT.shopen = function () { PAGE_STATE.shForm = true; PAGE_STATE.shDraft = null; render(); var f = document.getElementById('shform'); if (f) f.scrollIntoView({ block: 'start' }); };
  ACT.shclose = function () { PAGE_STATE.shForm = false; PAGE_STATE.shDraft = null; render(); };
  FORMS.shunusual = function (f, d) {
    var u = ME; if (!u || (u.type !== 'employee' && u.type !== 'worker')) { toast('Only cleaners can log hours here.'); return; }
    PAGE_STATE.shDraft = d; var job = null;
    if (/^sp:/.test(d.kind || '')) { job = shSpecialChoices().filter(function (r) { return 'sp:' + r.id === d.kind; })[0]; if (!job) { toast('Pick the special job.'); return; } d.site = job.site; }
    if (!shSite(d.site)) { toast('Pick a site.'); return; }
    if (!d.date || d.date > today() || d.date < addDays(today(), -7)) { toast('Pick a day in the last 7 days.'); return; }
    if (!quarterOk(d['in']) || !quarterOk(d.out)) { toast('Use quarter-hour times (:00, :15, :30, :45).'); return; }
    if (spanErr(d['in'], d.out)) { toast(spanErr(d['in'], d.out)); return; }
    if (!job) {
      if (SH_REASONS.indexOf(d.reason) < 0) { toast('Please choose a reason.'); return; }
      if (/^Other/.test(d.reason) && !String(d.note || '').trim()) { toast('Please explain the reason in Details.'); return; }
      if (shLogFor(u.id, d.site, d.date)) { toast('You already logged an unusual day for this site and day.'); return; }
    } else if (shLogFor(u.id, d.site, d.date, 'special')) { toast('You already logged hours for this special job on that day.'); return; }
    var l = { id: uid('sl'), userId: u.id, site: d.site, date: d.date, 'in': d['in'], out: d.out, kind: job ? 'special' : 'unusual', jobId: job ? job.id : null, jobNo: job ? job.no : '',
      reason: job ? 'Special job ' + job.no + ' – ' + job.kind : d.reason, note: String(d.note || '').trim().slice(0, 300), status: 'pending', createdAt: new Date().toISOString() };
    shLogs().push(l);
    audit(job ? 'Special job hours logged' : 'Unusual day logged', u.name, l.site + ' ' + l.date + ' ' + l['in'] + '–' + l.out + ' – ' + l.reason);
    notify('admin', (job ? 'Special job hours to approve: ' : 'Unusual day to approve: ') + u.name + ' at ' + l.site + ' on ' + l.date + ' ' + l['in'] + '–' + l.out + ' (' + shH(shLogHours(l)) + ' h) – ' + l.reason + '.', 'sh-' + l.id);
    save(); PAGE_STATE.shForm = false; PAGE_STATE.shDraft = null; PAGE_STATE.shDone = (job ? 'Special job hours' : 'Unusual day') + ' sent to the office ✓ ' + esc(l['in'] + '–' + l.out) + ' (' + shH(shLogHours(l)) + ' h). You will be told when it is checked.'; render();
  };
  document.addEventListener('change', function (e) { if (e.target && e.target.name === 'kind' && e.target.closest && e.target.closest('#shform')) { var sp = /^sp:/.test(e.target.value), b = document.getElementById('shreasonbox'); if (b) { b.style.display = sp ? 'none' : ''; var rs = b.querySelector('select'); if (rs) rs.required = !sp; } var s = e.target.form.querySelector('[name=site]'); if (s) { s.disabled = sp; if (sp) { var j = shSpecialChoices().filter(function (r) { return 'sp:' + r.id === e.target.value; })[0]; if (j) s.value = j.site; } } } });

  /* ---------- office: approval queue (on Late entries) ---------- */
  function shQueueHtml() {
    var l = shLogs().slice().sort(function (a, b) { return (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1) || (a.createdAt < b.createdAt ? 1 : -1); }).slice(0, 30);
    var pend = shLogs().filter(function (x) { return x.status === 'pending'; }).length;
    return '<div class="card shqueue" id="shqueue"><h2 style="margin-top:0">Unusual days &amp; special-job hours <span class="pill ' + (pend ? 's-pend' : 's-ok') + '">' + pend + ' waiting</span></h2><p class="small muted">Cleaners log these themselves. An approved unusual day replaces that cleaner\'s split hours for that site and day (the other cleaners keep their split). Special-job hours are actual hours, never split.</p>' +
      '<div class="tw"><table id="shqtable"><tr><th>Cleaner</th><th>Site · day</th><th>Type</th><th>Logged</th><th>Instead of</th><th>Reason</th><th>Decision</th></tr>' +
      (l.map(function (x) {
        var c = shCredit(x.userId, x.site, x.date), reg = shReg(x.site, x.date), n = shAttend(x.site, x.date).length || 1;
        return '<tr data-id="' + esc(x.id) + '"><td>' + esc(shName(x.userId)) + '</td><td>' + esc(x.site) + ' · ' + esc(shortDay(x.date)) + '</td><td>' + (x.kind === 'special' ? '<span class="pill s-test">Special job ' + esc(x.jobNo) + '</span>' : '<span class="pill s-warn">Unusual day</span>') + '</td>' +
          '<td><b>' + esc(x['in'] + '–' + x.out) + '</b><div class="small">' + shH(shLogHours(x)) + ' h</div></td><td class="small">' + (x.kind === 'special' ? 'not split (actual hours)' : reg > 0 ? esc(shSplitText(reg, n)) : 'no regular hours that day') + '</td>' +
          '<td class="small">' + esc(x.reason) + (x.note ? '<div class="muted">“' + esc(x.note) + '”</div>' : '') + '</td><td>' +
          (x.status === 'pending' ? '<div class="shdec"><input type="text" name="shnote" placeholder="Note (required to reject)" aria-label="Note"><div class="row"><button type="button" class="small" data-act="shdec" data-d="approve" data-id="' + esc(x.id) + '">Approve</button><button type="button" class="small danger" data-act="shdec" data-d="reject" data-id="' + esc(x.id) + '">Reject</button></div></div>'
            : x.status === 'approved' ? '<span class="pill s-ok">Approved</span><div class="small muted">' + esc((x.decidedBy || '') + ' ' + (x.decidedAt || '').slice(0, 10)) + '</div>' : '<span class="pill s-bad">Rejected</span><div class="small">' + esc(x.officeNote || '') + '</div>') + '</td></tr>';
      }).join('') || '<tr><td colspan="7" class="muted">Nothing logged yet.</td></tr>') + '</table></div></div>';
  }
  window.shQueueHtml = shQueueHtml;
  if (typeof VIEWS['admin:lateentries'] === 'function') {
    var ol = VIEWS['admin:lateentries'];
    VIEWS['admin:lateentries'] = function () { var x = ol(); return x.replace(/<h1>Late entries<\/h1>/, '<h1>Late entries &amp; unusual days</h1>' + shQueueHtml() + '<h2>Late entries (missed shifts)</h2>'); };
  }
  ACT.shdec = function (el) {
    if (!ME || ME.type !== 'admin') { denied('shdec'); return; }
    var x = shLogs().filter(function (l) { return l.id === el.dataset.id; })[0]; if (!x || x.status !== 'pending') return;
    var box = el.closest('.shdec'), note = String(((box && box.querySelector('[name=shnote]')) || {}).value || '').trim();
    if (el.dataset.d === 'reject' && !note) { toast('Write a note to reject.'); return; }
    x.status = el.dataset.d === 'approve' ? 'approved' : 'rejected'; x.officeNote = note; x.decidedBy = ME.name; x.decidedAt = new Date().toISOString();
    audit((x.status === 'approved' ? 'Approved ' : 'Rejected ') + (x.kind === 'special' ? 'special job hours' : 'unusual day'), shName(x.userId), x.site + ' ' + x.date + ' ' + x['in'] + '–' + x.out + (note ? ' – ' + note : ''));
    notify(x.userId, x.status === 'approved' ? 'Your ' + (x.kind === 'special' ? 'special job hours' : 'unusual-day hours') + ' at ' + x.site + ' on ' + x.date + ' (' + x['in'] + '–' + x.out + ') were approved.' : 'Your ' + (x.kind === 'special' ? 'special job hours' : 'unusual-day hours') + ' at ' + x.site + ' on ' + x.date + ' were not approved: ' + note + (x.kind === 'unusual' ? ' Your split hours for that day still count.' : ''), 'shd-' + x.id);
    save(); toast(x.status === 'approved' ? 'Approved ✓' : 'Rejected'); render();
  };
  if (typeof adminFlags === 'function') {
    var oaf = adminFlags;
    adminFlags = function () { var f = oaf(), n = shLogs().filter(function (l) { return l.status === 'pending'; }).length; if (n) f.unshift({ t: 'Unusual days', c: 's-pend', h: n + ' unusual-day / special-job hour log' + (n === 1 ? '' : 's') + ' waiting for approval. <a href="#/lateentries">Review →</a>' }); return f; };
  }

  /* ---------- office: cleaner timesheets ---------- */
  function shRows(from, to) {
    var rows = [], keys = {};
    var addKey = function (uid, site, date) { var k = uid + '|' + site + '|' + date; if (!keys[k]) { keys[k] = 1; rows.push({ uid: uid, site: site, date: date }); } };
    shVisits().forEach(function (v) { if (v.date >= from && v.date <= to) addKey(v.userId, v.site, v.date); });
    (DB.time || []).forEach(function (t) { if (t.date >= from && t.date <= to && !t.test && t.clock && !t.special && t.site && shReg(t.site, t.date) > 0) addKey(t.userId, t.site, t.date); });
    shLogs().forEach(function (l) { if (l.kind === 'unusual' && l.date >= from && l.date <= to) addKey(l.userId, l.site, l.date); });
    var out = rows.map(function (r) { var c = shCredit(r.uid, r.site, r.date); return { uid: r.uid, site: r.site, date: r.date, hours: c.hours, how: c.how, flag: c.flag, log: c.log, kind: 'regular' }; });
    shLogs().forEach(function (l) { if (l.kind === 'special' && l.date >= from && l.date <= to && l.status !== 'rejected') out.push({ uid: l.userId, site: l.site, date: l.date, hours: l.status === 'approved' ? shLogHours(l) : 0, how: 'Special job ' + l.jobNo + ': ' + l['in'] + '–' + l.out + ' = ' + shH(shLogHours(l)) + ' h (actual, not split)', flag: l.status === 'approved' ? 'special' : 'specialpend', log: l, kind: 'special' }); });
    return out.sort(function (a, b) { return shName(a.uid) < shName(b.uid) ? -1 : shName(a.uid) > shName(b.uid) ? 1 : a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  }
  window.shRows = shRows;
  function shFlag(r) {
    if (r.flag === 'unusual') return '<span class="pill s-warn">Unusual day</span><div class="small muted">' + esc(r.log.reason) + '</div>';
    if (r.flag === 'pending') return '<span class="pill s-pend">Unusual – waiting</span><div class="small muted">' + esc(r.log['in'] + '–' + r.log.out) + ' sent; split counts until approved</div>';
    if (r.flag === 'special') return '<span class="pill s-test">Special job</span>';
    if (r.flag === 'specialpend') return '<span class="pill s-pend">Special – waiting</span>';
    if (r.flag === 'nohours') return '<span class="pill s-bad">No regular hours</span>';
    return '<span class="small muted">Regular</span>';
  }
  function weekStartOf(d) { return addDays(d, -shDayIdx(d)); }
  VIEWS['admin:sitetimesheet'] = function () {
    var from = weekStartOf(PAGE_STATE.shWeek || today()), to = addDays(from, 6), R = shRows(from, to), tot = {};
    R.forEach(function (r) { tot[r.uid] = (tot[r.uid] || 0) + r.hours; });
    return '<h1>Cleaner timesheets</h1><p class="muted">Hours credited per cleaner per day. Regular clean = the site\'s regular hours ÷ cleaners who cleaned it that day. Approved unusual days replace the split for that cleaner. Special jobs are actual hours. Client invoices are not affected.</p>' +
      '<div class="row"><button class="small sec" data-act="shweek" data-d="-7">◀ Previous week</button><b id="shweek">' + esc(shortDay(from)) + ' – ' + esc(shortDay(to)) + '</b><button class="small sec" data-act="shweek" data-d="7">Next week ▶</button></div>' +
      '<div class="tw"><table id="shtimesheet"><tr><th>Cleaner</th><th>Day</th><th>Site</th><th>How the hours are worked out</th><th>Hours</th><th>Flag</th></tr>' +
      (R.map(function (r) { return '<tr class="sh-' + esc(r.flag || 'regular') + '"><td>' + esc(shName(r.uid)) + '</td><td>' + esc(shortDay(r.date)) + '</td><td>' + esc(r.site) + '</td><td class="small">' + esc(r.how) + '</td><td><b>' + (r.flag === 'specialpend' ? '–' : shH(r.hours)) + '</b></td><td>' + shFlag(r) + '</td></tr>'; }).join('') || '<tr><td colspan="6" class="muted">No regular cleans or logged hours this week.</td></tr>') + '</table></div>' +
      (R.length ? '<div class="card"><h3 style="margin-top:0">Week totals</h3><ul class="small" id="shtotals">' + Object.keys(tot).map(function (k) { return '<li><b>' + esc(shName(k)) + '</b>: ' + shH(tot[k]) + ' h</li>'; }).join('') + '</ul><p class="small muted">Pending logs are not counted until approved (the split counts meanwhile).</p></div>' : '');
  };
  ACT.shweek = function (el) { PAGE_STATE.shWeek = addDays(weekStartOf(PAGE_STATE.shWeek || today()), +el.dataset.d); render(); };
  if (typeof VIEWS['admin:payroll'] === 'function') {
    var op = VIEWS['admin:payroll'];
    VIEWS['admin:payroll'] = function () {
      var x = op(), cur = typeof payPeriodOf === 'function' ? payPeriodOf(PAGE_STATE.payDate || today()) : { start: weekStartOf(today()), end: addDays(weekStartOf(today()), 6) }, R = shRows(cur.start, cur.end), tot = {};
      R.forEach(function (r) { tot[r.uid] = (tot[r.uid] || 0) + r.hours; });
      return x + '<div class="card" id="shpaycard"><h3 style="margin-top:0">Site hours this pay period (regular split + approved unusual + special jobs)</h3>' + (Object.keys(tot).length ? '<ul class="small">' + Object.keys(tot).map(function (k) { return '<li><b>' + esc(shName(k)) + '</b>: ' + shH(tot[k]) + ' h</li>'; }).join('') + '</ul>' : '<p class="small muted">None.</p>') + '<a href="#/sitetimesheet">Open cleaner timesheets →</a></div>';
    };
  }

  /* ---------- menus + guards ---------- */
  var addNav = function (h, l, after) { if (!NAV.admin.some(function (n) { return n[0] === h; })) { var i = -1; NAV.admin.forEach(function (n, k) { if (n[0] === after) i = k; }); NAV.admin.splice(i >= 0 ? i + 1 : NAV.admin.length, 0, [h, l]); } };
  addNav('#/sitetimesheet', 'Cleaner timesheets', '#/lateentries'); addNav('#/sitehours', 'Site regular hours', '#/firms');
  NAV.admin.forEach(function (n) { if (n[0] === '#/lateentries') n[1] = 'Late entries & unusual days'; });
  if (typeof MENU_GROUPS !== 'undefined' && MENU_GROUPS) {
    var g0 = MENU_GROUPS[0][1], li = g0.indexOf('#/lateentries'); if (g0.indexOf('#/sitetimesheet') < 0) g0.splice(li >= 0 ? li + 1 : g0.length, 0, '#/sitetimesheet');
    var g2 = (MENU_GROUPS[2] || [0, []])[1], fi = g2.indexOf('#/firms'); if (g2.indexOf('#/sitehours') < 0) g2.splice(fi >= 0 ? fi + 1 : g2.length, 0, '#/sitehours');
  }
  if (typeof ADMIN_ONLY_ACT !== 'undefined') ADMIN_ONLY_ACT.push('shdec', 'shweek');
  if (typeof ADMIN_ONLY_FORM !== 'undefined') ADMIN_ONLY_FORM.push('shsave');
  if (typeof ROLE_ONLY !== 'undefined') { ROLE_ONLY.shunusual = ['employee', 'worker']; ROLE_ONLY.shregular = ['employee', 'worker']; }

  /* ---------- mock seed (once; mock store only) ---------- */
  function prevWeekday(d, k) { var x = d, c = 0; while (c < k) { x = addDays(x, -1); if (shDayIdx(x) < 5) c++; } return x; }
  window.shSeed = function () {
    if (!DB || DB.shSeed1 || !(window.REG_STORE && window.REG_STORE.mode === 'mock')) return false;
    var H = { CJC101: [3, 3, 3, 3, 3, 0, 0], CJC102: [2.5, 2.5, 2.5, 2.5, 2.5, 1.5, 0], CJC110: [4, 4, 4, 4, 4, 4, 0], CJC120: [2, 2, 2, 2, 2, 0, 0] };
    (DB.sites || []).forEach(function (s) { if (H[s.code] && !s.regHours) s.regHours = H[s.code].slice(); });
    var by = function (un) { return DB.users.filter(function (u) { return u.username === un; })[0]; }, e1 = by('employee1'), e3 = by('employee3');
    if (e1 && e3) {
      var t = today(), d1 = prevWeekday(t, 1), d2 = prevWeekday(t, 2), d3 = prevWeekday(t, 3), V = shVisits(), L = shLogs(), at = new Date().toISOString();
      V.push({ id: uid('sv'), userId: e1.id, site: 'CJC101', date: d1, at: at, kind: 'regular', seed: true }, { id: uid('sv'), userId: e3.id, site: 'CJC101', date: d1, at: at, kind: 'regular', seed: true });
      if (shDayIdx(t) < 5) V.push({ id: uid('sv'), userId: e3.id, site: 'CJC101', date: t, at: at, kind: 'regular', seed: true });
      V.push({ id: uid('sv'), userId: e1.id, site: 'CJC102', date: d2, at: at, kind: 'regular', seed: true });
      L.push({ id: uid('sl'), userId: e3.id, site: 'CJC102', date: d2, 'in': '17:00', out: '21:30', kind: 'unusual', reason: 'Event at the site', note: 'Client event the night before – extra garbage and floors (TEST)', status: 'pending', createdAt: at, seed: true });
      L.push({ id: uid('sl'), userId: e1.id, site: 'CJC110', date: d3, 'in': '18:00', out: '23:00', kind: 'unusual', reason: 'Short-staffed', note: 'Covered the whole store alone (TEST)', status: 'approved', decidedBy: 'Office Tester', decidedAt: at, createdAt: at, seed: true });
    }
    DB.shSeed1 = true; return true;
  };
  if (typeof load === 'function') { var _ld = load; load = function () { var r = _ld.apply(this, arguments); try { if (shSeed()) save(); } catch (e) {} return r; }; }
  if (typeof resetData === 'function') { var _rd = resetData; resetData = function () { var r = _rd.apply(this, arguments); try { if (shSeed()) save(); } catch (e) {} return r; }; }
})();
