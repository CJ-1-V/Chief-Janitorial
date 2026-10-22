/* calendar1 – task COMPLETION (owner, Oct 21 2026). TEST copy, mock store, FAKE data only.
   Crew (people responsible for the visit, incl. an approved handover) tick each Daily / Weekly task on the visit day:
   Done, or Not done + a required short reason. Saved with who + when (DB.taskDone['SITE|date']).
   Locked after the visit day; the office (owner/admin/ops) can correct any visit – every change audited.
   Clients (main + team): past visits show ✓ / ✗ + reason and "X of Y tasks done"; today shows "In progress";
   home card "This week's tasks" shows progress. Office: badges on calendar visits, a "Tasks not done" filter + list,
   and a notification when a visit finishes with tasks not done. No hours shown to clients. */
(function () {
  if (typeof VIEWS === 'undefined' || typeof ACT === 'undefined') return;
  function TD() { return DB.taskDone = DB.taskDone || {}; }
  function site(c) { return (DB.sites || []).filter(function (s) { return s.code === c; })[0] || null; }
  function di(d) { return (parseD(d).getDay() + 6) % 7; }
  function roles() { return (ME && ME.officeRoles) || (ME && ME.officeRole ? [ME.officeRole] : []); }
  function canManage() { if (!ME || ME.type !== 'admin') return false; var r = roles(); return !r.length || r.some(function (x) { return ['owner', 'admin', 'ops'].indexOf(x) >= 0; }); }
  function isCleaner() { return !!ME && (ME.type === 'employee' || ME.type === 'worker'); }
  function txt(t) { return typeof t === 'string' ? t : (t && (t.label || t.t || t.name || t.text)) || ''; }
  /* the task list for one visit: [{k, t, weekly}] */
  window.cjTaskItems = function (code, d) {
    var s = site(code); if (!s || typeof cjTasksDaily !== 'function') return [];
    var out = cjTasksDaily(s).map(function (t, i) { return { k: 'd' + i, t: txt(t) }; });
    cjTasksWeekly(s).forEach(function (w, i) { if (w.day === di(d) || w.day === -1) out.push({ k: 'w' + i, t: w.t, weekly: true }); });
    return out;
  };
  function rec(code, d) { return TD()[code + '|' + d] || null; }
  window.cjTaskSummary = function (code, d) {
    var items = cjTaskItems(code, d), r = rec(code, d) || { items: {} }, done = 0, not = 0;
    items.forEach(function (it) { var x = r.items[it.k]; if (x && x.st === 'done') done++; else if (x && x.st === 'not') not++; });
    return { total: items.length, done: done, not: not, open: items.length - done - not, finished: !!r.finished };
  };
  function crewCan(code, d) { return isCleaner() && d === today() && typeof calResponsible === 'function' && calResponsible(code, d).indexOf(ME.id) >= 0; }
  window.cjTaskCanEdit = function (code, d) { return crewCan(code, d) || canManage(); };
  /* logic: save ticks. ticks = {k: {st:'done'|'not', reason}} */
  window.cjTaskSave = function (code, d, ticks) {
    if (!cjTaskCanEdit(code, d)) return { ok: false, msg: isCleaner() && d !== today() ? 'Locked – ticks can only be changed on the visit day. Ask the office to correct them.' : 'Only the crew on this visit (on the visit day) or the office can tick tasks.' };
    var items = cjTaskItems(code, d), byK = {}; items.forEach(function (it) { byK[it.k] = it; });
    var bad = Object.keys(ticks || {}).filter(function (k) { var x = ticks[k]; return byK[k] && x && x.st === 'not' && !String(x.reason || '').trim(); });
    if (bad.length) return { ok: false, msg: 'Write a short reason for each task not done (e.g. “room locked”).' };
    var key = code + '|' + d, r = TD()[key] = TD()[key] || { site: code, date: d, items: {} }, changed = [], office = ME.type === 'admin';
    Object.keys(ticks || {}).forEach(function (k) {
      var x = ticks[k]; if (!byK[k] || !x || (x.st !== 'done' && x.st !== 'not')) return;
      var old = r.items[k], reason = x.st === 'not' ? String(x.reason).trim().slice(0, 120) : '';
      if (old && old.st === x.st && (old.reason || '') === reason) return;
      r.items[k] = { st: x.st, reason: reason, t: byK[k].t, by: ME.id, byName: ME.name, at: new Date().toISOString(), corrected: office && !!old };
      changed.push((office && old ? '[office correction] ' : '') + byK[k].t + ': ' + (x.st === 'done' ? 'done' : 'NOT done – ' + reason) + (old ? ' (was ' + old.st + ')' : ''));
    });
    if (!changed.length) return { ok: true, msg: 'No changes.' };
    audit(office ? 'Visit tasks corrected by the office' : 'Visit tasks ticked', code, d + ' · ' + changed.join('; '));
    var sm = cjTaskSummary(code, d);
    if (sm.open === 0 && !r.finished) {
      r.finished = true; r.finishedAt = new Date().toISOString();
      if (sm.not) notify('admin', 'Visit finished with tasks NOT done: ' + code + ' ' + d + ' – ' + sm.done + ' of ' + sm.total + ' done. ' + items.filter(function (it) { return r.items[it.k] && r.items[it.k].st === 'not'; }).map(function (it) { return it.t + ' (' + r.items[it.k].reason + ')'; }).join('; '), 'td|' + key + '|not');
    }
    save(); return { ok: true, msg: 'Saved – ' + sm.done + ' of ' + sm.total + ' tasks done' + (sm.not ? ', ' + sm.not + ' not done' : '') + '.' };
  };

  /* ---------- visit sheet ---------- */
  function clockedHere(code) { if (typeof openEntry !== 'function') return null; var o = openEntry(ME); return !!(o && o.site === code); }
  function resultList(code, d, past) {
    var items = cjTaskItems(code, d), r = rec(code, d) || { items: {} }, sm = cjTaskSummary(code, d), cl = ME.type === 'firm';
    return '<div class="tdsum ' + (sm.not ? 'bad' : sm.open ? 'prog' : 'ok') + '" id="tdsum">' + (past || sm.open === 0 ? sm.done + ' of ' + sm.total + ' tasks done' + (sm.not ? ' · ' + sm.not + ' not done' : '') + (past && sm.open ? ' · ' + sm.open + ' not marked' : '') : 'In progress – ' + sm.done + ' of ' + sm.total + ' done so far') + '</div><ul class="tdlist">' +
      items.map(function (it) { var x = r.items[it.k]; return '<li class="' + (x ? 'td-' + esc(x.st) : past ? 'td-none' : 'td-open') + '"><span class="tdi">' + (x ? (x.st === 'done' ? '✓' : '✗') : past ? '–' : '○') + '</span> ' + (it.weekly ? '<b>Weekly:</b> ' : '') + esc(it.t) + (x && x.st === 'not' ? ' <span class="tdr">– ' + esc(x.reason) + '</span>' : '') + (!x ? ' <span class="muted small">' + (past ? 'Not marked' : 'In progress') + '</span>' : '') + (x && !cl ? ' <span class="muted small">· ' + esc(x.byName) + ' ' + fmtStamp(x.at) + (x.corrected ? ' (office correction)' : '') + '</span>' : '') + '</li>'; }).join('') + '</ul>';
  }
  function editForm(code, d) {
    var items = cjTaskItems(code, d), r = rec(code, d) || { items: {} };
    return '<form data-form="cjtd" data-site="' + esc(code) + '" data-date="' + d + '" id="tdform">' + (isCleaner() && !clockedHere(code) ? '<p class="small muted">Tip: tick tasks while you are clocked in at ' + esc(code) + '.</p>' : '') + (ME.type === 'admin' ? '<p class="small muted">Office correction – every change is audited.</p>' : '') +
      items.map(function (it, i) { var x = r.items[it.k] || {}; return '<div class="tdrow" data-k="' + esc(it.k) + '"><div class="tdt">' + (it.weekly ? '<b>Weekly:</b> ' : '') + esc(it.t) + '</div><div class="tdopts"><label><input type="radio" name="s_' + esc(it.k) + '" value="done"' + (x.st === 'done' ? ' checked' : '') + '> Done</label><label><input type="radio" name="s_' + esc(it.k) + '" value="not"' + (x.st === 'not' ? ' checked' : '') + '> Not done</label><input type="text" name="r_' + esc(it.k) + '" maxlength="120" placeholder="Reason (required if not done)" value="' + esc(x.reason || '') + '"></div></div>'; }).join('') +
      '<p class="small muted" id="tdmsg"></p><button type="submit">Save tasks</button></form>';
  }
  var ocv = ACT.calvisit; ACT.calvisit = function (el) {
    ocv.apply(this, arguments);
    var id = String(el.dataset.id || ''); if (id.indexOf('WAX:') === 0) return;
    var sh = document.getElementById('calsheet'), box = sh && sh.querySelector('#caltasks'); if (!box) return;
    var code = id.split('|')[0], d = el.dataset.date; if (!cjTaskItems(code, d).length) return;
    if (d > today()) return;   // future: plain list stays
    box.innerHTML = '<b>Tasks this visit</b>' + (cjTaskCanEdit(code, d) && !(ME.type === 'admin' && el.dataset.view === '1') ? resultList(code, d, d < today()) + editForm(code, d) : resultList(code, d, d < today())) + (isCleaner() && d < today() ? '<p class="small muted">Locked – the visit day is over. Ask the office to correct a tick.</p>' : '');
  };
  FORMS.cjtd = function (f) {
    var code = f.dataset.site, d = f.dataset.date, t = {};
    [].forEach.call(f.querySelectorAll('.tdrow'), function (row) { var k = row.dataset.k, c = f.querySelector('input[name=s_' + k + ']:checked'); if (c) t[k] = { st: c.value, reason: (f.querySelector('input[name=r_' + k + ']') || {}).value || '' }; });
    var r = cjTaskSave(code, d, t), m = document.getElementById('tdmsg');
    if (!r.ok) { if (m) m.textContent = r.msg; return; }
    toast(r.msg); var b = document.createElement('button'); b.dataset.act = 'calvisit'; b.dataset.id = code + '|' + d; b.dataset.date = d; ACT.calvisit(b);
  };

  /* ---------- home card progress (clients) + office badges / filter ---------- */
  function weekRange() { var t = today(), s = addDays(t, -di(t)); return [s, addDays(s, 6)]; }
  window.cjWeekProgress = function () {
    var w = weekRange(), v = (calVisits(w[0], w[1]) || []).filter(function (x) { return !x.wax && x.status === 'scheduled' && x.date <= today(); });
    var tot = 0, done = 0, not = 0, open = 0; v.forEach(function (x) { var s = cjTaskSummary(x.site, x.date); tot += s.total; done += s.done; not += s.not; if (x.date === today()) open += s.open; });
    return { total: tot, done: done, not: not, open: open, visits: v.length };
  };
  function notDoneList() {
    var l = Object.keys(TD()).map(function (k) { var r = TD()[k], s = cjTaskSummary(r.site, r.date); return { r: r, s: s }; }).filter(function (x) { return x.s.not > 0; }).sort(function (a, b) { return a.r.date < b.r.date ? 1 : -1; });
    return '<div class="card" id="tdnotdone"><h2>Visits with tasks not done <span class="pill ' + (l.length ? 's-bad' : 's-ok') + '">' + l.length + '</span></h2>' + (l.length ? '<div class="tw"><table><tr><th>Date</th><th>Site</th><th>Done</th><th>Not done – reason</th><th>By</th></tr>' + l.map(function (x) {
      var items = cjTaskItems(x.r.site, x.r.date), nd = items.filter(function (it) { var i = x.r.items[it.k]; return i && i.st === 'not'; });
      return '<tr><td>' + esc(x.r.date) + '</td><td><a href="#/calendar" data-act="calvisit" data-id="' + esc(x.r.site + '|' + x.r.date) + '" data-date="' + esc(x.r.date) + '">' + esc(x.r.site) + '</a></td><td>' + x.s.done + ' of ' + x.s.total + '</td><td>' + nd.map(function (it) { return esc(it.t) + ' – <i>' + esc(x.r.items[it.k].reason) + '</i>'; }).join('<br>') + '</td><td class="small">' + esc([].concat.apply([], nd.map(function (it) { return x.r.items[it.k].byName; })).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', ')) + '</td></tr>';
    }).join('') + '</table></div>' : '<p class="muted">No visits with tasks not done.</p>') + '</div>';
  }
  if (typeof afterRender === 'function') { var oar = afterRender; afterRender = function () { oar.apply(this, arguments); try {
    var wt = document.getElementById('calweektasks');
    if (wt && ME && ME.type === 'firm' && !document.getElementById('tdprog')) {
      var p = cjWeekProgress(), pct = p.total ? Math.round(p.done / p.total * 100) : 0;
      wt.querySelector('.caltile-h').insertAdjacentHTML('afterend', '<div id="tdprog" class="tdprog"><b>' + p.done + ' of ' + p.total + ' done</b> <span class="small muted">this week so far' + (p.not ? ' · ' + p.not + ' not done' : '') + (p.open ? ' · ' + p.open + ' in progress today' : '') + '</span><div class="calbarline"><i style="width:' + pct + '%"></i></div></div>');
    }
    var wrap = document.getElementById('calwrap');
    if (wrap && ME && ME.type === 'admin') {
      [].forEach.call(wrap.querySelectorAll('[data-act=calvisit]'), function (b) { if (b.dataset.td) return; b.dataset.td = '1'; var pp = String(b.dataset.id).split('|'); if (pp.length < 2 || b.dataset.date > today()) return; var s = cjTaskSummary(pp[0], b.dataset.date); if (!s.total || (!s.done && !s.not)) return; b.classList.add(s.not ? 'td-has-not' : 'td-all'); b.insertAdjacentHTML('beforeend', '<span class="tdbadge ' + (s.not ? 'bad' : 'ok') + '">' + (s.not ? '✗ ' + s.not + ' not done' : '✓ ' + s.done + '/' + s.total) + '</span>'); });
      if (!document.getElementById('tdfilter')) wrap.insertAdjacentHTML('beforebegin', '<label class="calsw" id="tdfilter"><input type="checkbox" data-tdf="1"' + (window.CJ_TDF ? ' checked' : '') + '> Show only visits with tasks not done</label>');
      wrap.classList.toggle('tdf-on', !!window.CJ_TDF);
      if (!document.getElementById('tdnotdone')) wrap.insertAdjacentHTML('afterend', notDoneList());
    }
  } catch (e) {} }; }
  document.addEventListener('change', function (e) { if (e.target && e.target.dataset && e.target.dataset.tdf) { window.CJ_TDF = e.target.checked; var w = document.getElementById('calwrap'); if (w) w.classList.toggle('tdf-on', !!window.CJ_TDF); } });
  /* clients: past visit chips get a small ✓/✗ marker (no hours) */
})();
