/* calendar1 – office-defined Daily and Weekly TASKS per site (owner ask). TEST copy, mock store, FAKE data only.
   DB.sites[].tasksDaily  = ['Empty all bins', …]          (every visit; defaults to the site checklist)
   DB.sites[].tasksWeekly = [{t:'Clean inside glass', day:3}] day 0=Mon … 6=Sun, -1 = any day that week
   Office (owner/admin/ops): #/sitetasks. Client: visit sheet + "This week's tasks" home card. Cleaners: visit sheet + Schedule. */
(function () {
  if (typeof VIEWS === 'undefined') return;
  var DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  function site(c) { return (DB.sites || []).filter(function (s) { return s.code === c; })[0] || null; }
  function roles() { return (ME && ME.officeRoles) || (ME && ME.officeRole ? [ME.officeRole] : []); }
  function canManage() { if (!ME || ME.type !== 'admin') return false; var r = roles(); return !r.length || r.some(function (x) { return ['owner', 'admin', 'ops'].indexOf(x) >= 0; }); }
  function daily(s) { return s && s.tasksDaily && s.tasksDaily.length ? s.tasksDaily : (s && s.checklist && s.checklist.length ? s.checklist : (window.LN_DEFAULT_TASKS || [])); }
  function weekly(s) { return (s && s.tasksWeekly) || []; }
  function di(d) { return (parseD(d).getDay() + 6) % 7; }
  function li(t) { return '<li>' + esc(typeof t === 'string' ? t : t.label || t.t || '') + '</li>'; }
  window.cjTasksDaily = daily; window.cjTasksWeekly = weekly;
  /* tasks for one visit: daily + weekly tasks set for that weekday (+ "any day" ones) */
  window.cjTasksFor = function (code, d) {
    var s = site(code); if (!s) return '';
    var w = weekly(s).filter(function (x) { return x.day === di(d) || x.day === -1; });
    return daily(s).map(li).join('') + w.map(function (x) { return '<li><b>Weekly:</b> ' + esc(x.t) + (x.day === -1 ? ' <span class="muted">(any day this week)</span>' : '') + '</li>'; }).join('');
  };
  function weekCard() {
    var my = (typeof calMySitesFull === 'function' ? calMySitesFull() : []).filter(function (s) { return s.regHours; });
    if (!my.length) return '';
    return '<div class="caltile calweektasks" id="calweektasks"><div class="caltile-h">This week’s tasks</div>' + my.map(function (s) {
      var w = weekly(s);
      return '<div class="cwt-site"><b>' + esc(s.code) + '</b> <span class="small muted">' + daily(s).length + ' tasks every visit</span>' +
        (w.length ? '<ul class="small">' + w.map(function (x) { return '<li><span class="pill s-mut">' + (x.day === -1 ? 'This week' : DOW[x.day]) + '</span> ' + esc(x.t) + '</li>'; }).join('') + '</ul>' : '<div class="small muted">No weekly tasks set.</div>') + '</div>';
    }).join('') + '<a class="small" href="#/calendar" data-act="cwtall">See every-visit tasks ›</a></div>';
  }
  ACT.cwtall = function () {
    var my = calMySitesFull();
    modal('<div class="calsheet"><h2>Tasks at your sites</h2>' + my.map(function (s) { return '<h3>' + esc(s.code + ' · ' + s.name) + '</h3><b class="small">Every visit</b><ol class="small">' + daily(s).map(li).join('') + '</ol>' + (weekly(s).length ? '<b class="small">Weekly</b><ul class="small">' + weekly(s).map(function (x) { return '<li>' + (x.day === -1 ? 'Any day' : DOW[x.day]) + ': ' + esc(x.t) + '</li>'; }).join('') + '</ul>' : ''); }).join('') + '<div class="row"><button type="button" class="sec" data-act="closeModal">Close</button></div></div>');
  };
  /* inject: visit sheet (everyone who can open it), client home card, Schedule site list */
  var ocv = ACT.calvisit; ACT.calvisit = function (el) {
    ocv.apply(this, arguments);
    var id = String(el.dataset.id || ''); if (id.indexOf('WAX:') === 0) return;
    var sh = document.getElementById('calsheet'); if (!sh || sh.querySelector('#caltasks')) return;
    var code = id.split('|')[0], d = el.dataset.date, x = cjTasksFor(code, d); if (!x) return;
    var box = document.createElement('div'); box.id = 'caltasks'; box.className = 'caltasks'; box.innerHTML = '<b>Tasks this visit</b><ol class="small">' + x + '</ol>';
    var acts = sh.querySelector('.calacts,.calform,#handbox'); if (acts) sh.insertBefore(box, acts); else sh.appendChild(box);
  };
  if (typeof afterRender === 'function') { var oar = afterRender; afterRender = function () { oar.apply(this, arguments); try {
    var dash = document.getElementById('caldash'); if (dash && ME && ME.type === 'firm' && !document.getElementById('calweektasks')) dash.insertAdjacentHTML('beforeend', weekCard());
    [].forEach.call(document.querySelectorAll('#crewsites details.crewsite'), function (dt) { if (dt.dataset.cwt) return; dt.dataset.cwt = '1'; var c = (dt.querySelector('summary b') || {}).textContent, s = site(c), ol = dt.querySelector('ol'); if (!s || !ol) return; ol.outerHTML = '<b class="small">Every visit</b><ol class="small">' + daily(s).map(li).join('') + '</ol>' + (weekly(s).length ? '<b class="small">Weekly</b><ul class="small">' + weekly(s).map(function (x) { return '<li>' + (x.day === -1 ? 'Any day' : DOW[x.day]) + ': ' + esc(x.t) + '</li>'; }).join('') + '</ul>' : ''); });
  } catch (e) {} }; }

  /* office setup page */
  function sites() { return (DB.sites || []).filter(function (s) { return s.code !== 'TEST-PRACTICE' && (s.companyId || 'cj') === 'cj' && s.active !== false; }); }
  VIEWS['admin:sitetasks'] = function () {
    var ed = canManage();
    return '<h1>Site tasks</h1><p class="muted">Daily tasks are done at every visit. Weekly tasks are done once a week on the day you pick. Clients see them on their calendar and home page; the assigned cleaners see the same list.' + (ed ? '' : ' <b>Read-only</b> – only the owner, admin or operations can edit.') + '</p>' +
      sites().map(function (s) {
        var w = weekly(s).concat([{ t: '', day: -1 }, { t: '', day: -1 }]);
        return '<div class="card cjtaskedit" data-site="' + esc(s.code) + '"><form data-form="cjtasks"><input type="hidden" name="site" value="' + esc(s.code) + '"><h3 style="margin-top:0">' + esc(s.code) + ' · ' + esc(s.name) + '</h3><div class="grid2"><div><label>Daily tasks (one per line)</label><textarea name="daily" rows="7" maxlength="1500"' + (ed ? '' : ' disabled') + '>' + esc(daily(s).join('\n')) + '</textarea></div>' +
          '<div><label>Weekly tasks</label>' + w.map(function (x, i) { return '<div class="cjwrow"><input name="wt' + i + '" value="' + esc(x.t) + '" maxlength="120" placeholder="Weekly task"' + (ed ? '' : ' disabled') + '><select name="wd' + i + '"' + (ed ? '' : ' disabled') + '><option value="-1">Any day</option>' + DOW.map(function (d, k) { return '<option value="' + k + '"' + (x.day === k ? ' selected' : '') + '>' + d + '</option>'; }).join('') + '</select></div>'; }).join('') + '<input type="hidden" name="wn" value="' + esc(w.length) + '"></div></div>' + (ed ? '<button class="small">Save ' + esc(s.code) + ' tasks</button>' : '') + '</form></div>';
      }).join('');
  };
  FORMS.cjtasks = function (f, d) {
    if (!canManage()) { if (typeof denied === 'function') denied('cjtasks'); return; }
    var s = site(d.site); if (!s) return;
    s.tasksDaily = String(d.daily || '').split('\n').map(function (x) { return x.trim().slice(0, 120); }).filter(Boolean).slice(0, 20);
    var w = []; for (var i = 0; i < +d.wn; i++) { var t = String(d['wt' + i] || '').trim().slice(0, 120); if (t) w.push({ t: t, day: +d['wd' + i] }); } s.tasksWeekly = w.slice(0, 15);
    audit('Site tasks saved', s.code, s.tasksDaily.length + ' daily, ' + w.length + ' weekly'); save(); toast(s.code + ' tasks saved ✓'); render();
  };
  if (typeof NAV !== 'undefined' && NAV.admin && !NAV.admin.some(function (n) { return n[0] === '#/sitetasks'; })) { var k = -1; NAV.admin.forEach(function (n, i) { if (n[0] === '#/checklists') k = i; }); NAV.admin.splice(k >= 0 ? k + 1 : NAV.admin.length, 0, ['#/sitetasks', 'Site tasks']); }
  try { var g2 = (MENU_GROUPS[2] || [0, []])[1]; if (g2.indexOf('#/sitetasks') < 0) g2.push('#/sitetasks'); } catch (e) {}
  /* mock seed (once) */
  function seed() { return false; }   /* live build: TEST seed stripped */
  if (typeof load === 'function') { var _ld = load; load = function () { var r = _ld.apply(this, arguments); try { if (seed()) save(); } catch (e) {} return r; }; }
  if (typeof resetData === 'function') { var _rd = resetData; resetData = function () { var r = _rd.apply(this, arguments); try { if (seed()) save(); } catch (e) {} return r; }; }
  try { if (typeof DB !== 'undefined' && DB && seed()) save(); } catch (e) {}
})();
