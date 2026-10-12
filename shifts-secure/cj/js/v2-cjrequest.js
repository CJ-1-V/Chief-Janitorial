/* v2-cjrequest.js – CJ twin (TEST): working "＋ Request cleaning" flow. reqclean1, Oct 7 2026.
   Bug fixed: the client home showed "＋ Request cleaning" (the farm "Order a crew" card renamed by the CJ word filter), but it linked
   to #/orders, which v2-cj-brand.js had removed from the client menu – so pressing it just bounced back to the home screen.
   This file replaces that card with a cleaning-only request flow (no crews, workers, rates, PPE or 5-hour minimum):
   - Client #/requests: site (own sites only), type of cleaning, preferred date, preferred time, how often, details, contact.
     Shows a confirmation and the list of the client's requests with status; a request still waiting can be cancelled.
   - Office #/cleanrequests: queue of requests (Waiting / All) with Mark scheduled (date + optional note) or Decline (note required).
     Office overview "Needs attention" shows waiting requests. Client and office alerts go to the simulated outbox only.
   - Data: DB.cleanRequests (mock / browser test storage). Not wired to Supabase – a live table would need owner OK + SQL.
   Loads after v2-cj-brand.js.
   golive2 (Oct 9 2026): plain requests are rows WITHOUT special:true in DB.cleanRequests (special jobs share the list, v2-cjspecial.js).
   This file only counts / numbers plain rows (own counter DB.crSeq; with real data the database gives CR-#### and the browser shows
   a temporary "CR-…" until the save comes back). Its screens are exported as window.CJ_PLAIN for the two-choice page (v2-cjchoice.js).
   Saved with real data to reg_cleaning_requests (store-supabase.js, migration cj-cleanreq-002). */
'use strict';
(function () {
  if (typeof NAV === 'undefined' || typeof VIEWS === 'undefined') return;
  var CR_TYPES = ['Extra clean (same as regular service)', 'Deep clean', 'Floor care – strip & wax', 'Carpet cleaning', 'Window cleaning', 'Washroom deep clean', 'Move-in / move-out clean', 'Other (describe below)'];
  var CR_WHEN = ['Any time', 'Morning (before noon)', 'Afternoon (noon – 5 PM)', 'Evening (after 5 PM)', 'Overnight / after hours'];
  var CR_FREQ = ['One time only', 'Weekly', 'Every 2 weeks', 'Monthly'];
  var CR_PILL = { Requested: 's-pend', Scheduled: 's-ok', Declined: 's-bad', Cancelled: 's-mut' };
  var CR_LABEL = { Requested: 'Waiting for the office', Scheduled: 'Scheduled', Declined: 'Declined', Cancelled: 'Cancelled' };

  function crList() { return DB.cleanRequests = DB.cleanRequests || []; }
  function crById(id) { return crList().filter(function (r) { return r.id === id; })[0] || null; }
  function crMine(firm) { return crList().filter(function (r) { return r.firmId === firm.id && !r.special; }); }
  function crWaiting() { return crList().filter(function (r) { return r.status === 'Requested' && !r.special; }); }
  function crNo() { if (window.REG_LIVE) return 'CR-…' + Math.random().toString(36).slice(2, 7); DB.crSeq = (DB.crSeq || crList().filter(function (r) { return !r.special; }).length) + 1; return 'CR-' + String(DB.crSeq).padStart(4, '0'); }   // live: temporary until the database gives the number
  function crWho() { return ME ? ME.name + ' (' + (ME.type === 'admin' ? 'office' : (ME.username || ME.email || 'client')) + ')' : 'system'; }
  function crLog(r, action, detail) { (r.history = r.history || []).push({ at: new Date().toISOString(), who: crWho(), action: action, detail: detail || '' }); audit('Cleaning request: ' + action, r.firmName, r.no + (detail ? ' – ' + detail : '')); }
  function crDay(d) { try { return shortDay(d); } catch (e) { return d; } }
  function crSafeWho(w) { return /\(office\)$/.test(w) ? 'Chief Janitorial office' : w; }
  function sel(name, label, list, val, req) {
    return '<div><label class="' + (req ? 'req' : '') + '">' + esc(label) + '</label><select name="' + name + '"' + (req ? ' required' : '') + '>' + (req ? '<option value="">– choose –</option>' : '') + opt(list, val || '') + '</select></div>';
  }

  /* ---------- client: request form + my requests ---------- */
  function crForm(firm) {
    var codes = firmCodes(firm), d = PAGE_STATE.crDraft || {};
    if (!codes.length) return '<div class="alert warn" id="crnosite">No site is set up for your account yet. Please ask the office to add your site, then you can request cleaning here.</div>';
    var sites = codes.map(function (c) { return [c, siteName(c)]; });
    return '<div class="card crform"><form data-form="crsend" id="crform">' +
      '<div class="grid2">' + sel('site', 'Site', sites, d.site || (codes.length === 1 ? codes[0] : ''), true) + sel('kind', 'Type of cleaning', CR_TYPES, d.kind, true) +
      inp('date', 'Preferred date', d.date || '', { type: 'date', req: true, extra: ' min="' + today() + '"' }) + sel('when', 'Preferred time', CR_WHEN, d.when || CR_WHEN[0], false) +
      sel('freq', 'How often', CR_FREQ, d.freq || CR_FREQ[0], false) + inp('contact', 'Who should we contact? (optional)', d.contact || '', { ph: 'Name and phone' }) + '</div>' +
      '<div><label>Details</label><textarea name="note" placeholder="Rooms or areas, floor type, access or alarm instructions">' + esc(d.note || '') + '</textarea><div class="hint">Required if you choose “Other”.</div></div>' +
      '<div class="row"><button type="submit" id="crsend">Send request</button><button type="button" class="sec" data-act="crclose">Cancel</button></div>' +
      '<p class="small muted">The office will contact you to confirm the date before anything is scheduled.</p></form></div>';
  }
  function crCardClient(r) {
    var x = '<div class="crcard" data-id="' + esc(r.id) + '"><div class="cr-head"><b>' + esc(r.no) + ' · ' + esc(r.kind) + '</b><span class="pill ' + CR_PILL[r.status] + ' crst">' + esc(CR_LABEL[r.status]) + '</span></div>' +
      '<div class="cr-grid"><div><span>Site</span>' + esc(siteName(r.site)) + '</div><div><span>' + (r.status === 'Scheduled' ? 'Scheduled for' : 'Preferred date') + '</span>' + esc(crDay(r.schedDate || r.date)) + '</div><div><span>Time</span>' + esc(r.when) + '</div><div><span>How often</span>' + esc(r.freq) + '</div></div>' +
      (r.note ? '<div class="small">Details: ' + esc(r.note) + '</div>' : '') +
      (r.officeNote ? '<div class="small cr-note">Note from the office: “' + esc(r.officeNote) + '”</div>' : '');
    if (r.status === 'Requested') x += '<div class="row"><button class="small danger" data-act="crcancel" data-id="' + esc(r.id) + '">Cancel request</button></div>';
    x += '<details class="small"><summary>History</summary><ul>' + (r.history || []).slice().reverse().map(function (h) { return '<li>' + fmtStamp(h.at) + ' – ' + esc(crSafeWho(h.who)) + ': ' + esc(h.action) + (h.detail ? ' – ' + esc(h.detail) : '') + '</li>'; }).join('') + '</ul></details>';
    return x + '</div>';
  }
  VIEWS['firm:requests'] = function () {
    var firm = ME, mine = crMine(firm).slice().sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
    var open = mine.filter(function (r) { return r.status === 'Requested' || r.status === 'Scheduled'; }), closed = mine.filter(function (r) { return open.indexOf(r) < 0; });
    var x = '<h1>Cleaning requests</h1><p class="muted">Ask the Chief Janitorial office for an extra or one-time cleaning at one of your sites.</p>';
    if (PAGE_STATE.crDone) { var dn = crById(PAGE_STATE.crDone); PAGE_STATE.crDone = null; if (dn) x += '<div class="alert ok" id="crdone"><b>Request ' + esc(dn.no) + ' sent ✓</b> The Chief Janitorial office will review it and contact you to confirm the date. You can see its status below.</div>'; }
    x += PAGE_STATE.crForm ? crForm(firm) : '<button class="big" id="crbtn" data-act="cropen">＋ Request cleaning</button>';
    x += '<h2 id="crmine">My requests</h2>' + (open.length ? '<div id="crlist">' + open.map(crCardClient).join('') + '</div>' : '<p class="muted msg-empty" id="crlist">No open cleaning requests.</p>');
    if (closed.length) x += '<details class="crpast"><summary>Past, declined and cancelled (' + closed.length + ')</summary>' + closed.map(crCardClient).join('') + '</details>';
    return x;
  };
  ACT.cropen = function () { PAGE_STATE.crForm = true; PAGE_STATE.crDraft = null; go('#/requests'); };
  ACT.crclose = function () { PAGE_STATE.crForm = false; PAGE_STATE.crDraft = null; render(); };
  FORMS.crsend = function (f, d) {
    if (!ME || ME.type !== 'firm') { toast('Only client accounts can request cleaning.'); return; }
    PAGE_STATE.crDraft = d;
    if (firmCodes(ME).indexOf(d.site) < 0) { toast('Please choose one of your sites.'); return; }
    if (CR_TYPES.indexOf(d.kind) < 0) { toast('Please choose the type of cleaning.'); return; }
    if (!d.date || d.date < today()) { toast('Please choose a preferred date from today on.'); return; }
    if (/^Other/.test(d.kind) && !String(d.note || '').trim()) { toast('Please describe the cleaning you need in Details.'); return; }
    var r = { id: uid('cr'), no: crNo(), firmId: ME.id, firmName: ME.name, site: d.site, kind: d.kind, date: d.date,
      when: CR_WHEN.indexOf(d.when) >= 0 ? d.when : CR_WHEN[0], freq: CR_FREQ.indexOf(d.freq) >= 0 ? d.freq : CR_FREQ[0],
      note: String(d.note || '').trim().slice(0, 1000), contact: String(d.contact || '').trim().slice(0, 200), status: 'Requested', createdAt: new Date().toISOString(), history: [] };
    crList().push(r); crLog(r, 'Requested', r.kind + ' at ' + r.site + ' on ' + r.date);
    notify('admin', 'New cleaning request ' + r.no + ' from ' + r.firmName + ': ' + r.kind + ' at ' + siteName(r.site) + ', preferred ' + r.date + ' (' + r.when + ', ' + r.freq + ').', 'cr-new-' + r.id);
    save(); PAGE_STATE.crForm = false; PAGE_STATE.crDraft = null; PAGE_STATE.crDone = r.id; toast(/…/.test(r.no) ? 'Request sent ✓' : 'Request ' + r.no + ' sent ✓'); go('#/requests');
  };
  ACT.crcancel = function (el) {
    var r = crById(el.dataset.id); if (!r || !ME || r.firmId !== ME.id || r.status !== 'Requested') return;
    if (!confirm('Cancel cleaning request ' + r.no + '?')) return;
    r.status = 'Cancelled'; crLog(r, 'Cancelled by client');
    notify('admin', 'Cleaning request ' + r.no + ' from ' + r.firmName + ' was cancelled by the client.', 'cr-cancel-' + r.id);
    save(); toast('Request ' + r.no + ' cancelled'); render();
  };

  /* ---------- office: queue ---------- */
  function crCardOffice(r) {
    var x = '<div class="crcard office" data-id="' + esc(r.id) + '"><div class="cr-head"><b>' + esc(r.no) + '</b> <span>' + esc(r.firmName) + '</span><span class="pill ' + CR_PILL[r.status] + ' crst">' + esc(r.status === 'Requested' ? 'New – waiting' : r.status) + '</span></div>' +
      '<div class="cr-grid"><div><span>Type</span>' + esc(r.kind) + '</div><div><span>Site</span>' + esc(siteName(r.site)) + '</div><div><span>Preferred date</span>' + esc(crDay(r.date)) + '</div>' +
      '<div><span>Time</span>' + esc(r.when) + '</div><div><span>How often</span>' + esc(r.freq) + '</div><div><span>Requested</span>' + fmtStamp(r.createdAt) + '</div></div>' +
      (r.note ? '<div class="small">Client details: ' + esc(r.note) + '</div>' : '') + (r.contact ? '<div class="small">Contact: ' + esc(r.contact) + '</div>' : '') +
      (r.schedDate && r.status === 'Scheduled' ? '<div class="small"><b>Scheduled for ' + esc(crDay(r.schedDate)) + '</b></div>' : '') +
      (r.officeNote ? '<div class="small cr-note">Office note: “' + esc(r.officeNote) + '”</div>' : '');
    if (r.status === 'Requested') x += '<form data-form="crnone" class="crdec" data-id="' + esc(r.id) + '"><div class="grid2">' + inp('sched', 'Scheduled date', r.date, { type: 'date' }) + '</div>' +
      '<textarea name="comment" placeholder="Note to the client (required to decline)"></textarea><div class="row"><button class="small" data-act="crdec" data-d="Scheduled" data-id="' + esc(r.id) + '">Mark scheduled</button><button class="small danger" data-act="crdec" data-d="Declined" data-id="' + esc(r.id) + '">Decline</button></div></form>';
    return x + '</div>';
  }
  VIEWS['admin:cleanrequests'] = function () {
    var tab = PAGE_STATE.crTab || 'waiting', all = crList().slice().sort(function (a, b) { return (a.status === 'Requested' ? 0 : 1) - (b.status === 'Requested' ? 0 : 1) || (a.createdAt < b.createdAt ? 1 : -1); });
    var l = tab === 'waiting' ? all.filter(function (r) { return r.status === 'Requested'; }) : all;
    return '<h1>Cleaning requests</h1><p class="muted">Extra and one-time cleaning requests sent by clients. Confirm the date with the client, then mark it scheduled.</p>' +
      '<div class="row crtabs"><button class="small' + (tab === 'waiting' ? '' : ' sec') + '" data-act="crtab" data-t="waiting">Waiting (' + crWaiting().length + ')</button><button class="small' + (tab === 'all' ? '' : ' sec') + '" data-act="crtab" data-t="all">All (' + all.length + ')</button></div>' +
      (l.length ? '<div id="crqueue">' + l.map(crCardOffice).join('') + '</div>' : '<p class="muted msg-empty" id="crqueue">' + (tab === 'waiting' ? 'No cleaning requests waiting.' : 'No cleaning requests yet.') + '</p>');
  };
  ACT.crtab = function (el) { PAGE_STATE.crTab = el.dataset.t; render(); };
  FORMS.crnone = function () {};
  ACT.crdec = function (el) {
    if (!ME || ME.type !== 'admin') { denied('crdec'); return; }
    var r = crById(el.dataset.id); if (!r || r.status !== 'Requested') return;
    var f = el.closest('form'), dec = el.dataset.d, comment = String((f.querySelector('[name=comment]') || {}).value || '').trim(), sd = (f.querySelector('[name=sched]') || {}).value || r.date;
    if (dec === 'Declined' && !comment) { toast('Please add a note to the client to decline.'); return; }
    r.status = dec; r.officeNote = comment; r.decidedAt = new Date().toISOString();
    if (dec === 'Scheduled') r.schedDate = sd;
    crLog(r, dec === 'Scheduled' ? 'Scheduled by the office' : 'Declined by the office', (dec === 'Scheduled' ? 'for ' + sd : '') + (comment ? (dec === 'Scheduled' ? ' – ' : '') + comment : ''));
    notify(r.firmId, dec === 'Scheduled' ? 'Your cleaning request ' + r.no + ' (' + r.kind + ' at ' + siteName(r.site) + ') is scheduled for ' + sd + '.' + (comment ? ' Note: ' + comment : '') : 'Your cleaning request ' + r.no + ' (' + r.kind + ' at ' + siteName(r.site) + ') was declined. Note: ' + comment, 'cr-' + dec + '-' + r.id);
    save(); toast(r.no + (dec === 'Scheduled' ? ' marked scheduled ✓' : ' declined')); render();
  };
  if (typeof ADMIN_ONLY_ACT !== 'undefined') ADMIN_ONLY_ACT.push('crdec');
  if (typeof ROLE_ONLY !== 'undefined') { ROLE_ONLY.crsend = ['firm']; ROLE_ONLY.crcancel = ['firm']; }

  /* ---------- menus, routes, home card, overview flag ---------- */
  if (NAV.firm && !NAV.firm.some(function (n) { return n[0] === '#/requests'; })) NAV.firm.splice(1, 0, ['#/requests', 'Cleaning requests']);
  if (NAV.admin && !NAV.admin.some(function (n) { return n[0] === '#/cleanrequests'; })) {
    var ai = -1; NAV.admin.forEach(function (n, i) { if (n[0] === '#/hourschanges' || n[0] === '#/farmchanges') ai = i; });
    NAV.admin.splice(ai >= 0 ? ai + 1 : NAV.admin.length, 0, ['#/cleanrequests', 'Cleaning requests']);
  }
  if (typeof MENU_GROUPS !== 'undefined' && MENU_GROUPS && MENU_GROUPS[0] && MENU_GROUPS[0][1].indexOf('#/cleanrequests') < 0) {
    var g = MENU_GROUPS[0][1], ri = g.indexOf('#/review'); g.splice(ri >= 0 ? ri + 1 : 0, 0, '#/cleanrequests');
  }
  if (typeof gateRoute === 'function') {
    var og = gateRoute;
    gateRoute = function (h) {
      var r = og(h);
      var to = ME && ME.type === 'firm' && r === '#/orders' ? '#/requests' : ME && ME.type === 'admin' && r === '#/creworders' ? '#/cleanrequests' : '';
      if (to) { try { history.replaceState(null, '', location.pathname + location.search + to); } catch (e) {} return to; }
      return r;
    };
  }
  if (typeof VIEWS['firm:home'] === 'function') {
    var oh = VIEWS['firm:home'];
    VIEWS['firm:home'] = function (h) {
      var x = oh(h), n = ME ? crMine(ME).filter(function (r) { return r.status === 'Requested'; }).length : 0;
      var card = '<div class="card" id="ordercard"><a class="btn big" id="crhomebtn" href="#/requests" data-act="cropen">＋ Request cleaning</a>' + (n ? ' <span class="small">' + n + ' request' + (n === 1 ? '' : 's') + ' waiting for the office</span>' : '') + '</div>';
      var y = x.replace(/<div class="card" id="ordercard">[\s\S]*?<\/div>/, card);
      return y === x && x.indexOf('id="ordercard"') < 0 ? card + x : y;
    };
  }
  if (typeof adminFlags === 'function') {
    var of = adminFlags;
    adminFlags = function () {
      var f = of(), n = crWaiting().length;
      if (n) f.unshift({ t: 'Cleaning requests', c: 's-pend', h: n + ' cleaning request' + (n === 1 ? '' : 's') + ' from clients waiting. <a href="#/cleanrequests">Review →</a>' });
      return f;
    };
  }
  /* golive2: the two-choice page (v2-cjchoice.js) reuses these after v2-cjspecial.js replaces the screens */
  window.CJ_PLAIN = { form: crForm, send: FORMS.crsend, cardClient: crCardClient, cardOffice: crCardOffice, mine: crMine, waiting: crWaiting };
})();
