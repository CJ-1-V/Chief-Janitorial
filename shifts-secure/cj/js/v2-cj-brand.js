/* v2-cj-brand.js – Chief Janitorial product overlay (TEST only).
   companyId === 'cj': cleaning sites / offices / cleaners / fixed invoices.
   NO farms, NO farm labour / crew-order flows. Documented in THEME.md. */
(function () {
  'use strict';
  var C = window.REG_STORE || {};
  if (C.companyId !== 'cj') return;

  /* ---------- contact / FROM ---------- */
  try { ADMIN_EMAIL = 'admin@chiefjanitorial.com'; } catch (e) {}
  window.CJ_BRAND = {
    name: 'Chief Janitorial',
    email: 'admin@chiefjanitorial.com',
    phone: '902-200-4888',
    site: 'https://www.chiefjanitorial.com/',
    tagline: 'Cleaners, sites & invoices',
    hidden: []
  };

  function stripNav(nav, hashes) {
    if (!nav || !nav.length) return;
    for (var i = nav.length - 1; i >= 0; i--) {
      if (hashes.indexOf(nav[i][0]) >= 0) nav.splice(i, 1);
    }
  }
  function renameNav(nav, hash, label) {
    if (!nav) return;
    nav.forEach(function (n) { if (n[0] === hash) n[1] = label; });
  }

  /* ---------- hide farm staffing / crew-order UX ---------- */
  function hideCrewOrders() {
    stripNav(NAV.firm, ['#/orders']);
    stripNav(NAV.admin, ['#/creworders']);
    window.CJ_BRAND.hidden.push(
      'Crew orders (client “Order a crew” + office #/creworders queue)',
      'Crew-order late-change cut-off card in Settings',
      'Crew-order flags on office overview'
    );
    /* Redirect if somehow navigated */
    var stub = function () {
      return '<h1>Not used for Chief Janitorial</h1><p class="muted">Crew ordering is not part of Chief Janitorial. CJ covers cleaning sites, cleaners, timesheets and fixed cleaning invoices only.</p><p><a href="#/home">← Back</a></p>';
    };
    VIEWS['firm:orders'] = stub;
    VIEWS['admin:creworders'] = stub;
    /* Strip order card from client home */
    if (typeof firmPage === 'function') {
      var ofp = firmPage;
      firmPage = function (firm) {
        var x = ofp(firm);
        return x.replace(/<div class="card" id="ordercard">[\s\S]*?<\/div>/, '');
      };
    }
    /* Don’t surface crew-order alerts */
    if (typeof adminFlags === 'function') {
      var of = adminFlags;
      adminFlags = function () {
        return of().filter(function (f) {
          return !/crew order/i.test(String(f.t || '') + String(f.h || ''));
        });
      };
    }
    /* Hide settings cut-off card after render */
    if (typeof VIEWS['admin:settings'] === 'function') {
      var os = VIEWS['admin:settings'];
      VIEWS['admin:settings'] = function () {
        return os().replace(/<div class="card" id="ordercutoff">[\s\S]*?<\/div>/, '');
      };
    }
    /* Declutter menu groups: drop creworders from Daily work list */
    if (typeof MENU_GROUPS !== 'undefined' && MENU_GROUPS) {
      MENU_GROUPS.forEach(function (g) {
        if (!g[1]) return;
        g[1] = g[1].filter(function (h) { return h !== '#/creworders'; });
      });
    }
  }

  /* ---------- cleaning-only client industries (no Farm) ---------- */
  function scopeCleaningOnly() {
    window.CJ_BRAND.hidden.push(
      'Farm industry / farm roles (grader, bin piler, packer, field labour)',
      'Farm-default signup & “Farms first” client list',
      'Farm safety orientation quiz bank (farm-only)'
    );
    try {
      DEFAULT_INDUSTRIES.length = 0;
      ['Cleaning', 'Office', 'Other'].forEach(function (t) { DEFAULT_INDUSTRIES.push(t); });
    } catch (e) {}
    if (typeof clientTypes === 'function') {
      window.clientTypes = function () {
        var l = ((typeof DB !== 'undefined' && DB && DB.settings && DB.settings.clientTypes) || ['Cleaning', 'Office', 'Other']).slice();
        /* Never allow Farm in CJ */
        l = l.filter(function (t) { return !/^farm$/i.test(t); });
        if (l.indexOf('Cleaning') < 0) l.unshift('Cleaning');
        return l;
      };
    }
    if (typeof clientTypeOf === 'function') {
      var oto = clientTypeOf;
      window.clientTypeOf = function (f) {
        var t = oto(f);
        if (!t || /^farm$/i.test(t)) return 'Cleaning';
        return t;
      };
    }
    /* Wording: never say farm */
    window.isFarm = function () { return false; };
    window.clientWord = function (html) {
      return String(html || '')
        .replace(/farm or other client/gi, 'client')
        .replace(/farm or client/gi, 'client')
        .replace(/\bfarms\b/gi, 'clients')
        .replace(/\bfarm\b/gi, 'client')
        .replace(/\bFarm\b/g, 'Client')
        .replace(/\bFarms\b/g, 'Clients');
    };
    /* Job titles / roles for CJ cleaning */
    try {
      JOB_TITLES.length = 0;
      ['Cleaner', 'Lead cleaner', 'Supervisor', 'Site lead'].forEach(function (t) { JOB_TITLES.push(t); });
    } catch (e) {}
    if (typeof ROLE_INDUSTRY === 'object') {
      ROLE_INDUSTRY.Cleaning = ROLE_INDUSTRY.Cleaning || ['cleaner'];
      ROLE_INDUSTRY.Office = ROLE_INDUSTRY.Office || ['cleaner'];
      delete ROLE_INDUSTRY.Farm;
    }
    if (typeof RATE_INDUSTRY === 'object') {
      RATE_INDUSTRY.Cleaning = ['cleaner'];
      RATE_INDUSTRY.Office = ['cleaner'];
      delete RATE_INDUSTRY.Farm;
    }
    /* Rate role list: cleaner first; drop farm-only labels from UI when possible */
    if (typeof FARM_RATE_ROLES !== 'undefined' && FARM_RATE_ROLES && FARM_RATE_ROLES.length) {
      var keep = FARM_RATE_ROLES.filter(function (r) { return r[0] === 'cleaner'; });
      if (keep.length) {
        FARM_RATE_ROLES.length = 0;
        keep.forEach(function (r) { FARM_RATE_ROLES.push(r); });
        FARM_RATE_ROLES.push(['labour', 'General cleaning labour']);
      }
    }
  }

  /* ---------- rename farm-oriented menus & types ---------- */
  function renameChrome() {
    renameNav(NAV.admin, '#/farmchanges', 'Hours changes');
    renameNav(NAV.admin, '#/firms', 'Clients & sites');
    renameNav(NAV.firm, '#/home', 'Sites, hours & invoices');
    try { TYPES.firm = 'Client (office / site)'; } catch (e) {}
    try { TYPES.admin = 'Chief Janitorial Office (Admin)'; } catch (e) {}
    try { TYPES.employee = 'Employee (cleaner)'; } catch (e) {}
    try { TYPES.worker = 'Subcontractor worker / cleaner'; } catch (e) {}
    renameNav(NAV.admin, '#/farmbilling', 'Site billing by day');
    if (typeof VIEWS['admin:shifts'] === 'function') {
      var osh = VIEWS['admin:shifts'];
      VIEWS['admin:shifts'] = function () {
        return osh()
          .replace(/Field work/g, 'Site clean')
          .replace(/general labour/gi, 'cleaning')
          .replace(/>General</g, '>Cleaner<')
          .replace(/Forklift/g, 'Equipment')
          .replace(/Machinery/g, 'Floor machine')
          .replace(/Site orientation required/g, 'Site orientation / PPE brief required');
      };
    }

    /* Empty-state + page title for site billing (avoid “No sites with sites yet” from farm→site scrub) */
    if (typeof VIEWS['admin:farmbilling'] === 'function') {
      var ofb = VIEWS['admin:farmbilling'];
      VIEWS['admin:farmbilling'] = function () {
        return ofb()
          .replace(/<h1>Farm billing by day<\/h1>/g, '<h1>Site billing by day</h1>')
          .replace(/No farms with sites yet\./g, 'No clients with sites yet.')
          .replace(/No sites with sites yet\./g, 'No clients with sites yet.')
          .replace(/at each farm/g, 'at each site')
          .replace(/one farm on one day/g, 'one site on one day')
          .replace(/The farm sees/g, 'The client sees');
      };
    }
    if (typeof VIEWS['admin:pastinv'] === 'function' || typeof pastInvForm === 'function') { /* past invoices label patched below */ }
    /* Past invoices: Farm or client → Client / site */
    if (typeof VIEWS['admin:clientsmoney'] === 'function') {
      var ocm = VIEWS['admin:clientsmoney'];
      VIEWS['admin:clientsmoney'] = function () {
        return String(ocm()).replace(/Farm or client \(name and site codes\)/g, 'Client / site (name and site codes)');
      };
    }
    /* Subcontractor invoice placeholders */
    if (typeof VIEWS['sub:invoice'] === 'function') {
      var osi = VIEWS['sub:invoice'];
      VIEWS['sub:invoice'] = function () {
        return String(osi())
          .replace(/USDC-\[client\]-###/g, 'CJ-[site]-###')
          .replace(/Farm\(s\)\/client\(s\) covered/g, 'Client / site covered')
          .replace(/e\.g\. Test Farm A/g, "e.g. Good's / Kinlock");
      };
    }
    if (typeof VIEWS['sub:invoices'] === 'function') {
      var osiv = VIEWS['sub:invoices'];
      VIEWS['sub:invoices'] = function () {
        return String(osiv()).replace(/Farm\(s\)\/client\(s\)/g, 'Client / site');
      };
    }
    if (typeof adminFlags === 'function') {
      var of2 = adminFlags;
      adminFlags = function () {
        return of2().map(function (f) {
          var t = String(f.t || '').replace(/Farm changes/g, 'Hours changes').replace(/Farms?/g, 'Clients');
          var h = String(f.h || '').replace(/farms?/gi, 'clients').replace(/Farm changes/g, 'Hours changes');
          return { t: t, c: f.c, h: h };
        });
      };
    }
    /* Office farms page title */
    if (typeof VIEWS['admin:firms'] === 'function') {
      var ofi = VIEWS['admin:firms'];
      VIEWS['admin:firms'] = function () {
        return ofi()
          .replace(/<h1>Farms & other clients<\/h1>/g, '<h1>Clients & sites</h1>')
          .replace(/<h1>Client firms \(farms \/ businesses\)<\/h1>/g, '<h1>Clients & sites</h1>')
          .replace(/Farms first\./g, 'Cleaning clients.')
          .replace(/Industry per client<\/h3><p class="small muted">Farms first\./g, 'Industry per client</h3><p class="small muted">Cleaning / office sites.')
          .replace(/id="farmrates"/g, 'id="farmrates" data-cj="client-rates"')
          .replace(/>Farm</g, '>Cleaning<');
      };
    }
    if (typeof VIEWS['admin:farmchanges'] === 'function') {
      var ofc = VIEWS['admin:farmchanges'];
      VIEWS['admin:farmchanges'] = function () {
        return ofc()
          .replace(/<h1>Farm changes<\/h1>/g, '<h1>Hours changes</h1>')
          .replace(/by farms and other clients/g, 'by clients')
          .replace(/by client firms/g, 'by clients')
          .replace(/the farm sees/g, 'the client sees')
          .replace(/Farm \/ who/g, 'Client / who')
          .replace(/\(farm sees/g, '(client sees')
          .replace(/Reply note to the farm/g, 'Reply note to the client')
          .replace(/Farm asked for/g, 'Client asked for')
          .replace(/Farm reason/g, 'Client reason')
          .replace(/What the farm sees/g, 'What the client sees')
          .replace(/proposed by farms/g, 'proposed by clients');
      };
    }
    /* Client home / firm page farm strings */
    if (typeof firmPage === 'function') {
      var ofp2 = firmPage;
      firmPage = function (firm) {
        return clientWord(ofp2(firm), firm)
          .replace(/at this farm/g, 'at this site')
          .replace(/at your farm/g, 'at your site')
          .replace(/Workers, hours & billing/g, 'Sites, hours & invoices');
      };
    }
    /* Signup: firm = cleaning client, not farm */
    if (typeof VIEWS.signup === 'function') {
      var osu = VIEWS.signup;
      VIEWS.signup = function () {
        var x = osu()
          .replace(/Farm or other client/g, 'Client (office / site)')
          .replace(/Farms \(most of our clients\)[\s\S]*?supply workers\./g,
            'Office managers and site contacts for Chief Janitorial cleaning services. The office sets up your site and fixed cleaning invoices.')
          .replace(/that want (?:UnScramble|Chief Janitorial) to supply workers\.[\s\S]*?Rate Schedule\./g,
            'for Chief Janitorial cleaning at your office or site.')
          .replace(/(?:UnScramble|Chief Janitorial) employs and pays you directly\./g, 'Chief Janitorial employs and pays you directly.')
          .replace(/Employee of UnScramble/g, 'Employee of Chief Janitorial')
          .replace(/You want (?:UnScramble|Chief Janitorial) to supply workers\./g, 'You need cleaning at your office or site.')
          .replace(/(The office sets up your site and fixed cleaning invoices\.) The office reviews your request and sets your rates; then you sign the agreement and Rate Schedule\./g, '$1');
        /* Hint: cleaners choose Employee – put a tip above the choices */
        if (x.indexOf('data-cj-signup-hint') < 0) {
          x = x.replace('<p>Which describes you?</p>',
            '<p>Which describes you?</p><p class="small muted" data-cj-signup-hint><b>Cleaners:</b> choose <b>Employee of Chief Janitorial</b> (not Client). Client is only for the office/site that receives cleaning.</p>');
        }
        return x;
      };
    }
    if (typeof VIEWS.signupForm === 'function') {
      var osf = VIEWS.signupForm;
      VIEWS.signupForm = function (h) {
        var x = osf(h);
        x = x.replace(/Sign up: Farm worker/g, 'Sign up: Cleaner / worker')
          .replace(/Sign up: Farm or other client/g, 'Sign up: Client (office / site)')
          .replace(/Farm \(or other client\) legal name/g, 'Client / business legal name')
          .replace(/Farm \/ business legal name/g, 'Client / business legal name')
          .replace(/Farm or work site name \/ location/g, 'Office or site name / location')
          .replace(/Farm location \/ site name/g, 'Office or site name')
          .replace(/Industry \(Farm is the default\)/g, 'Industry')
          .replace(/Industry \(Cleaning is the default\)/g, 'Industry')
          .replace(/a farm word with a year/g, 'a simple pattern with a year');
        /* Start industry with none selected (Student Bot: don’t pre-select Client/Cleaning) */
        x = x.replace(/<select name="clientType"[^>]*>/, '<select name="clientType" required><option value="" selected disabled>– choose industry –</option>');
        return x;
      };
    }
    /* Notify helper labels */
    if (typeof notify === 'function') {
      var on = notify;
      /* leave notify; only rewrite admin toLabel via core if needed */
    }
  }

  /* ---------- welcome / email FROM strings still saying UnScramble ---------- */
  function patchEmails() {
    /* v2-pwemail / v2-addperson bake UnScramble at call time via ADMIN_EMAIL + literals.
       Wrap string builders if present; also patch afterRender toast paths via replace on known globals. */
    function brandText(s) {
      return String(s || '')
        .replace(/UnScramble office/g, 'Chief Janitorial office')
        .replace(/UnScramble – The HR Company Inc\./g, 'Chief Janitorial Inc.')
        .replace(/UnScramble The HR Company Inc\./g, 'Chief Janitorial Inc.')
        .replace(/admin@unscramble\.ca/g, 'admin@chiefjanitorial.com')
        .replace(/UnScramble/g, 'Chief Janitorial');
    }
    /* Hook common form that builds welcome body if exposed */
    if (typeof window !== 'undefined') {
      window.CJ_brandText = brandText;
    }
  }

  /* ---------- sitecode: site/client code, not farm; CJ range 101–199 ---------- */
  function patchSitecode() {
    if (!window.SITECODE) return;
    var SC = window.SITECODE;
    var LO = 101, HI = 199;
    if (typeof SC.fmtProblem === 'function') {
      SC.fmtProblem = function (c) {
        if (!c) return 'Enter the site code.';
        var m = /^([A-Z]{3})(\d{3})$/.exec(c);
        if (!m) return 'A site code is 3 letters + its site number, like CJC101 (Chief Janitorial numbers ' + LO + '–' + HI + ').';
        var n = +m[2];
        if (n < LO || n > HI) return 'Chief Janitorial site numbers are ' + LO + '–' + HI + '. ' + c + ' has number ' + n + '.';
        if (m[1] === 'UNK') return 'UNK is reserved. Use the site\'s own 3 letters.';
        return '';
      };
    }
    window.CJ_BRAND.hidden.push('“Farm code” sitecode labels (shown as site / client code)');
  }

  /* ---------- declutter overview: drop Crew orders waiting count ---------- */
  function patchOverview() {
    if (typeof VIEWS['admin:home'] !== 'function') return;
    var oh = VIEWS['admin:home'];
    VIEWS['admin:home'] = function () {
      return oh()
        .replace(/<option value="#\/creworders">[^<]*<\/option>/g, '')
        .replace(/Farms & other clients/g, 'Clients & sites')
        .replace(/Farm changes/g, 'Hours changes');
    };
  }

  /* ---------- live DOM pass: rewrite leftover farm words on client-visible pages ---------- */
  /* cjstrip4: one word filter for text nodes, placeholders/titles/aria-labels, modals and toasts.
     Capitalised forms first so "Farm code" → "Site code" (not "site code"). Only visible text is touched – never ids, routes or data. */
  var CJ_WORD_RX = /farm|grader|bin piler|crew order|Order a crew|orchard|harvest/i;
  function cjWords(t) {
    if (!t || !CJ_WORD_RX.test(t)) return t;
    return String(t)
      .replace(/Order a crew/g, 'Request cleaning').replace(/order a crew/gi, 'request cleaning')
      .replace(/Crew orders?/g, 'Cleaning requests').replace(/crew orders?/gi, 'cleaning requests')
      .replace(/Bin pilers?/g, 'Cleaners').replace(/bin pilers?/gi, 'cleaners')
      .replace(/Graders?/g, 'Cleaners').replace(/graders?/gi, 'cleaners')
      .replace(/Harvest crew/g, 'Cleaning crew').replace(/harvest crew/gi, 'cleaning crew')
      .replace(/\bHarvest\b/g, 'Cleaning').replace(/\bharvest\b/gi, 'cleaning')
      .replace(/\bOrchards?\b/g, 'Site').replace(/\borchards?\b/gi, 'site')
      .replace(/\bFarming\b/g, 'Cleaning').replace(/\bfarming\b/gi, 'cleaning')
      .replace(/\bFarmers?\b/g, 'Clients').replace(/\bfarmers?\b/gi, 'clients')
      .replace(/\bFarms\b/g, 'Sites').replace(/\bFarm\b/g, 'Site')
      .replace(/\bfarms\b/gi, 'sites').replace(/\bfarm\b/gi, 'site');
  }
  window.CJ_words = cjWords;
  function scrubNode(top) {
    var walk = function (node) {
      if (node.nodeType === 3) {
        var t = node.nodeValue;
        if (t && CJ_WORD_RX.test(t)) node.nodeValue = cjWords(t);
        return;
      }
      if (node.nodeType !== 1) return;
      if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE' || node.tagName === 'TEXTAREA') return;
      ['placeholder', 'title', 'aria-label'].forEach(function (k) {
        var v = node.getAttribute && node.getAttribute(k);
        if (v && CJ_WORD_RX.test(v)) node.setAttribute(k, cjWords(v));
      });
      for (var i = 0; i < node.childNodes.length; i++) walk(node.childNodes[i]);
    };
    try { walk(top); } catch (e) {}
  }
  function scrubFarmWords(root) {
    if (!root || !ME) return;
    if (root.id === 'modal') { scrubNode(root); return; }
    var main = root.querySelector ? root.querySelector('main') : null;
    if (!main) return;
    scrubNode(main);
  }

  /* ---------- mock seed: no farm clients; keep coverage CJC sites only ---------- */
  function neuterFarmSeedClients() {
    window.CJ_BRAND.hidden.push('v2-clients seedClients farm orchards / TOF/TFD farm codes');
    window.seedClients = function (db) {
      if (!db) return;
      db.settings = db.settings || {};
      db.settings.clientTypes = ['Cleaning', 'Office', 'Other'];
      (db.users || []).forEach(function (u) {
        if (u.type !== 'firm') return;
        u.companyId = 'cj';
        u.firm = u.firm || {};
        if (!u.firm.clientType || /^farm$/i.test(u.firm.clientType)) u.firm.clientType = 'Cleaning';
      });
      /* Drop farm leftover sites (TOF/CVF/BPF/…) – keep CJC### + practice only */
      db.sites = (db.sites || []).filter(function (s) {
        return s.companyId === 'cj' || /^CJC\d{3}$/.test(s.code) || s.code === 'TEST-PRACTICE';
      });
      /* Remove farm-only usernames from extra seed (clientFarm orchard, firmD/E, …) if present */
      var drop = { clientFarm:1, firmD:1, firmE:1, clientCon:1, clientBake:1, clientPaint:1, clientClean:1 };
      db.users = (db.users || []).filter(function (u) { return !(u.type === 'firm' && drop[u.username]); });
    };
    /* Add-person: no role pre-selected; cleaners → Employee; CJ labels */
    try {
      if (typeof AP_ROLES !== 'undefined' && AP_ROLES && AP_ROLES.length) {
        AP_ROLES.forEach(function (r) {
          if (r[0] === 'employee') r[1] = 'Cleaner – Chief Janitorial employee';
          if (r[0] === 'firm') r[1] = 'Client / site login (existing cleaning client)';
          if (r[0] === 'worker') r[1] = "Cleaner – a subcontractor's worker";
        });
        if (typeof AP_ROLE_LABEL === 'object') {
          AP_ROLES.forEach(function (r) { AP_ROLE_LABEL[r[0]] = r[0] === 'admin' ? 'Office staff' : r[1]; });
        }
      }
      if (typeof apForm === 'function') {
        var oap = apForm;
        window.apForm = function () {
          var d = PAGE_STATE.apDraft || {};
          if (!d.role) d.role = ''; /* none selected */
          PAGE_STATE.apDraft = d;
          var x = oap();
          x = x.replace(/<select name="role" id="aprole" required>/,
            '<select name="role" id="aprole" required><option value="" disabled' + (d.role ? '' : ' selected') + '>– choose role –</option>');
          if (x.indexOf('data-cj-ap-hint') < 0) {
            x = x.replace('</select>', '</select><div class="hint" data-cj-ap-hint"><b>Cleaners:</b> choose Employee. Client / site is only for the business that receives cleaning.</div>');
            /* only first </select> after role – fragile; better insert after aprole block */
            x = x.replace('id="aprole" required><option value="" disabled', 'id="aprole" required><option value="" disabled');
          }
          return x.replace(/Worker – UnScramble employee/g, 'Cleaner – Chief Janitorial employee')
            .replace(/Farm \/ client user/g, 'Client / site login')
            .replace(/farm\/client login/g, 'client / site login')
            .replace(/UnScramble employee/g, 'Chief Janitorial employee');
        };
      }
    } catch (e) {}
  }

  /* ---------- cjstrip4: CJ route aliases, cleaning labels, shift defaults, toasts ---------- */
  function cjstrip4() {
    /* 1. #/sitebilling and #/hourschanges render the same views as #/farmbilling and #/farmchanges (old routes keep working) */
    var ALIAS = { '#/farmbilling': '#/sitebilling', '#/farmchanges': '#/hourschanges' };
    VIEWS['admin:sitebilling'] = function (h) { return VIEWS['admin:farmbilling'](h); };
    VIEWS['admin:hourschanges'] = function (h) { return VIEWS['admin:farmchanges'](h); };
    (NAV.admin || []).forEach(function (n) { if (ALIAS[n[0]]) n[0] = ALIAS[n[0]]; });
    if (typeof MENU_GROUPS !== 'undefined' && MENU_GROUPS) {
      MENU_GROUPS.forEach(function (g) { if (g[1]) g[1] = g[1].map(function (h) { return ALIAS[h] || h; }); });
    }
    if (typeof gateRoute === 'function') {
      var og = gateRoute;
      gateRoute = function (h) {
        var r = og(h);
        return (ME && ME.type === 'admin' && ALIAS[r]) ? ALIAS[r] : r;
      };
    }
    if (typeof adminFlags === 'function') {
      var oaf = adminFlags;
      adminFlags = function () {
        return oaf().map(function (f) {
          return { t: f.t, c: f.c, h: String(f.h || '').replace(/#\/farmchanges/g, '#/hourschanges').replace(/#\/farmbilling/g, '#/sitebilling') };
        });
      };
    }
    /* 2. Clients & sites headings → cleaning wording */
    if (typeof VIEWS['admin:firms'] === 'function') {
      var ofi4 = VIEWS['admin:firms'];
      VIEWS['admin:firms'] = function () {
        return String(ofi4())
          .replace(/>Industry per client</g, '>Client type<')
          .replace(/Farm &(amp;)? other client sign-up/g, 'Client sign-up')
          .replace(/[Ss]ite &(amp;)? other client sign-up/g, 'Client sign-up');
      };
    }
    /* 3. Role labels (labels only – role keys, rates, payroll and licence checks unchanged) */
    try {
      if (JOB_ROLES.field) JOB_ROLES.field.label = 'Cleaner';
      if (JOB_ROLES.grader) JOB_ROLES.grader.label = 'Grader';
      if (JOB_ROLES.packer) JOB_ROLES.packer.label = 'Packer';
      if (JOB_ROLES.binpiler) JOB_ROLES.binpiler.label = 'Bin piler (forklift)';
    } catch (e) {}
    try { if (typeof ROLES !== 'undefined') ROLES.forEach(function (r) { if (r[0] === 'general') r[1] = 'Cleaner'; }); } catch (e) {}
    /* 4. Create a shift: CJ defaults (Site clean, 18:00–22:00, 2 cleaners; General shown as Cleaner) */
    if (typeof VIEWS['admin:shiftsadmin'] === 'function') {
      var osa = VIEWS['admin:shiftsadmin'];
      VIEWS['admin:shiftsadmin'] = function () {
        var x = String(osa());
        var i = x.indexOf('<form data-form="newshift">'), j = i >= 0 ? x.indexOf('</form>', i) : -1;
        if (i < 0 || j < 0) return x;
        var f = x.slice(i, j)
          .replace('name="title" value="Field work"', 'name="title" value="Site clean"')
          .replace('name="start" value="07:00"', 'name="start" value="18:00"')
          .replace('name="end" value="15:30"', 'name="end" value="22:00"')
          .replace('name="needed" value="4"', 'name="needed" value="2" min="1"')
          .replace('<label class="">Workers needed</label>', '<label class="">Cleaners needed</label>')
          .replace(/(<option value="general"[^>]*>)General(<\/option>)/, '$1Cleaner$2');
        return x.slice(0, i) + f + x.slice(j);
      };
    }
    /* 5. Toasts: same word filter as the screens */
    if (typeof toast === 'function') {
      var ot = toast;
      toast = function (msg) { return ot(cjWords(String(msg == null ? '' : msg))); };
    }
  }

  /* Run after other v2_* modules have registered NAV/VIEWS */
  function apply() {
    if (window.CJ_BRAND && window.CJ_BRAND._applied) return;
    if (typeof NAV === 'undefined') return;
    window.CJ_BRAND = window.CJ_BRAND || {};
    window.CJ_BRAND._applied = true;
    hideCrewOrders();
    scopeCleaningOnly();
    renameChrome();
    neuterFarmSeedClients();
    patchEmails();
    patchSitecode();
    patchOverview();
    try { cjstrip4(); } catch (e) { try { console.warn('[cjstrip4]', e); } catch (x) {} }
    if (typeof afterRender === 'function') {
      var oa = afterRender;
      afterRender = function (root) {
        oa(root);
        try { scrubFarmWords(root); } catch (e) {}
      };
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    /* Scripts at end of body: DOM may already be interactive; apply now */
    apply();
  }
  /* Also apply immediately in case NAV already exists */
  try { apply(); } catch (e) {}
})();

/* cjstrip4c: close any open pop-up when the screen changes (invoice dialog stayed open after leaving My invoices). */
window.addEventListener('hashchange', function () { try { if (typeof closeModal === 'function') closeModal(); } catch (e) {} });
