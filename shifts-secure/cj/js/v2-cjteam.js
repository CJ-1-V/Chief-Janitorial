/* v2-cjteam.js – CJ twin (TEST): client TEAM members + invoice wall + button wording. calendar1, Oct 21 2026.
   Owner (Oct 21 2026):
   - The client's main account invites its own Managers / Supervisors from "My team" (#/team): name, email, role, which of the
     client's sites each can see (default all); edit, deactivate, remove. They sign in to the same app (a linked login:
     DB.users[] {type:'firm', loginOf:<client id>, team:true, loginRole:'Manager'|'Supervisor', teamSites:[codes]|null}).
   - INVOICE WALL: team members NEVER see invoices or billing amounts – no invoice pages/list/PDF, no amounts (any $ amount on their
     screens is hidden), no "Latest invoice" card, no billing notifications, blocked routes + actions (audited). Live: RLS in
     migrations/cj-calendar-001.sql (DRAFT, NOT RUN).
   - They CAN use the calendar, request a day change, request special cleaning, cancel / block under the 3-day rule, and see
     notifications for their permitted sites. Their requests go straight to the office; the main account is notified and sees
     every request with who made it and its status. Team actions are audited with the member's name and role.
   - Office: "Client teams" (#/clientteams) lists each client's team.
   - Buttons: "Request cleaning" → "Request a day change of cleaning" (opens the calendar's day-change request);
     "Order special cleaning or site help" → "Request special cleaning" (same special-cleaning form, office inbox renamed).
   Loads after v2-cjcalendar.js. TEST COPY ONLY. */
'use strict';
(function () {
  if (typeof NAV === 'undefined' || typeof VIEWS === 'undefined') return;
  var ROLES = ['Manager', 'Supervisor'];
  var TEAM_OK = ['#/home', '#/', '#/calendar', '#/requests', '#/contact', '#/issues', '#/alerts', '#/profile', '#/changepw', '#/terms', '#/pending'];
  function login() { return typeof clLoginOf === 'function' ? clLoginOf(ME) : ME; }
  function isTeam() { if (!ME || ME.type !== 'firm') return false; var L = login(); return !!(L && L !== ME && L.team); }
  function isMain() { return !!(ME && ME.type === 'firm' && !isTeam()); }
  function teamSites() { if (!isTeam()) return null; var L = login(), all = (DB.sites || []).filter(function (s) { return s.firmId === ME.id; }).map(function (s) { return s.code; }); return L.teamSites && L.teamSites.length ? L.teamSites.filter(function (c) { return all.indexOf(c) >= 0; }) : all; }
  window.cjtIsTeam = isTeam; window.cjtTeamSites = teamSites; window.cjtIsMain = isMain;
  var MONEY = /(\$\s?\d[\d,]*(\.\d+)?|\bCAD\s?\d[\d,]*(\.\d+)?)/g;
  var BILL = /invoice|billing|\bbill\b|billed|amount|paid|payment|interest|\bHST\b|price|estimate|\$\s?\d/i;
  function noteOk(n) {
    if (!isTeam()) return true;
    if (BILL.test(n.text || '')) return false;
    var mine = teamSites(), other = (DB.sites || []).filter(function (s) { return s.firmId === ME.id && mine.indexOf(s.code) < 0; }).map(function (s) { return s.code; });
    return !other.some(function (c) { return (n.text || '').indexOf(c) >= 0; });
  }
  window.cjtNoteOk = noteOk;
  function block(what) { toast('Invoices and billing are only for the account holder. Ask your main account or the office.'); try { audit('Blocked (team member – billing)', ME ? ME.name : '', what || ''); save(); } catch (e) {} }

  /* ---------- audit: name the team member ---------- */
  if (typeof audit === 'function') { var oau = audit; audit = function (a, t, d) { if (isTeam()) { var L = login(); d = (d ? d + ' ' : '') + '[by team member ' + L.name + ', ' + (L.loginRole || 'Team') + ']'; } return oau.call(this, a, t, d); }; window.audit = audit; }

  /* ---------- invoice wall (logic) ---------- */
  if (typeof invAllowed === 'function') { var oia = invAllowed; invAllowed = function (i) { if (isTeam()) return false; return oia.apply(this, arguments); }; window.invAllowed = invAllowed; }
  if (typeof clientInvs === 'function') { var oci = clientInvs; clientInvs = function () { if (isTeam()) return []; return oci.apply(this, arguments); }; window.clientInvs = clientInvs; }
  if (typeof myInvoices === 'function') { var omi = myInvoices; myInvoices = function () { if (isTeam()) return []; return omi.apply(this, arguments); }; window.myInvoices = myInvoices; }
  ['invDoc', 'cjfDoc'].forEach(function (fn) { if (typeof window[fn] === 'function') { var o = window[fn]; window[fn] = function () { if (isTeam()) { block(fn); return [['t', 'Not available.']]; } return o.apply(this, arguments); }; } });
  var BILL_ACT = /inv|pdf|bill|paid|pay|price|rate|signoff/i;
  function wallActs() {
    Object.keys(ACT).forEach(function (k) { if (!BILL_ACT.test(k) || ACT[k].__cjt) return; var o = ACT[k]; ACT[k] = function () { if (isTeam()) { block('action ' + k); return; } return o.apply(this, arguments); }; ACT[k].__cjt = 1; });
    Object.keys(FORMS).forEach(function (k) { if (!BILL_ACT.test(k) || FORMS[k].__cjt) return; var o = FORMS[k]; FORMS[k] = function () { if (isTeam()) { block('form ' + k); return; } return o.apply(this, arguments); }; FORMS[k].__cjt = 1; });
  }
  /* routes: team members only reach the allowed pages; everything else (invoices, sign-off with hours, PDFs …) is blocked */
  var ogr = gateRoute; gateRoute = function (h) {
    var r = ogr.apply(this, arguments);
    if (isTeam()) { var base = String(r).split('?')[0]; if (TEAM_OK.indexOf(base) < 0) { block('page ' + base); try { history.replaceState(null, '', '#/home'); } catch (e) {} return '#/home'; } }
    if (ME && ME.type === 'firm' && r === '#/team' && !isMain()) return '#/home';
    return r;
  };
  window.gateRoute = gateRoute;
  /* menu: team members see only what they may use; the main account gets "My team" */
  var baseFirm = NAV.firm;
  try {
    Object.defineProperty(NAV, 'firm', { configurable: true, get: function () { if (isTeam()) return baseFirm.filter(function (n) { return TEAM_OK.indexOf(n[0]) >= 0; }).map(function (n) { return n[0] === '#/home' ? ['#/home', 'Cleaning schedule'] : n; }); return baseFirm; }, set: function (v) { baseFirm = v; } });
  } catch (e) {}
  if (!baseFirm.some(function (n) { return n[0] === '#/team'; })) { var pi = -1; baseFirm.forEach(function (n, i) { if (n[0] === '#/profile') pi = i; }); baseFirm.splice(pi >= 0 ? pi : baseFirm.length, 0, ['#/team', 'My team']); }
  /* screens: team home = the calendar page only; amounts hidden on anything else they open */
  var ofh = VIEWS['firm:home']; VIEWS['firm:home'] = function () { if (isTeam()) return VIEWS.calendar(); return relabel(ofh.apply(this, arguments)); };
  if (typeof afterRender === 'function') {
    var oar = afterRender; afterRender = function (root) {
      oar.apply(this, arguments);
      try {
        if (!isTeam() || !root) return;
        var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), n, L = [];
        while ((n = w.nextNode())) if (MONEY.test(n.nodeValue)) L.push(n);
        L.forEach(function (t) { MONEY.lastIndex = 0; t.nodeValue = t.nodeValue.replace(MONEY, '(price hidden)'); });
        [].forEach.call(root.querySelectorAll('[id^=calinv], .clientinv, [data-inv]'), function (e) { e.remove(); });
        if (root.id !== 'modal') wallActs();
      } catch (e) {}
    };
  }
  if (VIEWS.alerts) { var oal = VIEWS.alerts; VIEWS.alerts = function () { if (!isTeam()) return oal.apply(this, arguments); var keep = DB.notes; DB.notes = keep.filter(function (n) { return n.to !== ME.id || noteOk(n); }); try { return oal.apply(this, arguments); } finally { var shown = DB.notes; DB.notes = keep; shown.forEach(function (n) { if (n.read) n.read = true; }); } }; }

  /* ---------- button wording + one way to change a day ---------- */
  function relabel(x) {
    return String(x)
      .replace(/data-act="cropen"(?: data-k="plain")?>＋ Request cleaning/g, 'data-act="calchange">＋ Request a day change of cleaning')
      .replace(/href="#\/requests"( data-act="calchange")/g, 'href="#/calendar"$1')
      .replace(/<h2>Request cleaning<\/h2><p>[\s\S]*?<\/p>/, '<h2>Request a day change of cleaning</h2><p>Move one of your <b>regular cleanings</b> to another day or time. Pick the cleaning and the new day; the office approves it. At least 3 days’ notice.</p>')
      .replace(/<h2>Special cleaning or site help<\/h2>/g, '<h2>Request special cleaning</h2>')
      .replace(/Order special cleaning or site help/g, 'Request special cleaning')
      .replace(/Cleaning requests &amp; special jobs/g, 'Special cleaning requests')
      .replace(/Cleaning requests & special jobs/g, 'Special cleaning requests')
      .replace(/Order or see all →/g, 'Request or see all →');
  }
  window.cjtRelabel = relabel;
  ['firm:requests', 'admin:cleanrequests'].forEach(function (k) { if (typeof VIEWS[k] === 'function') { var o = VIEWS[k]; VIEWS[k] = function () { var x = relabel(o.apply(this, arguments)); (DB.cleanRequests || []).forEach(function (r) { if (r.byName && r.no) x = x.replace(new RegExp('(>[^<]*' + r.no.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')'), '$1 · by ' + esc(r.byName)); }); return x; }; } });
  /* every calendar request (incl. team members') on the client's requests page, with who made it and its status */
  if (typeof VIEWS['firm:requests'] === 'function') { var ofr = VIEWS['firm:requests']; VIEWS['firm:requests'] = function () {
    var x = ofr.apply(this, arguments), ts = teamSites(), l = (DB.calReqs || []).filter(function (r) { return r.firmId === ME.id && (!ts || (r.sites || [r.site]).some(function (c) { return ts.indexOf(c) >= 0; })); });
    return x + '<div class="card" id="cjtcalreqs"><h2>Calendar requests (day changes, cancellations, no-cleaner dates)</h2>' + (l.length ? '<div class="tw"><table><tr><th>No.</th><th>Request</th><th>Made by</th><th>Status</th><th>Office note</th></tr>' + l.map(function (r) { return '<tr data-req="' + esc(r.no) + '"><td>' + esc(r.no) + '</td><td>' + esc(calDesc(r)) + '</td><td>' + esc(r.createdBy || '') + '</td><td><span class="pill ' + (r.status === 'approved' ? 's-ok' : r.status === 'declined' ? 's-bad' : 's-pend') + '">' + esc(r.status) + '</span></td><td class="small">' + esc(r.officeNote || '') + '</td></tr>'; }).join('') + '</table></div>' : '<p class="muted">None yet.</p>') + '</div>';
  }; }
  var oop = ACT.cropen; ACT.cropen = function (el) { if (!(el && el.dataset && el.dataset.k === 'special')) return ACT.calchange(el); return oop.apply(this, arguments); };
  NAV.admin.forEach(function (n) { if (n[0] === '#/cleanrequests') n[1] = 'Special cleaning requests'; });
  baseFirm.forEach(function (n) { if (n[0] === '#/requests') n[1] = 'Request special cleaning'; });
  if (typeof notify === 'function') { var ono = notify; notify = function (to, text, key) { text = String(text).replace(/^New special job /, 'New special cleaning request ').replace(/^Special job /, 'Special cleaning ').replace(/^New cleaning request /, 'New special cleaning request '); return ono.call(this, to, text, key); }; window.notify = notify; }
  /* special-cleaning requests: team members only for their sites; tag who made it; tell the main account */
  if (FORMS.crsend) { var ocs = FORMS.crsend; FORMS.crsend = function (f, d) {
    if (isTeam() && d.site && teamSites().indexOf(d.site) < 0) { toast('Not allowed – you can only request for your own sites.'); audit('Blocked special cleaning request (site not permitted)', ME.name, d.site); save(); return; }
    var before = (DB.cleanRequests || []).length, r = ocs.apply(this, arguments), l = DB.cleanRequests || [];
    if (l.length > before) { var who = typeof calWhoBy === 'function' ? calWhoBy() : ME.name; l.slice(before).concat(l.slice(0, l.length - before)).forEach(function (x) { if (x.firmId === ME.id && !x.byName && Date.now() - new Date(x.createdAt || 0).getTime() < 60000) { x.byName = who; if (isTeam()) notify(ME.id, 'Your team member ' + who + ' requested special cleaning ' + (x.no || '') + ' (' + (x.kind || '') + ' at ' + (x.site || '') + '). Status: ' + (x.status || 'Requested') + '.', 'cjt|sp|' + x.id); } }); save(); }
    return r; }; }
  /* calendar requests by team members: notify the main account */
  if (typeof calRequest === 'function') { var ocr = calRequest; window.calRequest = function (o) { var r = ocr.apply(this, arguments); if (r && r.ok && isTeam()) { notify(ME.id, 'Your team member ' + r.req.createdBy + ' sent calendar request ' + r.req.no + ': ' + calDesc(r.req) + ' – status ' + r.req.status + '.', 'cal|team|' + r.req.id); save(); } return r; }; }

  /* ---------- My team (main account) ---------- */
  function team(fid) { return (DB.users || []).filter(function (u) { return u.type === 'firm' && u.team && u.loginOf === fid && !u.removed; }); }
  window.cjtTeam = team;
  function siteList(fid) { return (DB.sites || []).filter(function (s) { return s.firmId === fid && s.code !== 'TEST-PRACTICE'; }); }
  function sitesText(u, fid) { var all = siteList(fid).map(function (s) { return s.code; }); return !u.teamSites || !u.teamSites.length || u.teamSites.length === all.length ? 'All sites (' + all.length + ')' : u.teamSites.join(', '); }
  function form(u) {
    var fid = ME.id, s = siteList(fid);
    return '<form data-form="cjtsave" id="cjtform" class="cjtform"><input type="hidden" name="id" value="' + (u ? u.id : '') + '">' +
      '<div class="calfacts2"><label>Name<input name="name" required maxlength="80" value="' + esc(u ? u.name : '') + '"></label><label>Email<input type="email" name="email" required maxlength="120" value="' + esc(u ? u.email : '') + '"' + (u ? ' readonly' : '') + '></label></div>' +
      '<label>Role<select name="role">' + ROLES.map(function (r) { return '<option' + (u && u.loginRole === r ? ' selected' : '') + '>' + r + '</option>'; }).join('') + '</select></label>' +
      '<fieldset class="calsites"><legend class="small muted">Sites this person can see</legend>' + s.map(function (x) { var on = !u || !u.teamSites || !u.teamSites.length || u.teamSites.indexOf(x.code) >= 0; return '<label class="calck"><input type="checkbox" name="site_' + esc(x.code) + '" value="1"' + (on ? ' checked' : '') + '> ' + esc(x.code + ' – ' + x.name) + '</label>'; }).join('') + '</fieldset>' +
      '<p class="small muted">Managers and supervisors can use the calendar, request day changes and special cleaning, and cancel or block dates. They <b>never</b> see invoices or prices.</p>' +
      '<div class="calacts"><button type="submit">' + (u ? 'Save changes' : 'Invite') + '</button></div></form>';
  }
  VIEWS['firm:team'] = function () {
    if (!isMain()) return '<h1>My team</h1><p class="muted">Only the account holder can manage the team.</p>';
    var l = team(ME.id);
    return '<div class="calpage cjtpage"><h1>My team</h1><p class="muted small">Invite your managers and supervisors. They sign in to this app and see only the sites you choose. They can never see invoices or prices. Their requests go straight to Chief Janitorial, and you are notified of each one.</p>' +
      (function () { var n = window.__cjtNew; window.__cjtNew = null; var m = window.__cjtMail; return (n ? '<div class="alert ok" id="cjtnew"><b>' + (n.resent ? 'Invite resent ✓' : 'Invitation ready ✓') + '</b> ' + esc(n.name) + ' signs in with <b>' + esc(n.email) + '</b>. TEST copy: no email is sent – the preview is below and the message is logged. Test-only sign-in password: <code id="cjttmp">' + esc(n.tmp) + '</code> (they must set their own password at first sign-in).</div>' : '') +
        (m ? '<div class="card cjtmailprev" id="cjtmail"><div class="row-between"><h2 style="margin:0">Invite email preview <span class="caltest" style="background:#fdf1dc;color:#8a5a0a">TEST – not sent</span></h2><button class="small sec" data-act="cjtmailclose">Close</button></div>' +
          '<div class="small cjtmailhd"><div><b>To:</b> ' + esc(m.to) + '</div><div><b>From:</b> ' + esc(m.from) + '</div><div><b>Subject:</b> <span id="cjtmailsubj">' + esc(m.subject) + '</span></div></div>' + m.html + '<details class="small"><summary>Plain-text version</summary><pre style="white-space:pre-wrap">' + esc(m.text) + '</pre></details></div>' : ''); })() +
      '<div class="card"><h2>People</h2>' + (l.length ? '<div class="tw"><table id="cjttable"><tr><th>Name</th><th>Role</th><th>Sites</th><th>Status</th><th></th></tr>' + l.map(function (u) {
        return '<tr data-user="' + esc(u.username) + '"><td><b>' + esc(u.name) + '</b><div class="small muted">' + esc(u.email || '') + '</div></td><td>' + esc(u.loginRole) + '</td><td class="small">' + esc(sitesText(u, ME.id)) + '</td><td><span class="pill ' + (u.active === false ? 's-mut' : 's-ok') + '">' + (u.active === false ? 'Deactivated' : 'Active') + '</span></td>' +
          '<td><button class="small sec" data-act="cjtedit" data-id="' + u.id + '">Edit</button><button class="small sec" data-act="cjtoff" data-id="' + u.id + '">' + (u.active === false ? 'Reactivate' : 'Deactivate') + '</button><button class="small danger" data-act="cjtdel" data-id="' + u.id + '">Remove</button></td></tr>';
      }).join('') + '</table></div>' : '<p class="muted">No team members yet.</p>') + '</div>' +
      (window.REG_LIVE
        ? '<div class="card" id="cjtlive"><h2>Add a manager or supervisor</h2><p>To add a manager or supervisor, email <a href="mailto:admin@chiefjanitorial.com">admin@chiefjanitorial.com</a> or call the office with their name, email, role and the sites they should see. We set up their sign-in and send it to you.</p></div></div>'
        : '<div class="card"><h2>Invite a manager or supervisor</h2>' + form(null) + '</div></div>');
  };
  function mine(id) { var u = user(id); return u && u.team && u.loginOf === ME.id && !u.removed ? u : null; }
  FORMS.cjtsave = function (f, d) {
    if (!isMain()) { toast('Only the account holder can manage the team.'); return; }
    var name = String(d.name || '').trim(), email = String(d.email || '').trim().toLowerCase(), role = ROLES.indexOf(d.role) >= 0 ? d.role : 'Manager';
    var all = siteList(ME.id).map(function (s) { return s.code; }), pick = all.filter(function (c) { return d['site_' + c]; });
    if (name.length < 2) { toast('Enter the name.'); return; }
    if (!pick.length) { toast('Pick at least one site.'); return; }
    var ts = pick.length === all.length ? null : pick, u = d.id ? mine(d.id) : null;
    if (d.id && !u) { toast('Not found.'); return; }
    if (u) { var was = u.loginRole + ' / ' + sitesText(u, ME.id); u.name = name; u.loginRole = role; u.teamSites = ts; audit('Client team member changed', u.name, was + ' → ' + role + ' / ' + sitesText(u, ME.id)); save(); closeModal(); toast('Saved ✓'); render(); return; }
    if (window.REG_LIVE) { toast('Please ask the Chief Janitorial office to add new team members (admin@chiefjanitorial.com).'); return; }   /* live build: no self-serve logins yet (no server function / email) */
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast('Enter a valid email.'); return; }
    if ((DB.users || []).some(function (x) { return (x.email || '').toLowerCase() === email || (x.username || '').toLowerCase() === email; })) { toast('That email already has a login.'); return; }
    var tmp = 'Cj-' + Math.random().toString(36).slice(2, 8);
    var nu = { id: uid('u'), type: 'firm', team: true, loginOf: ME.id, loginRole: role, teamSites: ts, name: name, email: email, username: email, passHash: hashPw(tmp), mustChangePw: true, active: true, approved: true, accountApproved: true, createdAt: new Date().toISOString(), invitedBy: login().name || ME.name, firm: {} };
    nu.inviteToken = uid('inv'); nu.invitedAt = nu.createdAt; nu.invites = 1;
    DB.users.push(nu); logEmail(nu, inviteEmail(nu, tmp, false));
    audit('Client team member invited', ME.name, name + ' <' + email + '> as ' + role + ', ' + sitesText(nu, ME.id));
    window.__cjtNew = { name: name, email: email, tmp: tmp }; save(); render();
  };
  /* ---------- invite email (TEST: never sent – preview + log only) ---------- */
  var SIGNIN = 'https://www.chiefjanitorial.com/shifts-secure/cj/';
  function inviteEmail(u, tmp, resend) {
    var C = window.CJ_COMPANY || {}, client = ME.name, link = SIGNIN + '#/setpassword?invite=' + encodeURIComponent(u.inviteToken || '');
    var subject = (resend ? 'Reminder: ' : '') + client + ' invited you to the Chief Janitorial app';
    var html = '<div class="cjmail" style="font-family:Arial,sans-serif;max-width:560px;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden">' +
      '<div style="background:#426CB4;color:#fff;padding:18px 22px"><div style="font-size:20px;font-weight:700">Chief Janitorial</div><div style="font-size:13px;opacity:.9">Island\u2019s service provider</div></div>' +
      '<div style="height:5px;background:#8AC53F"></div><div style="padding:20px 22px;color:#1f2937;font-size:15px;line-height:1.5">' +
      '<p>Hi ' + esc(u.name) + ',</p><p><b>' + esc(client) + '</b> has invited you to the Chief Janitorial app as a <b>' + esc(u.loginRole) + '</b>' + (u.teamSites && u.teamSites.length ? ' for ' + esc(u.teamSites.join(', ')) : '') + '.</p>' +
      '<p>In the app you can see your cleaning schedule, ask to change a cleaning day, request special cleaning, and tell us about dates when no cleaners should come in.</p>' +
      '<p style="text-align:center;margin:22px 0"><a href="' + esc(link) + '" style="background:#8AC53F;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px;display:inline-block">Set your password and sign in</a></p>' +
      '<p style="font-size:13px;color:#6b7280">The first time you sign in you choose your own password. Your sign-in is <b>' + esc(u.email) + '</b>. This link expires in 7 days – ask ' + esc(client) + ' to resend it if needed.</p>' +
      '<p style="font-size:13px;color:#6b7280">Didn\u2019t expect this? You can ignore this email.</p></div>' +
      '<div style="background:#f6f7f9;padding:12px 22px;font-size:12px;color:#6b7280">' + esc(C.name || 'Chief Janitorial Inc.') + ' · ' + esc(C.address || '') + ' · ' + esc(C.phoneShort || '902-200-4888') + ' · ' + esc(C.email || 'admin@chiefjanitorial.com') + '</div></div>';
    var text = 'Hi ' + u.name + ',\n\n' + client + ' has invited you to the Chief Janitorial app as a ' + u.loginRole + '.\n\nSet your password and sign in: ' + link + '\n\nYour sign-in is ' + u.email + '. The link expires in 7 days.\n\n' + (C.name || 'Chief Janitorial Inc.') + ' · ' + (C.phoneShort || '902-200-4888');
    return { to: u.email, from: 'Chief Janitorial <admin@chiefjanitorial.com>', subject: subject, html: html, text: text, link: link, testTmp: tmp };
  }
  function logEmail(u, m) {
    (DB.emailLog = DB.emailLog || []).unshift({ id: uid('em'), at: new Date().toISOString(), to: m.to, subject: m.subject, kind: 'team-invite', userId: u.id, sent: false, note: 'TEST copy – not sent (preview only)' });
    if (DB.emailLog.length > 200) DB.emailLog.length = 200;
    audit('Team invite email prepared (TEST – not sent)', u.name, m.to + ' · ' + m.subject);
    window.__cjtMail = m;
  }
  window.cjtInviteEmail = inviteEmail;
  ACT.cjtresend = function (el) {
    if (!isMain()) return; var u = mine(el.dataset.id); if (!u || u.active === false) { toast('Reactivate this person first.'); return; }
    if (window.REG_LIVE) { toast('Please ask the Chief Janitorial office to resend the sign-in (admin@chiefjanitorial.com).'); return; }
    var tmp = 'Cj-' + Math.random().toString(36).slice(2, 8); u.passHash = hashPw(tmp); u.mustChangePw = true; u.inviteToken = uid('inv'); u.invitedAt = new Date().toISOString(); u.invites = (u.invites || 1) + 1;
    logEmail(u, inviteEmail(u, tmp, true)); window.__cjtNew = { name: u.name, email: u.email, tmp: tmp, resent: true }; save(); render(); toast('Invite email ready (TEST – shown below, not sent)');
  };
  ACT.cjtmailclose = function () { window.__cjtMail = null; render(); };
  ACT.cjtedit = function (el) { if (!isMain()) return; var u = mine(el.dataset.id); if (!u) return; modal('<h2>Edit ' + esc(u.name) + '</h2>' + form(u)); };
  ACT.cjtoff = function (el) { if (!isMain()) return; var u = mine(el.dataset.id); if (!u) return; u.active = u.active === false; audit('Client team member ' + (u.active ? 'reactivated' : 'deactivated'), u.name, u.loginRole); save(); render(); };
  ACT.cjtdel = function (el) { if (!isMain()) return; var u = mine(el.dataset.id); if (!u) return; if (!confirm('Remove ' + u.name + '? They can no longer sign in.')) return; u.removed = true; u.active = false; u.removedAt = new Date().toISOString(); audit('Client team member removed', u.name, u.loginRole); save(); render(); };
  /* a deactivated / removed team member cannot sign in or keep a session */
  var ogr2 = gateRoute; gateRoute = function (h) { var L = ME && ME.type === 'firm' ? login() : null; if (L && L.team && (L.active === false || L.removed)) { try { audit('Blocked sign-in (team member deactivated)', L.name, ''); } catch (e) {} ME = null; try { sessionStorage.clear(); } catch (e) {} return '#/'; } return ogr2.apply(this, arguments); }; window.gateRoute = gateRoute;

  /* ---------- office: client teams ---------- */
  VIEWS['admin:clientteams'] = function () {
    var firms = (DB.users || []).filter(function (u) { return u.type === 'firm' && !u.loginOf && !u.mergedInto; });
    return '<h1>Client teams</h1><p class="muted small">Managers and supervisors each client has invited. They never see invoices or prices.</p><div class="tw"><table id="cjtoffice"><tr><th>Client</th><th>Team member</th><th>Role</th><th>Sites</th><th>Status</th><th>Invited</th></tr>' +
      firms.map(function (f) { var l = team(f.id); return l.map(function (u) { return '<tr data-user="' + esc(u.username) + '"><td>' + esc(f.name) + '</td><td><b>' + esc(u.name) + '</b><div class="small muted">' + esc(u.email) + '</div></td><td>' + esc(u.loginRole) + '</td><td class="small">' + esc(sitesText(u, f.id)) + '</td><td>' + (u.active === false ? 'Deactivated' : 'Active') + '</td><td class="small">' + esc(fmtStamp(u.createdAt)) + (u.invitedBy ? ' by ' + esc(u.invitedBy) : '') + '</td></tr>'; }).join(''); }).join('') + '</table></div>' +
      (firms.some(function (f) { return team(f.id).length; }) ? '' : '<p class="muted">No client team members yet.</p>');
  };
  if (!NAV.admin.some(function (n) { return n[0] === '#/clientteams'; })) { var k = -1; NAV.admin.forEach(function (n, i) { if (n[0] === '#/calrequests') k = i; }); NAV.admin.splice(k >= 0 ? k + 1 : NAV.admin.length, 0, ['#/clientteams', 'Client teams']); }

  /* ---------- (live build: mock seed removed) ---------- */
  window.cjtSeed = function () { return false; };   /* live build: TEST seed stripped */
  if (typeof load === 'function') { var _ld = load; load = function () { var r = _ld.apply(this, arguments); try { if (cjtSeed()) save(); } catch (e) {} return r; }; }
  if (typeof resetData === 'function') { var _rd = resetData; resetData = function () { var r = _rd.apply(this, arguments); try { if (cjtSeed()) save(); } catch (e) {} return r; }; }
  try { if (typeof DB !== 'undefined' && DB && cjtSeed()) save(); } catch (e) {}
})();
