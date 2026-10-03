/* Core: Supabase client, helpers, login / sign-up, router. No client names anywhere in this app:
 * sites are shown by number only. Real names live only in the Drive "Site Key" sheets. */
(function () {
  const C = window.ST_CONFIG; const ST = (window.ST = window.ST || {});
  const sb = (ST.sb = window.supabase.createClient(C.url, C.key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'st-secure-auth' } }));
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TZ = 'America/Halifax';
  const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }) : '—');
  const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' });
  const fmtDateLong = (iso) => new Date(iso).toLocaleDateString('en-US', { timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const fmtDay = (key) => fmtDate(ST_tz().zoned(key, 12, 0).toISOString());
  const fmtDT = (iso) => (iso ? fmtDate(iso) + ', ' + fmtTime(iso) : '—');
  const hours = (a, b) => (a && b ? (new Date(b) - new Date(a)) / 3600000 : 0);
  const fmtDur = (h) => { const neg = h < 0; const m = Math.round(Math.abs(h) * 60); return (neg ? '−' : '') + Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm'; };
  const money = (n) => (n == null || isNaN(n) ? '—' : '$' + Number(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const initials = (n) => String(n || '?').split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  const mBadge = (on, title) => (on ? `<span class="mbadge" title="${esc(title || 'Changed by hand')}">M</span>` : '');
  const ST_tz = () => window.CJ.tz;
  // Display helpers: workers are shown by nickname (never a real name); staff by role title. Sites by code (e.g. CVF217).
  const who = (p) => (p ? p.nickname || p.full_name || '?' : '?');
  const isUnknownSite = (s) => !!s && (s.is_unknown || /^UNK/.test(s.site_code || ''));  // migration 010: UNK199 (CJ) / UNK299 (US)
  const siteName = (s) => (!s ? 'Site ?' : isUnknownSite(s) ? 'Unknown site · ' + (s.company_id === 'us' ? 'US' : 'CJ') : s.site_code || ('Site ' + s.site_no));
  const COMPANIES = { cj: { name: 'Chief Janitorial', short: 'CJ' }, us: { name: 'Unscramble', short: 'US' } };
  // Unpaid break per day per site (split shifts added together): over 5 h -> 0.5 h; 8 h or more -> 1 h.
  const unpaidBreak = (w) => (w >= 8 ? 1 : w > 5 ? 0.5 : 0);
  const phoneDigits = (p) => String(p || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  const loginId = (input) => (String(input).includes('@') ? String(input).trim().toLowerCase() : phoneDigits(input) + '@' + C.loginDomain);
  function errMsg(e) {
    const m = (e && (e.message || e.msg || e.error_description)) || String(e);
    if (/Invalid login credentials/i.test(m)) return 'Wrong phone number or password.';
    if (/already registered|already exists|duplicate key.*phone/i.test(m)) return 'This phone number already has an account. Log in instead, or ask the office.';
    if (/Email not confirmed/i.test(m)) return 'Sign-up is not switched on yet (the office must change one setting). Please ask the office.';
    if (/Password should be/i.test(m)) return 'Password must be at least 8 characters.';
    if (/Could not find the function|schema cache/i.test(m)) return 'This needs a database update first. Please tell the office.';
    return m.replace(/^.*?ERROR:\s*/, '');
  }
  function toast(msg, kind) {
    let t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.className = 'toast show ' + (kind || ''); t.textContent = msg; clearTimeout(t._h); t._h = setTimeout(() => (t.className = 'toast'), 3000);
  }
  function modal(html, onMount) {
    const w = document.createElement('div'); w.className = 'modal-wrap'; w.innerHTML = `<div class="modal">${html}</div>`;
    document.body.appendChild(w); const close = () => w.remove();
    w.addEventListener('click', (e) => { if (e.target === w || e.target.closest('[data-close]')) close(); });
    onMount && onMount(w, close); return close;
  }
  function theme(t) { if (t) localStorage.setItem('cj-theme', t); document.documentElement.dataset.theme = localStorage.getItem('cj-theme') || 'light'; }
  const logo = (co) => co === 'us' ? `<img class="logo logo-us" src="assets/unscramble-logo.svg" alt="Unscramble">`
    : co === 'both' ? `<span class="logo-pair">${logo('cj')}<span class="amp">+</span>${logo('us')}</span>`
    : `<img class="logo" src="assets/${document.documentElement.dataset.theme === 'dark' ? 'logo-dark' : 'logo'}.png" alt="Chief Janitorial">`;
  const themeBtn = () => `<button class="iconbtn" data-act="theme" title="Dark / light mode">${document.documentElement.dataset.theme === 'dark' ? '☀' : '☾'}</button>`;
  async function q(promise) { const { data, error } = await promise; if (error) throw error; return data; }
  function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/csv' })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
  const csv = (rows) => rows.map((r) => r.map((v) => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\n') + '\n';

  // ---------- who am I ----------
  ST.me = null;
  async function loadMe() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { ST.me = null; return null; }
    const uid = session.user.id;
    const prof = await q(sb.from('profiles').select('*').eq('id', uid).maybeSingle());
    const roles = await q(sb.from('staff_roles').select('company_id, role').eq('user_id', uid));
    let mustChange = false; try { mustChange = !!(await q(sb.rpc('must_change_password'))); } catch (e) { console.warn('must_change_password', e); }
    ST.me = { id: uid, profile: prof, roles, mustChange, isStaff: !!(prof && prof.is_staff), companies: [...new Set(roles.map((r) => r.company_id))].sort() };
    return ST.me;
  }
  ST.can = (co, list) => !!ST.me && ST.me.roles.some((r) => r.company_id === co && list.includes(r.role));
  ST.canBill = (co) => ST.can(co, ['owner', 'admin', 'billing']);
  ST.canOps = (co) => ST.can(co, ['owner', 'admin', 'ops']);

  // ---------- company picker (front-end only; remembered on this device until "Switch company" or log out) ----------
  ST.company = () => { const c = localStorage.getItem('st-company'); return c === 'cj' || c === 'us' ? c : null; };
  ST.setCompany = (c) => (c ? localStorage.setItem('st-company', c) : localStorage.removeItem('st-company'));
  ST.switchCompany = () => { ST.setCompany(null); location.hash = '#/pick'; ST.render(); };
  // Branding: Unscramble is the parent company (frame, colours, logo on top); Chief Janitorial is "an Unscramble company".
  const usMark = (cls) => `<img class="logo logo-us ${cls || ''}" src="assets/unscramble-logo.svg" alt="Unscramble">`;
  function pickerView() {
    document.title = 'Shift Tracker · Unscramble';
    return `<div class="auth auth-pick"><main class="auth-wrap">
      <header class="auth-hero">${usMark('hero-logo')}<p class="hero-app">Shift Tracker</p></header>
      <div class="auth-card picker-card">
        <h1 id="pickH">Choose your company</h1>
        <div class="picker" role="group" aria-labelledby="pickH">
          <button type="button" class="pick-btn pick-us" data-pick="us" aria-label="Unscramble, parent company">
            <span class="pick-tag">Parent company</span>${logo('us')}<span class="pick-name">Unscramble</span></button>
          <div class="pick-link" aria-hidden="true"></div>
          <button type="button" class="pick-btn pick-cj pick-sub" data-pick="cj" aria-label="Chief Janitorial, an Unscramble company">
            <span class="pick-tag">An Unscramble company</span>${logo('cj')}<span class="pick-name">Chief Janitorial</span></button>
        </div>
        <p class="auth-foot">One account works for both. You can switch company from the menu later.</p>
      </div></main></div>`;
  }
  function bindPicker(root) {
    root.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => { ST.setCompany(b.dataset.pick); location.hash = '#/'; ST.render(); }));
  }

  // ---------- login / sign-up ----------
  function loginView(msg) {
    const co = ST.company() || 'us'; document.title = 'Shift Tracker · ' + COMPANIES[co].name;
    return `<div class="auth auth-co-${co}"><main class="auth-wrap">
      <header class="auth-hero">${usMark('hero-logo')}<p class="hero-app">Shift Tracker</p></header>
      <div class="auth-card login-card">
        ${co === 'cj' ? `<div class="sub-brand">${logo('cj')}<p><span class="sb-line"><b>Chief Janitorial</b> — an Unscramble company</span></p></div>` : `<div class="sub-brand sub-us"><p><b>Unscramble</b></p></div>`}
        <h1>Log in</h1><p class="auth-sub">Clock in and out, and see your hours.</p>
      <form id="loginForm" class="stack">
        <label class="field"><span>Phone number</span><input name="phone" inputmode="tel" placeholder="902 555 0101" autocomplete="username" required></label>
        <label class="field"><span>Password</span><input name="password" type="password" autocomplete="current-password" required></label>
        <div class="err" id="loginErr">${esc(msg || '')}</div>
        <button class="btn primary big" type="submit">Log in</button>
      </form>
      <p class="auth-alt">New employee? <a href="#/signup">Create an account</a></p>
      <p class="auth-foot">Forgot your password? Ask the office.</p>
      <p class="auth-switch"><a href="#" data-act="switchco">Not ${COMPANIES[co].name}? Switch company</a></p>
    </div></main></div>`;
  }
  function signupView() {
    const q = new URLSearchParams(location.search).get('co'); const co = q === 'cj' || q === 'us' ? q : ST.company();
    return `<div class="auth auth-co-${co || 'cj'}"><div class="auth-card">
      <div class="auth-logo">${logo(co === 'us' || co === 'cj' ? co : 'both')}</div>
      <h1>Create employee account</h1>
      <p class="muted">New accounts are checked by your company's office before you can clock in.</p>
      <form id="signupForm" class="stack">
        <label class="field"><span>Your main office (approves your account). One account works for both companies; you can switch company from the menu.</span><select name="company"><option value="cj" ${co === 'cj' ? 'selected' : ''}>Chief Janitorial</option><option value="us" ${co === 'us' ? 'selected' : ''}>Unscramble</option></select></label>
        <p class="muted small">No real names here: you'll get a friendly nickname (like “Turbo Mop”). The office knows you by your phone number + nickname.</p>
        <label class="field"><span>Phone number</span><input name="phone" inputmode="tel" placeholder="10 digits" required></label>
        <label class="field"><span>Password (8 or more characters)</span><input name="password" type="password" required minlength="8" autocomplete="new-password"></label>
        <div class="err" id="signupErr"></div>
        <button class="btn primary big" type="submit">Create account</button>
      </form>
      <p class="muted center"><a href="#/login">Back to log in</a></p>
    </div></div>`;
  }
  function bindAuth(root) {
    const lf = $('#loginForm', root);
    lf && lf.addEventListener('submit', async (e) => {
      e.preventDefault(); const f = new FormData(lf); const id = String(f.get('phone'));
      if (!id.includes('@') && phoneDigits(id).length !== 10) { $('#loginErr').textContent = 'Enter your 10-digit phone number.'; return; }
      lf.classList.add('loading');
      const { error } = await sb.auth.signInWithPassword({ email: loginId(id), password: String(f.get('password')) });
      lf.classList.remove('loading');
      if (error) { $('#loginErr').textContent = errMsg(error); return; }
      ST._loginPw = String(f.get('password'));      // memory only (never saved): lets the "choose a new password" step skip re-typing it
      location.hash = '#/'; ST.render();
    });
    const sf = $('#signupForm', root);
    sf && sf.addEventListener('submit', async (e) => {
      e.preventDefault(); const f = new FormData(sf); const ph = phoneDigits(f.get('phone'));
      if (ph.length !== 10) { $('#signupErr').textContent = 'Enter a 10-digit phone number.'; return; }
      sf.classList.add('loading');
      const { data, error } = await sb.auth.signUp({ email: ph + '@' + C.loginDomain, password: String(f.get('password')), options: { data: { phone: ph, company: f.get('company') } } });
      sf.classList.remove('loading');
      if (error) { $('#signupErr').textContent = errMsg(error); return; }
      if (!data.session) { $('#signupErr').textContent = errMsg({ message: 'Email not confirmed' }); return; }
      location.hash = '#/'; ST.render();
    });
  }

  // ---------- passwords ----------
  const pwFields = (needCurrent, curLabel) => `${needCurrent ? `<label class="field"><span>${curLabel}</span><input name="current" type="password" autocomplete="current-password" required></label>` : ''}
      <label class="field"><span>New password (8 or more characters)</span><input name="pw1" type="password" minlength="8" autocomplete="new-password" required></label>
      <label class="field"><span>Repeat the new password</span><input name="pw2" type="password" minlength="8" autocomplete="new-password" required></label>`;
  async function savePw(form, current, errEl) {
    const f = new FormData(form); const cur = current != null ? current : String(f.get('current') || ''); const a = String(f.get('pw1')); const b = String(f.get('pw2'));
    if (a.length < 8) { errEl.textContent = 'New password must be at least 8 characters.'; return false; }
    if (a !== b) { errEl.textContent = 'The two new passwords are not the same.'; return false; }
    form.classList.add('loading');
    try { await q(sb.rpc('change_my_password', { p_current: cur, p_new: a })); return true; }
    catch (e) { errEl.textContent = errMsg(e); return false; } finally { form.classList.remove('loading'); }
  }
  function forcedPwView() {
    const known = !!ST._loginPw;
    return `<div class="auth"><div class="auth-card">
      <div class="auth-logo">${logo('both')}</div>
      <h1>Choose a new password</h1>
      <p class="muted">You logged in with a temporary password. Choose your own password to continue.</p>
      <form id="forcePwForm" class="stack">${pwFields(!known, 'Temporary password')}
        <div class="err" id="forcePwErr"></div>
        <button class="btn primary big" type="submit">Save new password</button>
      </form>
      <p class="muted center"><button class="linkbtn" data-act="logout">Log out</button></p>
    </div></div>`;
  }
  function bindForcedPw(root) {
    const f = $('#forcePwForm', root);
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const ok = await savePw(f, ST._loginPw || null, $('#forcePwErr', root));
      if (!ok && ST._loginPw && /current password/i.test($('#forcePwErr', root).textContent)) { ST._loginPw = null; ST.render(); return; }
      if (ok) { ST._loginPw = null; toast('New password saved ✓', 'good'); location.hash = '#/'; ST.render(); }
    });
  }
  ST.changePassword = function () {
    modal(`<h2>Change my password</h2><form id="chPwForm" class="stack">${pwFields(true, 'Current password')}
        <div class="err" id="chPwErr"></div>
        <div class="row-between"><button class="btn ghost" type="button" data-close>Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`, (w, close) => {
      const f = $('#chPwForm', w);
      f.addEventListener('submit', async (e) => { e.preventDefault(); if (await savePw(f, null, $('#chPwErr', w))) { close(); toast('Password changed ✓', 'good'); } });
    });
  };

  // ---------- install as an app (PWA) ----------
  let installEvt = null;
  const standalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; mountInstall(); });
  window.addEventListener('appinstalled', () => { installEvt = null; document.querySelectorAll('.install-bar').forEach((x) => x.remove()); });
  const IOS_PIC = `<svg class="ios-steps" viewBox="0 0 300 120" role="img" aria-label="Tap Share, then Add to Home Screen">
    <rect x="1" y="1" width="138" height="118" rx="14" fill="#f1f5f9" stroke="#cbd5e1"/><text x="70" y="22" text-anchor="middle" font-size="12" fill="#334155">1. Tap Share</text>
    <rect x="10" y="84" width="120" height="28" rx="6" fill="#fff" stroke="#cbd5e1"/>
    <g transform="translate(58 40)" fill="none" stroke="#0a84ff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v22M5 11l7-7 7 7"/><path d="M4 18v14h16V18"/></g>
    <path d="M70 80v10" stroke="#0a84ff" stroke-width="2"/><circle cx="70" cy="98" r="7" fill="none" stroke="#0a84ff" stroke-width="2"/>
    <rect x="161" y="1" width="138" height="118" rx="14" fill="#f1f5f9" stroke="#cbd5e1"/><text x="230" y="22" text-anchor="middle" font-size="12" fill="#334155">2. Add to Home Screen</text>
    <rect x="170" y="44" width="120" height="34" rx="8" fill="#fff" stroke="#0a84ff" stroke-width="2"/>
    <rect x="178" y="51" width="20" height="20" rx="5" fill="none" stroke="#334155" stroke-width="2"/><path d="M188 56v10M183 61h10" stroke="#334155" stroke-width="2"/>
    <text x="204" y="65" font-size="10.5" fill="#0f172a">Add to Home Screen</text></svg>`;
  function iosSteps() {
    modal(`<h2>Install the app on iPhone</h2>${IOS_PIC}
      <ol class="steps"><li>In <b>Safari</b>, tap the <b>Share</b> button <span class="share-ico">⬆︎</span> (bottom of the screen).</li><li>Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.</li><li>Open <b>Shifts</b> from your home screen.</li></ol>
      <div class="row-between"><span></span><button class="btn primary" data-close>OK</button></div>`);
  }
  function mountInstall() {
    if (standalone() || sessionStorage.getItem('st-install-hide')) return;
    const can = !!installEvt || isIOS(); if (!can) return;
    const p = parts(); const app = $('#app'); if (!app) return;
    const home = !p.length || p[0] === 'login' || p[0] === 'pick' || (p[0] === 'emp' && (!p[1] || p[1] === 'clock')) || (p[0] === 'admin' && (!p[1] || p[1] === 'dashboard'));
    if (!home) return;
    const host = $('#loginForm') ? $('.auth-card', app) : $('.emp-main', app) || $('.adm-main', app) || $('.auth-card', app);
    if (!host || $('.install-bar', host)) return;
    const bar = document.createElement('div'); bar.className = 'install-bar';
    bar.innerHTML = `<img src="icons/icon-192.png" alt=""><div><b>Install the app</b><span>Shifts on your home screen.</span></div>
      <button class="btn small primary" data-inst>Install app</button><button class="iconbtn" data-inst-x title="Not now">×</button>`;
    if (host.classList.contains('auth-card')) host.appendChild(bar); else host.prepend(bar);
    bar.querySelector('[data-inst-x]').addEventListener('click', () => { sessionStorage.setItem('st-install-hide', '1'); bar.remove(); });
    bar.querySelector('[data-inst]').addEventListener('click', async () => {
      if (installEvt) { const ev = installEvt; installEvt = null; ev.prompt(); try { const r = await ev.userChoice; if (r && r.outcome === 'accepted') bar.remove(); } catch (e) {} }
      else iosSteps();
    });
  }
  ST.mountInstall = mountInstall;

  // ---------- router ----------
  const parts = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  ST.render = async function () {
    theme(); const app = $('#app'); const p = parts();
    try {
      if (p[0] === 'signup') { app.innerHTML = signupView(); bindAuth(app); bindGlobal(app); return; }
      if (p[0] === 'pick' || !ST.company()) { if (p[0] !== 'pick' && p.length) history.replaceState(null, '', '#/pick'); app.innerHTML = pickerView(); bindPicker(app); bindGlobal(app); mountInstall(); return; }
      const me = await loadMe();
      if (!me || p[0] === 'login') { app.innerHTML = loginView(); bindAuth(app); bindGlobal(app); mountInstall(); return; }
      if (!me.profile) { app.innerHTML = loginView('Your account is not set up yet. Ask the office.'); bindAuth(app); await sb.auth.signOut(); return; }
      if (me.profile.status === 'disabled') { app.innerHTML = loginView('This account is turned off. Please contact the office.'); bindAuth(app); await sb.auth.signOut(); return; }
      if (me.mustChange) { app.innerHTML = forcedPwView(); bindForcedPw(app); bindGlobal(app); return; }
      if (me.isStaff && me.roles.length) { if (p[0] !== 'admin') { location.hash = '#/admin/dashboard'; return; } await ST.adminView(app, p.slice(1)); }
      else { if (p[0] !== 'emp' && me.profile.status === 'active') { location.hash = '#/emp/clock'; return; } await ST.employeeView(app, p.slice(1)); }
      bindGlobal(app); mountInstall();
    } catch (e) { console.error(e); app.innerHTML = `<div class="auth"><div class="auth-card"><h1>Something went wrong</h1><p class="err">${esc(errMsg(e))}</p><button class="btn primary big" onclick="location.reload()">Try again</button> <button class="btn ghost big" data-act="logout">Log out</button></div></div>`; bindGlobal(app); }
  };
  function bindGlobal(root) {
    root.querySelectorAll('[data-act="theme"]').forEach((b) => b.addEventListener('click', () => { theme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); ST.render(); }));
    root.querySelectorAll('[data-act="logout"]').forEach((b) => b.addEventListener('click', async () => { ST._loginPw = null; ST.setCompany(null); await sb.auth.signOut(); location.hash = '#/pick'; ST.render(); }));
    root.querySelectorAll('[data-act="switchco"]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); ST.switchCompany(); }));
    root.querySelectorAll('[data-act="chpw"]').forEach((b) => b.addEventListener('click', () => ST.changePassword()));
  }
  Object.assign(ST, { who, siteName, isUnknownSite, $, esc, fmtTime, fmtDate, fmtDateLong, fmtDay, fmtDT, hours, fmtDur, money, initials, mBadge, COMPANIES, unpaidBreak, phoneDigits, errMsg, toast, modal, logo, themeBtn, q, download, csv, bindGlobal, tz: () => window.CJ.tz });
  window.addEventListener('hashchange', () => { document.querySelectorAll('.modal-wrap').forEach((m) => m.remove()); ST.render(); });
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch((e) => console.warn('sw', e)));
  }
  window.addEventListener('DOMContentLoaded', () => { ST.render(); setInterval(() => { document.querySelectorAll('[data-live-clock]').forEach((el) => (el.textContent = fmtTime(new Date().toISOString()))); document.querySelectorAll('[data-elapsed]').forEach((el) => (el.textContent = fmtDur(hours(el.dataset.elapsed, new Date().toISOString())))); }, 15000); });
})();
