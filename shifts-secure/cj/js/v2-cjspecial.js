/* v2-cjspecial.js – CJ twin (TEST): "Order special cleaning or site help" at a per-person hourly rate. sitehours1, Oct 8 2026.
   Owner (Oct 8 12:02 PM): clients can order special cleanings and site help at $30/person per hour (painting, deep clean, glass
   cleaning, trash removal, other site maintenance). Owner (12:04 PM): the regular invoice stays the same; clients see upcoming
   special jobs on their dashboard.
   - Client #/requests (replaces the reqclean1 form): job type, site, people, estimated hours per person, date, start time, notes.
     Live estimate: people × hours × rate = $X plus HST (15% when HST is on for that client – existing client rate setting).
   - Office #/cleanrequests: type, people, hours, estimate; Mark scheduled / Decline (as before) and Mark done with ACTUAL
     people × hours. Rate lives in one office setting (DB.settings.specialRate, default $30) shown on the same page.
   - Done jobs become a separate extra line on the client's next monthly invoice (mock). The regular amount is unchanged.
   - Client home: "Upcoming special jobs" card (requested / scheduled / done; past jobs collapsed).
   - Cleaners log actual hours for a special job in "Unusual day – log my hours" (v2-cjsitehours.js), never split.
   Data: DB.cleanRequests (new fields people, hoursPer, rate, estimate, actual*, billedInv). Loads after v2-cjsitehours.js.
   golive2 (Oct 9 2026): the plain "Request cleaning" form is back next to this one (two clear choices, v2-cjchoice.js).
   The office queue shows both kinds (plain rows keep their own card). Special jobs have their own counter (DB.spSeq; with real data
   the database gives SJ-####). Saved with real data to reg_special_jobs (store-supabase.js). */
'use strict';
(function () {
  if (typeof NAV === 'undefined' || typeof VIEWS === 'undefined') return;
  var SP_TYPES = ['Extra regular cleaning', 'Deep clean', 'Floor strip / recoat', 'Glass / window cleaning', 'Carpet cleaning', 'Washroom deep clean', 'Move-in / move-out clean', 'Trash removal', 'Painting', 'Site visit help', 'Other (describe below)'];   // calendar1 Oct 21 2026: the old one-off "Request cleaning" types folded in (owner)
  var SP_PILL = { Requested: 's-pend', Scheduled: 's-ok', Done: 's-test', Declined: 's-bad', Cancelled: 's-mut' };
  var SP_LABEL = { Requested: 'Requested – waiting for the office', Scheduled: 'Scheduled', Done: 'Done', Declined: 'Declined', Cancelled: 'Cancelled' };
  function spRate() { var r = +((DB.settings || {}).specialRate); return r > 0 ? r : 30; }
  function spHstOn(firm) { try { var rs = typeof farmRatesCur === 'function' ? farmRatesCur(firm) : null; return rs ? rs.hst !== false : true; } catch (e) { return true; } }
  function r2(n) { return Math.round(n * 100) / 100; }
  function spList() { return DB.cleanRequests = DB.cleanRequests || []; }
  function spById(id) { return spList().filter(function (r) { return r.id === id; })[0] || null; }
  function spNo() { if (window.REG_LIVE) return 'SJ-…' + Math.random().toString(36).slice(2, 7); DB.spSeq = (DB.spSeq || spList().filter(function (r) { return r.special; }).length) + 1; return 'SJ-' + String(DB.spSeq).padStart(4, '0'); }   // live: temporary until the database gives the number
  function spLog(r, action, detail) { (r.history = r.history || []).push({ at: new Date().toISOString(), who: ME ? ME.name + (ME.type === 'admin' ? ' (office)' : '') : 'system', action: action, detail: detail || '' }); audit('Special job: ' + action, r.firmName, r.no + (detail ? ' – ' + detail : '')); }
  function spEst(people, hours, rate, firm) {
    var sub = r2((+people || 0) * (+hours || 0) * rate), on = spHstOn(firm), hst = on ? r2(sub * 0.15) : 0;
    return { sub: sub, hst: hst, total: r2(sub + hst), on: on, text: (+people || 0) + ' ' + ((+people) === 1 ? 'person' : 'people') + ' × ' + shH(+hours || 0) + ' h × ' + money(rate) + ' = ' + money(sub) + (on ? ' plus HST ' + money(hst) + ' (15%) = ' + money(r2(sub + hst)) : ' plus HST') };
  }
  window.spEst = spEst; window.spRate = spRate;
  function spPeople(r) { return r.people ? r.people + ' × ' + shH(r.hoursPer) + ' h' : '–'; }
  function spDay(r) { return shortDay(r.schedDate || r.date) + (r.time ? ' · ' + r.time : r.when ? ' · ' + r.when : ''); }
  function spField(name, label, list, val, req) { return sel(name, label, list, val, { req: req }); }

  /* ---------- client: order form ---------- */
  function spForm(firm) {
    var codes = firmCodes(firm), d = PAGE_STATE.crDraft || {};
    if (!codes.length) return '<div class="alert warn" id="crnosite">No site is set up for your account yet. Please ask the office to add your site first.</div>';
    var pe = spEst(d.people || 2, d.hoursPer || 3, spRate(), firm);
    return '<div class="card crform"><form data-form="crsend" id="crform">' +
      '<div class="grid2">' + spField('kind', 'Type of job', SP_TYPES, d.kind || '', true) + spField('site', 'Site', codes.map(function (c) { return [c, siteName(c)]; }), d.site || (codes.length === 1 ? codes[0] : ''), true) +
      inp('people', 'Number of people', d.people || 2, { type: 'number', req: true, extra: ' min="1" max="20" step="1" inputmode="numeric"' }) +
      inp('hoursPer', 'Estimated hours per person', d.hoursPer || 3, { type: 'number', req: true, extra: ' min="0.5" max="12" step="0.25"' }) +
      inp('date', 'Date', d.date || '', { type: 'date', req: true, extra: ' min="' + today() + '"' }) + inp('time', 'Start time', d.time || '09:00', { type: 'time', req: true, extra: ' step="900"' }) + '</div>' +
      '<div><label>Notes</label><textarea name="note" placeholder="Rooms or areas, colours, access or alarm instructions, who to see on site">' + esc(d.note || '') + '</textarea><div class="hint">Required for “Other” – tell us what you need.</div></div>' +
      inp('contact', 'Who should we contact? (optional)', d.contact || '', { ph: 'Name and phone' }) +
      '<div class="spest" id="spest" aria-live="polite"><span>Estimate</span><b id="spesttext">' + esc(pe.text) + '</b><small>Rate ' + money(spRate()) + ' per person per hour. You are billed for the actual people and hours, on a separate line of your next invoice. Your regular cleaning invoice does not change.</small></div>' +
      '<div class="row"><button type="submit" id="crsend">Send order</button><button type="button" class="sec" data-act="crclose">Cancel</button></div>' +
      '<p class="small muted">The office confirms the date with you before anything is scheduled.</p></form></div>';
  }
  document.addEventListener('input', function (e) {
    var f = e.target && e.target.closest && e.target.closest('#crform'); if (!f || !ME || ME.type !== 'firm') return;
    var t = document.getElementById('spesttext'); if (t) t.textContent = spEst(f.people.value, f.hoursPer.value, spRate(), ME).text;
  });
  function spCardClient(r) {
    var x = '<div class="crcard spcard" data-id="' + esc(r.id) + '"><div class="cr-head"><b>' + esc(r.no) + ' · ' + esc(r.kind) + '</b><span class="pill ' + (SP_PILL[r.status] || 's-mut') + ' crst">' + esc(SP_LABEL[r.status] || r.status) + '</span></div>' +
      '<div class="cr-grid"><div><span>Site</span>' + esc(siteName(r.site)) + '</div><div><span>' + (r.status === 'Scheduled' || r.status === 'Done' ? 'Date' : 'Preferred date') + '</span>' + esc(spDay(r)) + '</div><div><span>People × hours</span>' + esc(spPeople(r)) + '</div>' +
      '<div><span>' + (r.status === 'Done' ? 'Billed' : 'Estimate') + '</span>' + (r.status === 'Done' && r.actual ? money(r.actual.amount) + ' plus HST' : r.estimate ? money(r.estimate) + ' plus HST' : '–') + '</div></div>' +
      (r.note ? '<div class="small">Notes: ' + esc(r.note) + '</div>' : '') + (r.officeNote ? '<div class="small cr-note">Note from the office: “' + esc(r.officeNote) + '”</div>' : '') +
      (r.status === 'Done' && r.actual ? '<div class="small">Done: ' + r.actual.people + ' × ' + shH(r.actual.hoursPer) + ' h × ' + money(r.actual.rate) + ' = <b>' + money(r.actual.amount) + '</b>' + (r.billedInv ? (r.billedInv === 'billed' ? ' – billed' : ' – on invoice ' + esc(r.billedInv)) : ' – will be on your next invoice') + '</div>' : '');
    if (r.status === 'Requested') x += '<div class="row"><button class="small danger" data-act="crcancel" data-id="' + esc(r.id) + '">Cancel order</button></div>';
    return x + '</div>';
  }
  VIEWS['firm:requests'] = function () {
    var firm = ME, mine = spList().filter(function (r) { return r.firmId === firm.id; }).sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
    var open = mine.filter(function (r) { return r.status === 'Requested' || r.status === 'Scheduled'; }), closed = mine.filter(function (r) { return open.indexOf(r) < 0; });
    var x = '<h1>Order special cleaning or site help</h1><p class="muted">Deep cleans, glass and window cleaning, trash removal, painting, site visit help and other site maintenance – billed at <b>' + money(spRate()) + ' per person per hour</b>, separate from your regular cleaning.</p>';
    if (PAGE_STATE.crDone) { var dn = spById(PAGE_STATE.crDone); PAGE_STATE.crDone = null; if (dn) x += '<div class="alert ok" id="crdone"><b>Order ' + esc(dn.no) + ' sent ✓</b> The Chief Janitorial office will confirm the date with you. You can see its status below.</div>'; }
    x += PAGE_STATE.crForm ? spForm(firm) : '<button class="big" id="crbtn" data-act="cropen">＋ Order special cleaning or site help</button>';
    x += '<h2 id="crmine">My orders</h2>' + (open.length ? '<div id="crlist">' + open.map(spCardClient).join('') + '</div>' : '<p class="muted msg-empty" id="crlist">No open orders.</p>');
    if (closed.length) x += '<details class="crpast"><summary>Done, declined and cancelled (' + closed.length + ')</summary>' + closed.map(spCardClient).join('') + '</details>';
    return x;
  };
  FORMS.crsend = function (f, d) {
    if (!ME || ME.type !== 'firm') { toast('Only client accounts can order special jobs.'); return; }
    PAGE_STATE.crDraft = d;
    if (SP_TYPES.indexOf(d.kind) < 0) { toast('Please choose the type of job.'); return; }
    if (firmCodes(ME).indexOf(d.site) < 0) { toast('Please choose one of your sites.'); return; }
    var people = +d.people, hp = +d.hoursPer;
    if (!(people >= 1 && people <= 20 && Math.round(people) === people)) { toast('Number of people: 1 to 20.'); return; }
    if (!(hp >= 0.5 && hp <= 12) || Math.round(hp * 4) !== hp * 4) { toast('Hours per person: 0.5 to 12, in quarter hours.'); return; }
    if (!d.date || d.date < today()) { toast('Please choose a date from today on.'); return; }
    if (!/^\d{2}:\d{2}$/.test(d.time || '')) { toast('Please choose a start time.'); return; }
    if (/^Other/.test(d.kind || '') && !String(d.note || '').trim()) { toast('Please describe the job in Notes.'); return; }
    var rate = spRate(), e = spEst(people, hp, rate, ME);
    var r = { id: uid('cr'), no: spNo(), special: true, firmId: ME.id, firmName: ME.name, site: d.site, kind: d.kind, date: d.date, time: d.time, people: people, hoursPer: hp, rate: rate, estimate: e.sub, hstOn: e.on,
      note: String(d.note || '').trim().slice(0, 1000), contact: String(d.contact || '').trim().slice(0, 200), status: 'Requested', createdAt: new Date().toISOString(), history: [] };
    spList().push(r); spLog(r, 'Ordered', r.kind + ' at ' + r.site + ' on ' + r.date + ' ' + r.time + ' – ' + e.text);
    notify('admin', 'New special job ' + r.no + ' from ' + r.firmName + ': ' + r.kind + ' at ' + siteName(r.site) + ', ' + r.date + ' ' + r.time + ', ' + e.text + '.', 'sp-new-' + r.id);
    save(); PAGE_STATE.crForm = false; PAGE_STATE.crDraft = null; PAGE_STATE.crDone = r.id; toast(/…/.test(r.no) ? 'Order sent ✓' : 'Order ' + r.no + ' sent ✓'); go('#/requests');
  };

  /* ---------- office queue ---------- */
  function spLogsFor(r) { return (DB.shLogs || []).filter(function (l) { return l.kind === 'special' && l.jobId === r.id && l.status === 'approved'; }); }
  function spCardOffice(r) {
    var firm = user(r.firmId), e = r.people ? spEst(r.people, r.hoursPer, r.rate || spRate(), firm) : null;
    var x = '<div class="crcard office spcard" data-id="' + esc(r.id) + '"><div class="cr-head"><b>' + esc(r.no) + '</b> <span>' + esc(r.firmName) + '</span><span class="pill ' + (SP_PILL[r.status] || 's-mut') + ' crst">' + esc(r.status === 'Requested' ? 'New – waiting' : r.status) + '</span></div>' +
      '<div class="cr-grid"><div><span>Type</span>' + esc(r.kind) + '</div><div><span>Site</span>' + esc(siteName(r.site)) + '</div><div><span>' + (r.schedDate ? 'Scheduled' : 'Preferred') + '</span>' + esc(spDay(r)) + '</div>' +
      '<div><span>People</span>' + esc(r.people || '–') + '</div><div><span>Hours per person</span>' + (r.hoursPer ? shH(r.hoursPer) + ' h' : '–') + '</div><div><span>Estimate</span>' + (e ? '<b>' + money(e.sub) + '</b> plus HST' : '–') + '</div></div>' +
      (e ? '<div class="small muted">' + esc(e.text) + '</div>' : '') + (r.note ? '<div class="small">Client notes: ' + esc(r.note) + '</div>' : '') + (r.contact ? '<div class="small">Contact: ' + esc(r.contact) + '</div>' : '') +
      (r.officeNote ? '<div class="small cr-note">Office note: “' + esc(r.officeNote) + '”</div>' : '');
    if (r.status === 'Requested') x += '<form data-form="crnone" class="crdec" data-id="' + esc(r.id) + '"><div class="grid2">' + inp('sched', 'Scheduled date', r.date, { type: 'date' }) + '</div><textarea name="comment" placeholder="Note to the client (required to decline)"></textarea><div class="row"><button type="button" class="small" data-act="crdec" data-d="Scheduled" data-id="' + esc(r.id) + '">Mark scheduled</button><button type="button" class="small danger" data-act="crdec" data-d="Declined" data-id="' + esc(r.id) + '">Decline</button></div></form>';
    if (r.status === 'Scheduled' && r.special) {
      var L = spLogsFor(r), ph = L.reduce(function (a, l) { return a + shLogHours2(l); }, 0), np = L.map(function (l) { return l.userId; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).length;
      var ap = np || r.people, ah = np ? r2(ph / np) : r.hoursPer;
      x += '<div class="spdone"><b>Mark done</b> – enter the actual people and hours' + (L.length ? ' <span class="small muted">(from ' + L.length + ' approved cleaner log' + (L.length === 1 ? '' : 's') + ': ' + shH(ph) + ' person-hours)</span>' : '') + '<div class="row"><label class="small">People <input type="number" name="ap" min="1" max="20" step="1" value="' + ap + '" style="max-width:80px"></label><label class="small">Hours per person <input type="number" name="ah" min="0.25" max="24" step="0.25" value="' + ah + '" style="max-width:90px"></label><button type="button" class="small" data-act="spdone" data-id="' + esc(r.id) + '">Mark done</button></div></div>';
    }
    if (r.status === 'Done' && r.actual) x += '<div class="small"><b>Done:</b> ' + r.actual.people + ' × ' + shH(r.actual.hoursPer) + ' h × ' + money(r.actual.rate) + ' = <b>' + money(r.actual.amount) + '</b> ' + (r.billedInv ? (r.billedInv === 'billed' ? '– billed' : '– billed on ' + esc(r.billedInv)) : '– goes on the client\'s next invoice') + '</div>';
    return x + '</div>';
  }
  function shLogHours2(l) { var a = l['in'], b = l.out; return b > a ? hrs(a, b) : hrs(a, '24:00') + hrs('00:00', b); }
  VIEWS['admin:cleanrequests'] = function () {
    var tab = PAGE_STATE.crTab || 'waiting', all = spList().slice().sort(function (a, b) { return (a.status === 'Requested' ? 0 : a.status === 'Scheduled' ? 1 : 2) - (b.status === 'Requested' ? 0 : b.status === 'Scheduled' ? 1 : 2) || (a.createdAt < b.createdAt ? 1 : -1); });
    var cnt = function (s) { return all.filter(function (r) { return r.status === s; }).length; };
    var l = tab === 'waiting' ? all.filter(function (r) { return r.status === 'Requested'; }) : tab === 'scheduled' ? all.filter(function (r) { return r.status === 'Scheduled'; }) : all;
    return '<h1>Cleaning requests &amp; special jobs</h1><p class="muted"><b>Cleaning requests</b> (extra or one-time cleaning): confirm the date with the client, then mark it scheduled. <b>Special jobs</b> (deep clean, glass, trash removal, painting, site help, other maintenance – billed per person per hour): mark scheduled, then mark done with the actual people and hours. Done special jobs go on the client\'s next invoice as a separate line.</p>' +
      '<form data-form="sprate" class="row sprate" id="sprate"><label class="small"><b>Rate per person per hour</b> <input type="number" name="rate" min="1" max="500" step="0.5" value="' + spRate() + '" style="max-width:100px"></label><button class="small sec">Save rate</button><span class="small muted">New orders use this rate. Orders already placed keep the rate they were quoted.</span></form>' +
      '<div class="row crtabs"><button class="small' + (tab === 'waiting' ? '' : ' sec') + '" data-act="crtab" data-t="waiting">Waiting (' + cnt('Requested') + ')</button><button class="small' + (tab === 'scheduled' ? '' : ' sec') + '" data-act="crtab" data-t="scheduled">Scheduled (' + cnt('Scheduled') + ')</button><button class="small' + (tab === 'all' ? '' : ' sec') + '" data-act="crtab" data-t="all">All (' + all.length + ')</button></div>' +
      (l.length ? '<div id="crqueue">' + l.map(function (r) { return !r.special && window.CJ_PLAIN ? CJ_PLAIN.cardOffice(r).replace('<div class="crcard office"', '<div class="crcard office crplain"').replace('</b> <span>', '</b> <span class="pill s-mut">Cleaning request</span> <span>') : spCardOffice(r).replace('</b> <span>', '</b> <span class="pill s-test">Special job</span> <span>'); }).join('') + '</div>' : '<p class="muted msg-empty" id="crqueue">' + (tab === 'waiting' ? 'No cleaning requests or special-job orders waiting.' : 'Nothing here yet.') + '</p>');
  };
  FORMS.sprate = function (f, d) { var v = +d.rate; if (!(v >= 1 && v <= 500)) { toast('Enter a rate from $1 to $500.'); return; } var old = spRate(); DB.settings.specialRate = Math.round(v * 100) / 100; audit('Special job rate changed', 'Settings', money(old) + ' → ' + money(DB.settings.specialRate) + ' per person per hour'); save(); toast('Rate saved ✓'); render(); };
  ACT.spdone = function (el) {
    if (!ME || ME.type !== 'admin') { denied('spdone'); return; }
    var r = spById(el.dataset.id); if (!r || r.status !== 'Scheduled') return;
    var box = el.closest('.spdone'), ap = +box.querySelector('[name=ap]').value, ah = +box.querySelector('[name=ah]').value;
    if (!(ap >= 1 && ap <= 20 && Math.round(ap) === ap) || !(ah > 0 && ah <= 24) || Math.round(ah * 4) !== ah * 4) { toast('Enter people (1–20) and hours per person in quarter hours.'); return; }
    var rate = r.rate || spRate(); r.status = 'Done'; r.doneAt = new Date().toISOString(); r.doneDate = r.schedDate || today();
    r.actual = { people: ap, hoursPer: ah, rate: rate, amount: r2(ap * ah * rate) };
    spLog(r, 'Marked done', ap + ' × ' + ah + ' h × ' + money(rate) + ' = ' + money(r.actual.amount));
    notify(r.firmId, 'Special job ' + r.no + ' (' + r.kind + ' at ' + siteName(r.site) + ') is done: ' + ap + ' × ' + shH(ah) + ' h × ' + money(rate) + ' = ' + money(r.actual.amount) + ' plus HST. It will be on your next invoice as a separate line.', 'sp-done-' + r.id);
    save(); toast(r.no + ' marked done ✓'); render();
  };
  if (typeof ADMIN_ONLY_ACT !== 'undefined') ADMIN_ONLY_ACT.push('spdone');
  if (typeof ADMIN_ONLY_FORM !== 'undefined') ADMIN_ONLY_FORM.push('sprate');
  /* jobs a cleaner can log hours against (scheduled or done, last 14 days to tomorrow) */
  window.spJobsForLog = function () { return spList().filter(function (r) { var d = r.schedDate || r.date; return r.special && (r.status === 'Scheduled' || r.status === 'Done') && d >= addDays(today(), -14) && d <= addDays(today(), 1); }); };

  /* ---------- invoices: done jobs = separate extra line on the next invoice ---------- */
  function spUnbilled(firm, to) { return spList().filter(function (r) { return r.firmId === firm.id && r.status === 'Done' && r.actual && !r.billedInv && (r.doneDate || '') <= to; }); }
  if (typeof FORMS.clientinv === 'function') {
    var oc = FORMS.clientinv;
    FORMS.clientinv = function (f, d) {
      var firm = user(d.firmId); if (!firm || firm.type !== 'firm' || !/^\d{4}-\d{2}$/.test(d.month || '')) return oc(f, d);
      var from = d.month + '-01', to = addDays(isoLocal(new Date(+d.month.slice(0, 4), +d.month.slice(5, 7), 1)), -1), jobs = spUnbilled(firm, to), n = (DB.clientInvoices || []).length;
      if (!jobs.length || clientInvs(firm).some(function (i) { return i.periodStart === from; })) return oc(f, d);
      var R = firmReport(firm, from, to), late = typeof lateLinesFor === 'function' ? lateLinesFor(firm, from) : [];
      if (R.tot.amount > 0 || late.length) oc(f, d);
      else { var c = CB(); (DB.clientInvoices = DB.clientInvoices || []).push({ id: uid('ci'), firmId: firm.id, number: 'CJ-' + today().slice(0, 4) + '-' + String(n + 1).padStart(3, '0'), periodStart: from, periodEnd: to, billHours: 0, amount: 0, hst: 0, total: 0, issued: today(), due: addDays(today(), c.netDays), interestPct: c.interestPct, paidAt: '' }); }
      if ((DB.clientInvoices || []).length <= n) return;
      var inv = DB.clientInvoices[DB.clientInvoices.length - 1], add = 0, on = spHstOn(firm);
      inv.specialLines = jobs.map(function (r) { add += r.actual.amount; r.billedInv = inv.number; return { id: r.id, no: r.no, kind: r.kind, site: r.site, date: r.doneDate, people: r.actual.people, hoursPer: r.actual.hoursPer, rate: r.actual.rate, amount: r.actual.amount }; });
      inv.amount = r2(inv.amount + add); inv.hst = (on || inv.hst > 0) ? r2(inv.amount * 0.15) : 0; inv.total = r2(inv.amount + inv.hst);
      audit('Special jobs added to client invoice', firm.name, inv.number + ': ' + jobs.length + ' job(s), ' + money(add)); save(); toast('Invoice ' + inv.number + ' created – includes ' + jobs.length + ' special job' + (jobs.length === 1 ? '' : 's') + '.'); render();
    };
  }
  function spLineText(l) { return 'Special job ' + l.no + ' – ' + l.kind + ', ' + l.site + ', ' + l.date + ': ' + l.people + ' × ' + shH(l.hoursPer) + ' h × ' + money(l.rate); }
  if (typeof invDoc === 'function') {
    var od = invDoc;
    invDoc = function (i) {
      var L = od(i), S = i.specialLines || []; if (!S.length) return L;
      var add = S.reduce(function (a, l) { return a + l.amount; }, 0), late = (i.lateLines || []).reduce(function (a, l) { return a + l.amount; }, 0);
      var k = -1; L.forEach(function (l, j) { if (l[0] === 'r' && /^Labour services/.test(l[1])) { l[1] = l[1].replace('Labour services', 'Regular cleaning'); l[2] = money(i.amount - late - add); } if (l[0] === 'r' && l[1] === 'Subtotal' && k < 0) k = j; });
      var rows = [['t', 'Special jobs (separate from regular cleaning):']].concat(S.map(function (l) { return ['r', '  ' + spLineText(l), money(l.amount)]; }));
      if (k >= 0) Array.prototype.splice.apply(L, [k, 0].concat(rows)); return L;
    };
  }
  if (typeof clientInvoicesHtml === 'function') {
    var oh = clientInvoicesHtml;
    clientInvoicesHtml = function (firm, office) {
      var x = oh(firm, office);
      (DB.clientInvoices || []).forEach(function (i) { if (!i.specialLines || !i.specialLines.length || (firm && i.firmId !== firm.id)) return; x = x.replace(new RegExp('(<tr data-inv="' + i.number + '">[\\s\\S]*?</tr>)'), '$1<tr class="splines"><td colspan="' + (office ? 12 : 10) + '" class="small">Special jobs on this invoice (separate line): ' + i.specialLines.map(function (l) { return esc(spLineText(l) + ' = ' + money(l.amount)); }).join('; ') + '</td></tr>'); });
      return x;
    };
  }

  /* ---------- client home: button wording + Upcoming special jobs card ---------- */
  function spUpcomingCard(firm) {
    var mine = spList().filter(function (r) { return r.firmId === firm.id && r.special && r.status !== 'Cancelled' && r.status !== 'Declined'; });
    var up = mine.filter(function (r) { return r.status !== 'Done' && (r.schedDate || r.date) >= today(); }).sort(function (a, b) { return (a.schedDate || a.date) < (b.schedDate || b.date) ? -1 : 1; });
    var past = mine.filter(function (r) { return up.indexOf(r) < 0; }).sort(function (a, b) { return (a.schedDate || a.date) < (b.schedDate || b.date) ? 1 : -1; });
    var row = function (r) { return '<tr><td>' + esc(shortDay(r.schedDate || r.date)) + '</td><td>' + esc(r.time || '–') + '</td><td>' + esc(r.kind) + '<div class="small muted">' + esc(r.site) + ' · ' + esc(r.no) + '</div></td><td>' + esc(r.status === 'Done' && r.actual ? r.actual.people : r.people) + '</td><td><span class="pill ' + (SP_PILL[r.status] || 's-mut') + '">' + esc(r.status === 'Requested' ? 'Requested' : r.status) + '</span></td></tr>'; };
    var head = '<tr><th>Date</th><th>Time</th><th>Job</th><th>People</th><th>Status</th></tr>';
    return '<div class="card spupcoming" id="spupcoming"><div class="row-between"><h2 style="margin:0">Upcoming special jobs</h2><a href="#/requests" class="small">Order or see all →</a></div>' +
      (up.length ? '<div class="tw"><table id="spuptable">' + head + up.map(row).join('') + '</table></div>' : '<p class="muted small">No special jobs coming up.</p>') +
      (past.length ? '<details class="small"><summary>Past and done (' + past.length + ')</summary><div class="tw"><table>' + head + past.map(row).join('') + '</table></div></details>' : '') + '</div>';
  }
  if (typeof VIEWS['firm:home'] === 'function') {
    var ofh = VIEWS['firm:home'];
    VIEWS['firm:home'] = function (h) {
      var x = ofh(h); if (!ME || ME.type !== 'firm') return x;
      x = x.replace('＋ Request cleaning</a>', '＋ Request cleaning</a> <a class="btn big sec" id="sphomebtn" href="#/requests" data-act="cropen" data-k="special">＋ Order special cleaning or site help</a>');   // golive2: two clear choices
      var m = x.match(/<div class="card" id="ordercard">[\s\S]*?<\/div>/), card = spUpcomingCard(ME);
      return m ? x.replace(m[0], m[0] + card) : card + x;
    };
  }
  /* v2-declutter regroups the client home after render (top card + collapsible sections): keep these cards near the top */
  if (typeof afterRender === 'function') {
    var oar = afterRender;
    afterRender = function (root) {
      oar(root);
      try {
        if (!root || !ME || ME.type !== 'firm') return; var sp = root.querySelector('#spupcoming'), top = root.querySelector('.hometop'), cm = root.querySelector('#cmhome');
        if (sp && top && top.parentNode) { top.parentNode.insertBefore(sp, top.nextSibling); if (cm) sp.parentNode.insertBefore(cm, sp.nextSibling); }
      } catch (e) {}
    };
  }
  NAV.firm.forEach(function (n) { if (n[0] === '#/requests') n[1] = 'Request cleaning / special jobs'; });
  NAV.admin.forEach(function (n) { if (n[0] === '#/cleanrequests') n[1] = 'Cleaning requests & special jobs'; });
  if (typeof adminFlags === 'function') { var oaf = adminFlags; adminFlags = function () { var f = oaf(), n = spList().filter(function (r) { return r.special && r.status === 'Requested'; }).length; if (n) f.unshift({ t: 'Special jobs', c: 's-pend', h: n + ' special job order' + (n === 1 ? '' : 's') + ' from clients waiting. <a href="#/cleanrequests">Review →</a>' }); return f; }; }   // golive2: plain requests keep their own flag

  /* ---------- mock seed (once) ---------- */
  window.spSeed = function () {
    if (!DB || DB.spSeed1 || !(window.REG_STORE && window.REG_STORE.mode === 'mock')) return false;
    var fA = DB.users.filter(function (u) { return u.username === 'firmA'; })[0], e1 = DB.users.filter(function (u) { return u.username === 'employee1'; })[0], at = new Date().toISOString();
    if (fA) {
      var j1 = { id: uid('cr'), no: spNo(), special: true, firmId: fA.id, firmName: fA.name, site: 'CJC102', kind: 'Painting', date: addDays(today(), 3), schedDate: addDays(today(), 3), time: '09:00', people: 2, hoursPer: 4, rate: 30, estimate: 240, hstOn: true, note: 'Repaint the lunch room walls – same colour (TEST)', contact: '', status: 'Scheduled', officeNote: 'Two painters booked (TEST)', createdAt: at, history: [], seed: true };
      var j2 = { id: uid('cr'), no: spNo(), special: true, firmId: fA.id, firmName: fA.name, site: 'CJC101', kind: 'Glass / window cleaning', date: addDays(today(), -5), schedDate: addDays(today(), -5), doneDate: addDays(today(), -5), time: '13:00', people: 2, hoursPer: 3, rate: 30, estimate: 180, hstOn: true, note: 'Front windows inside and out (TEST)', contact: '', status: 'Done', actual: { people: 2, hoursPer: 3.5, rate: 30, amount: 210 }, doneAt: at, createdAt: at, history: [], seed: true };
      spList().push(j1, j2);
      if (e1) (DB.shLogs = DB.shLogs || []).push({ id: uid('sl'), userId: e1.id, site: 'CJC101', date: j2.doneDate, 'in': '13:00', out: '16:30', kind: 'special', jobId: j2.id, jobNo: j2.no, reason: 'Special job ' + j2.no + ' – ' + j2.kind, note: '', status: 'approved', decidedBy: 'Office Tester', decidedAt: at, createdAt: at, seed: true });
    }
    DB.spSeed1 = true; return true;
  };
  if (typeof load === 'function') { var _ld = load; load = function () { var r = _ld.apply(this, arguments); try { if (spSeed()) save(); } catch (e) {} return r; }; }
  if (typeof resetData === 'function') { var _rd = resetData; resetData = function () { var r = _rd.apply(this, arguments); try { if (spSeed()) save(); } catch (e) {} return r; }; }
  /* golive2: the two-choice page (v2-cjchoice.js) */
  window.CJ_SPECIAL = { form: spForm, send: FORMS.crsend, cardClient: spCardClient, rate: spRate };
})();
