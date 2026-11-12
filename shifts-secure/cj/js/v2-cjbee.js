/* v2-cjbee.js – flat monthly invoices billed to Bee-Clean (TEST COPY ONLY).
   Alberton (CIB119) and Souris (CIB120) only. Charlottetown (CIB115) stays out.
   Bill-to is Bee-Clean, 1505 Barrington St, Halifax — not CIBC.
   Numbers: SC-CIA-001 and SC-CIS-001, then 002, 003… on each prefix.
   Owner and admin can open this page and make the invoices. Billing, ops, clients and crew cannot.
   Mock (?store=mock) keeps the invoices in this browser. Live Supabase mode does not save them:
   the SQL file is for review and has not been applied. This file does not call the database.
   Loaded after v2-cjownernames.js (so the owner role is set before the menu is chosen) and
   before v2-keepscroll.js (a same-screen rebuild still restores the scroll position). */
'use strict';
(function () {
  if (typeof NAV === 'undefined' || typeof VIEWS === 'undefined' || typeof beeFlatQuote !== 'function') return;
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function mockMode() { return !!(window.REG_STORE && window.REG_STORE.mode === 'mock'); }
  function roles() { return (ME && ME.officeRoles) || (ME && ME.officeRole ? [ME.officeRole] : []); }
  function beeCan() {
    if (typeof ME === 'undefined' || !ME || ME.type !== 'admin') return false;
    var r = roles();
    if (r.indexOf('owner') >= 0 || r.indexOf('admin') >= 0) return true;
    return mockMode() && !r.length;
  }
  function deny() { toast('Flat monthly invoices are visible to the owner and an admin only.'); }
  function longDate(d) { return d ? (+d.slice(8, 10)) + ' ' + MON[+d.slice(5, 7) - 1] + ' ' + d.slice(0, 4) : ''; }
  function mLong(m) { return MONTHS[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4); }
  function list() { DB.beeInvoices = DB.beeInvoices || []; return DB.beeInvoices; }
  function siteRow(code) { return (DB.sites || []).filter(function (s) { return s.code === code; })[0] || null; }
  function monthlyOf(catalog) {
    var s = siteRow(catalog.code);
    if (s && s.monthlyAmount != null && s.monthlyAmount !== '' && isFinite(+s.monthlyAmount) && +s.monthlyAmount >= 0) return +s.monthlyAmount;
    return catalog.monthly;
  }
  function takenNumbers() { return list().map(function (i) { return i.number; }); }
  function existing(code, from) { return list().filter(function (i) { return i.site === code && i.periodStart === from; })[0] || null; }

  function seedBee() {
    if (!mockMode() || typeof DB === 'undefined' || !DB || !DB.sites || DB.beeSeed1) return false;
    BEE_SITES.forEach(function (c) {
      var s = siteRow(c.code);
      if (!s) return;
      s.billingMode = 'flat_monthly';
      s.monthlyAmount = c.monthly;
      s.monthlyTest = true;
      s.invoicePrefix = c.prefix;
      s.flatBillTo = BEE_BILL_TO.name;
    });
    var ch = siteRow('CIB115');
    if (ch) {
      if (ch.billingMode === 'flat_monthly') ch.billingMode = 'standard';
      ch.monthlyAmount = null;
      delete ch.invoicePrefix;
      delete ch.flatBillTo;
    }
    DB.beeInvoices = DB.beeInvoices || [];
    DB.beeSeed1 = true;
    return true;
  }
  function syncNav() {
    if (!NAV.admin) return;
    var at = -1, have = -1;
    NAV.admin.forEach(function (n, k) { if (n[0] === '#/invoicesadmin') at = k; if (n[0] === '#/flatmonthly') have = k; });
    if (beeCan()) { if (have < 0) NAV.admin.splice(at >= 0 ? at + 1 : NAV.admin.length, 0, ['#/flatmonthly', 'Flat monthly invoices']); }
    else if (have >= 0) NAV.admin.splice(have, 1);
  }

  function quoteInner(ym) {
    var p = beeMonthPeriod(ym);
    if (p.error) return { from: '', to: '', html: '<div class="alert warn" id="beequoteerr">' + esc(p.error) + '</div>' };
    var html = BEE_SITES.map(function (c) {
      var q = beeQuoteSite(c.code, p.from, p.to, monthlyOf(c));
      var how = q.full ? ('Full month · ' + money(q.monthly) + ' before HST') : (money(q.daily) + ' per weekday × ' + q.weekdays + ' weekdays = ' + money(q.pre) + ' + HST ' + money(q.hst));
      return '<div class="bee-q" data-site="' + esc(c.code) + '" data-daily="' + q.daily.toFixed(2) + '" data-days="' + q.weekdays + '" data-pre="' + q.pre.toFixed(2) + '" data-hst="' + q.hst.toFixed(2) + '" data-total="' + q.total.toFixed(2) + '"><span><b>' + esc(c.code) + ' – ' + esc(c.name) + '</b> <span class="pill s-ok">Flat monthly</span><br><span class="small muted">' + how + ' · invoice ' + esc(c.prefix) + '</span></span><b>' + money(q.total) + '</b></div>';
    }).join('');
    if (p.from === '2026-10-27') html += '<p class="small muted" id="beeoct">27–31 Oct 2026 includes Saturday 31 Oct, which is not a weekday. The 4 weekdays are 27–30 Oct.</p>';
    return { from: p.from, to: p.to, html: html };
  }
  function paintQuote(el, ym) {
    if (!el) return;
    var q = quoteInner(ym);
    el.setAttribute('data-from', q.from);
    el.setAttribute('data-to', q.to);
    el.innerHTML = q.html;
  }
  CALC.beemonth = function (el) {
    var f = el && el.form;
    if (!f || !beeCan()) return;
    PAGE_STATE.beeMonth = f.month.value;
    paintQuote(document.getElementById('beequote'), f.month.value);
  };

  function beeDoc(i) {
    var C = window.CJ_COMPANY || {}, st = typeof invPlain === 'function' ? invPlain(i) : { t: i.paidAt ? 'Paid' : 'Unpaid', d: '' };
    var it = typeof clientInvInterest === 'function' ? clientInvInterest(i) : { amount: 0, months: 0 };
    var L = [];
    L.push(['h', C.name || 'Chief Janitorial Inc.']);
    L.push(['s', C.address || 'Unit I, 56 Burns Avenue, Charlottetown PE C1E 2G1']);
    L.push(['s', (C.phoneShort || C.phone || '') + ' | ' + (C.email || 'admin@chiefjanitorial.com') + (C.web ? ' | ' + C.web : '')]);
    if (C.taxNo) L.push(['s', C.taxNo]);
    if (typeof cjMockInv === 'function' && cjMockInv()) L.push(['s', 'TEST VERSION – sample invoice made by the test app, not a real invoice']);
    L.push(['g']);
    L.push(['b', 'Invoice ' + i.number]);
    L.push(['t', 'Billed to: ' + (i.billTo && i.billTo.name ? i.billTo.name : BEE_BILL_TO.name)]);
    L.push(['t', (i.billTo && i.billTo.address) || BEE_BILL_TO.address]);
    L.push(['t', 'Invoice date: ' + longDate(i.issued)]);
    L.push(['t', 'For: ' + mLong(i.month) + ' (' + longDate(i.periodStart) + ' to ' + longDate(i.periodEnd) + ')']);
    L.push(['t', 'Due: ' + longDate(i.due) + ' | Status: ' + (st.t || '') + (i.paidAt ? ' ' + longDate(i.paidAt) : '')]);
    L.push(['g']);
    L.push(['t', 'Janitorial services – flat monthly contract price:']);
    if (i.partMonth) {
      L.push(['r', '  ' + i.site + ' – ' + i.siteName + ', ' + i.weekdays + ' weekdays × ' + money(i.daily), money(i.amount)]);
      L.push(['s', '  Part month. Daily rate = ' + money(i.monthlyPre) + ' × 12 ÷ 260 = ' + money(i.daily) + ', rounded to the cent.']);
    } else {
      L.push(['r', '  ' + i.site + ' – ' + i.siteName + ' – flat monthly, ' + mLong(i.month), money(i.amount)]);
    }
    L.push(['g']);
    L.push(['r', 'Subtotal', money(i.amount)]);
    L.push(['r', (C.taxNo || 'GST/HST') + ' @ 15.0%', money(i.hst)]);
    L.push(['rb', 'TOTAL', money(i.total)]);
    if (it.amount && !i.paidAt) L.push(['r', 'Interest on balance more than 2 months overdue (' + it.months + ' month(s) × ' + (i.interestPct || 2) + '%)', money(it.amount)]);
    if (i.paidAt && i.interestCharged) L.push(['r', 'Interest charged when paid', money(i.interestCharged)]);
    L.push(['rb', 'Now owing', money(i.paidAt ? 0 : Math.round((i.total + (it.amount || 0)) * 100) / 100)]);
    L.push(['g']);
    L.push(['s', (C.name || 'Chief Janitorial Inc.').toUpperCase() + ' consists of a team of professional cleaners dedicated to helping you maintain a clean and tidy space.']);
    L.push(['s', 'Payment is due within one month of the date this invoice is received by the customer.']);
    if (typeof cjPaymentLines === 'function') cjPaymentLines(L);
    L.push(['s', 'Late payment: interest of 2% per month applies to balances more than 2 months overdue.']);
    L.push(['s', 'Thank you for your business! Please contact us at ' + (C.email || 'admin@chiefjanitorial.com') + ' or ' + (C.phoneShort || C.phone || '') + ' with any questions about this invoice.']);
    return L;
  }
  function payFix(L) {
    if (!Array.isArray(L) || typeof cjPaymentSentence !== 'function') return L;
    var sent = cjPaymentSentence(), seen = false;
    var out = L.map(function (row) {
      if (row && row[0] === 's' && /^Payment options:/.test(String(row[1] || ''))) { seen = true; return ['s', sent]; }
      return row;
    });
    if (!seen) out.push(['s', sent]);
    return out;
  }
  if (typeof invDoc === 'function') {
    var doc0 = invDoc;
    invDoc = function (i) {
      var L = (i && i.beeFlat) ? beeDoc(i) : doc0.apply(this, arguments);
      return payFix(L);
    };
    try { window.invDoc = invDoc; } catch (e) {}
  }
  if (typeof clientInvs === 'function') {
    var invs0 = clientInvs;
    clientInvs = function () { return invs0.apply(this, arguments).filter(function (i) { return !(i && (i.beeFlat || i.kind === 'bee_flat')); }); };
  }
  if (typeof invAllowed === 'function') {
    var allow0 = invAllowed;
    invAllowed = function (i) {
      if (i && i.beeFlat) return beeCan();
      return allow0.apply(this, arguments);
    };
  }
  if (typeof FORMS.cjfsite === 'function') {
    var siteForm0 = FORMS.cjfsite;
    FORMS.cjfsite = function (f, d) {
      if (d && beeRefused(d.code) && d.mode === 'flat_monthly') {
        toast('CIBC Charlottetown (CIB115) is not billed as flat monthly. It stays out.');
        return;
      }
      return siteForm0.apply(this, arguments);
    };
  }

  function findBee(id) { return list().filter(function (i) { return i.id === id; })[0] || null; }
  VIEWS['admin:flatmonthly'] = function () {
    if (!beeCan()) return '<h1>Flat monthly invoices</h1><div class="card iv-calm" id="beedeny"><p><b>Flat monthly invoices are visible to the owner and an admin only.</b></p></div>';
    var month = PAGE_STATE.beeMonth || '2026-10';
    if (!/^\d{4}-\d{2}$/.test(month)) month = '2026-10';
    var q = quoteInner(month);
    var rows = list().slice().sort(function (a, b) { return a.issued < b.issued ? 1 : a.issued > b.issued ? -1 : (a.number < b.number ? 1 : -1); });
    var table = rows.length ? '<div class="tw"><table id="beeinvoices"><tr><th>Invoice #</th><th>Site</th><th>Period</th><th>Amount</th><th>HST</th><th>Total</th><th>Status</th><th></th></tr>' + rows.map(function (i) {
      var st = typeof invPlain === 'function' ? invPlain(i) : { t: '', c: '' };
      return '<tr data-bee="' + esc(i.number) + '" data-total="' + (+i.total).toFixed(2) + '"><td><b>' + esc(i.number) + '</b></td><td>' + esc(i.site + ' – ' + i.siteName) + '</td><td class="small">' + esc(i.periodStart) + ' – ' + esc(i.periodEnd) + '</td><td>' + money(i.amount) + '</td><td>' + money(i.hst) + '</td><td><b>' + money(i.total) + '</b></td><td><span class="pill ' + esc(st.c || '') + '">' + esc(st.t || '') + '</span></td><td><button type="button" class="small sec" data-act="beeview" data-id="' + esc(i.id) + '">View</button> ' + (i.paidAt ? '' : '<button type="button" class="small sec" data-act="beepaid" data-id="' + esc(i.id) + '">Mark paid</button>') + '</td></tr>';
    }).join('') + '</table></div>' : '<p class="small muted" id="beenone">No flat monthly invoices yet.</p>';
    var sites = '<div class="tw"><table id="beesites"><tr><th>Site</th><th>Billing</th><th>Monthly amount</th><th>Invoice numbers</th></tr>' + BEE_SITES.map(function (c) {
      var used = monthlyOf(c);
      return '<tr data-site="' + esc(c.code) + '"><td><b>' + esc(c.code) + '</b><div class="small">' + esc(c.name) + '</div></td><td><span class="pill s-ok">Flat monthly</span></td><td>' + money(used) + ' <span class="small muted">before HST</span></td><td>' + esc(c.prefix) + ' · next ' + esc(beeNextNumber(c.prefix, takenNumbers())) + '</td></tr>';
    }).join('') + '<tr data-site="CIB115" id="beeexcluded"><td><b>CIB115</b><div class="small">CIBC Charlottetown</div></td><td><span class="pill s-bad">Not billed</span></td><td class="muted">Stays out</td><td class="muted">No invoice</td></tr></table></div>';
    return '<h1>Flat monthly invoices</h1>' +
      '<p class="small muted" id="beetestcopy">TEST COPY. Invoices made here stay in this browser. Nothing is written to the live database.</p>' +
      '<div class="cjm-intro" id="beebillto">Billed to <b>' + esc(BEE_BILL_TO.name) + '</b>, ' + esc(BEE_BILL_TO.address) + '. Not billed to CIBC. Billing starts 27 Oct 2026. A full month is the flat amount plus 15% HST. A part month uses the daily rate (monthly amount × 12 ÷ 260, rounded to the cent) times the weekdays in the range, then 15% HST.</div>' +
      sites +
      '<div class="card" id="beeinv"><h2 style="margin-top:0">Make the invoices</h2>' +
      '<form data-form="beecreate" id="beeform"><div class="grid2">' + inp('month', 'Month', month, { type: 'month', req: true, extra: ' id="beemonth" data-calc="beemonth" min="2026-10"' }) + '</div>' +
      '<div id="beequote" data-from="' + esc(q.from) + '" data-to="' + esc(q.to) + '">' + q.html + '</div>' +
      (mockMode() ? '<button type="submit" id="beecreate">Create flat monthly invoices</button>' : '<div class="alert warn" id="beenolive">This login is on the live database. The test copy will not save these invoices.</div>') +
      '</form></div>' +
      '<div class="card"><h2 style="margin-top:0">Invoices</h2><div class="bee-pay" id="beepay">' + esc(cjPaymentSentence()) + '</div>' + table + '</div>';
  };

  FORMS.beecreate = function (f, d) {
    if (!beeCan()) { deny(); return; }
    if (!mockMode()) { toast('Test copy only. These invoices are not saved to the live database.'); return; }
    var ym = String(d.month || '');
    var p = beeMonthPeriod(ym);
    if (p.error) { toast(p.error); return; }
    if (ym > today().slice(0, 7)) { toast('That month has not started.'); return; }
    PAGE_STATE.beeMonth = ym;
    var made = [], skipped = [];
    BEE_SITES.forEach(function (c) {
      if (beeRefused(c.code)) return;
      if (existing(c.code, p.from)) { skipped.push(c.code); return; }
      var q = beeQuoteSite(c.code, p.from, p.to, monthlyOf(c));
      if (!q) return;
      var inv = {
        id: uid('bf'), kind: 'bee_flat', beeFlat: true, number: beeNextNumber(c.prefix, takenNumbers()), prefix: c.prefix,
        site: c.code, siteName: c.name, billTo: { name: BEE_BILL_TO.name, address: BEE_BILL_TO.address },
        month: ym, periodStart: p.from, periodEnd: p.to, partMonth: !q.full, daily: q.daily, weekdays: q.weekdays, monthlyPre: q.monthly,
        amount: q.pre, hst: q.hst, total: q.total, hstOn: true, issued: p.to, due: addDays(p.to, 30),
        interestPct: 2, interestAfterDays: 60, terms: 'cj-2026-10', paidAt: '', test: true, sample: true,
        createdAt: new Date().toISOString(), createdBy: ME ? ME.name : ''
      };
      list().push(inv);
      made.push(inv.number + ' ' + money(inv.total));
      audit('Created flat monthly invoice', BEE_BILL_TO.name, inv.number + ' ' + inv.site + ' ' + inv.periodStart + ' – ' + inv.periodEnd + ': ' + money(inv.total));
    });
    if (!made.length) { toast(skipped.length ? 'Those invoices are already made (' + skipped.join(', ') + ').' : 'No invoice was made.'); return; }
    save();
    toast('Made ' + made.join(' and ') + '.');
    render();
  };
  ACT.beeview = function (el) {
    if (!beeCan()) { deny(); return; }
    var i = findBee(el.dataset.id); if (!i) return;
    audit('Viewed flat monthly invoice', BEE_BILL_TO.name, i.number);
    save();
    modal('<div id="beeinvview">' + invHtml(i) + '</div><p class="row"><button type="button" data-act="beepdf" data-id="' + esc(i.id) + '">Download PDF</button><button type="button" class="sec" data-act="beeprint" data-id="' + esc(i.id) + '">Print</button></p>');
  };
  ACT.beepdf = function (el) {
    if (!beeCan()) { deny(); return; }
    var i = findBee(el.dataset.id); if (!i) return;
    var pdf = invPdf(i), name = invFileName(i);
    var blobUrl = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' })), a = document.createElement('a');
    a.href = blobUrl; a.download = name; a.rel = 'noopener'; a.style.display = 'none'; document.body.appendChild(a);
    if ('download' in a) a.click(); else { var w = window.open(blobUrl, '_blank'); if (!w) location.href = blobUrl; }
    setTimeout(function () { a.remove(); }, 2000);
    setTimeout(function () { try { URL.revokeObjectURL(blobUrl); } catch (e) {} }, 60000);
    audit('Downloaded flat monthly invoice PDF', BEE_BILL_TO.name, i.number);
    save();
    toast('PDF downloaded: ' + name);
  };
  ACT.beeprint = function (el) {
    if (!beeCan()) { deny(); return; }
    var i = findBee(el.dataset.id); if (!i) return;
    var w = window.open('', '_blank');
    if (!w) { toast('Pop-up blocked – use Download PDF instead.'); return; }
    w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ' + esc(i.number) + '</title><style>body{font:14px/1.5 Arial,sans-serif;max-width:720px;margin:24px auto;color:#111}.invrow{display:flex;justify-content:space-between;border-bottom:1px solid #eee;padding:4px 0}.tot{font-weight:bold}.small{font-size:12px;color:#555}</style></head><body>' + invHtml(i) + '</body></html>');
    w.document.close(); w.focus();
    setTimeout(function () { try { w.print(); } catch (e) {} }, 300);
  };
  ACT.beepaid = function (el) {
    if (!beeCan()) { deny(); return; }
    if (!mockMode()) { toast('Test copy only. These invoices are not saved to the live database.'); return; }
    var i = findBee(el.dataset.id); if (!i || i.paidAt) return;
    var it = typeof clientInvInterest === 'function' ? clientInvInterest(i) : { amount: 0 };
    i.paidAt = today(); i.interestCharged = it.amount || 0;
    audit('Flat monthly invoice marked paid', BEE_BILL_TO.name, i.number);
    save(); toast(i.number + ' marked paid.'); render();
  };
  if (typeof ADMIN_ONLY_ACT !== 'undefined') ADMIN_ONLY_ACT.push('beeview', 'beepdf', 'beeprint', 'beepaid');
  if (typeof ADMIN_ONLY_FORM !== 'undefined') ADMIN_ONLY_FORM.push('beecreate');

  function beforePaint() { try { if (seedBee()) save(); syncNav(); } catch (e) {} }
  if (typeof render === 'function') {
    var render0 = render;
    render = function () { beforePaint(); return render0.apply(this, arguments); };
    try { window.render = render; } catch (e) {}
  }
  /* ui.js listens for hashchange with the render it captured at load, so a route change does not
     run the wrapper above. Prepare in the capture phase. This file loads after v2-cjownernames.js,
     so the owner role is already on the login before the menu is decided. */
  window.addEventListener('hashchange', beforePaint, true);
})();
