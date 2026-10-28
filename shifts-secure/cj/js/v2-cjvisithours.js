/* v2-cjvisithours.js – optional per-site visit-hour limits. Flags only.
   Office / owner set "Min hours per visit" and "Max hours per visit" on the site hours row.
   They are saved on the site as minHours and maxHours by the same site-save path
   the app already uses (FORMS.shsave → save()). That save writes the whole site
   into the site JSON, so these are data.minHours and data.maxHours, next to
   data.ownerName (v2-cjownernames.js). They are hours, not money: they are not
   added to typed money columns, not formatted as dollars, and not concealed with
   the owner name.
   A completed shift is flagged when its clocked duration (in → out, unchanged) is
   below min or above max. Nothing is rounded, capped, or rewritten. Pay and invoices
   are not touched. Sites with no limit are never flagged. Crew, clients and team
   members do not see the flags.
   Mock only adds sample sites CJC130 (max 1.5h) and CJC140 (min 2h). No SQL.
   Loads after the site-hours / payroll screens and before v2-keepscroll.js.
   Turn off: remove this script and css/cjvisithours.css from index.html. */
(function () {
  'use strict';
  if (typeof VIEWS === 'undefined' || typeof FORMS === 'undefined' || typeof afterRender !== 'function') return;

  function office() { return !!(typeof ME !== 'undefined' && ME && ME.type === 'admin'); }
  function siteOf(code) { return (DB.sites || []).filter(function (s) { return s.code === code; })[0] || null; }
  function bag(s) { return s && s.data && typeof s.data === 'object' && !Array.isArray(s.data) ? s.data : null; }
  function numOrNull(v) {
    if (v === undefined || v === null || v === '') return null;
    var n = +v;
    if (!isFinite(n)) return null;
    return Math.round(n * 100) / 100;
  }
  function limits(s) {
    if (!s) return { min: null, max: null };
    var d = bag(s);
    return {
      min: numOrNull(s.minHours != null && s.minHours !== '' ? s.minHours : (d && d.minHours)),
      max: numOrNull(s.maxHours != null && s.maxHours !== '' ? s.maxHours : (d && d.maxHours))
    };
  }
  window.vlLimits = limits;
  function fmtH(h) {
    var n = Math.round((+h) * 100) / 100;
    var s = n.toFixed(2);
    return s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  }
  function limTxt(v) { return v == null ? 'none' : fmtH(v) + 'h'; }
  function entrySite(t) {
    if (t && t.site) return t.site;
    var sh = (DB.shifts || []).filter(function (s) { return t && s.id === t.shiftId; })[0];
    return sh ? sh.site : '';
  }
  function who(id) { var u = typeof user === 'function' ? user(id) : null; return u ? u.name : 'Cleaner'; }
  /* clocked duration only – the same hrs() the rest of the app uses. Never adjusted. */
  function clocked(t) { return (t && t.in && t.out && typeof hrs === 'function') ? hrs(t.in, t.out) : 0; }
  function flagFor(t) {
    if (!t || t.test || !t.in || !t.out || t.lateEntry === 'rejected') return null;
    var code = entrySite(t), s = siteOf(code); if (!s) return null;
    var L = limits(s);
    if (L.min == null && L.max == null) return null;
    var h = clocked(t);
    if (L.max != null && h > L.max + 1e-6) return { kind: 'over', limit: L.max, hours: h, site: s, code: code, t: t };
    if (L.min != null && h < L.min - 1e-6) return { kind: 'under', limit: L.min, hours: h, site: s, code: code, t: t };
    return null;
  }
  window.vlFlagFor = flagFor;
  function flagged() {
    return (DB.time || []).map(flagFor).filter(Boolean).sort(function (a, b) {
      if (a.t.date !== b.t.date) return a.t.date < b.t.date ? 1 : -1;
      return (a.t.in || '') < (b.t.in || '') ? 1 : -1;
    });
  }
  function badgeText(f) {
    return (f.kind === 'over' ? 'Over max ' : 'Under min ') + fmtH(f.limit) + 'h (' + fmtH(f.hours) + 'h)';
  }
  function badgeHtml(f) {
    return '<span class="pill vl-flag ' + (f.kind === 'over' ? 's-warn' : 's-bad') + '" data-vl="' + esc(f.t.id) + '">' + esc(badgeText(f)) + '</span>';
  }
  function flagsHtml(list) {
    if (!list.length) return '';
    return '<div class="vl-flags">' + list.map(badgeHtml).join('') + '</div>';
  }

  /* ---------- site hours form: optional limits, same Save as the row ---------- */
  function parseOne(raw, label) {
    raw = String(raw == null ? '' : raw).trim();
    if (raw === '') return { ok: true, v: null };
    var n = +raw;
    if (!(n >= 0 && n <= 24) || Math.abs(Math.round(n * 100) - n * 100) > 1e-6) return { ok: false, err: label + ': enter hours from 0 to 24 (for example 1.5), or leave it empty.' };
    return { ok: true, v: Math.round(n * 100) / 100 };
  }
  function readRaw(code, name, d) {
    if (d && Object.prototype.hasOwnProperty.call(d, name)) return d[name];
    var el = document.querySelector('input[name="' + name + '"][form="shf-' + code + '"]');
    return el ? el.value : undefined;
  }
  function applyLim(s, min, max) {
    if (min == null) delete s.minHours; else s.minHours = min;
    if (max == null) delete s.maxHours; else s.maxHours = max;
    var d = bag(s);
    if (d) { delete d.minHours; delete d.maxHours; if (!Object.keys(d).length) delete s.data; }
  }
  if (typeof FORMS.shsave === 'function') {
    var prevSave = FORMS.shsave;
    FORMS.shsave = function (f, d) {
      var code = d && d.code, s = siteOf(code);
      if (!s) return prevSave(f, d);
      var rawMin = readRaw(code, 'minHours', d), rawMax = readRaw(code, 'maxHours', d);
      if (rawMin === undefined && rawMax === undefined) return prevSave(f, d);
      var mn = parseOne(rawMin, 'Min hours per visit');
      var mx = parseOne(rawMax, 'Max hours per visit');
      if (!mn.ok) { toast(mn.err); return; }
      if (!mx.ok) { toast(mx.err); return; }
      if (mn.v != null && mx.v != null && mn.v > mx.v) { toast('Min hours per visit cannot be above max hours per visit.'); return; }
      var cur = limits(s), changed = cur.min !== mn.v || cur.max !== mx.v;
      var snap = { minHours: s.minHours, maxHours: s.maxHours, data: bag(s) ? JSON.parse(JSON.stringify(s.data)) : null, hadData: !!bag(s) };
      if (changed) audit('Site visit hour limits set', s.code, 'min ' + limTxt(cur.min) + ' → ' + limTxt(mn.v) + ', max ' + limTxt(cur.max) + ' → ' + limTxt(mx.v));
      applyLim(s, mn.v, mx.v);
      var formEl = document.getElementById('shf-' + code);
      prevSave(f, d);
      if (formEl && document.getElementById('shf-' + code) === formEl) {
        if (snap.minHours == null) delete s.minHours; else s.minHours = snap.minHours;
        if (snap.maxHours == null) delete s.maxHours; else s.maxHours = snap.maxHours;
        if (snap.hadData) s.data = snap.data; else delete s.data;
        if (changed && DB.audit && DB.audit[0] && DB.audit[0].action === 'Site visit hour limits set') DB.audit.shift();
      } else if (changed) {
        var noted = false;
        [].forEach.call(document.querySelectorAll('.toast'), function (t) {
          if (t.textContent === 'Nothing changed.') { t.textContent = code + ' visit limits saved ✓'; noted = true; }
        });
        if (!noted) toast(code + ' visit limits saved ✓');
      }
    };
  }

  function field(name, label, val, code) {
    return '<label class="vl-lab">' + esc(label) +
      '<input type="number" inputmode="decimal" name="' + name + '" form="shf-' + esc(code) + '" min="0" max="24" step="0.01" placeholder="None" value="' + (val == null ? '' : esc(fmtH(val))) + '" aria-label="' + esc(code + ' ' + label) + '" id="vl-' + name + '-' + esc(code) + '"></label>';
  }
  function editHtml(s) {
    var L = limits(s);
    return '<div class="vl-edit" data-vl-edit="' + esc(s.code) + '"><div class="vl-k">Visit limits (optional)</div><div class="vl-labs">' +
      field('minHours', 'Min hours per visit', L.min, s.code) +
      field('maxHours', 'Max hours per visit', L.max, s.code) +
      '</div><div class="hint vl-hint">Flag only. Does not change clocked time, pay or invoices. Use Save on this row.</div>' +
      flagsHtml(flagged().filter(function (f) { return f.code === s.code; }).slice(0, 4)) + '</div>';
  }

  function homeCard() {
    var all = flagged(), list = all.slice(0, 8);
    var rows = list.map(function (f) {
      var nm = typeof cjSiteLabel === 'function' ? cjSiteLabel(f.site) : (f.site && f.site.name && f.site.name !== f.code ? f.code + ' · ' + f.site.name : f.code);
      return '<li class="vl-row"><span class="vl-who"><b>' + esc(who(f.t.userId)) + '</b></span><span class="vl-site">' + esc(nm) + '</span><span class="vl-date">' + esc((typeof shortDay === 'function' ? shortDay(f.t.date) + ' ' : '') + String(f.t.date).slice(0, 4)) + '</span><span class="vl-hrs">' + esc(fmtH(f.hours)) + 'h clocked</span>' + badgeHtml(f) + '</li>';
    }).join('');
    return '<div class="card vl-card" id="vllimits"><h2>Hours outside site limits' + (all.length ? ' <span class="pill s-warn">' + all.length + '</span>' : '') + '</h2>' +
      '<p class="small muted">Completed shifts whose clocked hours are under the site’s minimum or over its maximum. This is a flag only – clocked time, pay and invoices are not changed. Sites with no limit are not listed.</p>' +
      (all.length ? '<ul class="vl-list">' + rows + '</ul>' : '<p class="muted" id="vlnone">None right now.</p>') + '</div>';
  }

  function addBadge(cell, f) {
    if (!cell || cell.querySelector('[data-vl="' + f.t.id + '"]')) return;
    var box = cell.querySelector('.vl-flags');
    if (!box) { cell.insertAdjacentHTML('beforeend', '<div class="vl-flags"></div>'); box = cell.querySelector('.vl-flags'); }
    box.insertAdjacentHTML('beforeend', badgeHtml(f));
  }

  function decorate(root) {
    if (!office() || !root || root.id !== 'app') return;
    var main = root.querySelector('main') || root;
    var h = (location.hash || '#/').split('?')[0];
    if ((h === '#/home' || h === '#/') && !main.querySelector('#vllimits')) {
      var h1 = main.querySelector('h1');
      if (h1) h1.insertAdjacentHTML('afterend', homeCard());
    }
    if (h === '#/sitehours') {
      [].forEach.call(main.querySelectorAll('#shedit tr[data-site]'), function (tr) {
        if (tr.querySelector('.vl-edit')) return;
        var s = siteOf(tr.getAttribute('data-site')); if (!s || !tr.cells[0]) return;
        tr.cells[0].insertAdjacentHTML('beforeend', editHtml(s));
      });
    }
    if (h === '#/shiftsadmin') {
      var table = [].filter.call(main.querySelectorAll('table'), function (tb) {
        var head = tb.rows && tb.rows[0] ? tb.rows[0].textContent : '';
        return /Date/.test(head) && /Shift/.test(head) && /Site/.test(head);
      })[0];
      if (table) {
        var rows = [].slice.call(table.rows).slice(1);
        flagged().forEach(function (f) {
          var sh = (DB.shifts || []).filter(function (s) { return s.id === f.t.shiftId; })[0];
          var placed = false;
          rows.forEach(function (tr) {
            if (placed) return;
            var c0 = tr.cells[0] ? tr.cells[0].textContent || '' : '';
            var c2 = tr.cells[2] ? tr.cells[2].textContent || '' : '';
            if (sh) {
              if (c0.indexOf(sh.date) < 0 || c0.indexOf(sh.start) < 0 || c0.indexOf(sh.end) < 0 || c2.indexOf(sh.site) < 0) return;
            } else if (c0.indexOf(f.t.date) < 0 || c2.indexOf(f.code) < 0) return;
            addBadge(tr.cells[1] || tr.cells[0], f);
            placed = true;
          });
        });
      }
    }
    if (h === '#/payroll') {
      var pay = main.querySelector('#paytable');
      if (pay) {
        flagged().forEach(function (f) {
          var needle = f.t.date + ' ' + f.t.in + '\u2013' + f.t.out;
          var w = document.createTreeWalker(pay, NodeFilter.SHOW_TEXT), hits = [], n;
          while ((n = w.nextNode())) if (n.nodeValue && n.nodeValue.indexOf(needle) >= 0) hits.push(n);
          hits.forEach(function (node) {
            var hold = node.parentNode;
            if (!hold || (hold.querySelector && hold.querySelector('[data-vl="' + f.t.id + '"]'))) return;
            var sp = document.createElement('span');
            sp.className = 'vl-flags vl-inline';
            sp.innerHTML = ' ' + badgeHtml(f);
            hold.insertBefore(sp, node.nextSibling);
          });
        });
      }
    }
    if (h === '#/sitetimesheet') {
      var ts = main.querySelector('#shtimesheet');
      if (ts) {
        flagged().forEach(function (f) {
          var day = typeof shortDay === 'function' ? shortDay(f.t.date) : f.t.date;
          var name = who(f.t.userId);
          [].forEach.call(ts.rows, function (tr, i) {
            if (!i || tr.cells.length < 5) return;
            if ((tr.cells[0].textContent || '').indexOf(name) < 0) return;
            if ((tr.cells[1].textContent || '').indexOf(day) < 0) return;
            if ((tr.cells[2].textContent || '').indexOf(f.code) < 0) return;
            addBadge(tr.cells[4], f);
          });
        });
      }
    }
  }
  var prevAfter = afterRender;
  afterRender = function (root) {
    var r = prevAfter.apply(this, arguments);
    try { decorate(root); } catch (e) { try { console.warn('[visithours]', e); } catch (z) {} }
    return r;
  };

  /* ---------- mock samples (fake sites only; never live Supabase) ---------- */
  function byUser(un) { return (DB.users || []).filter(function (u) { return u.username === un; })[0] || null; }
  function firmId(un) { var u = byUser(un); return u ? u.id : null; }
  function ensureSite(code, name, firmUn) {
    var s = siteOf(code);
    if (!s) {
      s = { code: code, name: name, firmId: firmId(firmUn), companyId: 'cj', active: true };
      DB.sites.push(s);
    }
    return s;
  }
  function addShift(u, code, date, inn, out, title) {
    var sh = { id: uid('s'), date: date, start: inn, end: out, role: 'general', kind: 'employee', orientation: false, booked: [u.id], test: false, needed: 1, site: code, title: title };
    DB.shifts.push(sh);
    DB.time.push({ id: uid('t'), userId: u.id, shiftId: sh.id, site: code, date: date, in: inn, out: out, clock: true, test: false });
  }
  function seed() {
    if (!DB || !(window.REG_STORE && window.REG_STORE.mode === 'mock') || window.REG_LIVE) return false;
    if (DB.vlSeed1) return false;
    var e1 = byUser('employee1'), e3 = byUser('employee3');
    if (!e1 || !e3 || typeof addDays !== 'function' || typeof today !== 'function') return false;
    var a = ensureSite('CJC130', 'Harbour sample', 'firmA');
    var b = ensureSite('CJC140', 'Market sample', 'firmB');
    a.maxHours = 1.5; delete a.minHours;
    b.minHours = 2; delete b.maxHours;
    function recentDay(back) {
      var d = addDays(today(), -back);
      if (typeof payPeriodOf === 'function') { var p = payPeriodOf(today()); if (d < p.start) d = p.start; }
      if (d > today()) d = today();
      return d;
    }
    var dWithin = recentDay(1), dOver = recentDay(2), dUnder = recentDay(0);
    addShift(e1, 'CJC130', dWithin, '16:00', '17:12', 'Sample visit 1.2h');
    addShift(e3, 'CJC130', dOver, '18:00', '20:06', 'Sample visit 2.1h');
    addShift(e1, 'CJC140', dUnder, '17:30', '18:30', 'Sample visit 1h');
    DB.vlSeed1 = true;
    return true;
  }
  if (typeof load === 'function') {
    var prevLoad = load;
    load = function () { var r = prevLoad.apply(this, arguments); try { if (seed()) save(); } catch (e) {} return r; };
  }
  if (typeof resetData === 'function') {
    var prevReset = resetData;
    resetData = function () { var r = prevReset.apply(this, arguments); try { if (seed()) save(); } catch (e) {} return r; };
  }
})();
