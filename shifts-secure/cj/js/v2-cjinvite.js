/* v2-cjinvite.js – site sign-up links with a long code and a printable QR (CJ only).
   The owner, admin or operations makes one link per site on Site assignments. The QR opens this app
   with ?join=CODE (or #/signup/employee?join=CODE). A cleaner lands on sign-up with that site filled in.
   The code is 26 characters from a 32-symbol alphabet (~130 bits). It is not the short site code
   (3 letters + 101–199 here, or UnScramble's 3 letters + 201–299). A guessed CJC101 / ACS238 does nothing.
   Signing up does not tick the person active. People still has to tick Active cleaner (v2-cjactive.js)
   before that cleaner can use the app. The account-approval wait is unchanged.
   Mock (?store=mock): the link is kept in this browser (DB.siteInvites) with the rest of the fake data.
   Live: this file does not call the database. Draft SQL is migrations/cj-site-invite-001.sql (do not run).
   No outside calls and no secrets. Turn off: remove vendor/qrcode.js, css/cjinvite.css and this script. */
(function () {
  'use strict';
  if (typeof VIEWS === 'undefined' || typeof ACT === 'undefined' || typeof DB === 'undefined') return;

  var ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; /* 32 symbols, no 0/1/I/O. 256 % 32 === 0, so a byte maps evenly. */
  var LEN = 26;
  var Q = window.CJINVITE = { token: '', site: '', bad: false, routed: false };

  function E(s) {
    return typeof esc === 'function' ? esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function mockMode() { return !!(window.REG_STORE && window.REG_STORE.mode === 'mock'); }
  function liveMode() { return !!(window.REG_LIVE || (window.REG_STORE && window.REG_STORE.mode === 'supabase')); }
  function office() { return !!(typeof ME !== 'undefined' && ME && ME.type === 'admin'); }
  function roles() {
    if (!ME) return [];
    if (ME.officeRoles && ME.officeRoles.length) return ME.officeRoles;
    return ME.officeRole ? [ME.officeRole] : [];
  }
  function canMake() {
    if (!office() || liveMode()) return false;
    var r = roles();
    return !r.length || r.some(function (x) { return x === 'owner' || x === 'admin' || x === 'ops'; });
  }
  function siteOf(code) {
    return (DB.sites || []).filter(function (s) { return s.code === code; })[0] || null;
  }
  function labelOf(s) {
    if (!s) return '';
    if (typeof cjSiteLabel === 'function') return cjSiteLabel(s);
    return s.code;
  }
  function invites() {
    if (!Array.isArray(DB.siteInvites)) DB.siteInvites = [];
    return DB.siteInvites;
  }
  function normalize(raw) {
    return String(raw || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 64);
  }
  /* Short site codes are refused even if someone puts one in ?join=. */
  function formatOk(code) {
    if (!code || code.length < 20 || code.length > 40) return false;
    if (/^[A-Z]{3}\d{3}$/.test(code)) return false;
    for (var i = 0; i < code.length; i++) if (ALPH.indexOf(code.charAt(i)) < 0) return false;
    return true;
  }
  function group(code) {
    return String(code || '').replace(/(.{4})/g, '$1-').replace(/-$/, '');
  }
  function grab(q) {
    var m = /(?:^|[?&])join=([^&#]*)/i.exec(String(q || ''));
    if (!m) return '';
    var v = m[1].slice(0, 200);
    try { v = decodeURIComponent(v.replace(/\+/g, ' ')); } catch (e) { return ''; }
    return v.slice(0, 80);
  }
  function rawJoin() {
    var h = String(location.hash || ''), i = h.indexOf('?');
    return grab(location.search) || (i >= 0 ? grab(h.slice(i + 1)) : '');
  }
  function findToken(token) {
    var n = normalize(token);
    if (!formatOk(n)) return null;
    var hit = invites().filter(function (row) { return row && row.active && normalize(row.token) === n; })[0];
    if (!hit || !siteOf(hit.siteCode)) return null;
    return hit;
  }
  function activeFor(code) {
    return invites().filter(function (row) { return row && row.active && row.siteCode === code && formatOk(normalize(row.token)); })[0] || null;
  }
  function linkFor(token) {
    if (liveMode()) return 'https://www.chiefjanitorial.com/shifts-secure/cj/?join=' + encodeURIComponent(token);
    var path = location.pathname || '/shifts-secure/cj/';
    var q = (mockMode() ? 'store=mock&' : '') + 'join=' + encodeURIComponent(token);
    return location.origin + path + '?' + q;
  }
  /* Filled squares (not a thin stroke) so a printed code still scans. */
  function qrSvg(url) {
    var lib = window.CJQR;
    if (!lib || typeof lib.create !== 'function') return '';
    var qr, size, data, margin = 2, dim, r, c, cells = '';
    try { qr = lib.create(url, { errorCorrectionLevel: 'M' }); } catch (e) { return ''; }
    if (!qr || !qr.modules) return '';
    size = qr.modules.size; data = qr.modules.data; dim = size + margin * 2;
    for (r = 0; r < size; r++) for (c = 0; c < size; c++) {
      if (data[r * size + c]) cells += '<rect x="' + (c + margin) + '" y="' + (r + margin) + '" width="1" height="1"/>';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + dim + ' ' + dim + '" width="240" height="240" shape-rendering="crispEdges"><rect width="' + dim + '" height="' + dim + '" fill="#ffffff"/><g fill="#191919">' + cells + '</g></svg>';
  }
  function makeToken() {
    var c = window.crypto || window.msCrypto;
    if (!c || !c.getRandomValues) return '';
    var buf = new Uint8Array(LEN), s = '', i;
    c.getRandomValues(buf);
    for (i = 0; i < LEN; i++) s += ALPH.charAt(buf[i] % 32);
    return formatOk(s) ? s : '';
  }

  /* ---------- signed-out: read ?join= once, open the cleaner sign-up, remember the site ---------- */
  function capture() {
    var raw = rawJoin();
    if (!raw) return;
    var n = normalize(raw);
    var hit = findToken(n);
    if (!hit) { Q.token = ''; Q.site = ''; Q.bad = !!n; return; }
    Q.bad = false; Q.token = n; Q.site = hit.siteCode;
  }
  function routeJoin() {
    capture();
    if (Q.routed) return;
    if (!Q.token && !Q.bad) return;
    Q.routed = true;
    if (typeof ME !== 'undefined' && ME) return;
    var h = String(location.hash || '');
    if (/[?&]invite=/.test(h)) return; /* a client invite link: leave it alone */
    if (/^#\/signup\/(employee|worker)/.test(h)) return;
    var join = Q.token ? ('?join=' + encodeURIComponent(Q.token)) : (Q.bad ? ('?join=' + encodeURIComponent(normalize(rawJoin()))) : '');
    location.hash = '#/signup/employee' + join;
  }
  function withJoin(html) {
    var t = Q.token || (formatOk(normalize(rawJoin())) ? normalize(rawJoin()) : '');
    if (!t) return html;
    return String(html).replace(/href="#\/signup(\/[^"?#]*)?"/g, function (_m, path) {
      return 'href="#/signup' + (path || '') + '?join=' + encodeURIComponent(t) + '"';
    });
  }
  function siteBlock(kind) {
    capture();
    if (Q.token && Q.site) {
      var s = siteOf(Q.site), shown = s ? s.code : Q.site;
      var other = kind === 'worker'
        ? '<p class="cji-note">Paid by Chief Janitorial, not a subcontractor? <a href="#/signup/employee?join=' + E(encodeURIComponent(Q.token)) + '">Sign up as an employee</a>. This site stays filled in.</p>'
        : '<p class="cji-note">Work for a subcontractor, not Chief Janitorial? <a href="#/signup/worker?join=' + E(encodeURIComponent(Q.token)) + '">Sign up as a subcontractor worker</a>. This site stays filled in.</p>';
      return '<div class="cji-site" id="cjisitebox"><label class="cji-lbl" for="cjisitecode">Your site</label>' +
        '<input id="cjisitecode" name="siteShown" readonly value="' + E(shown) + '" aria-readonly="true" aria-describedby="cjisitehint" autocomplete="off">' +
        '<input type="hidden" name="join" value="' + E(Q.token) + '">' +
        '<div class="hint ok" id="cjisitehint">Filled in from your sign-up link: <b>' + E(shown) + '</b>. After you create the account, the office still has to tick you as an active cleaner in People before you can sign in.</div>' +
        other + '</div>';
    }
    if (Q.bad || (rawJoin() && !formatOk(normalize(rawJoin())))) {
      return '<div class="cji-site cji-bad" id="cjisitebox" role="alert"><b>This sign-up link is not valid.</b> ' +
        '<p class="cji-note" id="cjisitehint">Chief Janitorial sign-up links use a long code from the office QR. A short site code is not a sign-up link. Ask the office for a new QR, or open Help.</p></div>';
    }
    return '';
  }
  function patchForm(html, kind) {
    html = String(html);
    if ((kind === 'employee' || kind === 'worker') && html.indexOf('id="cjisitebox"') < 0) {
      html = html.replace('<form data-form="signup">', '<form data-form="signup">' + siteBlock(kind));
    }
    return withJoin(html);
  }
  if (typeof VIEWS.signupForm === 'function') {
    var osf = VIEWS.signupForm;
    VIEWS.signupForm = function (h) {
      var kind = String(h || location.hash || '').split('?')[0].split('/')[2] || '';
      return patchForm(osf.apply(this, arguments), kind);
    };
  }
  if (typeof VIEWS.signup === 'function') {
    var osu = VIEWS.signup;
    VIEWS.signup = function () { return withJoin(osu.apply(this, arguments)); };
  }

  /* A new cleaner is never added to the active list. The link only records the site and the crew place. */
  function stamp(u, d) {
    if (!u || (u.type !== 'employee' && u.type !== 'worker')) return;
    var token = normalize(d && d.join);
    var hit = findToken(token);
    if (!hit) return;
    var code = hit.siteCode, s = siteOf(code);
    if (!s) return;
    u.signupSite = code;
    u.signupVia = 'site-link';
    s.crew = Array.isArray(s.crew) ? s.crew : [];
    if (s.crew.indexOf(u.id) < 0) s.crew.push(u.id);
    if (DB.settings && Array.isArray(DB.settings.activeCleaners)) {
      DB.settings.activeCleaners = DB.settings.activeCleaners.filter(function (id) { return String(id) !== String(u.id); });
    }
    if (typeof audit === 'function') audit('Cleaner signed up from site link', u.name, code + ' · link ending ' + token.slice(-4) + ' · not active until People is ticked');
    if (typeof save === 'function') save();
  }
  if (typeof FORMS !== 'undefined' && typeof FORMS.signup === 'function') {
    var osign = FORMS.signup;
    FORMS.signup = function (f, d) {
      var n = DB.users.length, ret = osign.apply(this, arguments);
      try {
        if (DB.users.length > n) {
          stamp(DB.users[DB.users.length - 1], d);
          if (typeof render === 'function') render();
        }
      } catch (e) {}
      return ret;
    };
  }

  /* ---------- office: one link per site, QR, print ---------- */
  window.cjInviteSlot = function (s) {
    if (!s || !s.code || s.code === 'TEST-PRACTICE') return '';
    return '<div class="cji-slot"><button type="button" class="small sec" data-act="cjiopen" data-site="' + E(s.code) + '">Sign-up link &amp; QR</button></div>';
  };
  function sheet(code) {
    var s = siteOf(code);
    if (!s) return '<p>That site is not on this list.</p>';
    var row = activeFor(code);
    var liveNote = liveMode() ? '<div class="alert warn small">This screen is on the live sign-in. Sign-up links are not saved to the database. The draft migration has not been applied. Try this on the mock store (<code>?store=mock</code>).</div>' : '';
    var who = canMake() ? '' : '<p class="small muted">Only the owner, admin or operations can make or turn off a link. You can still print one that is already made.</p>';
    var body;
    if (!row) {
      body = '<p class="cji-note">No sign-up link yet. A new link gets a long random code. The short site code is not the link.</p>' +
        (canMake() ? '<p><button type="button" data-act="cjinew" data-site="' + E(code) + '">Make sign-up link</button></p>' : '<p class="small muted">Ask the owner to make one.</p>');
    } else {
      var url = linkFor(row.token), svg = qrSvg(url);
      body = '<div class="cji-qr" id="cjiqr" role="img" aria-label="QR code for the ' + E(s.code) + ' sign-up link">' +
        (svg || '<p class="small">QR code could not be drawn.</p>') + '</div>' +
        '<p class="cji-code" id="cjicode">' + E(group(row.token)) + '</p>' +
        '<label class="small" for="cjilink">Link</label><input class="cji-link" id="cjilink" readonly value="' + E(url) + '">' +
        '<div class="cji-acts"><button type="button" data-act="cjicopy" data-site="' + E(code) + '">Copy link</button>' +
        '<button type="button" class="sec" data-act="cjiprint" data-site="' + E(code) + '">Print</button>' +
        (canMake() ? '<button type="button" class="sec" data-act="cjinew" data-site="' + E(code) + '" data-replace="1">Make a new link</button><button type="button" class="sec" data-act="cjirevoke" data-site="' + E(code) + '">Turn off</button>' : '') +
        '</div>';
    }
    return '<div class="cji-sheet" id="cjisheet"><img class="cji-logo" src="assets/cj_Logo.png" alt="Chief Janitorial"><h2>Sign-up link</h2>' +
      '<p><b>' + E(labelOf(s)) + '</b></p>' +
      '<p class="cji-note">Print this and put it at the site. A cleaner who scans it opens sign-up with this site filled in. The office still ticks them active in People before they can sign in.</p>' +
      liveNote + who + body + '</div>';
  }
  function openSheet(code) {
    if (typeof modal === 'function') modal(sheet(code));
  }
  ACT.cjiopen = function (el) { openSheet(el && el.dataset && el.dataset.site); };
  ACT.cjinew = function (el) {
    if (!canMake()) { if (typeof toast === 'function') toast('Only the owner, admin or operations can make a sign-up link, and only on the mock store.'); return; }
    var code = el && el.dataset && el.dataset.site, s = siteOf(code);
    if (!s) return;
    var replace = el.dataset.replace === '1';
    if (replace && typeof confirmBox === 'function' && !confirmBox('cjinew' + code, 'Make a new link for ' + code + '? The QR you already printed will stop working.')) return;
    var token = makeToken();
    if (!token) { if (typeof toast === 'function') toast('Could not make a code in this browser.'); return; }
    invites().forEach(function (row) { if (row && row.siteCode === code && row.active) { row.active = false; row.revokedAt = new Date().toISOString(); } });
    invites().unshift({ id: typeof uid === 'function' ? uid('inv') : ('inv_' + token.slice(0, 6)), siteCode: code, token: token, active: true, createdAt: new Date().toISOString(), createdBy: ME && ME.name || '' });
    if (typeof audit === 'function') audit(replace ? 'Replaced site sign-up link' : 'Made site sign-up link', code, 'link ending ' + token.slice(-4));
    if (typeof save === 'function') save();
    if (typeof toast === 'function') toast(replace ? 'New link made. The old QR no longer works.' : 'Sign-up link made.');
    openSheet(code);
  };
  ACT.cjirevoke = function (el) {
    if (!canMake()) { if (typeof toast === 'function') toast('Only the owner, admin or operations can turn a link off.'); return; }
    var code = el && el.dataset && el.dataset.site;
    if (typeof confirmBox === 'function' && !confirmBox('cjioff' + code, 'Turn off the sign-up link for ' + code + '? The printed QR will stop working.')) return;
    var n = 0;
    invites().forEach(function (row) { if (row && row.siteCode === code && row.active) { row.active = false; row.revokedAt = new Date().toISOString(); n++; } });
    if (typeof audit === 'function') audit('Turned off site sign-up link', code, n ? 'printed QR stopped' : 'no active link');
    if (typeof save === 'function') save();
    if (typeof toast === 'function') toast('Sign-up link turned off.');
    openSheet(code);
  };
  ACT.cjicopy = function () {
    var input = document.getElementById('cjilink'), text = input ? input.value : '';
    if (!text) return;
    function ok() { if (typeof toast === 'function') toast('Link copied.'); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok, function () { if (input) { input.focus(); input.select(); } ok(); });
    } else { if (input) { input.focus(); input.select(); } ok(); }
  };
  function printHtml(code) {
    var s = siteOf(code), row = activeFor(code);
    if (!s || !row) return '';
    var url = linkFor(row.token), svg = qrSvg(url);
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sign-up QR ' + E(s.code) + '</title>' +
      '<style>body{font:16px/1.4 "DM Sans",system-ui,sans-serif;color:#191919;margin:24px;max-width:420px}h1{font-size:22px;margin:8px 0}img.logo{height:48px}.qr{margin:12px 0}.qr svg{width:280px;height:280px}p{margin:8px 0}.muted{color:#555;font-size:13px;word-break:break-all}@media print{body{margin:12mm}}</style></head><body>' +
      '<img class="logo" src="assets/cj_Logo.png" alt="Chief Janitorial"><h1>Join this site</h1><p><b>' + E(labelOf(s)) + '</b></p>' +
      '<div class="qr">' + svg + '</div><p>Scan this code to sign up. The site is filled in for you. The office ticks you active before you can sign in.</p>' +
      '<p class="muted">' + E(url) + '</p></body></html>';
  }
  ACT.cjiprint = function (el) {
    var code = el && el.dataset && el.dataset.site, html = printHtml(code);
    if (!html) { if (typeof toast === 'function') toast('Make a sign-up link first.'); return; }
    var w = window.open('', '_blank');
    if (!w) { if (typeof toast === 'function') toast('Pop-up blocked. Allow pop-ups to print the QR.'); return; }
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(function () { try { w.print(); } catch (e) {} }, 300);
  };

  Q.normalize = normalize;
  Q.formatOk = formatOk;
  Q.findToken = findToken;
  Q.linkFor = linkFor;

  function boot() { try { routeJoin(); } catch (e) {} }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
