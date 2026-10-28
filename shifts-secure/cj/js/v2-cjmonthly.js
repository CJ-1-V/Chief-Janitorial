/* v2-cjmonthly.js – CJ twin (TEST): a client's regular bill is a FIXED MONTHLY AMOUNT PER SITE. monthly1, Oct 8 2026.
   Owner (Oct 8 2026, 12:24 PM): "Fixed monthly amount per site". Special jobs ($30/person/hour, v2-cjspecial.js) stay separate lines.
   - Office #/sitehours: "Monthly contract amount" (before HST) per site, next to the regular hours. Empty = Not set (warning on invoice).
     Clients & sites shows the amount next to each site (replaces the old hourly "Bill rate" column).
   - Client home: the "Period total" card becomes "Monthly bill": each site's monthly amount + done special jobs as separate lines,
     subtotal, HST (existing per-client HST on/off, 15%), total. Hours/visits are information only. No hours × rate, no daily minimum.
   - Invoices (office "Create monthly invoice"): one line per site (fixed amount, month name) + special job lines + HST.
     Office "Adjust" per site line (new amount + required note) for partial months – never prorated automatically.
   - Hidden / reworded for CJ: hourly bill columns, daily-minimum text, "Site billing by day" + waive-minimum button,
     hours-change popup "billable" preview, Settings daily minimum, farm labour rates panel (now just HST on/off).
   - Cleaner pay is NOT changed (v2-cjsitehours.js split + approved unusual days).
   Data (mock/browser only): DB.sites[].monthlyAmount (null = Not set), DB.sites[].monthlyTest, DB.clientInvoices[].siteLines/hstOn/monthly.
   Live columns: migrations/cj-sitehours-001.sql section 7 (file only, not run). Loads LAST (after v2-cjcontact.js). */
'use strict';
(function () {
  if (typeof NAV === 'undefined' || typeof VIEWS === 'undefined') return;
  function CJ() { try { return typeof cjSkipFarmRates === 'function' ? cjSkipFarmRates() : true; } catch (e) { return true; } }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function r2(n) { return Math.round((+n || 0) * 100) / 100; }
  function mLabel(m) { return MONTHS[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4); }
  function mStart(m) { return m + '-01'; }
  function mEnd(m) { return addDays(isoLocal(new Date(+m.slice(0, 4), +m.slice(5, 7), 1)), -1); }
  function mShift(m, k) { return isoLocal(new Date(+m.slice(0, 4), +m.slice(5, 7) - 1 + k, 1)).slice(0, 7); }
  function siteOf(code) { return (DB.sites || []).filter(function (s) { return s.code === code; })[0] || null; }
  function amt(s) { return s && s.monthlyAmount !== null && s.monthlyAmount !== undefined && s.monthlyAmount !== '' && isFinite(+s.monthlyAmount) ? +s.monthlyAmount : null; }
  function amtText(s) { var a = amt(s); return a === null ? 'Not set' : money(a) + (s.monthlyTest ? ' TEST' : ''); }
  function amtHtml(s) { var a = amt(s); return a === null ? '<span class="pill s-warn">Not set</span>' : '<b>' + money(a) + '</b>' + (s.monthlyTest ? ' <span class="pill s-test">TEST</span>' : ''); }
  function hstOn(firm) { try { var rs = typeof farmRatesCur === 'function' ? farmRatesCur(firm) : null; return rs ? rs.hst !== false : true; } catch (e) { return true; } }
  function fSites(firm) { return firmCodes(firm).filter(function (c) { return c !== 'TEST-PRACTICE'; }).map(siteOf).filter(Boolean); }
  function jobsToBill(firm, m) { return (DB.cleanRequests || []).filter(function (r) { return r.firmId === firm.id && r.special && r.status === 'Done' && r.actual && !r.billedInv && (r.doneDate || '') <= mEnd(m); }); }
  function spLine(r) { return { id: r.id, no: r.no, kind: r.kind, site: r.site, date: r.doneDate, people: r.actual.people, hoursPer: r.actual.hoursPer, rate: r.actual.rate, amount: r.actual.amount }; }
  function spText(l) { return 'Special job ' + l.no + ' – ' + l.kind + ', ' + l.site + ', ' + l.date + ': ' + l.people + ' × ' + shH(l.hoursPer) + ' h × ' + money(l.rate); }
  function siteLineLabel(l) { return l.site + ' – Regular cleaning, ' + l.month; }   // calendar1 Oct 21: owner wording
  function calc(firm, m) {
    // golive2: switched-off sites (active === false, e.g. not started yet / on hold) are NOT billed
    var all = fSites(firm), off = all.filter(function (s) { return s.active === false; }).map(function (s) { return s.code; });
    var S = all.filter(function (s) { return s.active !== false; }).map(function (s) { var a = amt(s), l = { site: s.code, name: s.name, month: mLabel(m), base: a, amount: a === null ? 0 : a, unset: a === null, test: !!s.monthlyTest }; if (typeof cjfIsFlat === 'function' && cjfIsFlat(s)) l.mode = 'flat_monthly'; return l; });  // flatmonthly1: flat lines tagged
    var J = jobsToBill(firm, m).map(spLine), on = hstOn(firm);
    var sub = r2(S.reduce(function (a, l) { return a + l.amount; }, 0) + J.reduce(function (a, l) { return a + l.amount; }, 0)), hst = on ? r2(sub * 0.15) : 0;
    return { sites: S, jobs: J, sub: sub, hst: hst, total: r2(sub + hst), on: on, unset: S.filter(function (l) { return l.unset; }).map(function (l) { return l.site; }), inactive: off,
      flat: S.some(function (l) { return l.mode === 'flat_monthly'; }), blocked: S.filter(function (l) { return l.mode === 'flat_monthly' && l.unset; }).map(function (l) { return l.site; }) };  // flatmonthly1
  }
  function invOfMonth(firm, m) { return clientInvs(firm).filter(function (i) { return i.periodStart === mStart(m) && !i.uploaded && !i.extraWork; })[0] || null; }
  function recalc(i) { var on = i.hstOn !== undefined ? i.hstOn : i.hst > 0; i.amount = r2((i.siteLines || []).reduce(function (a, l) { return a + (+l.amount || 0); }, 0) + (i.specialLines || []).reduce(function (a, l) { return a + (+l.amount || 0); }, 0) + (i.extraLines || []).reduce(function (a, l) { return a + (+l.amount || 0); }, 0)); i.hst = on ? r2(i.amount * 0.15) : 0; i.total = r2(i.amount + i.hst); }
  window.cjmCalc = calc; window.cjmAmt = amt;

  /* ---------- office: monthly amount on Site regular hours ---------- */
  if (typeof VIEWS['admin:sitehours'] === 'function') {
    var osh = VIEWS['admin:sitehours'];
    VIEWS['admin:sitehours'] = function (h) {
      var x = osh(h); if (!CJ()) return x;
      x = x.replace('<h1>Site regular hours</h1>', '<h1>Site regular hours &amp; monthly amounts</h1>')
        .replace('Client invoices do not change.', '</p><div class="cjm-intro" id="cjmintro">The <b>monthly contract amount</b> (before HST) is what the client is billed each month for the regular cleaning of that site. Hours are used for cleaner pay only – they do not change the client\'s bill. Leave it empty if it is not agreed yet: the site shows <b>Not set</b> and the invoice shows a warning.</div><p class="small muted">')
        .replace('<th>Week</th><th></th></tr>', '<th>Week</th><th class="cjm-th">Monthly contract amount<div class="small muted">before HST</div></th><th></th></tr>');
      return x.replace(/<td><form data-form="shsave" id="shf-([^"]+)">/g, function (all, code) {
        var s = siteOf(code), a = amt(s);
        return '<td class="cjm-amt"><div class="cjm-in"><span>$</span><input type="number" name="monthly" form="shf-' + esc(code) + '" min="0" max="1000000" step="0.01" value="' + (a === null ? '' : a.toFixed(2)) + '" placeholder="Not set" aria-label="' + esc(code) + ' monthly contract amount"></div>' +
          (a === null ? '<span class="pill s-warn">Not set</span>' : s.monthlyTest ? '<span class="pill s-test">TEST value</span>' : '') + '</td>' + all;
      });
    };
  }
  if (typeof FORMS.shsave === 'function') {
    var oss = FORMS.shsave;
    FORMS.shsave = function (f, d) {
      if (!CJ()) return oss(f, d);
      var s = siteOf(d.code); if (!s) return;
      var el = document.querySelector('input[name=monthly][form="shf-' + s.code + '"]'); if (!el) return oss(f, d);
      var raw = String(el.value || '').trim(), v = raw === '' ? null : +raw;
      if (v !== null && (!(v >= 0 && v <= 1000000) || Math.abs(Math.round(v * 100) - v * 100) > 1e-6)) { toast('Monthly amount: a dollar amount from 0 to 1,000,000 (cents allowed), or leave it empty for Not set.'); return; }
      var before = amtText(s), changed = (v === null ? amt(s) !== null : amt(s) === null || r2(v) !== amt(s));
      var hoursChanged = false;
      for (var k = 0; k < 7; k++) { var hi = document.querySelector('input[name=d' + k + '][form="shf-' + s.code + '"]'); if (hi && +hi.value !== +((s.regHours || [])[k] || 0)) hoursChanged = true; }
      if (changed) { s.monthlyAmount = v === null ? null : r2(v); s.monthlyTest = false; audit('Site monthly contract amount set', s.code, before + ' → ' + amtText(s)); }
      if (hoursChanged) return oss(f, d);
      save(); toast(changed ? s.code + ' monthly amount saved ✓ (' + amtText(s) + ')' : 'Nothing changed.'); render();
    };
  }
  /* Clients & sites: monthly amounts instead of the hourly bill rate; no "Billing by day" */
  if (typeof VIEWS['admin:firms'] === 'function') {
    var ofi = VIEWS['admin:firms'];
    VIEWS['admin:firms'] = function (h) {
      var x = ofi(h); if (!CJ()) return x;
      x = x.replace(/(<span class="shsum small" data-site="([^"]+)">[^<]*<\/span>)/g, function (all, span, code) { return span + '<span class="cjmsum small" data-site="' + esc(code) + '"> · Monthly: ' + esc(amtText(siteOf(code))) + '</span>'; });
      x = x.replace('<th>Bill rate</th>', '<th>Monthly amounts</th>');
      x = x.replace(/<td><form data-form="firmrate" class="row"><input type="hidden" name="id" value="([^"]+)">[\s\S]*?<\/form><\/td>/g, function (all, id) {
        var f = user(id), S = f ? fSites(f) : [];
        return '<td class="small cjm-firmamts">' + (S.length ? S.map(function (s) { return esc(s.code) + ': ' + amtHtml(s); }).join('<br>') : '<span class="muted">No sites</span>') + '<div><a href="#/sitehours">Set →</a></div></td>';
      });
      x = x.replace(/<button class="small sec" data-act="farmbilling" data-id="[^"]+">Billing by day<\/button>/g, '');
      x = x.replace(/Set regular hours per site →/g, 'Set regular hours &amp; monthly amounts per site →');
      return x;
    };
  }

  /* ---------- client home: Monthly bill card (replaces the hourly "Period total") ---------- */
  function visitsInfo(firm, m) {
    if (typeof shAttend !== 'function') return '';
    var from = mStart(m), to = mEnd(m) < today() ? mEnd(m) : today(); if (from > to) return '';
    var out = fSites(firm).filter(function (s) { return s.active !== false; }).map(function (s) { var days = 0, d = from; while (d <= to) { if (shAttend(s.code, d).length) days++; d = addDays(d, 1); } return esc(s.code) + ' – ' + days + ' day' + (days === 1 ? '' : 's'); });
    return out.length ? '<p class="small muted cjm-visits" id="cjmvisits">Regular cleaning days recorded ' + (mEnd(m) < today() ? 'in ' + esc(mLabel(m)) : 'so far this month') + ' (for your information only): ' + out.join(' · ') + '.</p>' : '';
  }
  function monthlyCard(firm) {
    var cur = today().slice(0, 7), m = PAGE_STATE.cjmMonth && PAGE_STATE.cjmMonth <= cur ? PAGE_STATE.cjmMonth : cur, inv = invOfMonth(firm, m);
    var row = function (label, sub, val, cls) { return '<div class="trow' + (cls ? ' ' + cls : '') + '"><span>' + label + (sub ? '<br><span class="small muted">' + sub + '</span>' : '') + '</span><b>' + val + '</b></div>'; };
    var x = '<div class="card totals cjmonthly" id="cjmonthly"><div class="row-between"><h2 style="margin:0">Monthly bill <span class="small muted" id="cjmmonth">' + esc(mLabel(m)) + '</span></h2>' +
      '<span class="cjm-nav"><button type="button" class="small sec" data-act="cjmmonth" data-d="-1" aria-label="Previous month">◀</button>' + (m < cur ? '<button type="button" class="small sec" data-act="cjmmonth" data-d="1" aria-label="Next month">▶</button>' : '') + '</span></div>' +
      '<p class="small muted">Your regular cleaning is a <b>fixed monthly amount per site</b>. Special jobs are added as separate lines.</p>';
    var S, J, sub, hst, total, on, note;
    if (inv && inv.siteLines) { S = inv.siteLines; J = inv.specialLines || []; sub = inv.amount; hst = inv.hst; total = inv.total; on = inv.hst > 0 || inv.hstOn; note = 'Invoice <b>' + esc(inv.number) + '</b> · ' + esc(invPlain(inv).d) + '. <a href="#/invoices">See invoice →</a>'; }
    else if (inv) { return x + row('Invoice ' + esc(inv.number), esc(inv.periodStart + ' – ' + inv.periodEnd), money(inv.total), 'grand') + '<p class="small muted"><a href="#/invoices">See invoice →</a></p></div>'; }
    else { var C = calc(firm, m); S = C.sites; J = C.jobs; sub = C.sub; hst = C.hst; total = C.total; on = C.on; note = m === cur ? 'Estimate – your invoice is made after the month ends. Special jobs are added once they are done.' : 'Not invoiced yet.'; }
    x += S.map(function (l) {
      var val = l.unset && !(l.adjNote) ? '<span class="pill s-warn">Not set</span>' : money(l.amount) + (l.test ? ' <span class="pill s-test">TEST</span>' : '');
      return row(esc(l.site) + ' – ' + esc(l.name), (l.mode === 'flat_monthly' ? 'Flat monthly contract price · ' : 'Regular cleaning · ') + esc(l.month) + (l.adjNote ? ' · adjusted: ' + esc(l.adjNote) : '') + (l.unset && !l.adjNote ? ' · the office has not set this amount yet' : ''), val, 'cjm-site');
    }).join('');
    x += J.map(function (l) { return row('Special job ' + esc(l.no) + ' – ' + esc(l.kind), esc(l.site) + ' · ' + esc(shortDay(l.date)) + ' · ' + l.people + ' ' + (l.people === 1 ? 'person' : 'people') + ' × ' + shH(l.hoursPer) + ' h × ' + money(l.rate), money(l.amount), 'cjm-sp'); }).join('');
    x += (inv && inv.siteLines ? inv.extraLines || [] : []).map(function (l) { return row(esc(l.desc), 'Extra work · ' + l.qty + ' × ' + money(l.unit), money(l.amount), 'cjm-sp cjf-extra'); }).join('');  // flatmonthly1
    if (!S.length && !J.length) x += '<p class="small muted">No sites set up yet.</p>';
    x += row('Subtotal', '', money(sub)) + row(on ? 'HST 15%' : 'HST (not charged)', '', money(hst)) + row('Total for ' + esc(mLabel(m)), '', money(total), 'grand');
    if (S.some(function (l) { return l.unset && !l.adjNote; })) x += '<div class="alert warn small" id="cjmunset">The total does not include sites marked <b>Not set</b>. The office will confirm those amounts.</div>';
    return x + '<p class="small muted" id="cjmnote">' + note + '</p>' + visitsInfo(firm, m) + '</div>';
  }
  ACT.cjmmonth = function (el) { var cur = today().slice(0, 7), m = PAGE_STATE.cjmMonth || cur; m = mShift(m, +el.dataset.d); if (m > cur) m = cur; PAGE_STATE.cjmMonth = m; var y = window.scrollY; PAGE_STATE.after = function () { window.scrollTo(0, y); }; render(); };
  if (typeof firmPage === 'function') {
    var ofp = firmPage;
    firmPage = function (firm) {
      var x = ofp(firm); if (!CJ() || !firm || !firm.id) return x;
      var re = /<div class="card totals"><h2 style="margin-top:0">Period total[\s\S]*?<div class="trow grand">[\s\S]*?<\/div><\/div>/;
      var card = monthlyCard(firm); x = re.test(x) ? x.replace(re, function () { return card; }) : card + x;
      x = x.replace(/<p class="small muted">Billable hours[\s\S]*?<\/p>/g, '<p class="small muted cjm-info">Hours are shown for your information only. Your regular bill is a fixed monthly amount per site.</p>');
      return x;
    };
  }
  /* CSV downloads on the client page: information only (no billable hours / amounts) */
  var ofc = ACT.fcsv;
  ACT.fcsv = function (el) {
    if (!CJ() || !PAGE_STATE.frData) return ofc(el);
    var D = PAGE_STATE.frData, rows = [['Day', 'Workers', 'Hours worked (information only)']];
    D.R.rows.forEach(function (r) { rows.push([r.date, r.n, r.hours.toFixed(2)]); });
    rows.push(['Total', D.R.tot.n, D.R.tot.hours.toFixed(2)]);
    downloadText(D.firm.name.replace(/\W+/g, '-') + '-' + D.from + '-to-' + D.to + '-hours-TEST.csv', rows.map(csvRow).join('\n'), 'text/csv');
  };
  if (typeof ACT.phcsv === 'function') {
    var opc = ACT.phcsv;
    ACT.phcsv = function (el) {
      var D = PAGE_STATE.phData; if (!CJ() || !D || !D.rows) return opc(el);
      var rows = [['Date', 'Site', 'People worked', 'Hours worked (information only)']];
      D.rows.forEach(function (x) { rows.push([x.date, siteName(x.site), x.people, x.hours == null ? '' : x.hours.toFixed(2)]); });
      downloadText('past-hours-TEST.csv', rows.map(csvRow).join('\n'), 'text/csv');
    };
  }

  /* ---------- invoices: monthly site lines + special jobs + HST ---------- */
  if (typeof FORMS.clientinv === 'function') {
    var oci = FORMS.clientinv;
    FORMS.clientinv = function (f, d) {
      if (!CJ()) return oci(f, d);
      var firm = user(d.firmId); if (!firm || firm.type !== 'firm' || !/^\d{4}-\d{2}$/.test(d.month || '')) { toast('Pick a client and a month.'); return; }
      var m = d.month; if (invOfMonth(firm, m)) { toast('That month is already invoiced for this client.'); return; }
      var C = calc(firm, m); if (!C.sites.length && !C.jobs.length) { toast('This client has no sites yet.'); return; }
      if (C.blocked && C.blocked.length) { if (typeof cjfBlocked === 'function') cjfBlocked(firm, m, C.blocked); else toast('No invoice made – price not set for ' + C.blocked.join(', ') + '.'); return; }  // flatmonthly1
      var c = CB(), n = (DB.clientInvoices || []).length + 1, num = function (k) { return 'CJ-' + today().slice(0, 4) + '-' + String(k).padStart(3, '0'); };
      while ((DB.clientInvoices || []).some(function (i) { return i.number === num(n); })) n++;
      var inv = { id: uid('ci'), firmId: firm.id, number: num(n), monthly: true, month: m, periodStart: mStart(m), periodEnd: mEnd(m), billHours: 0, siteLines: C.sites, specialLines: C.jobs, hstOn: C.on, amount: 0, hst: 0, total: 0, issued: today(), due: addDays(today(), c.netDays), interestPct: c.interestPct, paidAt: '' };
      if (C.flat && typeof cjfDecorate === 'function') cjfDecorate(inv);  // flatmonthly1: draft, template terms, month-end date
      recalc(inv);
      (DB.clientInvoices = DB.clientInvoices || []).push(inv);
      jobsToBill(firm, m).forEach(function (r) { r.billedInv = inv.number; });
      audit('Created monthly client invoice', firm.name, inv.number + ' ' + mLabel(m) + ': ' + C.sites.length + ' site line(s)' + (C.jobs.length ? ', ' + C.jobs.length + ' special job(s)' : '') + ', ' + money(inv.total) + (C.unset.length ? ' – NOT SET: ' + C.unset.join(', ') : ''));
      if (inv.draft) { save(); toast('Draft invoice ' + inv.number + ' made for ' + mLabel(m) + ' (' + money(inv.total) + '). Add extra lines if needed, then Finalise & send.'); render(); return; }  // flatmonthly1: the client is told at Finalise
      notify(firm.id, 'New invoice ' + inv.number + ' for ' + mLabel(m) + ': ' + money(inv.total) + ', due ' + inv.due + '.');
      save(); toast('Invoice ' + inv.number + ' created' + (C.inactive && C.inactive.length ? ' (not billed – switched off: ' + C.inactive.join(', ') + ')' : '') + (C.unset.length ? ' – WARNING: monthly amount not set for ' + C.unset.join(', ') + '. Use Adjust on that line.' : '.')); render();
    };
  }
  if (typeof invDoc === 'function') {
    var oid = invDoc;
    invDoc = function (i) {
      if (!CJ()) return oid(i);
      if (i && i.flat && typeof cjfDoc === 'function') return cjfDoc(i);  // flatmonthly1: current CJ invoice template
      if (!i || !i.siteLines) { /* earlier / sample invoices: keep the totals, drop the hourly wording */
        return oid(i).filter(function (l) { return !(l[0] === 's' && /daily minimum|Daily minimum waived/i.test(l[1] || '')); }).map(function (l) { if (l[0] === 'r' && /^(Labour services|Regular cleaning) – billable hours/.test(l[1])) return ['r', 'Regular cleaning', l[2]]; return l; });
      }
      var f = user(i.firmId), st = invPlain(i), it = clientInvInterest(i), c = CB(), L = [];
      cjCompanyHead(L); if (cjMockInv()) L.push(['s', 'TEST VERSION – sample invoice made by the test app, not a real invoice']); L.push(['g']);
      L.push(['b', 'Invoice ' + i.number]); L.push(['t', 'Bill to: ' + (f ? f.name : '')]); L.push(['t', 'Month: ' + mLabel(i.month || i.periodStart.slice(0, 7)) + ' (' + i.periodStart + ' to ' + i.periodEnd + ')']);
      L.push(['t', 'Issued: ' + i.issued + '    Due: ' + i.due]); L.push(['t', 'Status: ' + st.d]); L.push(['g']);
      L.push(['t', 'Regular cleaning – fixed monthly amount per site:']);
      i.siteLines.forEach(function (l) {
        var unset = l.unset && !l.adjNote;
        L.push(['r', '  ' + siteLineLabel(l) + (l.test ? ' (TEST amount)' : ''), unset ? 'Not set' : money(l.amount)]);
        if (unset) L.push(['s', '  WARNING: the monthly amount for ' + l.site + ' is not set – this line is $0.00 until the office sets it.']);
        if (l.adjNote) L.push(['s', '  Adjusted' + (l.base !== null && l.base !== undefined ? ' from ' + money(l.base) : '') + ': ' + l.adjNote]);
      });
      if ((i.specialLines || []).length) { L.push(['t', 'Special jobs (separate from regular cleaning):']); i.specialLines.forEach(function (l) { L.push(['r', '  ' + spText(l), money(l.amount)]); }); }
      L.push(['r', 'Subtotal', money(i.amount)]); L.push(['r', i.hst ? 'HST 15%' : 'HST (not charged)', money(i.hst)]); L.push(['rb', 'Invoice total', money(i.total)]);
      if (it.amount && !i.paidAt) L.push(['r', 'Interest on overdue amount (' + it.months + ' month(s) × ' + (i.interestPct != null ? i.interestPct : c.interestPct) + '%)', money(it.amount)]);
      if (i.paidAt && i.interestCharged) L.push(['r', 'Interest charged when paid', money(i.interestCharged)]);
      L.push(['rb', 'Now owing', money(i.paidAt ? 0 : i.total + it.amount)]); L.push(['g']);
      L.push(['s', 'Payable within ' + c.netDays + ' days. Interest of ' + c.interestPct + '% per month on invoices not paid by the due date (Independent Contractor Service Agreement, s. 3).']);
      L.push(['s', 'Worker names are not shown on client invoices.']);
      return L;
    };
  }
  if (typeof clientInvoicesHtml === 'function') {
    var oih = clientInvoicesHtml;
    clientInvoicesHtml = function (firm, office) {
      var x = oih(firm, office); if (!CJ()) return x;
      x = x.replace(/(Invoiced monthly, payable within [^<]*?\(Independent Contractor Service Agreement, s\. 3\)\.)/, '$1 Each monthly invoice = the fixed monthly amount for each site + special jobs done + HST.');
      if (!office) return x;
      (DB.clientInvoices || []).forEach(function (i) {
        if (!i.siteLines || (firm && i.firmId !== firm.id)) return;
        var cells = i.siteLines.map(function (l, k) {
          var unset = l.unset && !l.adjNote;
          return '<span class="cjm-line' + (unset ? ' unset' : '') + '" data-site="' + esc(l.site) + '">' + esc(l.site) + ': ' + (unset ? '<span class="pill s-warn">Not set</span>' : '<b>' + money(l.amount) + '</b>') + (l.adjNote ? ' <span class="pill s-pend" title="' + esc(l.adjNote) + '">adjusted</span>' : '') +
            (i.paidAt ? '' : ' <button type="button" class="small sec" data-act="cjmadj" data-id="' + esc(i.id) + '" data-k="' + k + '">Adjust</button>') + '</span>';
        }).join('');
        var extra = '<tr class="cjmlines"><td colspan="12" class="small"><b>' + esc(mLabel(i.month || i.periodStart.slice(0, 7))) + ' – site lines:</b> ' + cells +
          (i.siteLines.some(function (l) { return l.unset && !l.adjNote; }) ? '<div class="cjm-warn">⚠ Monthly amount not set for ' + esc(i.siteLines.filter(function (l) { return l.unset && !l.adjNote; }).map(function (l) { return l.site; }).join(', ')) + ' – use Adjust to enter the amount for this invoice (and set it in Site hours &amp; monthly amounts for next month).</div>' : '') + '</td></tr>';
        x = x.replace(new RegExp('(<tr data-inv="' + esc(i.number) + '">[\\s\\S]*?</tr>)'), function (row) { return row + extra; });
      });
      return x;
    };
  }
  ACT.cjmadj = function (el) {
    if (!ME || ME.type !== 'admin') { denied('cjmadj'); return; }
    var i = invById(el.dataset.id), k = +el.dataset.k, l = i && (i.siteLines || [])[k]; if (!l) return;
    if (i.paidAt) { toast('This invoice is paid – it can no longer be changed.'); return; }
    modal('<h2>Adjust an invoice line</h2><p><b>' + esc(i.number) + '</b> · ' + esc(user(i.firmId).name) + '<br>' + esc(siteLineLabel(l)) + '</p>' +
      '<div class="cjm-intro small" id="cjmadjinfo">Monthly contract amount for this site: <b>' + (l.base === null || l.base === undefined ? 'Not set' : money(l.base)) + '</b>. Use this for a partial first or last month or another agreed change. Nothing is prorated automatically – enter the amount for this invoice. The client sees the new amount and your note on the invoice.</div>' +
      '<form data-form="cjmadj" id="cjmadjform"><input type="hidden" name="id" value="' + esc(i.id) + '"><input type="hidden" name="k" value="' + k + '"><div class="grid2">' +
      inp('amount', 'Amount for this invoice ($, before HST)', l.unset && !l.adjNote ? '' : (+l.amount).toFixed(2), { type: 'number', req: true, extra: ' min="0" max="1000000" step="0.01"' }) + '</div>' +
      inp('note', 'Note (required – shown on the invoice)', l.adjNote || '', { req: true, ph: 'e.g. Started Oct 15 – half month as agreed' }) +
      '<div class="row"><button type="submit" id="cjmadjsave">Save adjustment</button><button type="button" class="sec" data-act="closeModal">Cancel</button></div></form>');
  };
  FORMS.cjmadj = function (f, d) {
    if (!ME || ME.type !== 'admin') { denied('cjmadj'); return; }
    var i = invById(d.id), l = i && (i.siteLines || [])[+d.k]; if (!l) return;
    if (i.paidAt) { toast('This invoice is paid – it can no longer be changed.'); return; }
    var v = String(d.amount || '').trim() === '' ? NaN : +d.amount, note = String(d.note || '').trim();
    if (!(v >= 0 && v <= 1000000) || Math.abs(Math.round(v * 100) - v * 100) > 1e-6) { toast('Enter the amount in dollars (0 to 1,000,000, cents allowed).'); return; }
    if (note.length < 3) { toast('Please write a note – it is shown on the invoice.'); return; }
    var old = l.unset && !l.adjNote ? 'Not set' : money(l.amount);
    l.amount = r2(v); l.adjNote = note.slice(0, 200); l.adjBy = ME.name; l.adjAt = new Date().toISOString();
    recalc(i);
    audit('Adjusted monthly client invoice line', user(i.firmId).name, i.number + ' ' + l.site + ': ' + old + ' → ' + money(l.amount) + ' – ' + l.adjNote + ' (invoice total ' + money(i.total) + ')');
    save(); closeModal(); toast(i.number + ' ' + l.site + ' line adjusted ✓ – new total ' + money(i.total)); render();
  };
  if (typeof ADMIN_ONLY_ACT !== 'undefined') ADMIN_ONLY_ACT.push('cjmadj', 'cjmhst');
  if (typeof ADMIN_ONLY_FORM !== 'undefined') ADMIN_ONLY_FORM.push('cjmadj');

  /* ---------- hide hourly / daily-minimum billing for CJ ---------- */
  if (CJ()) {
    ['admin:farmbilling', 'admin:sitebilling'].forEach(function (k) { var o = VIEWS[k]; if (typeof o !== 'function') return; VIEWS[k] = function (h) { if (!CJ()) return o(h); return '<h1>Site billing</h1><div class="alert info" id="cjmnobilling">Chief Janitorial bills each site a <b>fixed monthly amount</b> (before HST), plus special jobs as separate lines. There is no hourly billing and no daily minimum. <a href="#/sitehours">Set monthly amounts →</a> · <a href="#/firms">Create monthly invoices →</a></div>'; }; });
    NAV.admin = NAV.admin.filter(function (n) { return n[0] !== '#/sitebilling' && n[0] !== '#/farmbilling'; });
    NAV.admin.forEach(function (n) { if (n[0] === '#/sitehours') n[1] = 'Site hours & monthly amounts'; });
    if (typeof MENU_GROUPS !== 'undefined' && MENU_GROUPS) MENU_GROUPS.forEach(function (g) { if (g[1]) g[1] = g[1].filter(function (h) { return h !== '#/sitebilling' && h !== '#/farmbilling'; }); });
    if (typeof HC_TXT !== 'undefined' && HC_TXT) HC_TXT.rules = HC_TXT.rules.replace('Until the office answers, the original hours stay on your bill.', 'Hours are for your records and our cleaner pay – your regular bill is a fixed monthly amount per site, so it does not change.');
    if (typeof VIEWS['admin:lateentries'] === 'function') { var ole = VIEWS['admin:lateentries']; VIEWS['admin:lateentries'] = function (h) { return ole(h).replace(/They are not billed to the client until approved\. Approved entries go on the client\\?'s next invoice with the note "Late entry, approved by office &lt;date&gt;", and the client gets 7 days from approval to propose a change\./, 'They count for cleaner pay once approved. Client invoices are a fixed monthly amount per site, so late entries never change a client invoice.'); }; }
    ['admin:farmchanges', 'admin:hourschanges'].forEach(function (k) { var o = VIEWS[k]; if (typeof o !== 'function') return; VIEWS[k] = function (h) { return o(h).replace('Only approved (or adjusted) changes affect hours, pay and billing.', 'Only approved (or adjusted) changes affect hours and cleaner pay. Client bills are a fixed monthly amount per site.'); }; });
  }
  /* HST on/off for a CJ client = the existing per-client HST setting (a new rates version with only HST changed) */
  ACT.cjmhst = function (el) {
    if (!ME || ME.type !== 'admin') { denied('cjmhst'); return; }
    var firm = user(el.dataset.id); if (!firm || firm.type !== 'firm') return;
    var c = typeof farmRatesCur === 'function' ? farmRatesCur(firm) : null, on = c ? c.hst !== false : true;
    var r = { id: uid('fr'), firmId: firm.id, version: (c ? c.version : 0) + 1, effective: today(), rates: c ? JSON.parse(JSON.stringify(c.rates || {})) : {}, other: c ? c.other || null : null, overtime: c ? c.overtime || null : null, hst: !on, by: ME.name, at: new Date().toISOString(), reason: 'HST turned ' + (on ? 'off' : 'on') + ' (monthly billing)' };
    (DB.farmRates = DB.farmRates || []).push(r);
    audit('Client HST ' + (on ? 'turned off' : 'turned on'), firm.name, 'Monthly invoices and special jobs from now on ' + (on ? 'without' : 'with') + ' HST 15%');
    save(); toast(firm.name + ': HST ' + (on ? 'off' : 'on') + ' ✓'); render();
  };

  /* ---------- DOM clean-up after render (client page, office preview, hours-change popup, settings, rates panel) ---------- */
  function stripCols(t, re) {
    var rows = [].slice.call(t.rows || []); if (!rows.length) return; var hdr = rows.filter(function (r) { return r.querySelector('th'); })[0]; if (!hdr) return;
    var n = hdr.cells.length, idx = []; [].forEach.call(hdr.cells, function (c, k) { if (re.test((c.textContent || '').trim())) idx.push(k); }); if (!idx.length) return;
    rows.forEach(function (r) { if (r.cells.length !== n) return; idx.slice().reverse().forEach(function (k) { r.deleteCell(k); }); });
  }
  function cleanClient(scope) {
    [].forEach.call(scope.querySelectorAll('table'), function (t) { if (t.closest('#cjmonthly,#clientinvoices,#spupcoming,#myinvlist,.invdoc')) return; stripCols(t, /^(Billable|Amount)/); });
    [].forEach.call(scope.querySelectorAll('[class*=grid] > div, .hc-cg > div'), function (d) { var s = d.querySelector('span'); if (s && d.firstElementChild === s && /^Billable/.test((s.textContent || '').trim())) d.remove(); });
    [].forEach.call(scope.querySelectorAll('.daycard .dc-head'), function (h) { var b = h.querySelectorAll('b'); if (b.length > 1 && /^\$/.test((b[b.length - 1].textContent || '').trim())) b[b.length - 1].remove(); });
    [].forEach.call(scope.querySelectorAll('#pasthours .totals .trow'), function (r) { var s = r.querySelector('span'); if (s && /^Billable/.test(s.textContent)) r.remove(); });
    var sh = scope.querySelector('#sect-hours > summary'); if (sh) sh.textContent = 'Hours by day (for your information)';
    var sa = scope.querySelector('#sect-agr > summary'); if (sa) sa.textContent = 'Agreement & pricing';
    var fa = scope.querySelector('#firmagr'); if (fa && !fa.dataset.cjm) { fa.dataset.cjm = '1'; fa.innerHTML = '<b>Cleaning client</b> <span class="pill s-ok">Fixed monthly amount per site</span><p class="small muted">Your regular cleaning is billed as a fixed monthly amount for each site (shown on your Monthly bill), plus HST if it applies. Special cleaning and site help are billed separately at ' + money(typeof spRate === 'function' ? spRate() : 30) + ' per person per hour.</p>'; }
  }
  function cleanHcModal(root) {
    var f = root.querySelector('#hcform');
    if (f) {
      [].forEach.call(f.querySelectorAll('.hc-l'), function (l) { if (/^Billable/.test((l.textContent || '').trim())) { var a = l.nextElementSibling, b = a && a.nextElementSibling; if (b) b.remove(); if (a) a.remove(); l.remove(); } });
      [].forEach.call(f.querySelectorAll('.hc-note'), function (n) { var t = (n.textContent || '').trim(); if (/^Billable =/.test(t)) n.remove(); else if (/original hours stay on your bill/.test(t)) n.innerHTML = '<b>Your regular bill is a fixed monthly amount per site – changing hours does not change it.</b> Hours are used for our records and cleaner pay.'; });
    }
    var s = root.querySelector('#hcsent');
    if (s) { [].forEach.call(s.querySelectorAll('div.muted'), function (d) { if (/^Now on your bill:/.test(d.textContent)) d.innerHTML = d.innerHTML.replace('Now on your bill:', 'Hours now:'); }); var b2 = s.querySelector('.hc-big2'); if (b2) b2.textContent = 'We will show the answer on this shift. Your monthly bill does not change.'; }
  }
  function cleanOffice(root) {
    var h = (location.hash || '').split('?')[0];
    if (h === '#/settings') { var mh = root.querySelector('form[data-form=clientbill] input[name=minHours]'); if (mh && !mh.dataset.cjm) { mh.dataset.cjm = '1'; var box = mh.closest('div'); if (box) { box.style.display = 'none'; var p = document.createElement('p'); p.className = 'small muted'; p.id = 'cjmminnote'; p.textContent = 'Daily minimum hours: not used – Chief Janitorial bills a fixed monthly amount per site.'; box.parentNode.parentNode.insertBefore(p, box.parentNode); } } }
    if (h === '#/firms') {
      var nf = root.querySelector('form[data-form=newfirm] input[name=rate]'); if (nf && !nf.dataset.cjm) { nf.dataset.cjm = '1'; var bx = nf.closest('div'); if (bx) { bx.style.display = 'none'; bx.innerHTML = '<input type="hidden" name="rate" value="0" data-cjm="1">'; var q = document.createElement('div'); q.className = 'small muted'; q.id = 'cjmnewfirmnote'; q.innerHTML = 'After you create the login, set the <b>monthly contract amount</b> for the site in <a href="#/sitehours">Site hours &amp; monthly amounts</a>.'; bx.parentNode.appendChild(q); } }
      var fr = root.querySelector('#farmrates'); if (fr && !fr.dataset.cjm) {
        fr.dataset.cjm = '1'; var t = fr.querySelector('h2'); if (t) t.textContent = 'Client sign-up, HST & signing';
        var hp = fr.querySelector('details.help p'); if (hp) hp.innerHTML = 'Cleaning clients are billed a <b>fixed monthly amount per site</b> (set in <a href="#/sitehours">Site hours &amp; monthly amounts</a>) plus special jobs. Here you can turn HST (15%) on or off per client and see who signed the agreement.';
        var th = [].filter.call(fr.querySelectorAll('th'), function (x) { return /Current rates/.test(x.textContent); })[0]; if (th) th.textContent = 'Billing';
        [].forEach.call(fr.querySelectorAll('tr[data-firm]'), function (tr) {
          var btn = tr.querySelector('[data-act=farmratesmodal]'), id = btn ? btn.dataset.id : null, firm = id ? user(id) : null; if (!firm) return;
          var cell = [].filter.call(tr.cells, function (c) { return c.getAttribute('data-label') === 'Current rates'; })[0] || tr.cells[2];
          if (cell) { cell.setAttribute('data-label', 'Billing'); cell.innerHTML = 'Fixed monthly per site: ' + fSites(firm).map(function (s) { return esc(s.code) + ' ' + esc(amtText(s)); }).join(', ') + '<br>HST ' + (hstOn(firm) ? 'on (15%)' : 'off'); }
          btn.outerHTML = '<button class="small sec" data-act="cjmhst" data-id="' + esc(firm.id) + '">Turn HST ' + (hstOn(firm) ? 'off' : 'on') + '</button>';
        });
      }
    }
  }
  if (typeof afterRender === 'function') {
    var oar = afterRender;
    afterRender = function (root) {
      oar(root);
      try {
        if (!root || !ME || !CJ()) return;
        if (root.id === 'modal') {
          cleanHcModal(root);
          if (/Office preview of what/.test(root.textContent || '')) cleanClient(root);
          return;
        }
        if (ME.type === 'firm') cleanClient(root);
        if (ME.type === 'admin') cleanOffice(root);
      } catch (e) { if (typeof logError === 'function') logError(e); }
    };
  }
  /* hours-change popup preview: worked hours only (no billable hours) */
  if (typeof hcPreview === 'function') {
    var ohp = hcPreview;
    hcPreview = function () {
      if (!CJ()) return ohp();
      var E = PAGE_STATE.hcEdit, f = document.getElementById('hcform'); if (!E || !f) return;
      var st = f.start.value, en = f.end.value, brk = f.brk.value, out = document.getElementById('hcdiff'), nh = document.getElementById('hcnewh'), span = function (a, b) { return b > a ? hrs(a, b) : hrs(a, '24:00') + hrs('00:00', b); };
      var err = spanErr(st, en); if (err) { out.className = 'hc-diff bad'; out.textContent = err; if (nh) nh.textContent = '–'; return; }
      var h = span(st, en), oh = span(E.start, E.end), dd = r2(h - oh); if (nh) nh.textContent = h.toFixed(2) + ' h';
      if (st === E.start && en === E.end && brk === E.brk) { out.className = 'hc-diff'; out.textContent = 'Change the time or the break above.'; return; }
      out.className = 'hc-diff ' + (dd < 0 ? 'less' : dd > 0 ? 'more' : 'same');
      out.innerHTML = 'Hours worked: <b>' + oh.toFixed(2) + ' → ' + h.toFixed(2) + '</b> ' + (dd === 0 ? '(no change)' : '(' + Math.abs(dd).toFixed(2) + ' h ' + (dd < 0 ? 'less' : 'more') + ')') + '<div class="small">Your monthly bill does not change.</div>';
    };
  }

  /* ---------- mock seed (once; mock store only): obviously-test monthly amounts; CJC120 left Not set on purpose ---------- */
  window.cjmSeed = function () {
    if (!DB || DB.cjmSeed1 || !(window.REG_STORE && window.REG_STORE.mode === 'mock')) return false;
    var A = { CJC101: 1000, CJC102: 500, CJC110: 2000 };
    (DB.sites || []).forEach(function (s) { if (A[s.code] !== undefined && s.monthlyAmount === undefined) { s.monthlyAmount = A[s.code]; s.monthlyTest = true; } });
    DB.cjmSeed1 = true; return true;
  };
  if (typeof load === 'function') { var _ld = load; load = function () { var r = _ld.apply(this, arguments); try { if (cjmSeed()) save(); } catch (e) {} return r; }; }
  if (typeof resetData === 'function') { var _rd = resetData; resetData = function () { var r = _rd.apply(this, arguments); try { if (cjmSeed()) save(); } catch (e) {} return r; }; }
})();
