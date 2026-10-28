/* calendar1 – "Schedule waxing" (owner, Oct 21 2026). TEST copy, mock store, FAKE data only.
   Client (main account or team member) asks for a preferred month + days/weekdays (+ site, notes). No 3-day rule, no prices.
   Creates a 'Waxing' request (DB.waxReqs, WX-0001…) in the office calendar requests inbox; notifies office + client main account.
   Office (owner/admin/ops) confirms with a date + time → a 'Waxing' visit (DB.waxVisits) on client + assigned-cleaner calendars
   (own colour), everyone notified; or replies with a note offering another date. Every action audited. */
(function () {
  if (typeof VIEWS === 'undefined' || typeof ACT === 'undefined') return;
  var DOWL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  var MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var TEXT = 'Get in touch with the Chief Janitorial office. Please set your preferred month and days. The office will reach out to confirm if it’s possible, or arrange another date. The confirmed date will show up on your calendar.';
  window.CJ_WAX_TEXT = TEXT;
  function W() { return DB.waxReqs = DB.waxReqs || []; }
  function WV() { return DB.waxVisits = DB.waxVisits || []; }
  function site(c) { return (DB.sites || []).filter(function (s) { return s.code === c; })[0] || null; }
  function roles() { return (ME && ME.officeRoles) || (ME && ME.officeRole ? [ME.officeRole] : []); }
  function canManage() { if (!ME || ME.type !== 'admin') return false; var r = roles(); return !r.length || r.some(function (x) { return ['owner', 'admin', 'ops'].indexOf(x) >= 0; }); }
  function mine() { return typeof calMySitesFull === 'function' ? calMySitesFull() : []; }
  function mLabel(m) { return MONL[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4); }
  function t12(t) { if (!t) return ''; var H = +t.slice(0, 2), M = t.slice(3, 5); return ((H % 12) || 12) + (M !== '00' ? ':' + M : '') + (H < 12 ? ' am' : ' pm'); }
  function dLong(d) { var x = parseD(d); return DOWL[(x.getDay() + 6) % 7] + ', ' + MONL[x.getMonth()].slice(0, 3) + ' ' + x.getDate() + ', ' + x.getFullYear(); }
  function daysIn(m) { var n = new Date(+m.slice(0, 4), +m.slice(5, 7), 0).getDate(), l = []; for (var i = 1; i <= n; i++) l.push(m + '-' + String(i).padStart(2, '0')); return l; }
  function no() { DB.waxSeq = (DB.waxSeq || 0) + 1; return 'WX-' + String(DB.waxSeq).padStart(4, '0'); }
  function who() { var L = typeof clLoginOf === 'function' ? clLoginOf(ME) : ME; return typeof calWhoBy === 'function' ? calWhoBy() : (L || ME).name; }
  function prefTxt(r) { return mLabel(r.month) + (r.days && r.days.length ? ' – ' + r.days.map(function (d) { return /^\d{4}/.test(d) ? +d.slice(8) : d; }).join(', ') : ' – any day'); }
  window.waxDesc = function (r) { return 'Waxing at ' + r.site + ', preferred ' + prefTxt(r); };

  /* ---------- logic (also used by tests) ---------- */
  window.waxRequest = function (o) {
    if (!ME || ME.type !== 'firm') return { ok: false, msg: 'Only clients can ask for waxing.' };
    o = o || {}; var my = mine(), code = o.site || (my.length === 1 ? my[0].code : '');
    if (!code) return { ok: false, msg: 'Pick the site.' };
    if (!my.some(function (s) { return s.code === code; })) return { ok: false, msg: 'Not allowed – you can only ask for your own sites.' };
    if (!/^\d{4}-\d\d$/.test(o.month || '')) return { ok: false, msg: 'Pick the preferred month.' };
    if (o.month < today().slice(0, 7)) return { ok: false, msg: 'Pick this month or a later one.' };
    var days = (o.days || []).filter(function (d) { return DOWL.indexOf(d) >= 0 || (/^\d{4}-\d\d-\d\d$/.test(d) && d.slice(0, 7) === o.month); });
    var r = { id: 'wx' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), no: no(), kind: 'waxing', firmId: ME.id, firmName: ME.name, site: code, month: o.month, days: days, note: String(o.note || '').slice(0, 500), status: 'pending', createdBy: who(), createdAt: new Date().toISOString() };
    W().unshift(r);
    audit('Waxing request sent', code, r.no + ' ' + waxDesc(r) + ' (by ' + r.createdBy + ')');
    notify('admin', 'Waxing request ' + r.no + ' from ' + ME.name + ' (by ' + r.createdBy + '): ' + waxDesc(r) + ' – please confirm a date.', 'wax|' + r.id + '|new');
    notify([ME.id], 'Waxing request ' + r.no + ' sent by ' + r.createdBy + ': ' + waxDesc(r) + '. The office will confirm the date.', 'wax|' + r.id + '|client');
    save(); return { ok: true, req: r, msg: 'Sent – the office will reach out to confirm the date. Status: pending.' };
  };
  window.waxConfirm = function (id, date, start, note) {
    if (!canManage()) return { ok: false, msg: 'Only the owner, admin or operations can confirm waxing.' };
    var r = W().filter(function (x) { return x.id === id || x.no === id; })[0]; if (!r) return { ok: false, msg: 'Request not found.' };
    if (r.status !== 'pending' && r.status !== 'other-date') return { ok: false, msg: 'Already ' + r.status + '.' };
    if (!/^\d{4}-\d\d-\d\d$/.test(date || '')) return { ok: false, msg: 'Pick the waxing date.' };
    if (!/^\d\d:\d\d$/.test(start || '')) return { ok: false, msg: 'Pick the start time.' };
    r.status = 'confirmed'; r.date = date; r.start = start; r.officeNote = String(note || '').slice(0, 300); r.decidedBy = ME.name; r.decidedAt = new Date().toISOString();
    WV().push({ no: r.no, reqId: r.id, site: r.site, date: date, start: start });
    var s = site(r.site), msg = 'Waxing confirmed (' + r.no + '): ' + r.site + ' on ' + dLong(date) + ' at ' + t12(start) + '. It is on the calendar.' + (r.officeNote ? ' Note: ' + r.officeNote : '');
    audit('Waxing confirmed', r.site, r.no + ' ' + date + ' ' + start + ' by ' + ME.name);
    notify([r.firmId], msg, 'wax|' + r.id + '|ok');
    if (s && (s.crew || []).length) notify(s.crew.slice(), 'Waxing added (' + r.no + '): ' + r.site + ' on ' + dLong(date) + ' at ' + t12(start) + '.', 'wax|' + r.id + '|crew');
    save(); return { ok: true, req: r, msg: msg };
  };
  window.waxOtherDate = function (id, note) {
    if (!canManage()) return { ok: false, msg: 'Only the owner, admin or operations can reply.' };
    var r = W().filter(function (x) { return x.id === id || x.no === id; })[0]; if (!r) return { ok: false, msg: 'Request not found.' };
    note = String(note || '').trim(); if (!note) return { ok: false, msg: 'Write the note offering another date.' };
    r.status = 'other-date'; r.officeNote = note.slice(0, 300); r.decidedBy = ME.name; r.decidedAt = new Date().toISOString();
    audit('Waxing – other date offered', r.site, r.no + ' ' + note);
    notify([r.firmId], 'Waxing ' + r.no + ' (' + r.site + '): the office offers another date – ' + r.officeNote, 'wax|' + r.id + '|other');
    save(); return { ok: true, req: r };
  };
  /* visits for the calendar (called from v2-cjcalendar.js visits()) */
  window.calWaxVisits = function (from, to, codes) {
    return WV().filter(function (v) { return v.date >= from && v.date <= to && codes.indexOf(v.site) >= 0; }).map(function (w) {
      var s = site(w.site) || {}; return { id: 'WAX:' + w.no, wax: true, no: w.no, site: w.site, name: s.name || w.site, date: w.date, orig: w.date, start: w.start, hours: 2, crew: (s.crew || []).length, status: 'scheduled' };
    });
  };

  /* ---------- client sheet ---------- */
  function sheet(m) {
    var my = mine(); m = m || today().slice(0, 7);
    var months = []; for (var i = 0; i < 12; i++) { var d = new Date(+today().slice(0, 4), +today().slice(5, 7) - 1 + i, 1); months.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')); }
    return '<div class="calsheet" id="calwaxsheet"><h2>Schedule waxing</h2><p id="calwaxtext">' + TEXT + '</p>' +
      '<form data-form="calwax">' +
      (my.length > 1 ? '<label>Site<select name="site"><option value="">Pick the site…</option>' + my.map(function (s) { return '<option value="' + esc(s.code) + '">' + esc(typeof cjSiteLabel === 'function' ? cjSiteLabel(s) : (s.name && s.name !== s.code ? s.code + ' – ' + s.name : s.code)) + '</option>'; }).join('') + '</select></label>' : '<p class="small muted">Site: <b>' + esc(my[0] ? (typeof cjSiteLabel === 'function' ? cjSiteLabel(my[0]) : my[0].code) : '–') + '</b></p>') +
      '<label>Preferred month<select name="month" data-calwaxmonth="1">' + months.map(function (x) { return '<option value="' + x + '"' + (x === m ? ' selected' : '') + '>' + mLabel(x) + '</option>'; }).join('') + '</select></label>' +
      '<div><b class="small">Preferred weekdays</b><div class="calwaxdays" id="calwaxwd">' + DOWL.map(function (d) { return '<label><input type="checkbox" name="wd" value="' + d + '"> ' + d.slice(0, 3) + '</label>'; }).join('') + '</div></div>' +
      '<div><b class="small">…or preferred dates in ' + mLabel(m) + '</b><div class="calwaxdays" id="calwaxdates">' + daysIn(m).filter(function (d) { return d >= today(); }).map(function (d) { return '<label><input type="checkbox" name="dt" value="' + d + '"> ' + +d.slice(8) + '</label>'; }).join('') + '</div></div>' +
      '<label>Notes (optional)<textarea name="note" maxlength="500" rows="2" placeholder="Anything the office should know"></textarea></label>' +
      '<p class="small muted" id="calwaxmsg"></p><div class="row"><button type="submit">Send to the office</button><button type="button" class="sec" data-act="closeModal">Close</button></div></form></div>';
  }
  window.calWaxSheet = sheet;
  ACT.calwax = function () { if (!ME || ME.type !== 'firm') return; modal(sheet()); };
  document.addEventListener('change', function (e) { var t = e.target; if (t && t.dataset && t.dataset.calwaxmonth) { var f = t.form, s = f.site ? f.site.value : ''; var mm = document.querySelector('.modal'); if (!mm) return; modal(sheet(t.value)); var nf = document.querySelector('form[data-form=calwax]'); if (nf && nf.site) nf.site.value = s; } });
  FORMS.calwax = function (f) {
    var g = function (n) { return [].slice.call(f.querySelectorAll('input[name=' + n + ']:checked')).map(function (x) { return x.value; }); };
    var r = waxRequest({ site: f.site ? f.site.value : '', month: f.month.value, days: g('wd').concat(g('dt')), note: f.note.value });
    var m = document.getElementById('calwaxmsg');
    if (!r.ok) { if (m) m.textContent = r.msg; return; }
    closeModal && closeModal(); toast(r.msg); render();
  };
  /* visit sheet for a waxing visit */
  var ocv = ACT.calvisit; ACT.calvisit = function (el) {
    var id = el.dataset.id || ''; if (id.indexOf('WAX:') !== 0) return ocv.apply(this, arguments);
    var w = WV().filter(function (x) { return 'WAX:' + x.no === id; })[0]; if (!w || !calCanSite(w.site)) { toast('Not allowed – you can only see your own sites.'); return; }
    var s = site(w.site) || {};
    modal('<div class="calsheet" id="calsheet"><h2>Waxing</h2><p class="small muted">' + esc(typeof cjSiteLabel === 'function' ? cjSiteLabel(s.code ? s : w.site) : w.site) + '</p><div class="calfacts"><div><small>Date</small><b>' + dLong(w.date) + '</b></div><div><small>Time</small><b>' + t12(w.start) + '</b></div><div><small>Service</small><b>Waxing</b></div></div><p class="small muted">Confirmed by the office (' + esc(w.no) + '). To change it, contact the office.</p><div class="row"><button type="button" class="sec" data-act="closeModal">Close</button></div></div>');
  };

  /* ---------- office inbox ---------- */
  function inbox() {
    var l = W(), pend = l.filter(function (r) { return r.status === 'pending' || r.status === 'other-date'; }), rest = l.filter(function (r) { return pend.indexOf(r) < 0; }).slice(0, 20);
    var row = function (r) {
      var open = (r.status === 'pending' || r.status === 'other-date') && canManage();
      return '<div class="calreq calwaxreq st-' + esc(r.status) + '" data-wax="' + esc(r.no) + '"><div class="calreq-h"><b>' + esc(r.no) + ' · Waxing</b> <span class="pill ' + (r.status === 'confirmed' ? 's-ok' : 's-pend') + '">' + (r.status === 'other-date' ? 'other date offered' : esc(r.status)) + '</span><span class="small muted"> ' + esc(r.firmName) + ' · by ' + esc(r.createdBy) + ' · ' + fmtStamp(r.createdAt) + '</span></div>' +
        '<div>' + esc(waxDesc(r)) + (r.date ? ' → <b>' + dLong(r.date) + ' ' + t12(r.start) + '</b>' : '') + '</div>' + (r.note ? '<div class="small muted">Client note: ' + esc(r.note) + '</div>' : '') + (r.officeNote ? '<div class="small">Office note: ' + esc(r.officeNote) + '</div>' : '') +
        (open ? '<div class="row calreq-a"><input type="date" id="waxd-' + esc(r.id) + '" min="' + today() + '"><input type="time" id="waxt-' + esc(r.id) + '" value="18:00"><input type="text" maxlength="300" id="waxn-' + esc(r.id) + '" placeholder="Note to the client (needed to offer another date)"><button type="button" class="small" data-act="waxok" data-id="' + esc(r.id) + '">Confirm date</button><button type="button" class="small sec" data-act="waxother" data-id="' + esc(r.id) + '">Offer another date</button></div><p class="small muted" id="waxm-' + esc(r.id) + '"></p>' : '') + '</div>';
    };
    return '<div class="card calinbox" id="calwaxinbox"><h2>Waxing requests <span class="pill ' + (pend.length ? 's-pend' : 's-ok') + '">' + pend.length + ' open</span></h2><p class="small muted">No 3-day rule. Confirming adds a Waxing visit to the client’s and the assigned cleaners’ calendars and tells them.</p>' +
      (pend.length ? pend.map(row).join('') : '<p class="muted">No waxing requests waiting.</p>') + (rest.length ? '<h3>Recent</h3>' + rest.map(row).join('') : '') + '</div>';
  }
  var g = function (i) { var e = document.getElementById(i); return e ? e.value : ''; };
  ACT.waxok = function (el) { var i = el.dataset.id, r = waxConfirm(i, g('waxd-' + i), g('waxt-' + i), g('waxn-' + i)); if (!r.ok) { var m = document.getElementById('waxm-' + i); if (m) m.textContent = r.msg; return; } toast('Waxing confirmed – on the calendar.'); render(); };
  ACT.waxother = function (el) { var i = el.dataset.id, r = waxOtherDate(i, g('waxn-' + i)); if (!r.ok) { var m = document.getElementById('waxm-' + i); if (m) m.textContent = r.msg; return; } toast('Reply sent to the client.'); render(); };
  ['admin:calrequests', 'calendar'].forEach(function (k) { if (typeof VIEWS[k] !== 'function') return; var o = VIEWS[k]; VIEWS[k] = function () { var x = o.apply(this, arguments); if (!ME || ME.type !== 'admin') return x; return x.replace(/(<div class="card calinbox" id="calinbox">)/, inbox() + '$1'); }; });
  /* client requests page: waxing requests with who made them + status */
  if (typeof VIEWS['firm:requests'] === 'function') { var ofr = VIEWS['firm:requests']; VIEWS['firm:requests'] = function () {
    var x = ofr.apply(this, arguments); if (!ME || ME.type !== 'firm') return x; var codes = mine().map(function (s) { return s.code; }), l = W().filter(function (r) { return r.firmId === ME.id && codes.indexOf(r.site) >= 0; });
    return x + '<div class="card" id="calwaxmine"><h2>Waxing requests</h2>' + (l.length ? '<div class="tw"><table><tr><th>No.</th><th>Request</th><th>Made by</th><th>Status</th><th>Office note</th></tr>' + l.map(function (r) { return '<tr><td>' + esc(r.no) + '</td><td>' + esc(waxDesc(r)) + (r.date ? ' → ' + dLong(r.date) + ' ' + t12(r.start) : '') + '</td><td>' + esc(r.createdBy) + '</td><td>' + esc(r.status === 'other-date' ? 'other date offered' : esc(r.status)) + '</td><td>' + esc(r.officeNote || '') + '</td></tr>'; }).join('') + '</table></div>' : '<p class="muted">No waxing requests yet.</p>') + '</div>';
  }; }
})();
