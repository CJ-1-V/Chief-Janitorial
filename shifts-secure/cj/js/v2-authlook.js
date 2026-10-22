/* authlook2 (Oct 21 2026) – visual layer for the signed-out screens: sign in, forgot password, create account.
 * Wraps whatever the existing views return (forms untouched, so v2-pwshow / v2-pwemail / v2-security keep working)
 * in a two-column shell with a company-coloured hero panel: logo, "how it works" steps and fact chips.
 * The create-account choices get an icon tile each. Company is read from the folder (/cj/ = Chief Janitorial).
 * Load this file LAST in index.html. Pair: css/authlook.css. */
(function () {
  'use strict';
  if (typeof VIEWS === 'undefined') return;
  var isCJ = /\/cj\//.test(location.pathname);
  if (isCJ) document.documentElement.classList.add('cj-app');

  /* stroke icons (24x24 grid) */
  var I = {
    id: '<path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/><circle cx="9" cy="11" r="2.2"/><path d="M5.5 16.5c.6-1.8 2-2.7 3.5-2.7s2.9.9 3.5 2.7"/><path d="M14 9.5h5M14 12.5h5M14 15.5h3"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    check: '<path d="M4 12.5l5 5L20 6.5"/>',
    pay: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6.5 9.5h.01M17.5 14.5h.01"/>',
    doc: '<path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/><circle cx="12" cy="16" r="1.3"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18h2"/>',
    person: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c.9-3.8 3.9-5.8 7.5-5.8s6.6 2 7.5 5.8"/>',
    building: '<path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16"/><path d="M15 10h4a1 1 0 0 1 1 1v10"/><path d="M7.5 8h2M7.5 12h2M7.5 16h2M17.5 14h.01M17.5 18h.01M3 21h18"/>',
    team: '<circle cx="9" cy="8.5" r="3"/><circle cx="17" cy="9.5" r="2.4"/><path d="M3 20c.6-3.4 3-5.3 6-5.3s5.4 1.9 6 5.3"/><path d="M15.5 14.4c2.8 0 4.9 1.5 5.5 4.6"/>',
    farm: '<path d="M3 20h18"/><path d="M4 20V10l6-5 6 5v10"/><path d="M8 20v-5h4v5"/><path d="M16 12h4v8"/><path d="M18 9V6"/>',
    broom: '<path d="M14.5 3.5l6 6"/><path d="M17.5 6.5l-7.5 7.5"/><path d="M10 14l-4.3 1.3A3.5 3.5 0 0 0 3.5 19v1.5H5a3.5 3.5 0 0 0 3.7-2.2L10 14z"/><path d="M6 20.5l2-2.5"/>',
    camera: '<path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
    flask: '<path d="M9 3h6M10 3v6l-5.5 9.5A1.5 1.5 0 0 0 5.8 21h12.4a1.5 1.5 0 0 0 1.3-2.5L14 9V3"/><path d="M7.5 15h9"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M8 14h3M13 14h3M8 18h3"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    key: '<circle cx="8" cy="14" r="4"/><path d="M11 11l9-9M16 4l3 3M13 7l3 3"/>'
  };
  function svg(k) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + I[k] + '</svg>'; }
  function uri(k, color) {
    return 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + I[k] + '</svg>') + '")';
  }

  /* company copy – only things the apps actually do */
  var CO = isCJ ? {
    logo: 'assets/cj_Logo.png', alt: 'Chief Janitorial', tag: 'Cleaners, sites & invoices',
    title: 'Welcome to Chief Janitorial',
    sub: 'One sign in for cleaners, subcontractors and client sites.',
    steps: [['id', 'Create your account', 'The office approves it before your first shift.'],
            ['clock', 'Clock in at your site', 'Tick the task list and add visit photos when they are needed.'],
            ['check', 'Reviewed and invoiced', 'The office reviews the hours; clients see visit logs and one monthly invoice.']],
    chips: [['lock', 'Secure sign in'], ['phone', 'Works on your phone'], ['camera', 'Visit photos'], ['calendar', 'Site calendar']]
  } : {
    logo: 'assets/unscramble-logo.svg', alt: 'UnScramble', tag: 'Clock, farms & compliance',
    title: 'Welcome to UnScramble',
    sub: 'One sign in for workers, subcontractor crews and farm clients.',
    steps: [['id', 'Create your account', 'Workers add their documents online; farms and clients sign the agreement online.'],
            ['clock', 'Clock in or book a crew', 'Workers clock in from their phone. Clients book the crew they need, day by day.'],
            ['pay', 'Approve and get paid', 'Farms approve the week; hours go to payroll and one monthly invoice.']],
    chips: [['lock', 'Secure sign in'], ['phone', 'Works on your phone'], ['doc', 'Documents kept private'], ['team', 'Subcontractor crews welcome']]
  };

  function hero(kind) {
    var h = '<aside class="auth-hero" aria-label="How it works">' +
      '<div class="ah-logo"><img src="' + esc(CO.logo) + '" alt="' + esc(CO.alt) + '"><span>' + CO.tag + '</span></div>' +
      '<h2>' + CO.title + '</h2><p class="ah-sub">' + CO.sub + '</p><ol class="ah-steps">';
    CO.steps.forEach(function (s, n) {
      h += '<li><div class="ah-ic">' + svg(s[0]) + '<i>' + (n + 1) + '</i></div><div><b>' + s[1] + '</b><span>' + s[2] + '</span></div></li>';
    });
    h += '</ol><div class="ah-chips">' + CO.chips.map(function (c) { return '<span>' + svg(c[0]) + c[1] + '</span>'; }).join('') + '</div></aside>';
    return h;
  }

  /* the heading icon and the choice icons are CSS backgrounds – build them once with the brand colour */
  function injectIcons() {
    var p = (getComputedStyle(document.documentElement).getPropertyValue('--p') || '#332E57').trim() || '#332E57';
    var css = '.auth-shell .login-wrap h1::before{background-image:' + uri('key', p) + '}' +
      '.auth-shell .choice[href="#/signup/employee"]::before{background-image:' + uri(isCJ ? 'broom' : 'person', p) + '}' +
      '.auth-shell .choice[href="#/signup/sub"]::before{background-image:' + uri('building', p) + '}' +
      '.auth-shell .choice[href="#/signup/worker"]::before{background-image:' + uri('team', p) + '}' +
      '.auth-shell .choice[href="#/signup/firm"]::before{background-image:' + uri(isCJ ? 'building' : 'farm', p) + '}' +
      '.auth-shell .choice[href="#/signup/tester"]::before{background-image:' + uri('flask', p) + '}' +
      '.auth-shell .choice::before{background-image:' + uri('id', p) + '}';
    var st = document.createElement('style'); st.id = 'authlook-icons'; st.textContent = css; document.head.appendChild(st);
  }
  injectIcons();

  function wrap(name) {
    var orig = VIEWS[name];
    if (typeof orig !== 'function') return;
    VIEWS[name] = function (h) {
      var html = orig(h);
      if (typeof ME !== 'undefined' && ME) return html;                 /* signed in: never touch */
      html = String(html);
      if (html.indexOf('class="auth-shell"') >= 0) return html;         /* already wrapped (another overlay re-wrapped us): never double */
      if (html.indexOf('class="login-wrap"') < 0) return html;          /* unknown shape: leave it */
      /* create-account choices: wrap the text so the icon tile (CSS ::before) sits in its own column */
      html = html.replace(/<a class="choice"([^>]*)>([\s\S]*?)<\/a>/g, '<a class="choice"$1><span class="ch-tx">$2</span></a>');
      return '<div class="auth-shell">' + hero(name) + '<div>' + html + '</div></div>';
    };
  }
  ['login', 'forgot', 'signup', 'signupForm', 'twofa'].forEach(wrap);
})();
