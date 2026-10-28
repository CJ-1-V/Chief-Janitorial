/* v2-cjactive.js – which cleaners are active in Chief Janitorial (owner request).
   Store: DB.settings.activeCleaners = [account ids] on the CJ settings row (mock: the same save() that writes
   localStorage; live: reg_settings id 'cj-main' via the existing settings payload). Not reg_accounts.
   window.cjActiveCleaner(u) is true only for an employee or subcontractor worker whose id is in that list,
   whose account is on, and who is not suspended.
   When activeCleaners is missing or not an array, nobody is ticked, so no crew is active. Office roles and
   client logins are not crew: they can still sign in and tick people before any cleaner is active.
   An empty array means the same thing (the office saved "nobody").
   Pickers (site-assignment list, checklist crew, handover, late-entry crew, calendar and clock-in site lists)
   show only active cleaners. Someone already on site.crew stays there: the board shows them greyed
   "not active" with ×. Payroll and compliance keep the full realPeople() list.
   UnScramble crew (usCrew / crewView / companyId 'us') can be ticked here, but their person record is
   view-only so a CJ save cannot overwrite the UnScramble account.
   Loads last. Turn off: remove css/cjactive.css and this script in index.html. No SQL in this file. */
(function () {
  'use strict';
  if (typeof VIEWS === 'undefined' || typeof ACT === 'undefined' || typeof DB === 'undefined') return;

  function E(s) { return typeof esc === 'function' ? esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function isCleaner(u) { return !!u && (u.type === 'employee' || u.type === 'worker'); }
  function roles() { return (ME && ME.officeRoles && ME.officeRoles.length) ? ME.officeRoles : (ME && ME.officeRole ? [ME.officeRole] : []); }
  function canEdit() {
    if (!ME || ME.type !== 'admin') return false;
    var r = roles();
    return !r.length || r.some(function (x) { return x === 'owner' || x === 'admin' || x === 'ops'; });
  }
  function listRaw() {
    var s = DB && DB.settings && DB.settings.activeCleaners;
    return Array.isArray(s) ? s.map(String) : null;
  }
  function inList(id) { var l = listRaw(); return !!l && l.indexOf(String(id)) >= 0; }

  /* Missing list and an empty list both mean "no cleaner has been ticked". */
  window.cjActiveCleaner = function (u) {
    if (!isCleaner(u) || u.active === false || u.suspended) return false;
    return inList(u.id);
  };
  window.cjScheduleCrew = function (ids) {
    return (ids || []).filter(function (id) { return window.cjActiveCleaner(typeof user === 'function' ? user(id) : null); });
  };
  window.cjSchedulePeople = function () {
    var all = typeof realPeople === 'function' ? realPeople() : (DB.users || []).filter(isCleaner);
    return all.filter(window.cjActiveCleaner);
  };
  window.cjUsCrew = function (u) {
    if (!u) return false;
    if (u.usCrew === true || u.crewView === true) return true;
    if ((u.companyId === 'us' || u.company_id === 'us') && isCleaner(u)) return true;
    return false;
  };

  function blocked(u) {
    if (!isCleaner(u)) return false;
    if (typeof PAGE_STATE !== 'undefined' && PAGE_STATE && PAGE_STATE.cjInactiveCrew) return true;
    return !window.cjActiveCleaner(u);
  }
  window.cjCrewBlocked = blocked;

  function refuseUs(id) {
    var u = typeof user === 'function' ? user(id) : null;
    if (!u || !window.cjUsCrew(u)) return false;
    if (typeof toast === 'function') toast('This UnScramble crew record is view-only in Chief Janitorial. A save here would overwrite their UnScramble account.');
    return true;
  }

  /* ---------- sign-in gate: crew who are not ticked see one screen and no other route ---------- */
  var MSG = "Your account isn't active in the Chief Janitorial app yet. Please contact the office.";
  function paintInactive() {
    var app = document.getElementById('app');
    if (!app) return;
    if ((location.hash || '').split('?')[0] !== '#/cjinactive') {
      try { history.replaceState(null, '', '#/cjinactive'); } catch (e) {}
    }
    var who = ME && ME.name ? '<div class="who">' + E(ME.name) + ' <button type="button" class="small sec" data-act="logout">Sign out</button></div>' : '';
    app.innerHTML = '<div class="testbar"><span>TEST VERSION – local only.</span> Fake data, stored only in this browser. Nothing is sent anywhere.</div>' +
      '<header class="top"><img src="assets/cj_Logo.png" alt="Chief Janitorial"><div><div style="font-weight:700">Chief Janitorial</div><div class="small" style="opacity:.8">Cleaners, sites &amp; invoices</div></div>' + who + '</header>' +
      '<main id="main"><div class="cj-inactive-wrap"><div class="card cj-inactive" id="cjinactive"><h1>Account not active</h1><p id="cjactmsg">' + MSG + '</p><p><button type="button" data-act="logout">Sign out</button></p></div></div></main>';
  }
  if (typeof render === 'function') {
    var prevRender = render;
    render = function () {
      try { if (typeof ME !== 'undefined' && blocked(ME)) { paintInactive(); return; } } catch (e) {}
      return prevRender.apply(this, arguments);
    };
  }
  /* ui.js registered hashchange with the original render function. A later assignment does not
     replace that listener, so a route change would paint the real screen over this gate. */
  window.addEventListener('hashchange', function (e) {
    try {
      if (typeof ME !== 'undefined' && blocked(ME)) {
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        paintInactive();
      }
    } catch (err) {}
  }, true);
  if (typeof gateRoute === 'function') {
    var og = gateRoute;
    gateRoute = function (h) {
      try { if (typeof ME !== 'undefined' && blocked(ME)) return '#/cjinactive'; } catch (e) {}
      return og.apply(this, arguments);
    };
    window.gateRoute = gateRoute;
  }
  if (typeof actionAllowed === 'function') {
    var oa = actionAllowed;
    actionAllowed = function (name, kind) {
      try { if (typeof ME !== 'undefined' && blocked(ME)) return name === 'logout' || name === 'closeModal'; } catch (e) {}
      return oa.apply(this, arguments);
    };
  }
  if (ACT.logout) {
    var ol = ACT.logout;
    ACT.logout = function () {
      try { if (typeof PAGE_STATE !== 'undefined' && PAGE_STATE) PAGE_STATE.cjInactiveCrew = false; } catch (e) {}
      return ol.apply(this, arguments);
    };
  }

  /* ---------- People: tick, filters, UnScramble tag ---------- */
  function tickHtml(u) {
    if (!isCleaner(u)) return '<span class="small muted">–</span>';
    var on = inList(u.id), edit = canEdit();
    return '<label class="inline cjact-tick"><input type="checkbox" id="cjact-' + E(u.id) + '"' +
      (edit ? ' data-act="cjacttick" data-id="' + E(u.id) + '"' : ' disabled') +
      (on ? ' checked' : '') + ' aria-label="Active cleaner for ' + E(u.name) + '"> <span>Active cleaner</span></label>';
  }
  if (typeof VIEWS['admin:people'] === 'function') {
    var ovp = VIEWS['admin:people'];
    VIEWS['admin:people'] = function () {
      var x = ovp.apply(this, arguments);
      try {
        var t = document.createElement('template');
        t.innerHTML = x;
        var root = t.content;
        var cur = (PAGE_STATE.cjAf || 'all');
        var filt = document.createElement('div');
        filt.className = 'cjact-filters';
        filt.id = 'cjactfilters';
        filt.setAttribute('role', 'group');
        filt.setAttribute('aria-label', 'Active cleaner');
        [['all', 'All'], ['on', 'Active cleaners'], ['off', 'Not active']].forEach(function (p) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'small' + (cur === p[0] ? '' : ' sec');
          b.setAttribute('data-act', 'cjactfilter');
          b.setAttribute('data-f', p[0]);
          b.setAttribute('aria-pressed', cur === p[0] ? 'true' : 'false');
          b.textContent = p[1];
          filt.appendChild(b);
        });
        var form = root.querySelector('form[data-form=pfilter]');
        var head = root.querySelector('.ap-peoplehead') || root.querySelector('h1');
        if (form) form.insertAdjacentElement('afterend', filt);
        else if (head) head.insertAdjacentElement('afterend', filt);
        var tb = root.querySelector('table');
        if (tb && tb.rows.length) {
          var hr = tb.rows[0];
          var th = document.createElement('th');
          th.textContent = 'Active cleaner';
          hr.insertBefore(th, hr.cells[1] || null);
          var drop = [];
          for (var i = 1; i < tb.rows.length; i++) {
            var r = tb.rows[i], btn = r.querySelector('[data-act=person]'), u = btn && user(btn.dataset.id);
            var td = document.createElement('td');
            td.className = 'cjact-col';
            td.innerHTML = tickHtml(u);
            r.insertBefore(td, r.cells[1] || null);
            if (u && window.cjUsCrew(u) && r.cells[0] && !r.cells[0].querySelector('.cjact-tag')) {
              r.cells[0].insertAdjacentHTML('beforeend', ' <span class="pill cjact-tag">UnScramble</span>');
            }
            var show = cur === 'all' || (isCleaner(u) && (cur === 'on' ? window.cjActiveCleaner(u) : !window.cjActiveCleaner(u)));
            if (!show) drop.push(r);
          }
          drop.forEach(function (r) { r.remove(); });
          if (tb.rows.length < 2) {
            var tr = document.createElement('tr'), cell = document.createElement('td');
            cell.colSpan = hr.cells.length;
            cell.className = 'muted';
            cell.textContent = cur === 'on' ? 'No active cleaners yet.' : 'No cleaners in this filter.';
            tr.appendChild(cell);
            tb.appendChild(tr);
          }
        }
        return t.innerHTML;
      } catch (e) { try { console.warn('[cjactive people]', e); } catch (z) {} return x; }
    };
  }
  ACT.cjactfilter = function (el) {
    PAGE_STATE.cjAf = (el && el.dataset && el.dataset.f) || 'all';
    if (typeof render === 'function') render();
  };
  ACT.cjacttick = function (el) {
    if (!canEdit()) { if (typeof toast === 'function') toast('Only the owner, admin or operations can change who is an active cleaner.'); return; }
    var u = user(el.dataset.id);
    if (!isCleaner(u)) return;
    DB.settings = DB.settings || {};
    var list = Array.isArray(DB.settings.activeCleaners) ? DB.settings.activeCleaners.slice() : [];
    var i = list.map(String).indexOf(String(u.id)), on = i < 0;
    if (on) list.push(u.id); else list.splice(i, 1);
    DB.settings.activeCleaners = list;
    if (typeof audit === 'function') audit(on ? 'Marked active cleaner' : 'Marked cleaner not active', u.name, 'settings.activeCleaners');
    if (typeof save === 'function') save();
    if (typeof toast === 'function') toast(on ? u.name + ' is an active cleaner.' : u.name + ' is not an active cleaner.');
    if (typeof render === 'function') render();
  };

  /* ---------- UnScramble crew: hide edit / save so CJ cannot overwrite their account ---------- */
  function scrubUs(id) {
    var u = user(id), m = document.querySelector('#modal .modal');
    if (!u || !window.cjUsCrew(u) || !m) return;
    var h = m.querySelector('h2');
    if (h && !h.querySelector('.cjact-tag')) h.insertAdjacentHTML('beforeend', ' <span class="pill cjact-tag">UnScramble</span>');
    if (!m.querySelector('.cjact-usnote')) {
      var note = '<p class="small muted cjact-usnote">UnScramble crew record. View only in Chief Janitorial — saving here would overwrite their UnScramble account.</p>';
      if (h) h.insertAdjacentHTML('afterend', note);
    }
    [].forEach.call(m.querySelectorAll('form'), function (f) { f.remove(); });
    [].forEach.call(m.querySelectorAll('button'), function (b) {
      var act = b.getAttribute('data-act') || '';
      if (act === 'viewdoc' || act === 'closeModal' || act === 'copy') return;
      var label = (b.textContent || '').toLowerCase();
      if (/toggleactive|suspend|approveacct|forcereset|pwresetyes|unlock|toggle2fa|approvenew|declinenew|apresend/.test(act) || /switch account|save|reset password|change username|suspend|approve|lift suspension/.test(label)) b.remove();
    });
  }
  if (typeof showPerson === 'function') {
    var osp = showPerson;
    showPerson = function (id) {
      var r = osp.apply(this, arguments);
      try { scrubUs(id); } catch (e) {}
      return r;
    };
  }
  if (typeof ACT.person === 'function') {
    var operson = ACT.person;
    ACT.person = function (el) {
      var r = operson.apply(this, arguments);
      try { scrubUs(el && el.dataset && el.dataset.id); } catch (e) {}
      return r;
    };
  }
  ['toggleactive', 'suspend', 'approveacct', 'forcereset', 'pwresetyes', 'approvenew', 'declinenew', 'apresend', 'unlock'].forEach(function (k) {
    var o = ACT[k];
    if (typeof o !== 'function') return;
    ACT[k] = function (el) {
      if (refuseUs(el && el.dataset && el.dataset.id)) return;
      return o.apply(this, arguments);
    };
  });
  ['emppay', 'orient', 'adminpw', 'apuname'].forEach(function (k) {
    if (typeof FORMS === 'undefined' || typeof FORMS[k] !== 'function') return;
    var o = FORMS[k];
    FORMS[k] = function (f, d) {
      if (refuseUs(d && d.id)) return;
      return o.apply(this, arguments);
    };
  });

  /* ---------- pickers that are global (closed ones call cjActiveCleaner / cjScheduleCrew) ---------- */
  if (typeof window.calHandEligible === 'function') {
    var ohe = window.calHandEligible;
    window.calHandEligible = function () {
      return ohe.apply(this, arguments).filter(window.cjActiveCleaner);
    };
  }
  if (typeof window.calResponsible === 'function') {
    var ocr = window.calResponsible;
    window.calResponsible = function () {
      return window.cjScheduleCrew(ocr.apply(this, arguments));
    };
  }
  if (typeof officeCrewForm === 'function') {
    var ocf = officeCrewForm;
    officeCrewForm = function () {
      var html = ocf.apply(this, arguments);
      try {
        var t = document.createElement('template');
        t.innerHTML = html;
        var sel = t.content.querySelector('select[name=wid]');
        if (sel) [].slice.call(sel.options).forEach(function (o) { if (!window.cjActiveCleaner(user(o.value))) o.remove(); });
        return t.innerHTML;
      } catch (e) { return html; }
    };
  }
  if (typeof window.cjAssignedSites === 'function') {
    var oas = window.cjAssignedSites;
    window.cjAssignedSites = function (u) {
      u = u || (typeof ME !== 'undefined' ? ME : null);
      if (!u) return oas.apply(this, arguments);
      if (isCleaner(u)) return window.cjActiveCleaner(u) ? oas.call(this, u) : [];
      if (u.type === 'sub') {
        var ids = (DB.users || []).filter(function (w) { return w.subId === u.id && window.cjActiveCleaner(w); }).map(function (w) { return w.id; });
        return (oas.call(this, u) || []).filter(function (code) {
          var s = (DB.sites || []).filter(function (x) { return x.code === code; })[0];
          var onCrew = s && (s.crew || []).some(function (i) { return ids.indexOf(i) >= 0; });
          var onShift = (DB.shifts || []).some(function (sh) { return sh.site === code && (sh.booked || []).some(function (i) { return ids.indexOf(i) >= 0; }); });
          return onCrew || onShift;
        });
      }
      return oas.call(this, u);
    };
  }
  if (typeof window.calWaxVisits === 'function') {
    var owax = window.calWaxVisits;
    window.calWaxVisits = function () {
      var list = owax.apply(this, arguments) || [];
      list.forEach(function (v) {
        var s = (DB.sites || []).filter(function (x) { return x.code === v.site; })[0];
        if (s) v.crew = window.cjScheduleCrew(s.crew || []).length;
      });
      return list;
    };
  }

  /* ---------- Overview: inactive cleaners still assigned to a site ---------- */
  function inactiveOnSites() {
    var seen = {};
    (DB.sites || []).forEach(function (s) {
      (s.crew || []).forEach(function (id) {
        var u = typeof user === 'function' ? user(id) : null;
        if (!isCleaner(u) || window.cjActiveCleaner(u)) return;
        seen[id] = u;
      });
    });
    return Object.keys(seen).map(function (k) { return seen[k]; });
  }
  window.cjInactiveOnSites = inactiveOnSites;
  if (typeof adminFlags === 'function') {
    var oaf = adminFlags;
    adminFlags = function () {
      var f = oaf.apply(this, arguments);
      try {
        var n = inactiveOnSites().length;
        if (n) f.unshift({ t: 'Inactive on sites', c: 's-warn', h: n + ' inactive cleaner' + (n === 1 ? '' : 's') + ' still on sites. <a href="#/people">People →</a>' });
      } catch (e) {}
      return f;
    };
  }

  /* ---------- mock only: one UnScramble crew stub, plus one CJ cleaner left on a site but not ticked ---------- */
  function ensureMock() {
    if (window.REG_LIVE || !DB || !DB.users || !(window.REG_STORE && window.REG_STORE.mode === 'mock')) return;
    if (DB.cjActMockSeeded) return;
    var by = function (un) { return DB.users.filter(function (u) { return u.username === un; })[0]; };
    var off = by('office');
    if (!by('uscrew1')) {
      DB.users.push({
        id: 'u_uscrew1', type: 'employee', usCrew: true, crewView: true, companyId: 'us',
        name: 'Uma Unscramble', username: 'uscrew1', email: 'uscrew1@example.com',
        passHash: off ? off.passHash : '', active: true, suspended: false, approved: true, accountApproved: true,
        createdAt: new Date().toISOString(), phone: '',
        profile: { firstName: 'Uma', lastName: 'Unscramble', jobTitle: 'Cleaner', provEmp: 'PE', payRate: 17, lang: 'English' },
        roles: [], orientations: [], wagepoint: { added: true, date: '2026-01-01', by: 'UnScramble' }
      });
    }
    function put(un, code) {
      var u = by(un), s = (DB.sites || []).filter(function (x) { return x.code === code; })[0];
      if (!u || !s) return;
      s.crew = Array.isArray(s.crew) ? s.crew : [];
      if (s.crew.indexOf(u.id) < 0) s.crew.push(u.id);
    }
    put('uscrew1', 'CJC101');
    put('employee1', 'CJC102');
    DB.cjActMockSeeded = 1;
    if (typeof save === 'function') save();
  }
  if (typeof load === 'function') {
    var oldLoad = load;
    load = function () { var r = oldLoad.apply(this, arguments); try { ensureMock(); } catch (e) {} return r; };
  }
  if (typeof resetData === 'function') {
    var oldReset = resetData;
    resetData = function () { var r = oldReset.apply(this, arguments); try { ensureMock(); } catch (e) {} return r; };
  }
})();
