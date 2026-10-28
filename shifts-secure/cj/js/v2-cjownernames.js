/* v2-cjownernames.js – real site names for the owner login only.
   Live sites keep data.name as the site code and carry data.ownerName (the server strips ownerName for crew).
   When ME.officeRoles includes 'owner', every site label is "CODE · ownerName"
   (e.g. CBS101 · Canadian Blood Services (85 Fitzroy St)). Everyone else sees the code alone.
   A label is never "CBS101 – CBS101" when the stored name equals the code.
   Mock (?store=mock): proposed names from the site-names sheet are ownerName. Nothing here calls Supabase.
   Loaded last. Turn off: remove this file's line in index.html. */
(function () {
  'use strict';
  var HIDDEN = '__cjOwnerName';
  /* proposed_name from the site-names sheet, keyed by site code. Mock only. */
  var MOCK = {
    CAL109: 'Canada Life',
    CAS116: 'CASTL',
    CBS101: 'Canadian Blood Services (85 Fitzroy St)',
    CHB117: 'Chinova Bioworks',
    CIB115: 'CIBC Charlottetown (University Ave)',
    CIB119: 'CIBC Alberton',
    CIB120: 'CIBC Souris',
    CPK107: 'Canada Post (101 Kent St)',
    CPM105: 'Canada Post (200 Maple Hills)',
    CPS106: 'Canada Post (454 Granville St Summerside)',
    GOI113: "Good's Independent #1636",
    KHH112: 'Home Hardware Stratford',
    SDC110: 'Shoppers #101',
    SDS111: 'Shoppers #105 (Summerside)',
    SDT114: 'Shoppers #2029 (9 Kinlock Rd Stratford)',
    SDU118: 'Shoppers #100',
    SLF108: 'SunLife (202 Buchanan Dr)',
    TDQ104: 'TD (192 Queen St)',
    TDS103: 'TD (Summerside)',
    TDU102: 'TD (University Ave)'
  };

  function mockMode() {
    return !!(window.REG_STORE && window.REG_STORE.mode === 'mock');
  }
  function liveMode() {
    return !!(window.REG_STORE && window.REG_STORE.mode === 'supabase');
  }
  function rolesOf(u) {
    u = u || (typeof ME !== 'undefined' ? ME : null);
    if (!u) return [];
    if (u.officeRoles && u.officeRoles.length) return u.officeRoles;
    return u.officeRole ? [u.officeRole] : [];
  }
  function cjOwnerSeesNames(u) {
    u = u || (typeof ME !== 'undefined' ? ME : null);
    return !!(u && u.type === 'admin' && rolesOf(u).indexOf('owner') >= 0);
  }
  function siteOf(siteOrCode) {
    if (siteOrCode && typeof siteOrCode === 'object' && siteOrCode.code) return siteOrCode;
    var code = String(siteOrCode == null ? '' : siteOrCode);
    if (!code || typeof DB === 'undefined' || !DB || !DB.sites) return null;
    return DB.sites.filter(function (s) { return s.code === code; })[0] || null;
  }
  function rawOwnerName(s) {
    if (!s) return '';
    var n = s.ownerName || s[HIDDEN] || '';
    n = String(n).trim();
    if (!n || n === s.code) return '';
    return n;
  }
  /* The one label. Owner: "CODE · ownerName". Everyone else, and a name that equals the code: "CODE". */
  function cjSiteLabel(siteOrCode) {
    var s = siteOf(siteOrCode);
    var code = s ? s.code : String(siteOrCode == null ? '' : siteOrCode);
    if (!s) return code;
    if (cjOwnerSeesNames()) {
      var n = rawOwnerName(s);
      if (n) return code + ' · ' + n;
    }
    return code;
  }
  function cjSiteSub(siteOrCode) {
    if (!cjOwnerSeesNames()) return '';
    return rawOwnerName(siteOf(siteOrCode));
  }
  function cjSiteOpt(s) {
    return [s.code, cjSiteLabel(s)];
  }
  window.cjOwnerSeesNames = cjOwnerSeesNames;
  window.cjSiteLabel = cjSiteLabel;
  window.cjSiteSub = cjSiteSub;
  window.cjSiteOpt = cjSiteOpt;

  /* siteName() in core.js is the shared label. Point it here so every caller picks up the rule. */
  if (typeof siteName === 'function') {
    siteName = function (code) { return cjSiteLabel(code); };
    try { window.siteName = siteName; } catch (e) {}
  }

  function reveal() {
    if (typeof DB === 'undefined' || !DB || !DB.sites) return;
    DB.sites.forEach(function (s) {
      if (!s.ownerName && s[HIDDEN]) s.ownerName = s[HIDDEN];
    });
  }
  function conceal() {
    if (typeof DB === 'undefined' || !DB || !DB.sites) return;
    if (cjOwnerSeesNames()) { reveal(); return; }
    /* Live office saves the whole site row. Leave ownerName in place for an office login so a save cannot wipe it.
       Crew and clients do not save sites; mock saves the whole DB, so hide the field and put it back around save. */
    var office = typeof ME !== 'undefined' && ME && ME.type === 'admin';
    if (liveMode() && office) return;
    DB.sites.forEach(function (s) {
      if (!s.ownerName) return;
      try {
        Object.defineProperty(s, HIDDEN, { value: s.ownerName, writable: true, enumerable: false, configurable: true });
      } catch (e) { s[HIDDEN] = s.ownerName; }
      delete s.ownerName;
    });
  }
  function scrubText(text) {
    text = String(text == null ? '' : text);
    if (typeof DB === 'undefined' || !DB || !DB.sites) return text;
    var pairs = [];
    DB.sites.forEach(function (s) {
      var n = rawOwnerName(s);
      if (n) pairs.push({ code: s.code, name: n });
    });
    pairs.sort(function (a, b) { return b.name.length - a.name.length; });
    pairs.forEach(function (p) {
      text = text.split(p.code + ' · ' + p.name).join(p.code);
      text = text.split(p.code + ' – ' + p.name).join(p.code);
      text = text.split(p.code + ' - ' + p.name).join(p.code);
    });
    return text;
  }
  /* Stored alerts and audit lines are read by admin and crew too. Keep the real name on screen only. */
  if (typeof notify === 'function') {
    var notify0 = notify;
    notify = function (toIds, text, key) { return notify0.call(this, toIds, scrubText(text), key); };
    try { window.notify = notify; } catch (e) {}
  }
  if (typeof audit === 'function') {
    var audit0 = audit;
    audit = function (action, target, detail) { return audit0.call(this, action, scrubText(target), scrubText(detail)); };
    try { window.audit = audit; } catch (e) {}
  }
  if (typeof save === 'function') {
    var save0 = save;
    save = function () {
      var hideAgain = !cjOwnerSeesNames();
      if (hideAgain) reveal();
      try { return save0.apply(this, arguments); }
      finally { if (hideAgain) conceal(); }
    };
    try { window.save = save; } catch (e) {}
  }

  function tagOwner() {
    if (!mockMode() || typeof DB === 'undefined' || !DB || !DB.users) return;
    var off = DB.users.filter(function (u) { return u.username === 'office'; })[0];
    if (!off || (off.officeRoles && off.officeRoles.length)) return;
    off.officeRole = 'owner';
    off.officeRoles = ['owner'];
  }
  function seedMock() {
    if (!mockMode() || typeof DB === 'undefined' || !DB || !DB.sites) return;
    tagOwner();
    var firm = (DB.users || []).filter(function (u) { return u.username === 'firmA'; })[0];
    var emp = (DB.users || []).filter(function (u) { return u.username === 'employee1'; })[0];
    Object.keys(MOCK).forEach(function (code) {
      var s = DB.sites.filter(function (x) { return x.code === code; })[0];
      if (!s) {
        s = { code: code, name: code, ownerName: MOCK[code], firmId: firm ? firm.id : null, companyId: 'cj', active: true };
        if (code === 'CBS101' && emp) s.crew = [emp.id];
        if (typeof tagCompany === 'function') tagCompany(s);
        DB.sites.push(s);
      }
      if (!s.ownerName && !s[HIDDEN]) s.ownerName = MOCK[code];
      if (s.name !== code) s.name = code;
      if (!s.companyId) s.companyId = 'cj';
      if (code === 'CBS101' && emp && (!(s.crew) || s.crew.indexOf(emp.id) < 0)) s.crew = (s.crew || []).concat([emp.id]);
    });
  }
  function prepare() {
    try { seedMock(); conceal(); } catch (e) { try { console.warn('[cjownernames]', e); } catch (z) {} }
  }
  if (typeof render === 'function') {
    var render0 = render;
    render = function () { prepare(); return render0.apply(this, arguments); };
    try { window.render = render; } catch (e) {}
  }
  /* ui.js listens for hashchange with the render it had at load time, so a route change
     would skip the wrapper above. Prepare first, in the capture phase, before that paint. */
  window.addEventListener('hashchange', function () { prepare(); }, true);
  try { prepare(); } catch (e) {}
})();
