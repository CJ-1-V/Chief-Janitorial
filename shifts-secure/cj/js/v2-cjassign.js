/* v2-cjassign.js – Chief Janitorial office: SITE ASSIGNMENTS board (owner request Oct 26, 2026: "each person will be assigned a site
   they will work at … a page in Schedule where we see all employees in the site and we can drag and drop them to assign sites").
   - Office #/siteassign (Daily work › Schedule › Site assignments): every site as a card with the cleaners on it, and a "Cleaners"
     list on the side. Drag a cleaner onto a site (mouse, or the ⠿ grip on a phone), or tap a cleaner and then "Put here" on a site.
     From the Cleaners list = add (a cleaner can be on more than one site); between two site cards = move; × = take off the site.
     One change at a time, saved at once, audited, and the cleaner gets an in-app alert. "Undo" puts the last change back.
   - Data: the SAME field the app already uses – DB.sites[].crew (cleaner ids). Nothing new is stored: the clock-in site picker,
     My site calendar, Schedule, Today's visits, handovers and the subcontractor view all already key off it (v2-cjsiteiso.js,
     v2-cjcalendar.js, v2-cjlean1.js, v2-cjhandover.js). Live: saved by the office into reg_client_sites (data), as before. No SQL.
   - Site checklists (#/checklists) keeps its checklist editor; "Assigned cleaners" there is now read-only with a link here
     (hidden fields keep each site's crew exactly as it is when a checklist is saved).
   - People: a "Site" column and a Sites line in the person pop-up. Overview "Needs attention": cleaners with no site and sites with
     regular hours but no cleaner.
   Who may change assignments: owner / admin / ops office logins (other office roles see the board read-only).
   Loads after v2-cjlean1.js and v2-cjsiteiso.js (and before v2-cjsimplify.js, which puts the page under Schedule).
   Turn off: remove the 2 lines (css/cjassign.css + this file) in index.html. */
(function () {
  'use strict';
  if (typeof VIEWS === 'undefined' || typeof ACT === 'undefined' || typeof NAV === 'undefined') return;
  var ROUTE = '#/siteassign';
  function E(s) { return typeof esc === 'function' ? esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function office() { return !!(typeof ME !== 'undefined' && ME && ME.type === 'admin'); }
  function roles() { return (ME && ME.officeRoles) || (ME && ME.officeRole ? [ME.officeRole] : []); }
  function canManage() { if (!office()) return false; var r = roles(); return !r.length || r.some(function (x) { return ['owner', 'admin', 'ops'].indexOf(x) >= 0; }); }
  function isCleaner(u) { return !!u && (u.type === 'employee' || u.type === 'worker'); }
  function U(id) { return typeof user === 'function' ? user(id) : null; }
  function nm(id) { var u = U(id); return u ? u.name : 'Unknown person'; }
  function site(code) { return (DB.sites || []).filter(function (s) { return s.code === code; })[0] || null; }
  /* every Chief Janitorial site (inactive ones too, so a crew can be set before a site starts); practice site never */
  function allSites() {
    var l = typeof companySites === 'function' ? companySites({ skipPractice: true }) : (DB.sites || []).filter(function (s) { return s.code !== 'TEST-PRACTICE'; });
    return l.slice().sort(function (a, b) { var x = a.active === false ? 1 : 0, y = b.active === false ? 1 : 0; return x - y || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0); });
  }
  /* the cleaners who can be put on a site: employees and subcontractor workers the office has ticked Active
     (v2-cjactive.js). Testers stay out. Someone already on a site but not active still renders (grey "not active"). */
  function listed(u) { return isCleaner(u) && !u.test && !u.anonymous && u.active !== false && !u.suspended && (typeof window.cjActiveCleaner !== 'function' || window.cjActiveCleaner(u)); }
  function cleaners() { return (DB.users || []).filter(listed).sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); }); }
  function crewOf(s) { return (s && Array.isArray(s.crew)) ? s.crew.slice() : []; }
  function sitesOf(uid) { return allSites().filter(function (s) { return crewOf(s).indexOf(uid) >= 0; }); }
  function hasHours(s) { return !!(s && s.regHours && s.regHours.some(function (h) { return +h > 0; })); }
  function summary(s) { return typeof shSummary === 'function' ? shSummary(s) : ''; }
  function kind(u) { if (!u) return ''; if (u.type === 'employee') return 'Employee'; var e = typeof employerName === 'function' ? employerName(u) : ''; return 'Sub worker' + (e && e !== '(not linked)' ? ' · ' + e : ''); }
  function st() { return PAGE_STATE.asg = PAGE_STATE.asg || { q: '', f: 'all', sel: null, undo: null }; }

  /* ---------- the changes (one at a time, saved at once, audited, cleaner told) ---------- */
  function siteLabel(s) { return (typeof cjSiteLabel === 'function') ? cjSiteLabel(s) : (s.code + (s.name && s.name !== s.code ? ' · ' + s.name : '')); }
  function tell(uid, text, key) { try { if (typeof notify === 'function') notify(uid, text, 'asg|' + key + '|' + Date.now()); } catch (e) {} }
  function remember(label, before) { st().undo = { label: label, before: before }; }
  function snapshot(codes) { return codes.map(function (c) { var s = site(c); return { code: c, crew: crewOf(s) }; }); }
  function assign(uid, code, from) {
    if (!canManage()) { if (typeof denied === 'function') denied('siteassign'); return false; }
    var s = site(code), u = U(uid); if (!s || !isCleaner(u)) { toast('That cleaner or site is not available.'); return false; }
    if (crewOf(s).indexOf(uid) >= 0) {
      if (from && from !== code) { var ok = unassign(uid, from, true); if (ok) toast(u.name + ' was already on ' + s.code + ' – taken off ' + from + '.'); return ok; }
      toast(u.name + ' is already on ' + s.code + '.'); return false;
    }
    var fs = from && from !== code ? site(from) : null;
    remember(u.name + (fs ? ' back to ' + fs.code : ' off ' + s.code), snapshot(fs ? [code, from] : [code]));
    s.crew = crewOf(s).concat([uid]);
    if (fs) fs.crew = crewOf(fs).filter(function (i) { return i !== uid; });
    audit('Site assignment', s.code, u.name + (fs ? ' moved from ' + fs.code : ' added') + ' (' + s.crew.length + ' on site)');
    tell(uid, 'You are now assigned to site ' + siteLabel(s) + (fs ? ' (instead of ' + fs.code + ')' : '') + '. It shows on your Clock screen, Schedule and My site calendar.', 'add|' + code + '|' + uid);
    save(); toast(u.name + ' → ' + s.code + ' ✓'); return true;
  }
  function unassign(uid, code, quiet) {
    if (!canManage()) { if (typeof denied === 'function') denied('siteassign'); return false; }
    var s = site(code), u = U(uid); if (!s || crewOf(s).indexOf(uid) < 0) return false;
    remember(nm(uid) + ' back on ' + s.code, snapshot([code]));
    s.crew = crewOf(s).filter(function (i) { return i !== uid; });
    audit('Site assignment', s.code, nm(uid) + ' taken off (' + s.crew.length + ' on site)');
    if (u) tell(uid, 'You are no longer assigned to site ' + siteLabel(s) + '.', 'off|' + code + '|' + uid);
    save(); if (!quiet) toast(nm(uid) + ' taken off ' + s.code + '.'); return true;
  }
  function undo() {
    var un = st().undo; if (!un || !canManage()) return;
    un.before.forEach(function (b) { var s = site(b.code); if (s) s.crew = b.crew.slice(); });
    audit('Site assignment undone', un.before.map(function (b) { return b.code; }).join(', '), un.label);
    st().undo = null; save(); toast('Put back: ' + un.label + '.');
  }

  /* ---------- the page ---------- */
  function chip(u, s, opts) {
    opts = opts || {}; var S = st(), sel = S.sel && S.sel.uid === u.id && (S.sel.from || '') === (s ? s.code : '');
    var mine = sitesOf(u.id), drag = canManage() && !opts.readonly;
    var x = '<div class="asg-chip' + (sel ? ' sel' : '') + (s ? ' on-site' : '') + (listed(u) ? '' : ' off') + '" data-uid="' + E(u.id) + '"' + (s ? ' data-site="' + E(s.code) + '"' : '') + (drag ? ' role="button" tabindex="0" aria-pressed="' + (sel ? 'true' : 'false') + '" title="Drag onto a site, or tap and then choose a site"' : '') + '>';
    if (drag) x += '<span class="asg-grip" aria-hidden="true">⠿</span>';
    x += '<span class="asg-body"><span class="asg-nm">' + E(u.name) + '</span><span class="asg-sub">' + E(kind(u)) + (listed(u) ? '' : ' · <b>not active</b>') + '</span>';
    if (!s) x += '<span class="asg-sites">' + (mine.length ? mine.map(function (m) { return '<i>' + E(m.code) + '</i>'; }).join('') : '<em class="asg-none">No site yet</em>') + '</span>';
    x += '</span>';
    if (s && drag) x += '<button type="button" class="asg-x" data-act="asgremove" data-uid="' + E(u.id) + '" data-site="' + E(s.code) + '" aria-label="Take ' + E(u.name) + ' off ' + E(s.code) + '" title="Take off this site">×</button>';
    return x + '</div>';
  }
  function peopleList() {
    var S = st(), q = (S.q || '').toLowerCase(), l = cleaners().filter(function (u) {
      var n = sitesOf(u.id).length;
      if (S.f === 'none' && n) return false; if (S.f === 'some' && !n) return false;
      return !q || (u.name + ' ' + kind(u)).toLowerCase().indexOf(q) >= 0;
    });
    if (!l.length) return '<p class="muted small" id="asgnobody">' + (cleaners().length ? 'No cleaner matches.' : 'No active cleaners yet. Add people under People.') + '</p>';
    return l.map(function (u) { return chip(u, null); }).join('');
  }
  function siteCard(s) {
    var S = st(), crew = crewOf(s), sel = S.sel, here = sel && crew.indexOf(sel.uid) >= 0;
    var x = '<div class="asg-site card' + (s.active === false ? ' inactive' : '') + (sel && !here ? ' can-put' : '') + '" data-site="' + E(s.code) + '">';
    x += '<div class="asg-site-h"><div><b>' + E(siteLabel(s)) + '</b></div><span class="pill ' + (crew.length ? 's-ok' : (hasHours(s) && s.active !== false ? 's-warn' : 's-mut')) + '">' + crew.length + ' cleaner' + (crew.length === 1 ? '' : 's') + '</span></div>';
    /* cjinvite1: sign-up link + printable QR. v2-cjinvite.js fills this; empty if that file is off. */
    if (typeof window.cjInviteSlot === 'function') x += window.cjInviteSlot(s);
    x += '<div class="asg-site-m small muted">' + (s.active === false ? '<span class="pill s-mut">Inactive</span> ' : '') + E(summary(s)) + (s.visitStart ? ' · from ' + E(s.visitStart) : '') + '</div>';
    if (s.note) x += '<div class="asg-site-n small muted">' + E(String(s.note).slice(0, 120)) + '</div>';
    x += '<div class="asg-crew">' + (crew.length ? crew.map(function (id) { var u = U(id); return u ? chip(u, s) : '<div class="asg-chip off" data-uid="' + E(id) + '" data-site="' + E(s.code) + '"><span class="asg-body"><span class="asg-nm">Unknown person</span></span>' + (canManage() ? '<button type="button" class="asg-x" data-act="asgremove" data-uid="' + E(id) + '" data-site="' + E(s.code) + '" aria-label="Remove">×</button>' : '') + '</div>'; }).join('') : '<div class="asg-empty">' + (canManage() ? 'Drop a cleaner here' : 'No cleaner assigned') + '</div>') + '</div>';
    if (sel && canManage()) x += '<button type="button" class="small asg-put" data-act="asgput" data-site="' + E(s.code) + '"' + (here ? ' disabled' : '') + '>' + (here ? E(nm(sel.uid)) + ' is here' : (sel.from ? 'Move ' : 'Put ') + E(nm(sel.uid)) + ' here') + '</button>';
    return x + '</div>';
  }
  function stats() {
    var cl = cleaners(), none = cl.filter(function (u) { return !sitesOf(u.id).length; }).length, sites = allSites(), empty = sites.filter(function (s) { return s.active !== false && hasHours(s) && !crewOf(s).length; }).length;
    return '<div class="asg-stats" id="asgstats"><span><b>' + cl.length + '</b> cleaner' + (cl.length === 1 ? '' : 's') + '</span><span' + (none ? ' class="warn"' : '') + '><b>' + none + '</b> without a site</span><span><b>' + sites.length + '</b> site' + (sites.length === 1 ? '' : 's') + '</span><span' + (empty ? ' class="warn"' : '') + '><b>' + empty + '</b> with hours but no cleaner</span></div>';
  }
  function page() {
    var S = st(), manage = canManage();
    var x = '<div class="asg" id="asg"><div class="asg-head"><h1>Site assignments</h1><div class="asg-hint muted small">' +
      (manage ? 'Drag a cleaner onto a site, or tap a cleaner and then <b>Put here</b> on a site. Each cleaner then sees only their own site in the app (clock-in, schedule, calendar, visits).' : 'Read-only for your office role – the owner, admin or operations change assignments.') + '</div></div>' + stats();
    if (S.sel && manage) x += '<div class="asg-selbar" id="asgselbar"><span>Now choose a site for <b>' + E(nm(S.sel.uid)) + '</b>' + (S.sel.from ? ' (moving from ' + E(S.sel.from) + ')' : '') + '</span><button type="button" class="small sec" data-act="asgcancel">Cancel</button></div>';
    if (S.undo && manage) x += '<div class="asg-undobar" id="asgundobar"><span>Changed. </span><button type="button" class="small sec" data-act="asgundo">Undo – ' + E(S.undo.label) + '</button></div>';
    x += '<div class="asg-wrap"><aside class="asg-people card" id="asgpeople"><div class="asg-people-h"><h2>Cleaners</h2><input type="search" id="asgq" value="' + E(S.q || '') + '" placeholder="Search name" aria-label="Search cleaners" autocomplete="off"></div>' +
      '<div class="asg-filters row" role="group" aria-label="Show">' + [['all', 'All'], ['none', 'No site'], ['some', 'On a site']].map(function (f) { return '<button type="button" class="small' + (S.f === f[0] ? '' : ' sec') + '" data-act="asgfilter" data-f="' + f[0] + '" aria-pressed="' + (S.f === f[0]) + '">' + f[1] + '</button>'; }).join('') + '</div>' +
      '<div class="asg-list" id="asglist">' + peopleList() + '</div>' + (manage ? '<div class="small muted asg-tip">A cleaner can be on more than one site: drag the same name onto another site. Dragging between two sites moves them.</div>' : '') + '</aside>';
    x += '<section class="asg-board" id="asgboard" aria-label="Sites">' + (allSites().length ? allSites().map(siteCard).join('') : '<p class="muted">No sites yet. Add them under Clients &amp; sites.</p>') + '</section></div></div>';
    return x;
  }
  VIEWS['admin:siteassign'] = function () { return page(); };
  (function addNav() { var L = NAV.admin; if (!L || L.some(function (n) { return n[0] === ROUTE; })) return; var k = -1; L.forEach(function (n, i) { if (n[0] === '#/calendar') k = i; }); L.splice(k >= 0 ? k : L.length, 0, [ROUTE, 'Site assignments']); })();
  /* re-draw the page in place (keeps the scroll position and the search box) */
  function refresh() {
    var el = document.getElementById('asg'); if (!el) return;
    var wx = window.scrollX || window.pageXOffset || 0, wy = window.scrollY || window.pageYOffset || 0;
    var ae = document.activeElement, focusQ = ae && ae.id === 'asgq';
    /* dropping the focused Put here / × button makes some browsers jump the window to the top */
    if (ae && ae !== document.body && ae.blur && el.contains(ae)) { try { ae.blur(); } catch (e) {} }
    var ol = document.getElementById('asglist'), op = document.getElementById('asgpeople');
    var sl = ol ? ol.scrollLeft : 0, pst = op ? op.scrollTop : 0;
    var t = document.createElement('div'); t.innerHTML = page(); el.parentNode.replaceChild(t.firstElementChild, el);
    var nl = document.getElementById('asglist'), pp = document.getElementById('asgpeople'); if (nl) nl.scrollLeft = sl; if (pp) pp.scrollTop = pst;
    if (Math.abs((window.scrollY || 0) - wy) > 1 || Math.abs((window.scrollX || 0) - wx) > 1) window.scrollTo(wx, wy);
    if (focusQ) { var q = document.getElementById('asgq'); if (q) { try { q.focus({ preventScroll: true }); } catch (e) { q.focus(); } try { q.setSelectionRange(q.value.length, q.value.length); } catch (e2) {} } }
  }
  function refreshList() { var l = document.getElementById('asglist'); if (l) l.innerHTML = peopleList(); }

  /* ---------- tap / click / keyboard ---------- */
  ACT.asgfilter = function (el) { st().f = el.dataset.f || 'all'; refresh(); };
  ACT.asgcancel = function () { st().sel = null; refresh(); };
  ACT.asgundo = function () { undo(); refresh(); };
  ACT.asgremove = function (el) { st().sel = null; unassign(el.dataset.uid, el.dataset.site); refresh(); };
  ACT.asgput = function (el) { var S = st(); if (!S.sel) return; var sel = S.sel; S.sel = null; assign(sel.uid, el.dataset.site, sel.from || ''); refresh(); };
  function select(chipEl) {
    var S = st(), uid = chipEl.dataset.uid, from = chipEl.dataset.site || '';
    S.sel = (S.sel && S.sel.uid === uid && (S.sel.from || '') === from) ? null : { uid: uid, from: from };
    refresh();
    var again = document.querySelector('#asg .asg-chip[role="button"][data-uid="' + uid + '"]' + (from ? '[data-site="' + from + '"]' : ':not([data-site])')); if (again) { try { again.focus({ preventScroll: true }); } catch (e) {} }
  }
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var c = t.closest('#asg .asg-chip[role="button"]'); if (!c || t.closest('.asg-x') || !canManage()) return;
    if (DRAG && DRAG.moved) return;   // a drag just ended on this chip
    select(c);
  });
  document.addEventListener('keydown', function (e) {
    var t = e.target; if (!t || !t.closest || !t.closest('#asg')) return;
    if ((e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') && t.classList.contains('asg-chip')) { e.preventDefault(); select(t); }
    if (e.key === 'Escape' && st().sel) { st().sel = null; refresh(); }
  });
  document.addEventListener('input', function (e) { if (e.target && e.target.id === 'asgq') { st().q = e.target.value; refreshList(); } });

  /* ---------- drag and drop (pointer events: mouse, pen and touch via the ⠿ grip) ---------- */
  var DRAG = null, SCROLL = null;
  function overSite(x, y) { var el = document.elementFromPoint(x, y); return el && el.closest ? el.closest('#asg .asg-site') : null; }
  function mark(target) { [].forEach.call(document.querySelectorAll('#asg .asg-site.over'), function (s) { if (s !== target) s.classList.remove('over'); }); if (target) target.classList.add('over'); }
  function autoScroll(y) {
    var h = window.innerHeight, dy = y < 70 ? -14 : y > h - 70 ? 14 : 0;
    if (dy && !SCROLL) SCROLL = setInterval(function () { window.scrollBy(0, DRAG ? DRAG.dy : 0); }, 30);
    if (DRAG) DRAG.dy = dy; if (!dy && SCROLL) { clearInterval(SCROLL); SCROLL = null; }
  }
  function start(e) {
    var c = DRAG.el, r = c.getBoundingClientRect(), g = c.cloneNode(true);
    g.className = 'asg-chip asg-ghost' + (c.classList.contains('on-site') ? ' on-site' : ''); g.removeAttribute('id'); g.style.width = r.width + 'px';
    DRAG.ox = e.clientX - r.left; DRAG.oy = e.clientY - r.top; DRAG.ghost = g; DRAG.started = true; DRAG.moved = true;
    document.body.appendChild(g); document.body.classList.add('asg-drag'); c.classList.add('dragging');
    try { c.setPointerCapture(DRAG.pid); } catch (x) {}
    move(e);
  }
  function move(e) {
    var g = DRAG.ghost; g.style.left = (e.clientX - DRAG.ox) + 'px'; g.style.top = (e.clientY - DRAG.oy) + 'px';
    var target = overSite(e.clientX, e.clientY); if (target && target.dataset.site === DRAG.from) target = null;
    DRAG.target = target; mark(target); autoScroll(e.clientY);
  }
  function end(e, cancelled) {
    var d = DRAG; if (!d) return;
    if (d.started) {
      try { d.el.releasePointerCapture(d.pid); } catch (x) {}
      if (d.ghost && d.ghost.parentNode) d.ghost.parentNode.removeChild(d.ghost);
      document.body.classList.remove('asg-drag'); d.el.classList.remove('dragging'); mark(null);
      if (SCROLL) { clearInterval(SCROLL); SCROLL = null; }
      var target = cancelled ? null : (d.target || overSite(e.clientX, e.clientY));
      if (target && target.dataset.site !== d.from) { st().sel = null; assign(d.uid, target.dataset.site, d.from); refresh(); }
      setTimeout(function () { DRAG = null; }, 50);   // the click that follows the drop is ignored
    } else DRAG = null;
  }
  document.addEventListener('pointerdown', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var c = t.closest('#asg .asg-chip[role="button"]'); if (!c || t.closest('.asg-x') || !canManage()) return;
    if (e.button != null && e.button !== 0) return;
    var grip = !!t.closest('.asg-grip');
    if (e.pointerType !== 'mouse' && !grip) return;   // on a phone the chip scrolls / taps as usual; the grip drags
    DRAG = { uid: c.dataset.uid, from: c.dataset.site || '', el: c, x0: e.clientX, y0: e.clientY, pid: e.pointerId, started: false, moved: false, dy: 0 };
    if (grip) e.preventDefault();
  });
  document.addEventListener('pointermove', function (e) {
    if (!DRAG || e.pointerId !== DRAG.pid) return;
    if (!DRAG.started) { if (Math.abs(e.clientX - DRAG.x0) + Math.abs(e.clientY - DRAG.y0) < 6) return; start(e); return; }
    e.preventDefault(); move(e);
  }, { passive: false });
  document.addEventListener('pointerup', function (e) { if (DRAG && e.pointerId === DRAG.pid) end(e, false); });
  document.addEventListener('pointercancel', function (e) { if (DRAG && e.pointerId === DRAG.pid) end(e, true); });
  document.addEventListener('dragstart', function (e) { if (e.target && e.target.closest && e.target.closest('#asg .asg-chip')) e.preventDefault(); });
  window.addEventListener('hashchange', function () { DRAG = null; var S = PAGE_STATE.asg; if (S) { S.sel = null; S.undo = null; } });

  /* ---------- Site checklists: crew is read-only there (hidden fields keep it exactly as it is) ---------- */
  (function () {
    var ov = VIEWS['admin:checklists']; if (typeof ov !== 'function') return;
    VIEWS['admin:checklists'] = function () {
      var x = ov.apply(this, arguments);
      try {
        var t = document.createElement('template'); t.innerHTML = x;
        [].forEach.call(t.content.querySelectorAll('.lnedit form'), function (f) {
          var code = (f.querySelector('input[name="site"]') || {}).value, s = site(code); if (!s) return;
          var lab = [].filter.call(f.querySelectorAll('label'), function (l) { return (l.textContent || '').trim() === 'Assigned cleaners'; })[0], box = lab && lab.parentNode; if (!box) return;
          var crew = crewOf(s);
          box.innerHTML = '<label>Assigned cleaners</label><div class="asg-ro">' + (crew.length ? crew.map(function (id) { var uu = U(id), off = uu && typeof window.cjActiveCleaner === 'function' && !window.cjActiveCleaner(uu); return '<span class="pill ' + (off ? 's-mut' : 's-ok') + '">' + E(nm(id)) + (off ? ' · not active' : '') + '</span>'; }).join(' ') : '<span class="pill s-warn">No cleaner yet</span>') + '</div><a class="small" href="' + ROUTE + '">Change on Site assignments →</a>' +
            crew.map(function (id) { return '<input type="hidden" name="crew[]" value="' + E(id) + '">'; }).join('');
        });
        x = t.innerHTML.replace('visit, and which cleaners are assigned to the site. One task per line.', 'visit. One task per line. Who cleans each site is set on <a href="' + ROUTE + '">Site assignments</a>.');
      } catch (e) { try { console.warn('[cjassign checklists]', e); } catch (z) {} }
      return x;
    };
  })();
  (function () {
    var ov = VIEWS['admin:dayvisits']; if (typeof ov !== 'function') return;
    VIEWS['admin:dayvisits'] = function () { return String(ov.apply(this, arguments)).replace('Edit checklists and who is assigned in <a href="#/checklists">Site checklists</a>.', 'Who is assigned: <a href="' + ROUTE + '">Site assignments</a> · checklists: <a href="#/checklists">Site checklists</a>.'); };
  })();

  /* ---------- People: a Site column, and the sites in the person pop-up ---------- */
  function sitesHtml(u) { var l = sitesOf(u.id); return l.length ? l.map(function (s) { return '<span class="pill s-ok asg-pill">' + E(s.code) + '</span>'; }).join(' ') : '<span class="pill s-warn">No site</span>'; }
  (function () {
    var ov = VIEWS['admin:people']; if (typeof ov !== 'function') return;
    VIEWS['admin:people'] = function () {
      var x = ov.apply(this, arguments);
      try {
        var t = document.createElement('template'); t.innerHTML = x; var tb = t.content.querySelector('table'); if (!tb) return x;
        var hr = tb.rows[0]; if (!hr || hr.cells.length < 2) return x;
        var th = document.createElement('th'); th.textContent = 'Site'; hr.insertBefore(th, hr.cells[hr.cells.length - 1]);
        for (var i = 1; i < tb.rows.length; i++) { var r = tb.rows[i], b = r.querySelector('button[data-act="person"]'), u = b && U(b.dataset.id), td = document.createElement('td'); td.className = 'asg-col'; td.innerHTML = isCleaner(u) ? sitesHtml(u) : ''; r.insertBefore(td, r.cells[r.cells.length - 1]); }
        return t.innerHTML;
      } catch (e) { return x; }
    };
  })();
  (function () {
    var op = ACT.person; if (typeof op !== 'function') return;
    ACT.person = function (el) {
      var r = op.apply(this, arguments);
      try { var u = U(el.dataset.id), m = document.querySelector('#modal .modal'), h = m && m.querySelector('h2'); if (!isCleaner(u) || !h || m.querySelector('.asg-personline')) return r;
        h.insertAdjacentHTML('afterend', '<div class="asg-personline"><b>Site' + (sitesOf(u.id).length === 1 ? '' : 's') + ':</b> ' + sitesHtml(u) + (canManage() ? ' <a class="small" href="' + ROUTE + '">Change →</a>' : '') + '</div>'); } catch (e) {}
      return r;
    };
  })();

  /* ---------- Overview › Needs attention ---------- */
  if (typeof adminFlags === 'function') {
    var oaf = adminFlags;
    adminFlags = function () {
      var f = oaf.apply(this, arguments);
      try {
        var none = cleaners().filter(function (u) { return !sitesOf(u.id).length; });
        var empty = allSites().filter(function (s) { return s.active !== false && hasHours(s) && !crewOf(s).length; });
        if (none.length) f.push({ t: 'No site', c: 's-warn', h: none.length + ' cleaner' + (none.length === 1 ? ' is' : 's are') + ' not assigned to a site: ' + E(none.slice(0, 6).map(function (u) { return u.name; }).join(', ')) + (none.length > 6 ? ' and ' + (none.length - 6) + ' more' : '') + '. <a href="' + ROUTE + '">Assign →</a>' });
        if (empty.length) f.push({ t: 'No cleaner', c: 's-warn', h: empty.length + ' site' + (empty.length === 1 ? ' has' : 's have') + ' regular hours but no cleaner: ' + E(empty.slice(0, 8).map(function (s) { return s.code; }).join(', ')) + (empty.length > 8 ? ' and ' + (empty.length - 8) + ' more' : '') + '. <a href="' + ROUTE + '">Assign →</a>' });
      } catch (e) {}
      return f;
    };
  }
  window.CJ_ASSIGN = { sitesOf: sitesOf, cleaners: cleaners, assign: assign, unassign: unassign, route: ROUTE };
})();
