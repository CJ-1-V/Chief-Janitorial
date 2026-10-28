/* v2-cjxinv.js – Extra work invoice (separate from the monthly invoice).
   Owner request: another choice to invoice additional work at any site, with details and amounts on the invoice.
   Storage: the same client-invoice list and CJ-YYYY-NNN numbers. The whole invoice (date, site, lines, note,
   amounts) sits in the invoice JSON. No new columns: lines are workLines, not extraLines / siteLines / month / hstOn,
   so the live save does not send the typed columns from the unrun flat-monthly draft.
   Who can create one: office owner, admin and ops (mock office login with no role is allowed, same as other office tools).
   Monthly invoices stay owner-only. HST follows the client's existing on/off at 15%. Payment wording matches the
   current Chief Janitorial invoice. Loads last. */
'use strict';
(function () {
  if (typeof NAV === 'undefined' || typeof VIEWS === 'undefined' || typeof ACT === 'undefined') return;
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function r2(n) { return Math.round((+n || 0) * 100) / 100; }
  function rate() { return +((window.CJ_COMPANY && CJ_COMPANY.hstRate) || 0.15); }
  function co() { return window.CJ_COMPANY || {}; }
  function longDate(d) { return d ? +d.slice(8, 10) + ' ' + MONTHS[+d.slice(5, 7) - 1] + ' ' + d.slice(0, 4) : ''; }
  function roles() { return (ME && ME.officeRoles) || (ME && ME.officeRole ? [ME.officeRole] : []); }
  function cjxCan() {
    if (!ME || ME.type !== 'admin') return false;
    var r = roles();
    if (!r.length) return true;
    return r.some(function (x) { return x === 'owner' || x === 'admin' || x === 'ops'; });
  }
  window.cjxCan = cjxCan;
  function deny() { toast('You can\'t make an extra work invoice with this login.'); }
  function everyInv() { return (DB && (DB.__ivReal || DB.clientInvoices)) || []; }
  function siteOf(code) { return (DB.sites || []).filter(function (s) { return s.code === code; })[0] || null; }
  function sites() {
    return (DB.sites || []).filter(function (s) {
      return s && s.code && s.code !== 'TEST-PRACTICE' && (s.companyId || 'cj') === 'cj' && s.firmId && user(s.firmId);
    }).sort(function (a, b) { return a.code < b.code ? -1 : 1; });
  }
  function hstOn(firm) {
    try { var rs = typeof farmRatesCur === 'function' ? farmRatesCur(firm) : null; return rs ? rs.hst !== false : true; }
    catch (e) { return true; }
  }
  function findInv(id) {
    var i = typeof invById === 'function' ? invById(id) : null;
    if (i) return i;
    return everyInv().filter(function (x) { return x.id === id; })[0] || null;
  }
  function extras(firm) {
    return everyInv().filter(function (i) { return i && i.extraWork && (!firm || i.firmId === firm.id); })
      .sort(function (a, b) { return (a.issued || '') < (b.issued || '') ? 1 : (a.issued || '') > (b.issued || '') ? -1 : (a.number < b.number ? 1 : -1); });
  }
  function nextNumber() {
    var y = today().slice(0, 4), n = everyInv().length + 1, all = everyInv();
    function num(k) { return 'CJ-' + y + '-' + String(k).padStart(3, '0'); }
    function taken(v) { var u = String(v).replace(/\s+/g, '').toUpperCase(); return all.some(function (i) { return String(i.number || '').replace(/\s+/g, '').toUpperCase() === u; }); }
    while (taken(num(n))) n++;
    return num(n);
  }
  function storeInv(inv) {
    if (DB.__ivReal) {
      DB.__ivReal.push(inv);
      if (DB.clientInvoices && DB.clientInvoices !== DB.__ivReal && !DB.clientInvoices.some(function (x) { return x.id === inv.id; })) DB.clientInvoices.push(inv);
    } else (DB.clientInvoices = DB.clientInvoices || []).push(inv);
  }
  function sums(list) {
    var a = 0, h = 0, t = 0, o = 0;
    (list || []).forEach(function (i) {
      var it = typeof clientInvInterest === 'function' ? clientInvInterest(i) : { amount: 0 };
      a += +i.amount || 0; h += +i.hst || 0; t += +i.total || 0;
      o += i.paidAt ? 0 : (+i.total || 0) + (+it.amount || 0);
    });
    return { amount: r2(a), hst: r2(h), total: r2(t), owing: r2(o) };
  }
  function totalsHtml(list, id) {
    var s = sums(list);
    return '<p class="small cjx-totals" id="' + id + '" data-amount="' + s.amount.toFixed(2) + '" data-hst="' + s.hst.toFixed(2) + '" data-total="' + s.total.toFixed(2) + '" data-owing="' + s.owing.toFixed(2) + '"><b>Totals:</b> amount ' + money(s.amount) + ' · HST ' + money(s.hst) + ' · total ' + money(s.total) + ' · now owing ' + money(s.owing) + '</p>';
  }
  function lineBits(i) { return (i.workLines || []).map(function (l) { return esc(l.desc) + ' <b>' + money(l.amount) + '</b>'; }).join('; '); }
  function owingOf(i) { var it = typeof clientInvInterest === 'function' ? clientInvInterest(i) : { amount: 0 }; return i.paidAt ? 0 : r2((+i.total || 0) + (+it.amount || 0)); }

  /* an extra-work day must not count as the monthly invoice already being issued */
  if (typeof mtInvoiced === 'function') {
    var _mt = mtInvoiced;
    mtInvoiced = function (site, date) {
      var hit = _mt.apply(this, arguments);
      if (!hit) return null;
      var f = typeof firmOfSite === 'function' ? firmOfSite(site) : null;
      if (!f) return hit.extraWork ? null : hit;
      var src = everyInv();
      var monthly = src.filter(function (i) {
        return i && !i.extraWork && i.firmId === f.id && i.periodStart && i.periodStart <= date && date <= (i.periodEnd || i.periodStart);
      })[0] || null;
      if (hit.extraWork) return monthly || null;
      if (hit.ivPeriod) return monthly ? hit : null;
      return hit;
    };
  }

  /* ---------- invoice document (screen, print and PDF share invDoc) ---------- */
  function extraDoc(i) {
    var f = user(i.firmId), st = typeof invPlain === 'function' ? invPlain(i) : { t: i.paidAt ? 'Paid' : 'Unpaid', d: '' };
    var it = typeof clientInvInterest === 'function' ? clientInvInterest(i) : { amount: 0, months: 0 };
    var C = co(), L = [], rt = rate();
    L.push(['h', C.name || 'Chief Janitorial Inc.']);
    L.push(['s', C.address || 'Unit I, 56 Burns Avenue, Charlottetown PE C1E 2G1']);
    L.push(['s', (C.phoneShort || C.phone || '') + ' | ' + (C.email || 'admin@chiefjanitorial.com') + (C.web ? ' | ' + C.web : '')]);
    if (C.taxNo) L.push(['s', C.taxNo]);
    if (typeof cjMockInv === 'function' && cjMockInv()) L.push(['s', 'TEST VERSION – sample invoice made by the test app, not a real invoice']);
    L.push(['g']);
    L.push(['b', 'Invoice ' + i.number]);
    L.push(['t', 'Billed to: ' + (f ? f.name : '')]);
    L.push(['t', 'Invoice date: ' + longDate(i.workDate || i.issued)]);
    L.push(['t', 'Extra work' + (i.site ? ' at ' + i.site + (i.siteName ? ' – ' + i.siteName : '') : '')]);
    L.push(['t', 'Due: ' + longDate(i.due) + ' | Status: ' + (st.t || '') + (i.paidAt ? ' ' + longDate(i.paidAt) : '')]);
    L.push(['g']);
    L.push(['t', 'Additional work:']);
    (i.workLines || []).forEach(function (l) { L.push(['r', '  ' + l.desc, money(l.amount)]); });
    if (i.note) L.push(['s', 'Note: ' + i.note]);
    L.push(['g']);
    L.push(['r', 'Subtotal', money(i.amount)]);
    L.push(['r', i.hst ? ((C.taxNo || 'GST/HST') + ' @ ' + (rt * 100).toFixed(1) + '%') : 'HST (not charged)', money(i.hst)]);
    L.push(['rb', 'TOTAL', money(i.total)]);
    if (it.amount && !i.paidAt) L.push(['r', 'Interest on balance more than 2 months overdue (' + it.months + ' month(s) × ' + (i.interestPct || 2) + '%)', money(it.amount)]);
    if (i.paidAt && i.interestCharged) L.push(['r', 'Interest charged when paid', money(i.interestCharged)]);
    L.push(['rb', 'Now owing', money(i.paidAt ? 0 : r2(i.total + (it.amount || 0)))]);
    L.push(['g']);
    L.push(['s', (C.name || 'Chief Janitorial Inc.').toUpperCase() + ' consists of a team of professional cleaners dedicated to helping you maintain a clean and tidy space.']);
    L.push(['s', 'Payment is due within one month of the date this invoice is received by the customer.']);
    L.push(['s', 'Payment options: Interac e-transfer to ' + (C.email || 'admin@chiefjanitorial.com') + ', or cheque payable to ' + (C.name || 'Chief Janitorial Inc.') + ', mailed to ' + (C.address || 'Unit I, 56 Burns Avenue, Charlottetown PE C1E 2G1') + '.']);
    L.push(['s', 'Late payment: interest of 2% per month applies to balances more than 2 months overdue.']);
    L.push(['s', 'Thank you for your business! Please contact us at ' + (C.email || 'admin@chiefjanitorial.com') + ' or ' + (C.phoneShort || C.phone || '') + ' with any questions about this invoice.']);
    return L;
  }
  if (typeof invDoc === 'function') {
    var _doc = invDoc;
    invDoc = function (i) {
      if (typeof cjtIsTeam === 'function' && cjtIsTeam()) return _doc.apply(this, arguments);
      if (i && i.extraWork) return extraDoc(i);
      return _doc.apply(this, arguments);
    };
    window.invDoc = invDoc;
  }
  if (typeof invHtml === 'function') {
    var _html = invHtml;
    invHtml = function (i) {
      var x = _html.apply(this, arguments);
      if (i && i.extraWork) x = x.replace('class="invdoc"', 'class="invdoc" id="cjxinvdoc"');
      return x;
    };
    window.invHtml = invHtml;
  }

  /* ---------- create form ---------- */
  function lineHtml() {
    return '<div class="cjx-line"><div><label>Details</label><input type="text" name="desc[]" maxlength="200" required placeholder="What was done" data-calc="cjx" aria-label="Details"></div>' +
      '<div><label>Amount ($)</label><input type="number" name="amt[]" min="0.01" max="1000000" step="0.01" required placeholder="0.00" data-calc="cjx" aria-label="Amount before HST"></div>' +
      '<button type="button" class="small sec" data-act="cjxrm">Remove</button></div>';
  }
  function formHtml() {
    var S = sites();
    return '<form data-form="cjxinv" id="cjxform">' +
      '<p class="small muted">A separate invoice for additional work at one site. It does not change the monthly invoice. Amounts are before HST.</p>' +
      '<div><label class="req">Site</label><select name="site" id="cjxsite" required data-calc="cjx" aria-label="Site"><option value="">Choose a site…</option>' +
      S.map(function (s) { var f = user(s.firmId); return '<option value="' + esc(s.code) + '">' + esc(s.code + ' – ' + s.name + (f ? ' – ' + f.name : '')) + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="cjx-date">' + inp('date', 'Invoice date', today(), { type: 'date', req: true }) + '</div>' +
      '<div id="cjxlines">' + lineHtml() + '</div>' +
      '<p class="row"><button type="button" class="small sec" id="cjxadd" data-act="cjxadd">Add a line</button></p>' +
      '<div><label>Note (optional – shown on the invoice)</label><textarea name="note" id="cjxnote" maxlength="500" rows="2" placeholder="Anything else the client should see"></textarea></div>' +
      '<div class="cjx-sum" id="cjxsum" aria-live="polite"></div>' +
      '<div class="row"><button type="submit" id="cjxsave">Create extra work invoice</button><button type="button" class="sec" data-act="closeModal">Cancel</button></div></form>';
  }
  function readDomLines(f) {
    var d = [].map.call(f.querySelectorAll('[name="desc[]"]'), function (el) { return el.value; });
    var a = [].map.call(f.querySelectorAll('[name="amt[]"]'), function (el) { return el.value; });
    var n = Math.max(d.length, a.length), out = [];
    for (var i = 0; i < n; i++) out.push({ desc: String(d[i] || '').trim().replace(/\s+/g, ' '), amt: String(a[i] == null ? '' : a[i]).trim() });
    return out;
  }
  function cjxPreview(f) {
    var out = document.getElementById('cjxsum'); if (!f || !out) return;
    var s = siteOf(f.site && f.site.value), firm = s && s.firmId ? user(s.firmId) : null, on = firm ? hstOn(firm) : true;
    var sub = 0, bad = false;
    readDomLines(f).forEach(function (l) { if (l.amt === '') return; var v = +l.amt; if (!(v >= 0)) { bad = true; return; } sub += v; });
    sub = r2(sub); var h = on && !bad ? r2(sub * rate()) : 0;
    out.className = 'cjx-sum' + (bad ? ' bad' : '');
    out.innerHTML = (firm ? 'Billed to <b>' + esc(firm.name) + '</b>. ' : '') +
      (on ? 'HST ' + (rate() * 100) + '% is added.' : 'HST is not charged for this client.') +
      '<div>Subtotal <b>' + money(sub) + '</b> · HST <b>' + money(h) + '</b> · Total <b id="cjxprevtotal">' + money(r2(sub + h)) + '</b></div>';
  }
  window.cjxPreview = cjxPreview;
  CALC.cjx = function (el) { cjxPreview(el && el.form); };
  ACT.cjxopenform = function () {
    if (!cjxCan()) { deny(); return; }
    if (!sites().length) { toast('No site with a client is set up yet.'); return; }
    modal('<h2>Extra work invoice</h2>' + formHtml());
    cjxPreview(document.getElementById('cjxform'));
  };
  ACT.cjxadd = function (el) {
    if (!cjxCan()) { deny(); return; }
    var box = document.getElementById('cjxlines'); if (!box) return;
    if (box.querySelectorAll('.cjx-line').length >= 20) { toast('An invoice can have up to 20 lines.'); return; }
    box.insertAdjacentHTML('beforeend', lineHtml());
    var last = box.querySelector('.cjx-line:last-child input'); if (last) last.focus();
  };
  ACT.cjxrm = function (el) {
    if (!cjxCan()) { deny(); return; }
    var box = document.getElementById('cjxlines'), row = el.closest('.cjx-line'); if (!box || !row) return;
    if (box.querySelectorAll('.cjx-line').length < 2) { toast('Keep at least one line.'); return; }
    row.remove(); cjxPreview(document.getElementById('cjxform'));
  };
  function moneyOk(raw) {
    if (raw === '' || raw == null) return false;
    var v = +raw;
    return v > 0 && v <= 1000000 && Math.abs(Math.round(v * 100) - v * 100) < 1e-6;
  }
  FORMS.cjxinv = function (f, d) {
    if (!cjxCan()) { deny(); return; }
    var s = siteOf(d.site); if (!s || s.code === 'TEST-PRACTICE' || (s.companyId || 'cj') !== 'cj' || !s.firmId) { toast('Choose a site.'); return; }
    var firm = user(s.firmId); if (!firm || firm.type !== 'firm') { toast('That site has no client.'); return; }
    var date = String(d.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { toast('Enter the invoice date.'); return; }
    if (date > today()) { toast('The invoice date cannot be after today.'); return; }
    if (date < '2000-01-01') { toast('Enter an invoice date.'); return; }
    var desc = d.desc, amt = d.amt;
    if (desc != null && !Array.isArray(desc)) desc = [desc];
    if (amt != null && !Array.isArray(amt)) amt = [amt];
    desc = desc || []; amt = amt || [];
    var n = Math.max(desc.length, amt.length), lines = [], sub = 0;
    if (!n) { toast('Add at least one line with details and an amount.'); return; }
    for (var i = 0; i < n; i++) {
      var text = String(desc[i] || '').trim().replace(/\s+/g, ' '), raw = String(amt[i] == null ? '' : amt[i]).trim();
      if (!text && raw === '') continue;
      if (text.length < 3) { toast('Each line needs a short description (at least 3 characters). It is shown on the invoice.'); return; }
      if (text.length > 200) { toast('Keep each description to 200 characters.'); return; }
      if (!moneyOk(raw)) { toast('Each amount is a dollar amount above 0, up to 1,000,000 (cents allowed), before HST.'); return; }
      var amount = r2(+raw); lines.push({ id: uid('xl'), desc: text, amount: amount }); sub += amount;
    }
    if (!lines.length) { toast('Add at least one line with details and an amount.'); return; }
    if (lines.length > 20) { toast('An invoice can have up to 20 lines.'); return; }
    var note = String(d.note || '').trim().replace(/\s+/g, ' ');
    if (note.length > 500) { toast('Keep the note to 500 characters.'); return; }
    var on = hstOn(firm), c = typeof CB === 'function' ? CB() : { netDays: 30 };
    sub = r2(sub); var hst = on ? r2(sub * rate()) : 0, total = r2(sub + hst), number = nextNumber();
    var inv = {
      id: uid('ci'), firmId: firm.id, number: number, kind: 'extra', extraWork: true,
      site: s.code, siteName: s.name || '', workDate: date, issued: date,
      periodStart: date, periodEnd: date, billHours: 0, workLines: lines,
      note: note, hstCharged: on, amount: sub, hst: hst, total: total,
      due: addDays(date, c.netDays || 30), interestPct: 2, interestAfterDays: 60, terms: 'cj-2026-10', paidAt: ''
    };
    storeInv(inv);
    audit('Created extra work invoice', firm.name, inv.number + ' ' + s.code + ' ' + date + ': ' + lines.map(function (l) { return l.desc + ' ' + money(l.amount); }).join('; ') + (note ? ' · note: ' + note : '') + ' · ' + money(inv.total));
    notify(firm.id, 'New invoice ' + inv.number + ' for extra work at ' + s.code + ' (' + longDate(date) + '): ' + money(inv.total) + ', due ' + inv.due + '.');
    save(); closeModal(); toast('Invoice ' + inv.number + ' created · ' + money(inv.total)); render();
  };
  if (typeof ADMIN_ONLY_ACT !== 'undefined') ADMIN_ONLY_ACT.push('cjxopenform', 'cjxadd', 'cjxrm');
  if (typeof ADMIN_ONLY_FORM !== 'undefined') ADMIN_ONLY_FORM.push('cjxinv');

  /* ---------- office list on Invoices ---------- */
  function sectionHtml() {
    var list = extras(null);
    var rows = list.map(function (i) {
      var f = user(i.firmId), st = typeof invPlain === 'function' ? invPlain(i) : { t: '', c: '' };
      return '<tr data-extra="' + esc(i.number) + '" data-id="' + esc(i.id) + '"><td>' + esc(f ? f.name : '') + '</td><td><b>' + esc(i.number) + '</b></td><td>' + esc(longDate(i.workDate || i.issued)) + '</td><td>' + esc(i.site || '') + '</td><td class="small cjxdetail">' + (lineBits(i) || '–') + (i.note ? '<div class="muted">Note: ' + esc(i.note) + '</div>' : '') + '</td><td>' + money(i.amount) + '</td><td>' + money(i.hst) + '</td><td><b>' + money(i.total) + '</b></td><td class="owing"><b>' + money(owingOf(i)) + '</b></td><td><span class="pill ' + esc(st.c || '') + '">' + esc(st.t || '') + '</span></td><td><button type="button" class="small sec" data-act="civview" data-id="' + esc(i.id) + '">View</button></td></tr>';
    }).join('');
    return '<div class="card" id="cjxinv"><h2 style="margin-top:0">Extra work invoice</h2>' +
      '<p class="small">A separate invoice for additional work at any site. Add the details and the amount for each line. It is not part of the monthly invoice. HST is added the same way as on other client invoices.</p>' +
      '<p><button type="button" class="small" id="cjxchoice" data-act="cjxopenform">Extra work invoice</button></p>' +
      (list.length ? '<div class="tw"><table id="cjxinvtable"><tr><th>Client</th><th>Invoice #</th><th>Date</th><th>Site</th><th>Details</th><th>Amount</th><th>HST</th><th>Total</th><th>Now owing</th><th>Status</th><th></th></tr>' + rows + '</table></div>' + totalsHtml(list, 'cjxtotals') : '<p class="small muted" id="cjxnone">No extra work invoices yet.</p>') +
      '</div>';
  }
  if (VIEWS['admin:invoicesadmin']) {
    var _ia = VIEWS['admin:invoicesadmin'];
    VIEWS['admin:invoicesadmin'] = function () {
      var x = _ia.apply(this, arguments);
      if (!cjxCan()) return x;
      var block = sectionHtml();
      var calm = x.indexOf('id="ivcalm"');
      if (calm >= 0) { var end = x.indexOf('</div>', calm); if (end >= 0) return x.slice(0, end + 6) + block + x.slice(end + 6); }
      if (x.indexOf('</h1>') >= 0) return x.replace('</h1>', '</h1>' + block);
      return block + x;
    };
  }

  /* ---------- existing client-invoice table: lines, view, and totals ---------- */
  function patchOfficeRow(x, i) {
    var key = '<tr data-inv="' + esc(i.number) + '">';
    var at = x.indexOf(key); if (at < 0) return x;
    var end = x.indexOf('</tr>', at); if (end < 0) return x;
    var row = x.slice(at, end);
    var period = '<td class="small">' + esc(i.periodStart) + ' – ' + esc(i.periodEnd) + '</td>';
    var nice = '<td class="small">Extra work · ' + esc(longDate(i.workDate || i.issued)) + (i.site ? '<br>' + esc(i.site) : '') + '</td>';
    if (row.indexOf(period) >= 0) row = row.replace(period, nice);
    var num = '<td>' + esc(i.number) + '</td>';
    if (row.indexOf(num) >= 0) row = row.replace(num, '<td>' + esc(i.number) + ' <span class="pill s-ok">Extra work</span></td>');
    if (row.indexOf('data-act="civview"') < 0) {
      var paid = 'data-act="clientinvpaid" data-id="' + esc(i.id) + '">Mark paid</button>';
      var view = '<button type="button" class="small sec" data-act="civview" data-id="' + esc(i.id) + '">View</button>';
      if (row.indexOf(paid) >= 0) row = row.replace(paid, paid + ' ' + view);
      else row = row.replace(/<td>\s*<\/td>\s*$/, '<td>' + view + '</td>');
    }
    var who = user(i.firmId);
    var cols = (who && row.indexOf('<td>' + esc(who.name) + '</td>') >= 0) || row.split('<td').length > 11 ? 12 : 10;
    var detail = '</tr><tr class="cjxlines" data-extra="' + esc(i.number) + '"><td colspan="' + cols + '" class="small"><b>Extra work</b>' + (i.site ? ' · ' + esc(i.site + (i.siteName ? ' – ' + i.siteName : '')) : '') + (lineBits(i) ? ': ' + lineBits(i) : '') + (i.note ? '<div>Note: ' + esc(i.note) + '</div>' : '') + '</td></tr>';
    return x.slice(0, at) + row + detail + x.slice(end + 5);
  }
  if (typeof clientInvoicesHtml === 'function') {
    var _cih = clientInvoicesHtml;
    clientInvoicesHtml = function (firm, office) {
      var x = _cih.apply(this, arguments);
      if (!office) {
        extras(firm).forEach(function (i) { x = patchOfficeRow(x, i); });
        return x;
      }
      if (typeof ivBlocked === 'function' && ivBlocked()) return cjxCan() ? x + sectionHtml() : x;
      if (!cjxCan()) return x;
      extras(firm).forEach(function (i) { x = patchOfficeRow(x, i); });
      var listed = typeof clientInvs === 'function' ? clientInvs(firm) : extras(firm);
      var tid = 'id="clientinvtable"';
      var p = x.indexOf(tid);
      if (p >= 0) {
        var close = '</table></div>', q = x.indexOf(close, p);
        if (q >= 0) x = x.slice(0, q + close.length) + totalsHtml(listed, 'cjxalltotals') + x.slice(q + close.length);
      }
      if (x.indexOf('id="cjxchoice"') < 0 && x.indexOf('Create monthly invoice') >= 0) {
        x = x.replace('Create monthly invoice</button></form>', 'Create monthly invoice</button></form> <button type="button" class="small sec" id="cjxchoice" data-act="cjxopenform">Extra work invoice</button>');
      }
      return x;
    };
  }

  /* ---------- client's own invoice list ---------- */
  if (VIEWS['firm:invoices']) {
    var _fi = VIEWS['firm:invoices'];
    VIEWS['firm:invoices'] = function () {
      var x = _fi.apply(this, arguments);
      if (!ME || ME.type !== 'firm' || (typeof cjtIsTeam === 'function' && cjtIsTeam())) return x;
      extras(ME).forEach(function (i) {
        var key = 'data-id="' + esc(i.id) + '"';
        var at = x.indexOf(key); if (at < 0) return;
        var end = x.indexOf('</button>', at); if (end < 0) return;
        var chunk = x.slice(at, end);
        var small = '<span class="small">' + esc(i.periodStart) + ' – ' + esc(i.periodEnd) + '</span>';
        var lines = (i.workLines || []).map(function (l) { return esc(l.desc) + ' ' + money(l.amount); }).join('<br>');
        var repl = '<span class="small cjxdetail">Extra work · ' + esc(longDate(i.workDate || i.issued)) + (i.site ? ' · ' + esc(i.site) : '') +
          (lines ? '<br>' + lines : '') + '<br>Total ' + money(i.total) + (i.hst ? ' (includes HST ' + money(i.hst) + ')' : '') + '</span>';
        if (chunk.indexOf(small) >= 0) chunk = chunk.replace(small, repl);
        chunk = chunk.replace('<b>' + esc(i.number) + '</b>', '<b>' + esc(i.number) + '</b> <span class="pill s-ok">Extra work</span>');
        x = x.slice(0, at) + chunk + x.slice(end);
      });
      return x;
    };
  }
})();
