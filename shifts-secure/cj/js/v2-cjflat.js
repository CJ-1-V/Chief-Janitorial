/* v2-cjflat.js – CJ twin (TEST): FLAT-MONTHLY site billing. flatmonthly1, Oct 19 2026.
   Owner decision (relayed by Grok Bot, Oct 19 2026 2:25 AM ET): fixed-price sites get ONE monthly invoice line at their contract
   price instead of hours × rate; extra jobs (e.g. a floor recoat) can be added as extra lines; current CJ invoice template details.
   - Site setting: billingMode 'flat_monthly' + contract price (DB.sites[].monthlyAmount, BEFORE HST – the same field as before).
     The office may type the price including HST; it is stored before HST (2,070.00 incl. → 1,800.00 + 270.00 HST).
     Sites without billingMode keep the existing monthly1 behaviour exactly ("Standard").
   - A flat site with no price (CIB115) BLOCKS the monthly invoice for that client: nothing is made, a clear "price not set" notice shows.
   - A monthly invoice with a flat line starts as a DRAFT (the client does not see it and gets no message). The owner can add, edit
     and remove extra lines (description, qty, unit amount; HST applies) and then "Finalise & send". After that extra lines are locked;
     Adjust on a site line (with a note) keeps working on unpaid invoices, as before.
   - Flat invoices use the current CJ invoice template (Unit I, 56 Burns Avenue; admin@; e-transfer / cheque; 2% a month on balances
     more than 2 months overdue), dated the last day of the month.
   - Visibility is unchanged: owner + that client's own login only (v2-cjinvowner.js); drafts are owner-only.
   Data (mock/browser): DB.sites[].billingMode / .priceInclHst; DB.clientInvoices[].flat / .draft / .extraLines / .terms / .finalisedAt.
   Live columns: migrations/cj-flatmonthly-001.sql (DRAFT, NOT RUN). Loads LAST. TEST COPY ONLY. */
'use strict';
(function () {
  if (typeof NAV === 'undefined' || typeof VIEWS === 'undefined') return;
  var FLAT = 'flat_monthly', TERMS = 'cj-2026-10';
  var CO = function () { var c = window.CJ_COMPANY || {}; return c; };
  var RATE = function () { return +(CO().hstRate || 0.15); };
  function CJ() { try { return typeof cjSkipFarmRates === 'function' ? cjSkipFarmRates() : true; } catch (e) { return true; } }
  function r2(n) { return Math.round((+n || 0) * 100) / 100; }
  function siteOf(code) { return (DB.sites || []).filter(function (s) { return s.code === code; })[0] || null; }
  function isFlat(s) { return !!s && s.billingMode === FLAT; }
  function price(s) { return typeof cjmAmt === 'function' ? cjmAmt(s) : (s && s.monthlyAmount != null && s.monthlyAmount !== '' ? +s.monthlyAmount : null); }
  function owner() { return typeof ivOwner === 'function' ? ivOwner() : !!(ME && ME.type === 'admin'); }
  function deny() { toast(typeof IV_MSG === 'string' ? IV_MSG : 'Owner only.'); }
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function longDate(d) { return d ? +d.slice(8, 10) + ' ' + MONTHS[+d.slice(5, 7) - 1] + ' ' + d.slice(0, 4) : ''; }
  function mLong(m) { return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4); }
  function cjSites() { return (DB.sites || []).filter(function (s) { return s.code !== 'TEST-PRACTICE' && (s.companyId || 'cj') === 'cj'; }); }
  function split(pre) { var h = r2(pre * RATE()); return { pre: r2(pre), hst: h, incl: r2(pre + h) }; }
  window.cjfIsFlat = isFlat; window.cjfSplit = split;

  /* ---------- hooks used by v2-cjmonthly.js ---------- */
  // a new monthly invoice that has at least one flat line: draft, template terms, dated the last day of the month
  window.cjfDecorate = function (inv) {
    var c = CB();
    inv.flat = true; inv.draft = true; inv.extraLines = []; inv.terms = TERMS; inv.interestPct = 2; inv.interestAfterDays = 60;
    inv.issued = inv.periodEnd; inv.due = addDays(inv.periodEnd, c.netDays); inv.createdAt = new Date().toISOString(); inv.createdBy = ME ? ME.name : '';
    return inv;
  };
  // flat invoice document: the current CJ invoice template (screen, print and PDF share it)
  window.cjfDoc = function (i) {
    var f = user(i.firmId), st = invPlain(i), it = clientInvInterest(i), C = CO(), L = [];
    L.push(['h', C.name || 'Chief Janitorial Inc.']); L.push(['s', C.address]); L.push(['s', (C.phoneShort || C.phone) + ' | ' + (C.email || 'admin@chiefjanitorial.com') + (C.web ? ' | ' + C.web : '')]); L.push(['s', C.taxNo]);
    if (cjMockInv()) L.push(['s', 'TEST VERSION – sample invoice made by the test app, not a real invoice']);
    if (i.draft) L.push(['s', 'DRAFT – not sent to the client yet']);
    L.push(['g']);
    L.push(['b', 'Invoice ' + i.number]); L.push(['t', 'Billed to: ' + (f ? f.name : '')]);
    L.push(['t', 'Invoice date: ' + longDate(i.issued)]);
    L.push(['t', 'For: ' + mLong(i.month || i.periodStart.slice(0, 7)) + ' (' + longDate(i.periodStart) + ' to ' + longDate(i.periodEnd) + ')']);
    L.push(['t', i.draft ? 'Status: Draft – not sent' : 'Due: ' + longDate(i.due) + ' | Status: ' + st.t + (i.paidAt ? ' ' + longDate(i.paidAt) : '')]); L.push(['g']);
    var flat = (i.siteLines || []).filter(function (l) { return l.mode === FLAT; }), std = (i.siteLines || []).filter(function (l) { return l.mode !== FLAT; });
    if (flat.length) L.push(['t', 'Janitorial services – flat monthly contract price:']);
    flat.forEach(function (l) {
      L.push(['r', '  ' + l.site + ' – Regular cleaning, ' + l.month, money(l.amount)]);   // calendar1 Oct 21: owner wording
      if (l.adjNote) L.push(['s', '  Adjusted' + (l.base != null ? ' from ' + money(l.base) : '') + ': ' + l.adjNote]);
    });
    if (std.length) { L.push(['t', 'Regular cleaning – fixed monthly amount per site:']); std.forEach(function (l) { var u = l.unset && !l.adjNote; L.push(['r', '  ' + l.site + ' – Regular cleaning, ' + l.month, u ? 'Not set' : money(l.amount)]); if (l.adjNote) L.push(['s', '  Adjusted' + (l.base != null ? ' from ' + money(l.base) : '') + ': ' + l.adjNote]); }); }
    if ((i.specialLines || []).length) { L.push(['t', 'Special jobs:']); i.specialLines.forEach(function (l) { L.push(['r', '  Special job ' + l.no + ' – ' + l.kind + ', ' + l.site + ', ' + l.date + ': ' + l.people + ' × ' + shH(l.hoursPer) + ' h × ' + money(l.rate), money(l.amount)]); }); }
    if ((i.extraLines || []).length) { L.push(['t', 'Extra work:']); i.extraLines.forEach(function (l) { L.push(['r', '  ' + l.desc + ' – ' + fmtQty(l.qty) + ' × ' + money(l.unit), money(l.amount)]); }); }
    L.push(['g']);
    L.push(['r', 'Subtotal', money(i.amount)]);
    L.push(['r', i.hst ? (C.taxNo || 'GST/HST') + ' @ ' + (RATE() * 100).toFixed(1) + '%' : 'HST (not charged)', money(i.hst)]);
    L.push(['rb', 'TOTAL', money(i.total)]);
    if (it.amount && !i.paidAt) L.push(['r', 'Interest on balance more than 2 months overdue (' + it.months + ' month(s) × ' + i.interestPct + '%)', money(it.amount)]);
    if (i.paidAt && i.interestCharged) L.push(['r', 'Interest charged when paid', money(i.interestCharged)]);
    if (!i.draft) L.push(['rb', 'Now owing', money(i.paidAt ? 0 : i.total + it.amount)]);
    L.push(['g']);
    L.push(['s', (C.name || 'Chief Janitorial Inc.').toUpperCase() + ' consists of a team of professional cleaners dedicated to helping you maintain a clean and tidy space.']);
    L.push(['s', 'Payment is due within one month of the date this invoice is received by the customer.']);
    L.push(['s', 'Payment options: Interac e-transfer to ' + (C.email || 'admin@chiefjanitorial.com') + ', or cheque payable to ' + (C.name || 'Chief Janitorial Inc.') + ', mailed to ' + C.address + '.']);
    L.push(['s', 'Late payment: interest of 2% per month applies to balances more than 2 months overdue.']);
    L.push(['s', 'Thank you for your business! Please contact us at ' + (C.email || 'admin@chiefjanitorial.com') + ' or ' + (C.phoneShort || C.phone) + ' with any questions about this invoice.']);
    return L;
  };
  function fmtQty(q) { q = +q; return q % 1 === 0 ? String(q) : String(r2(q)); }

  /* interest on flat invoices: only on balances more than 2 months (60 days) past due, 2% per month after that point */
  if (typeof clientInvInterest === 'function') {
    var oii = clientInvInterest;
    clientInvInterest = function (i, on) {
      if (!i || i.terms !== TERMS) return oii.apply(this, arguments);
      if (i.draft) return { months: 0, amount: 0, over: 0 };
      var end = i.paidAt || on || today(), over = daysBetween(i.due, end), g = i.interestAfterDays || 60;
      if (!(over > g)) return { months: 0, amount: 0, over: over > 0 ? over : 0 };
      var m = Math.ceil((over - g) / 30); return { months: m, over: over, amount: r2(i.total * (i.interestPct || 2) / 100 * m) };
    };
  }
  /* drafts: owner only; never shown to the client */
  if (typeof clientInvs === 'function') { var oci = clientInvs; clientInvs = function () { var l = oci.apply(this, arguments); return ME && ME.type === 'firm' ? l.filter(function (i) { return !i.draft; }) : l; }; }
  if (typeof invAllowed === 'function') { var oia = invAllowed; invAllowed = function (i) { if (i && i.draft && (!ME || ME.type !== 'admin')) return false; return oia.apply(this, arguments); }; }
  if (typeof invPlain === 'function') { var oip = invPlain; invPlain = function (i) { return i && i.draft ? { t: 'Draft', c: 's-pend', d: 'Draft – not sent to the client yet' } : oip.apply(this, arguments); }; }
  if (typeof clientInvStatus === 'function') { var ois = clientInvStatus; clientInvStatus = function (i) { return i && i.draft ? { t: 'Draft – not sent', c: 's-pend' } : ois.apply(this, arguments); }; }
  if (typeof ACT.clientinvpaid === 'function') { var opd = ACT.clientinvpaid; ACT.clientinvpaid = function (el) { var i = invById(el.dataset.id); if (i && i.draft) { toast('This invoice is still a draft – finalise and send it first.'); return; } return opd.apply(this, arguments); }; }

  /* ---------- office invoice list: draft state, extra lines, finalise ---------- */
  if (typeof clientInvoicesHtml === 'function') {
    var oih = clientInvoicesHtml;
    clientInvoicesHtml = function (firm, office) {
      var x = oih.apply(this, arguments); if (!CJ() || !office || (typeof ivBlocked === 'function' && ivBlocked())) return x;
      (DB.clientInvoices || []).forEach(function (i) {
        if (!i.flat || (firm && i.firmId !== firm.id)) return;
        var ex = i.extraLines || [];
        var row = '<tr class="cjflines" data-inv="' + esc(i.number) + '-flat"><td colspan="12" class="small">' +
          (i.draft ? '<span class="pill s-pend">Draft – the client cannot see it yet</span> ' : '<span class="pill s-ok">Finalised ' + esc((i.finalisedAt || '').slice(0, 10)) + '</span> ') +
          'Extra lines: <b>' + ex.length + '</b>' + (ex.length ? ' (' + money(ex.reduce(function (a, l) { return a + l.amount; }, 0)) + ')' : '') + ' ' +
          '<button type="button" class="small sec" data-act="cjfx" data-id="' + esc(i.id) + '">' + (i.draft ? 'Extra lines' : 'See extra lines') + '</button> ' +
          '<button type="button" class="small sec" data-act="civview" data-id="' + esc(i.id) + '">Preview</button> ' +
          (i.draft ? '<button type="button" class="small" data-act="cjffin" data-id="' + esc(i.id) + '">Finalise &amp; send</button>' : '') + '</td></tr>';
        x = x.replace(new RegExp('(<tr data-inv="' + i.number + '">[\\s\\S]*?</tr>(?:<tr class="cjmlines">[\\s\\S]*?</tr>)?)'), function (all) {
          if (i.draft) all = all.replace(/<button class="small sec" data-act="clientinvpaid"[^>]*>Mark paid<\/button>/, '');
          return all + row;
        });
      });
      return x;
    };
  }
  function exModal(i) {
    var ex = i.extraLines || [], ed = PAGE_STATE.cjfEdit && PAGE_STATE.cjfEdit.inv === i.id ? ex.filter(function (l) { return l.id === PAGE_STATE.cjfEdit.line; })[0] : null;
    var rows = ex.length ? '<div class="tw"><table id="cjfxtable"><tr><th>Description</th><th>Qty</th><th>Unit amount</th><th>Amount</th>' + (i.draft ? '<th></th>' : '') + '</tr>' + ex.map(function (l) {
      return '<tr data-line="' + esc(l.id) + '"><td>' + esc(l.desc) + '</td><td>' + esc(fmtQty(l.qty)) + '</td><td>' + money(l.unit) + '</td><td><b>' + money(l.amount) + '</b></td>' +
        (i.draft ? '<td><button type="button" class="small sec" data-act="cjfxedit" data-id="' + esc(i.id) + '" data-line="' + esc(l.id) + '">Edit</button> <button type="button" class="small sec danger" data-act="cjfxdel" data-id="' + esc(i.id) + '" data-line="' + esc(l.id) + '">Remove</button></td>' : '') + '</tr>';
    }).join('') + '</table></div>' : '<p class="small muted" id="cjfxnone">No extra lines yet.</p>';
    var sum = '<div class="cjf-sum" id="cjfxsum">Subtotal <b>' + money(i.amount) + '</b> · HST <b>' + money(i.hst) + '</b> · Total <b>' + money(i.total) + '</b></div>';
    var form = i.draft ? '<form data-form="cjfx" id="cjfxform"><input type="hidden" name="id" value="' + esc(i.id) + '"><input type="hidden" name="line" value="' + (ed ? esc(ed.id) : '') + '">' +
      '<h3 style="margin:10px 0 4px">' + (ed ? 'Edit extra line' : 'Add an extra line') + '</h3>' +
      inp('desc', 'Description (shown on the invoice)', ed ? ed.desc : '', { req: true, ph: 'e.g. Floor recoat – sales floor' }) +
      '<div class="grid2">' + inp('qty', 'Qty', ed ? fmtQty(ed.qty) : '1', { type: 'number', req: true, extra: ' min="0.01" max="10000" step="0.01"' }) +
      inp('unit', 'Unit amount ($, before HST)', ed ? (+ed.unit).toFixed(2) : '', { type: 'number', req: true, extra: ' min="0" max="1000000" step="0.01"' }) + '</div>' +
      '<p class="small muted">HST (' + (RATE() * 100) + '%) is added on the invoice total when this client has HST on.</p>' +
      '<div class="row"><button type="submit" id="cjfxsave">' + (ed ? 'Save change' : 'Add line') + '</button>' + (ed ? '<button type="button" class="sec" data-act="cjfxcancel" data-id="' + esc(i.id) + '">Cancel edit</button>' : '') + '<button type="button" class="sec" data-act="closeModal">Close</button></div></form>'
      : '<div class="alert info small" id="cjfxlocked">This invoice is finalised – extra lines can no longer be changed. To change a site line, use <b>Adjust</b> (a note is required).</div><div class="row"><button type="button" class="sec" data-act="closeModal">Close</button></div>';
    modal('<h2>Extra lines</h2><p><b>' + esc(i.number) + '</b> · ' + esc(user(i.firmId).name) + ' · ' + esc(mLong(i.month)) + '</p>' + rows + sum + form);
  }
  function getInv(el) { var i = invById(el.dataset ? el.dataset.id : el.id); return i && i.flat ? i : null; }
  ACT.cjfx = function (el) { if (!owner()) { deny(); return; } var i = getInv(el); if (!i) return; PAGE_STATE.cjfEdit = null; exModal(i); };
  ACT.cjfxedit = function (el) { if (!owner()) { deny(); return; } var i = getInv(el); if (!i) return; if (!i.draft) { toast('This invoice is finalised – extra lines are locked.'); return; } PAGE_STATE.cjfEdit = { inv: i.id, line: el.dataset.line }; exModal(i); };
  ACT.cjfxcancel = function (el) { var i = getInv(el); PAGE_STATE.cjfEdit = null; if (i) exModal(i); };
  ACT.cjfxdel = function (el) {
    if (!owner()) { deny(); return; } var i = getInv(el); if (!i) return; if (!i.draft) { toast('This invoice is finalised – extra lines are locked.'); return; }
    var l = (i.extraLines || []).filter(function (x) { return x.id === el.dataset.line; })[0]; if (!l) return;
    if (!confirm('Remove "' + l.desc + '" (' + money(l.amount) + ') from ' + i.number + '?')) return;
    i.extraLines = i.extraLines.filter(function (x) { return x.id !== l.id; }); recalcInv(i);
    audit('Removed extra line from client invoice', user(i.firmId).name, i.number + ': ' + l.desc + ' ' + money(l.amount) + ' (new total ' + money(i.total) + ')');
    save(); toast('Line removed – new total ' + money(i.total)); PAGE_STATE.cjfEdit = null; exModal(i); render();
  };
  FORMS.cjfx = function (f, d) {
    if (!owner()) { deny(); return; } var i = invById(d.id); if (!i || !i.flat) return;
    if (!i.draft) { toast('This invoice is finalised – extra lines are locked.'); return; }
    var desc = String(d.desc || '').trim().replace(/\s+/g, ' '), q = +d.qty, u = String(d.unit || '').trim() === '' ? NaN : +d.unit;
    if (desc.length < 3) { toast('Write a short description – it is shown on the invoice.'); return; }
    if (!(q > 0 && q <= 10000) || Math.abs(Math.round(q * 100) - q * 100) > 1e-6) { toast('Qty: a number above 0 (up to 2 decimals).'); return; }
    if (!(u >= 0 && u <= 1000000) || Math.abs(Math.round(u * 100) - u * 100) > 1e-6) { toast('Unit amount: dollars from 0 to 1,000,000 (cents allowed).'); return; }
    var amount = r2(q * u), L = i.extraLines = i.extraLines || [], ed = d.line ? L.filter(function (x) { return x.id === d.line; })[0] : null, before = ed ? ed.desc + ' ' + money(ed.amount) : '';
    if (ed) { ed.desc = desc.slice(0, 160); ed.qty = q; ed.unit = r2(u); ed.amount = amount; ed.editedBy = ME.name; ed.editedAt = new Date().toISOString(); }
    else L.push({ id: uid('xl'), desc: desc.slice(0, 160), qty: q, unit: r2(u), amount: amount, addedBy: ME.name, addedAt: new Date().toISOString() });
    recalcInv(i);
    audit(ed ? 'Changed extra line on client invoice' : 'Added extra line to client invoice', user(i.firmId).name, i.number + ': ' + (ed ? before + ' → ' : '') + desc + ' ' + fmtQty(q) + ' × ' + money(u) + ' = ' + money(amount) + ' (new total ' + money(i.total) + ')');
    save(); toast((ed ? 'Line changed' : 'Line added') + ' ✓ – new total ' + money(i.total)); PAGE_STATE.cjfEdit = null; exModal(i); render();
  };
  function recalcInv(i) {
    var on = i.hstOn !== undefined ? i.hstOn : i.hst > 0, sum = function (a) { return (a || []).reduce(function (t, l) { return t + (+l.amount || 0); }, 0); };
    i.amount = r2(sum(i.siteLines) + sum(i.specialLines) + sum(i.extraLines)); i.hst = on ? r2(i.amount * RATE()) : 0; i.total = r2(i.amount + i.hst);
  }
  window.cjfRecalc = recalcInv;
  ACT.cjffin = function (el) {
    if (!owner()) { deny(); return; } var i = getInv(el); if (!i || !i.draft) return;
    var early = today() < i.periodEnd;
    modal('<h2>Finalise &amp; send ' + esc(i.number) + '?</h2><p>' + esc(user(i.firmId).name) + ' · ' + esc(mLong(i.month)) + '</p>' +
      '<div class="cjf-sum">Subtotal <b>' + money(i.amount) + '</b> · HST <b>' + money(i.hst) + '</b> · Total <b>' + money(i.total) + '</b></div>' +
      '<ul class="small"><li>Invoice date: <b>' + esc(longDate(i.issued)) + '</b> (last day of the month) · due <b>' + esc(longDate(i.due)) + '</b>.</li><li>The client can then see it and gets a message (simulated in the test app).</li><li>Extra lines are locked after this. Site lines can still be changed with Adjust (note required) until it is paid.</li></ul>' +
      (early ? '<div class="alert warn small" id="cjfearly">' + esc(mLong(i.month)) + ' is not over yet (ends ' + esc(longDate(i.periodEnd)) + ').</div>' : '') +
      '<div class="row"><button type="button" id="cjffinok" data-act="cjffinok" data-id="' + esc(i.id) + '">Finalise &amp; send</button><button type="button" class="sec" data-act="closeModal">Cancel</button></div>');
  };
  ACT.cjffinok = function (el) {
    if (!owner()) { deny(); return; } var i = getInv(el); if (!i || !i.draft) return;
    recalcInv(i); i.draft = false; i.finalisedAt = new Date().toISOString(); i.finalisedBy = ME.name;
    audit('Finalised client invoice', user(i.firmId).name, i.number + ' ' + mLong(i.month) + ': ' + money(i.total) + ((i.extraLines || []).length ? ' incl. ' + i.extraLines.length + ' extra line(s)' : ''));
    notify(i.firmId, 'New invoice ' + i.number + ' for ' + mLong(i.month) + ': ' + money(i.total) + ', due ' + i.due + '.');
    save(); closeModal(); toast(i.number + ' finalised and sent ✓'); render();
  };
  if (typeof FORMS.cjmadj === 'function') { var oadj = FORMS.cjmadj; FORMS.cjmadj = function (f, d) { var r = oadj.apply(this, arguments); var i = invById(d.id); if (i && i.flat && (i.extraLines || []).length) { recalcInv(i); save(); render(); } return r; }; }
  ['cjfx', 'cjfxedit', 'cjfxdel', 'cjffin', 'cjffinok'].forEach(function (k) { if (typeof ADMIN_ONLY_ACT !== 'undefined') ADMIN_ONLY_ACT.push(k); });
  if (typeof ADMIN_ONLY_FORM !== 'undefined') ADMIN_ONLY_FORM.push('cjfx', 'cjfsite');

  /* the monthly invoice is blocked when a flat site has no price: clear notice (called from v2-cjmonthly.js) */
  window.cjfBlocked = function (firm, m, codes) {
    audit('Monthly client invoice not made – price not set', firm.name, mLong(m) + ': ' + codes.join(', '));
    save();
    modal('<h2>No invoice made</h2><div class="alert warn" id="cjfblocked"><b>Price not set for ' + esc(codes.join(', ')) + '.</b> ' + (codes.length === 1 ? 'This site is' : 'These sites are') + ' billed at a <b>flat monthly contract price</b>, and no price has been entered, so the ' + esc(mLong(m)) + ' invoice for ' + esc(firm.name) + ' cannot be made.</div>' +
      '<div class="small cjf-next" id="cjfnext">Next step: enter the agreed price in <a href="#/billingsettings" data-act="closeModal">Site billing settings</a>, then create the invoice again.</div><div class="row"><button type="button" class="sec" data-act="closeModal">OK</button></div>');
  };

  /* ---------- office: Site billing settings (#/billingsettings) ---------- */
  function modeText(s) { return isFlat(s) ? 'Flat monthly' : 'Standard'; }
  function priceCell(s) {
    var p = price(s);
    if (isFlat(s)) {
      if (p === null) return '<span class="pill s-bad" data-site="' + esc(s.code) + '">Price not set</span><div class="small cjf-block">No invoice can be made until a price is entered.</div>';
      var x = split(p); return '<b>' + money(x.pre) + '</b> + HST ' + money(x.hst) + ' = <b>' + money(x.incl) + '</b>' + (s.priceInclHst != null ? '<div class="small muted">entered as ' + money(s.priceInclHst) + ' incl. HST</div>' : '');
    }
    return p === null ? '<span class="pill s-warn">Not set</span>' : money(p) + ' <span class="small muted">before HST</span>';
  }
  VIEWS['admin:billingsettings'] = function () {
    var S = cjSites().slice().sort(function (a, b) { return a.code < b.code ? -1 : 1; }), focus = PAGE_STATE.cjfSite;
    var blocked = S.filter(function (s) { return isFlat(s) && price(s) === null; });
    return '<h1>Site billing settings</h1>' +
      '<div class="cjm-intro" id="cjfintro"><b>Flat monthly</b> sites get <b>one line a month at the contract price</b> (before HST) on the client\'s monthly invoice – hours never change it. Extra work (e.g. a floor recoat) is added as extra lines on that invoice before it is finalised. <b>Standard</b> sites keep the current monthly amount way, unchanged.</div>' +
      (blocked.length ? '<div class="alert warn" id="cjfunsetall"><b>Price not set:</b> ' + blocked.map(function (s) { return esc(s.code); }).join(', ') + ' – flat monthly with no price. No invoice can be made for ' + (blocked.length === 1 ? 'this site\'s' : 'these sites\'') + ' client until a price is entered.</div>' : '') +
      '<div class="tw"><table id="cjfsites"><tr><th>Site</th><th>Client</th><th>Billing</th><th>Monthly price</th><th>Status</th><th></th></tr>' + S.map(function (s) {
        var f = s.firmId ? user(s.firmId) : null;
        return '<tr data-site="' + esc(s.code) + '"' + (focus === s.code ? ' class="cjf-focus"' : '') + '><td><b>' + esc(s.code) + '</b><div class="small muted">' + esc(s.name) + '</div></td><td class="small">' + (f ? esc(f.name) : '<span class="muted">No client login</span>') + '</td>' +
          '<td><span class="pill ' + (isFlat(s) ? 's-ok' : 's-test') + '">' + modeText(s) + '</span></td><td>' + priceCell(s) + '</td><td class="small">' + (s.active === false ? 'Switched off' : 'Active') + '</td>' +
          '<td><button type="button" class="small sec" data-act="cjfsite" data-site="' + esc(s.code) + '">Edit</button></td></tr>';
      }).join('') + '</table></div><p class="small muted">Prices are stored before HST. HST is ' + (RATE() * 100) + '% (' + esc(CO().taxNo || '') + '). Every change is written to the audit log.</p>';
  };
  function siteModal(s) {
    var p = price(s);
    modal('<h2>Billing – ' + esc(s.code) + '</h2><p class="small muted">' + esc(s.name) + (s.firmId && user(s.firmId) ? ' · ' + esc(user(s.firmId).name) : '') + '</p>' +
      '<form data-form="cjfsite" id="cjfsiteform"><input type="hidden" name="code" value="' + esc(s.code) + '">' +
      '<fieldset class="cjf-modes"><legend>How is this site billed?</legend>' +
      '<label class="cjf-opt"><input type="radio" name="mode" value="flat_monthly"' + (isFlat(s) ? ' checked' : '') + '> <b>Flat monthly</b> – one line a month at the contract price</label>' +
      '<label class="cjf-opt"><input type="radio" name="mode" value="standard"' + (!isFlat(s) ? ' checked' : '') + '> <b>Standard</b> – current monthly amount way (unchanged)</label></fieldset>' +
      '<div class="grid2">' + inp('price', 'Monthly contract price ($)', p === null ? '' : (s.priceInclHst != null ? (+s.priceInclHst).toFixed(2) : p.toFixed(2)), { type: 'number', extra: ' min="0" max="1000000" step="0.01" id="cjfprice"', ph: 'Not set' }) +
      '<div><label>The price I typed is</label><select name="incl" id="cjfincl"><option value="0"' + (s.priceInclHst == null ? ' selected' : '') + '>before HST</option><option value="1"' + (s.priceInclHst != null ? ' selected' : '') + '>including HST (15%)</option></select></div></div>' +
      '<div class="cjf-preview" id="cjfpreview"></div>' +
      '<div class="small muted cjf-next">Leave the price empty if it is not agreed yet. A flat monthly site with no price blocks its client\'s monthly invoice.</div>' +
      '<div class="row"><button type="submit" id="cjfsitesave">Save</button><button type="button" class="sec" data-act="closeModal">Cancel</button></div></form>');
    var f = document.getElementById('cjfsiteform'); if (f) { f.addEventListener('input', cjfPreview); f.addEventListener('change', cjfPreview); cjfPreview(); }
  }
  function parsePrice(raw, incl) {
    raw = String(raw || '').trim(); if (raw === '') return { pre: null };
    var v = +raw; if (!(v >= 0 && v <= 1000000) || Math.abs(Math.round(v * 100) - v * 100) > 1e-6) return { err: 'Price: a dollar amount from 0 to 1,000,000 (cents allowed), or leave it empty for Not set.' };
    if (!incl) return { pre: r2(v) };
    var pre = r2(v / (1 + RATE())), x = split(pre); return { pre: pre, incl: r2(v), off: r2(x.incl - v) };
  }
  window.cjfPreview = function () {
    var f = document.getElementById('cjfsiteform'), out = document.getElementById('cjfpreview'); if (!f || !out) return;
    var r = parsePrice(f.price.value, f.incl.value === '1');
    if (r.err) { out.className = 'cjf-preview bad'; out.textContent = r.err; return; }
    if (r.pre === null) { out.className = 'cjf-preview warn'; out.innerHTML = '<b>Not set</b>' + (f.mode.value === FLAT ? ' – no invoice can be made for this client until a price is entered.' : ''); return; }
    var x = split(r.pre); out.className = 'cjf-preview';
    out.innerHTML = 'The invoice will show: <b>' + money(x.pre) + '</b> + HST ' + money(x.hst) + ' = <b>' + money(x.incl) + '</b> a month' + (r.off ? '<div class="small warn-text" id="cjfoff">Note: ' + money(r.incl) + ' including HST does not divide exactly – the invoice total will be ' + money(x.incl) + ' (' + (r.off > 0 ? '+' : '') + r.off.toFixed(2) + ').</div>' : '');
  };
  ACT.cjfsite = function (el) { if (!ME || ME.type !== 'admin') { denied('cjfsite'); return; } var s = siteOf(el.dataset.site); if (!s) return; PAGE_STATE.cjfSite = s.code; siteModal(s); };
  FORMS.cjfsite = function (f, d) {
    if (!ME || ME.type !== 'admin') { denied('cjfsite'); return; }
    var s = siteOf(d.code); if (!s) return;
    var mode = d.mode === FLAT ? FLAT : 'standard', r = parsePrice(d.price, d.incl === '1'); if (r.err) { toast(r.err); return; }
    var before = modeText(s) + ' ' + (price(s) === null ? 'Not set' : money(price(s)));
    s.billingMode = mode;  // 'standard' is stored explicitly once edited, so the live column follows a switch back
    s.monthlyAmount = r.pre; s.monthlyTest = false; if (r.incl != null) s.priceInclHst = r.incl; else delete s.priceInclHst;
    var after = modeText(s) + ' ' + (r.pre === null ? 'Not set' : money(r.pre) + ' before HST' + (r.incl != null ? ' (entered ' + money(r.incl) + ' incl. HST)' : ''));
    audit('Site billing settings changed', s.code, before + ' → ' + after);
    save(); closeModal(); toast(s.code + ': ' + after + ' ✓'); render();
  };
  if (typeof ADMIN_ONLY_ACT !== 'undefined') ADMIN_ONLY_ACT.push('cjfsite');
  (function () {
    var list = NAV.admin; if (list && !list.some(function (n) { return n[0] === '#/billingsettings'; })) { var k = -1; list.forEach(function (n, j) { if (n[0] === '#/sitehours') k = j; }); list.splice(k >= 0 ? k + 1 : list.length, 0, ['#/billingsettings', 'Site billing settings']); }
    if (typeof MENU_GROUPS !== 'undefined' && MENU_GROUPS && MENU_GROUPS[2] && MENU_GROUPS[2][1].indexOf('#/billingsettings') < 0) MENU_GROUPS[2][1].splice(1, 0, '#/billingsettings');
  })();
  /* Site hours page: a pill on flat sites + link to the settings */
  if (typeof VIEWS['admin:sitehours'] === 'function') {
    var osh = VIEWS['admin:sitehours'];
    VIEWS['admin:sitehours'] = function (h) {
      var x = osh(h); if (!CJ()) return x;
      return x.replace('</h1>', '</h1><p class="small" id="cjfshlink">Flat monthly contract prices and billing type: <a href="#/billingsettings">Site billing settings →</a></p>');
    };
  }
  /* admin overview flag: flat sites without a price */
  if (typeof adminFlags === 'function') { var oaf = adminFlags; adminFlags = function () { var f = oaf(); try { var b = cjSites().filter(function (s) { return isFlat(s) && s.active !== false && price(s) === null; }); if (b.length) f.push({ t: 'Price not set', c: 's-warn', h: 'Flat monthly site' + (b.length === 1 ? '' : 's') + ' with no price: ' + b.map(function (s) { return esc(s.code); }).join(', ') + ' – no invoice can be made. <a href="#/billingsettings">Open →</a>' }); } catch (e) {} return f; }; }

  /* ---------- mock seed (once; mock store only; FAKE clients) ---------- */
  window.cjfSeed = function () { return false; };   /* live build: TEST seed stripped */
  if (typeof load === 'function') { var _ld = load; load = function () { var r = _ld.apply(this, arguments); try { if (cjfSeed()) save(); } catch (e) {} return r; }; }
  if (typeof resetData === 'function') { var _rd = resetData; resetData = function () { var r = _rd.apply(this, arguments); try { if (cjfSeed()) save(); } catch (e) {} return r; }; }
  try { if (typeof DB !== 'undefined' && DB && cjfSeed()) save(); } catch (e) {}
})();
