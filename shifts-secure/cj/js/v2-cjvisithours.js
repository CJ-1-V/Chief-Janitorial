/* v2-cjvisithours.js – optional per-site visit-hour limits. Flags only.
   The owner sets "Min hours per visit" and "Max hours per visit" on the site hours row.
   They are saved on the site as minHours and maxHours by the same site-save path
   the app already uses (FORMS.shsave → save()). That save writes the whole site
   into the site JSON, so these are data.minHours and data.maxHours, next to
   data.ownerName (v2-cjownernames.js). They are hours, not money: they are not
   added to typed money columns, not formatted as dollars, and not concealed with
   the owner name.
   Typed columns min_hours / max_hours / typical_hours are proposed only
   (proposed/sql/028b_*.sql). They are not written here: the columns are not on
   the shared database until the owner says yes. An unknown column would fail
   the whole site save.
   A completed shift is flagged when its clocked duration (in → out, unchanged) is
   below min or above max. A completed shift is also flagged when that same
   clocked span crosses a daylight-saving change in America/Halifax (the 2 AM
   change), so the owner can confirm the hours. Nothing is rounded, capped, or
   rewritten. Pay and invoices are not touched. Sites with no limit are never
   flagged for range. typical_hours is a reference only and never flags a visit.
   The clock-change flag does not need a min or max. Flags show for the owner
   and admin only. Only the owner can edit the range. Crew, clients and team
   members do not see the flags. Clock in and clock out are not blocked.
   Duration uses the DST-safe hrs(in, out, date) from cursor/cj-bugsweep1 when
   that helper is loaded (hrs.length >= 3). Otherwise hours are computed from
   America/Halifax timestamps for the shift's start date.
   Mock only adds sample sites CJC130 (max 1.5h) and CJC140 (min 2h).
   Loads after the site-hours / payroll screens and before v2-keepscroll.js.
   Turn off: remove this script and css/cjvisithours.css from index.html. */
(function () {
  'use strict';
  if (typeof VIEWS === 'undefined' || typeof FORMS === 'undefined' || typeof afterRender !== 'function') return;

  /* Owner-approved typical hours per visit. Same list as proposed/sql/028b_typical_hours_seed.sql.
     Reference only. SDT114 is unknown. Not used as a min or a max. */
  var TYPICAL = { CPM105: 4, CPS106: 4, CPK107: 1.5, SLF108: 1.5, TDU102: 1.5, CBS101: 3.5, SDS111: 4, TDS103: 1, TDQ104: 3, CAL109: 1, CAS116: 2, CHB117: 2, SDC110: 4, KHH112: 5, GOI113: 3, CIB115: 1.5, CIB119: 1.5, CIB120: 1.5, SDT114: null };
  function roles() {
    if (typeof ME === 'undefined' || !ME) return [];
    if (ME.officeRoles && ME.officeRoles.length) return ME.officeRoles;
    return ME.officeRole ? [ME.officeRole] : [];
  }
  function canSee() {
    if (typeof ME === 'undefined' || !ME || ME.type !== 'admin') return false;
    var r = roles();
    if (!r.length) return !window.REG_LIVE;
    return r.indexOf('owner') >= 0 || r.indexOf('admin') >= 0;
  }
  function canEdit() {
    if (typeof cjOwnerSeesNames === 'function') return !!cjOwnerSeesNames();
    if (typeof ME === 'undefined' || !ME || ME.type !== 'admin') return false;
    var r = roles();
    if (!r.length) return !window.REG_LIVE;
    return r.indexOf('owner') >= 0;
  }
  window.vlCanSee = canSee;
  window.vlCanEdit = canEdit;
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
  function typicalOf(s) {
    if (!s) return null;
    if (s.typicalHours != null && s.typicalHours !== '') return numOrNull(s.typicalHours);
    var d = bag(s);
    if (d && d.typicalHours != null && d.typicalHours !== '') return numOrNull(d.typicalHours);
    if (Object.prototype.hasOwnProperty.call(TYPICAL, s.code)) return TYPICAL[s.code];
    return null;
  }
  function typicalKnown(s) {
    if (!s) return false;
    if (s.typicalHours != null && s.typicalHours !== '') return true;
    var d = bag(s);
    if (d && d.typicalHours != null && d.typicalHours !== '') return true;
    return Object.prototype.hasOwnProperty.call(TYPICAL, s.code);
  }
  window.vlTypical = function (code) { return typicalOf(siteOf(code) || { code: code }); };
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
  /* DST-safe duration. Prefer hrs(in, out, date) when cursor/cj-bugsweep1 has replaced hrs
     (that helper's length is 3). Otherwise compute from America/Halifax timestamps.
     The stored in/out are never written. */
  var HFX_TZ = 'America/Halifax', _hfxFmt = null;
  function hfxOffMin(ms) {
    try {
      _hfxFmt = _hfxFmt || new Intl.DateTimeFormat('en-US', { timeZone: HFX_TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      var o = {};
      _hfxFmt.formatToParts(new Date(ms)).forEach(function (x) { o[x.type] = x.value; });
      return (Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour % 24, +o.minute) - Math.floor(ms / 60000) * 60000) / 60000;
    } catch (e) { return -new Date(ms).getTimezoneOffset(); }
  }
  function hfxMs(date, min) {
    var x = String(date).slice(0, 10).split('-'), g = Date.UTC(+x[0], +x[1] - 1, +x[2]) + min * 60000;
    var o1 = hfxOffMin(g - hfxOffMin(g) * 60000), o2 = hfxOffMin(g - o1 * 60000);
    return g - Math.max(o1, o2) * 60000;
  }
  function hmMin(v) { var x = String(v || '').split(':'); return (+x[0]) * 60 + (+x[1]); }
  function hoursFromTimestamps(inn, out, date) {
    if (!inn || !out) return 0;
    var m = hmMin(out) - hmMin(inn);
    if (m < 0) m += 1440;
    if (!date || !/^\d{4}-\d{2}-\d{2}/.test(String(date))) return m / 60;
    var s = hmMin(inn);
    return Math.round((hfxMs(date, s + m) - hfxMs(date, s)) / 60000) / 60;
  }
  function clocked(t) {
    if (!t || !t.in || !t.out) return 0;
    if (typeof hrs === 'function' && hrs.length >= 3) return hrs(t.in, t.out, t.date);
    return hoursFromTimestamps(t.in, t.out, t.date);
  }
  window.vlClocked = clocked;
  /* True when the clocked span includes both sides of a Halifax clock change.
     Start and end are the same instants used for the duration. Stored times are not written. */
  function crossesDst(inn, out, date) {
    if (!inn || !out || !date || !/^\d{4}-\d{2}-\d{2}/.test(String(date))) return false;
    var s = hmMin(inn), m = hmMin(out) - s;
    if (!m) return false;
    if (m < 0) m += 1440;
    var start = hfxMs(date, s), end = hfxMs(date, s + m);
    if (!(end > start)) return false;
    return hfxOffMin(start) !== hfxOffMin(end);
  }
  window.vlCrossesDst = crossesDst;
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
  function dstFlagFor(t) {
    if (!t || t.test || !t.in || !t.out || t.lateEntry === 'rejected') return null;
    if (!crossesDst(t.in, t.out, t.date)) return null;
    var code = entrySite(t), s = siteOf(code);
    return { kind: 'dst', hours: clocked(t), site: s || { code: code }, code: code, t: t };
  }
  window.vlFlagFor = flagFor;
  window.vlDstFlag = dstFlagFor;
  function flagged() {
    var list = [];
    (DB.time || []).forEach(function (t) {
      var r = flagFor(t); if (r) list.push(r);
      var d = dstFlagFor(t); if (d) list.push(d);
    });
    return list.sort(function (a, b) {
      if (a.t.date !== b.t.date) return a.t.date < b.t.date ? 1 : -1;
      if ((a.t.in || '') !== (b.t.in || '')) return (a.t.in || '') < (b.t.in || '') ? 1 : -1;
      return a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0;
    });
  }
  function badgeText(f) {
    if (f.kind === 'dst') return 'Clock change: confirm hours (' + fmtH(f.hours) + 'h)';
    return (f.kind === 'over' ? 'Over max ' : 'Under min ') + fmtH(f.limit) + 'h (' + fmtH(f.hours) + 'h)';
  }
  function badgeKey(f) { return String(f.t.id) + (f.kind === 'dst' ? ':dst' : ''); }
  function badgeHtml(f) {
    var cls = f.kind === 'under' ? 's-bad' : 's-warn';
    return '<span class="pill vl-flag ' + cls + (f.kind === 'dst' ? ' vl-dst' : '') + '" data-vl="' + esc(badgeKey(f)) + '">' + esc(badgeText(f)) + '</span>';
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
      if (!s || !canEdit()) return prevSave(f, d);
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
  function typicalLine(s) {
    if (!typicalKnown(s)) return '';
    var t = typicalOf(s);
    return '<div class="hint vl-typical">Typical visit (reference only, not a limit): ' + (t == null ? 'not set' : esc(fmtH(t)) + ' h') + '</div>';
  }
  function editHtml(s) {
    var L = limits(s);
    return '<div class="vl-edit" data-vl-edit="' + esc(s.code) + '"><div class="vl-k">Visit limits (optional)</div><div class="vl-labs">' +
      field('minHours', 'Min hours per visit', L.min, s.code) +
      field('maxHours', 'Max hours per visit', L.max, s.code) +
      '</div>' + typicalLine(s) + '<div class="hint vl-hint">Flag only. Does not change clocked time, pay or invoices. Use Save on this row.</div>' +
      flagsHtml(flagged().filter(function (f) { return f.code === s.code; }).slice(0, 4)) + '</div>';
  }
  function readOnlyHtml(s) {
    var L = limits(s), bits = [];
    if (L.min != null) bits.push('Min ' + fmtH(L.min) + ' h');
    if (L.max != null) bits.push('Max ' + fmtH(L.max) + ' h');
    var flags = flagsHtml(flagged().filter(function (f) { return f.code === s.code; }).slice(0, 4));
    var tip = typicalLine(s);
    if (!bits.length && !flags && !tip) return '';
    return '<div class="vl-edit vl-readonly" data-vl-edit="' + esc(s.code) + '">' +
      (bits.length ? '<div class="vl-ro">' + esc(bits.join(' · ')) + ' per visit <span class="small muted">(flag only)</span></div>' : '') +
      tip + flags + '</div>';
  }

  function homeCard() {
    var all = flagged(), list = all.slice(0, 8);
    var rows = list.map(function (f) {
      var nm = typeof cjSiteLabel === 'function' ? cjSiteLabel(f.site) : (f.site && f.site.name && f.site.name !== f.code ? f.code + ' · ' + f.site.name : f.code);
      return '<li class="vl-row"><span class="vl-who"><b>' + esc(who(f.t.userId)) + '</b></span><span class="vl-site">' + esc(nm) + '</span><span class="vl-date">' + esc((typeof shortDay === 'function' ? shortDay(f.t.date) + ' ' : '') + String(f.t.date).slice(0, 4)) + '</span><span class="vl-hrs">' + esc(fmtH(f.hours)) + 'h clocked</span>' + badgeHtml(f) + '</li>';
    }).join('');
    return '<div class="card vl-card" id="vllimits"><h2>Hours to confirm' + (all.length ? ' <span class="pill s-warn">' + all.length + '</span>' : '') + '</h2>' +
      '<p class="small muted">Completed shifts under a site’s minimum, over its maximum, or whose clocked time crosses a daylight-saving change (2 AM, America/Halifax). This is a flag only. Clocked time, pay and invoices are not changed. Please confirm these hours.</p>' +
      (all.length ? '<ul class="vl-list">' + rows + '</ul>' : '<p class="muted" id="vlnone">None right now.</p>') + '</div>';
  }

  function addBadge(cell, f) {
    if (!cell || cell.querySelector('[data-vl="' + badgeKey(f) + '"]')) return;
    var box = cell.querySelector('.vl-flags');
    if (!box) { cell.insertAdjacentHTML('beforeend', '<div class="vl-flags"></div>'); box = cell.querySelector('.vl-flags'); }
    box.insertAdjacentHTML('beforeend', badgeHtml(f));
  }

  function decorate(root) {
    if (!canSee() || !root || root.id !== 'app') return;
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
        var html = canEdit() ? editHtml(s) : readOnlyHtml(s);
        if (html) tr.cells[0].insertAdjacentHTML('beforeend', html);
      });
    }
    if (h === '#/dayvisits') {
      var day = (typeof PAGE_STATE !== 'undefined' && PAGE_STATE.lnDay) || (typeof today === 'function' ? today() : '');
      var dayTable = main.querySelector('#lndaytable');
      if (dayTable && dayTable.rows) {
        flagged().forEach(function (f) {
          if (String(f.t.date) !== String(day)) return;
          var name = who(f.t.userId);
          [].forEach.call(dayTable.rows, function (tr, i) {
            if (!i || tr.cells.length < 2) return;
            if ((tr.cells[0].textContent || '').indexOf(f.code) < 0) return;
            if ((tr.cells[1].textContent || '').indexOf(name) < 0) return;
            addBadge(tr.cells[2] || tr.cells[0], f);
          });
        });
      }
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
            if (!hold || (hold.querySelector && hold.querySelector('[data-vl="' + badgeKey(f) + '"]'))) return;
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
