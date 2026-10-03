/* Shared helpers, session, router, login/sign-up screens. */
(function () {
  const CJ = (window.CJ = window.CJ || {});
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-US', { timeZone: 'America/Halifax', hour: 'numeric', minute: '2-digit' }) : '—');
  const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/Halifax', weekday: 'short', month: 'short', day: 'numeric' });
  const fmtDateLong = (iso) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/Halifax', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const fmtDT = (iso) => (iso ? fmtDate(iso) + ', ' + fmtTime(iso) : '—');
  const hours = (a, b) => (a && b ? (new Date(b) - new Date(a)) / 3600000 : 0);
  const fmtDur = (h) => { const m = Math.round(h * 60); return Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm'; };
  const toLocalInput = (iso) => CJ.tz.toInput(iso); // Atlantic wall-clock for <input type=datetime-local>
  const ago = (iso) => { const m = Math.round((Date.now() - new Date(iso)) / 60000); if (m < 60) return m + ' min ago'; const h = Math.round(m / 60); if (h < 24) return h + ' h ago'; return Math.round(h / 24) + ' days ago'; };
  const startOfWeek = () => CJ.tz.zoned(CJ.tz.weekStart(CJ.tz.todayKey()), 0, 0); // Monday 00:00 Atlantic
  const initials = (n) => n.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  // The "M" marker for a manually edited time.
  const mBadge = (on, title, href) => (on ? (href ? `<a class="mbadge" href="${href}" title="${esc(title || 'Changed by hand')}">M</a>` : `<span class="mbadge" title="${esc(title || 'Changed by hand')}">M</span>`) : '');

  const SESSION = 'cj-shift-session';
  const session = { get: () => localStorage.getItem(SESSION), set: (id) => localStorage.setItem(SESSION, id), clear: () => localStorage.removeItem(SESSION) };

  function toast(msg, kind) {
    let t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.className = 'toast show ' + (kind || ''); t.textContent = msg; clearTimeout(t._h); t._h = setTimeout(() => (t.className = 'toast'), 2600);
  }
  function modal(html, onMount) {
    const w = document.createElement('div'); w.className = 'modal-wrap'; w.innerHTML = `<div class="modal">${html}</div>`;
    document.body.appendChild(w); const close = () => w.remove();
    w.addEventListener('click', (e) => { if (e.target === w || e.target.closest('[data-close]')) close(); });
    onMount && onMount(w, close); return close;
  }
  function theme(t) { if (t) localStorage.setItem('cj-theme', t); document.documentElement.dataset.theme = localStorage.getItem('cj-theme') || 'light'; }
  function toggleTheme() { theme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); CJ.render(); }
  // Company logo: 'cj' (default) or 'us' (Unscramble). 'both' = the two side by side (owner / login page).
  const logo = (co) => co === 'us' ? `<img class="logo logo-us" src="assets/unscramble-logo.svg" alt="Unscramble">`
    : co === 'both' ? `<span class="logo-pair">${logo('cj')}<span class="amp">+</span>${logo('us')}</span>`
    : `<img class="logo" src="assets/${document.documentElement.dataset.theme === 'dark' ? 'logo-dark' : 'logo'}.png" alt="Chief Janitorial">`;
  const themeBtn = () => `<button class="iconbtn" data-act="theme" title="Dark / light mode">${document.documentElement.dataset.theme === 'dark' ? '☀' : '☾'}</button>`;

  // ---------- Login / sign-up ----------
  function loginView() {
    return `<div class="auth">
      <div class="auth-card">
        <div class="auth-logo">${logo('both')}</div>
        <h1>Shift Tracker</h1><p class="muted center small">Chief Janitorial · Unscramble</p>
        <form id="loginForm" class="stack">
          <label class="field"><span>Phone number</span><input name="phone" inputmode="tel" placeholder="902 555 0101" autocomplete="username"></label>
          <label class="field"><span>Password</span><input name="password" type="password" placeholder="••••" autocomplete="current-password"></label>
          <div class="err" id="loginErr"></div>
          <button class="btn primary big" type="submit">Log in</button>
        </form>
        <p class="muted center">New employee? <a href="#/signup">Create an account</a></p>
        <div class="demo-box">
          <div class="demo-title">Prototype demo logins <span class="muted">(password: demo)</span></div>
          <div class="demo-grp">Employees</div>
          <button class="btn demo" data-demo="u-harpreet">👷 Employee (CJ) — Harpreet Kaur</button>
          <button class="btn demo demo-us" data-demo="u-us-ana">👷 Employee (Unscramble) — Ana Lima</button>
          <button class="btn demo" data-demo="u-ai">⏳ Pending sign-up — AI</button>
          <div class="demo-grp">Office logins — each sees only its own company</div>
          <button class="btn demo" data-demo="u-owner">🛡 Owner — all companies</button>
          <div class="demo-2"><button class="btn demo" data-demo="u-cj-ops">CJ Ops — Bal</button><button class="btn demo" data-demo="u-cj-billing">CJ Billing — Sandra</button></div>
          <div class="demo-2"><button class="btn demo demo-us" data-demo="u-us-ops">US Ops — Us Aasa</button><button class="btn demo demo-us" data-demo="u-us-billing">US Billing — Us Sandra</button></div>
          <button class="linkbtn" data-act="reset">Reset sample data</button>
        </div>
      </div></div>`;
  }
  function signupView() {
    return `<div class="auth"><div class="auth-card">
        <div class="auth-logo">${logo('both')}</div>
        <h1>Create employee account</h1>
        <p class="muted">New accounts are checked by your company's office before you can clock in.</p>
        <form id="signupForm" class="stack">
          <label class="field"><span>Who do you work for?</span><select name="company"><option value="cj">Chief Janitorial</option><option value="us">Unscramble</option></select></label>
          <label class="field"><span>Full name</span><input name="name" placeholder="First and last name"></label>
          <label class="field"><span>Phone number</span><input name="phone" inputmode="tel" placeholder="10 digits"></label>
          <label class="field"><span>Password</span><input name="password" type="password"></label>
          <div class="err" id="signupErr"></div>
          <button class="btn primary big" type="submit">Create account</button>
        </form>
        <p class="muted center"><a href="#/login">Back to log in</a></p>
      </div></div>`;
  }
  function bindAuth(root) {
    const lf = $('#loginForm', root);
    lf && lf.addEventListener('submit', (e) => {
      e.preventDefault(); const f = new FormData(lf); const r = CJ.api.login(f.get('phone'), f.get('password'));
      if (r.error) { $('#loginErr').textContent = r.error; return; }
      session.set(r.id); location.hash = r.role === 'admin' ? '#/admin/dashboard' : '#/emp/clock';
    });
    root.querySelectorAll('[data-demo]').forEach((b) => b.addEventListener('click', () => { session.set(b.dataset.demo); location.hash = CJ.api.roleOf(b.dataset.demo) === 'admin' ? '#/admin/dashboard' : '#/emp/clock'; CJ.render(); }));
    const sf = $('#signupForm', root);
    sf && sf.addEventListener('submit', (e) => {
      e.preventDefault(); const f = new FormData(sf); const r = CJ.api.emp.signup(f.get('name'), f.get('phone'), f.get('password'), f.get('company'));
      if (r.error) { $('#signupErr').textContent = r.error; return; }
      session.set(r.id); location.hash = '#/pending';
    });
  }

  // ---------- Router ----------
  function parseHash() { const h = location.hash.replace(/^#\/?/, ''); return h.split('/').filter(Boolean); }
  CJ.render = function () {
    theme();
    const app = $('#app'); const parts = parseHash(); const uid = session.get(); const role = uid ? CJ.api.roleOf(uid) : null;
    window.scrollTo(0, 0);
    CJ.api.setActor(role === 'admin' ? uid : null); // admin data is scoped to this login's companies
    if (parts[0] === 'signup') { app.innerHTML = signupView(); bindAuth(app); return; }
    if (!uid || !role || parts[0] === 'login') { if (parts[0] !== 'login') session.clear(); app.innerHTML = loginView(); bindAuth(app); bindGlobal(app); return; }
    if (role === 'admin') { if (parts[0] !== 'admin') return go('#/admin/dashboard'); CJ.adminView(app, parts.slice(1), uid); if ((CJ.api.db() || {}).dataMode === 'real') app.insertAdjacentHTML('afterbegin', '<div class="private-band">🔒 PRIVATE REVIEW — REAL client names, rates, terms and HST numbers from the local-only seed file (shifts, hours, workers and towns are still SAMPLE data). Not part of the public build.</div>'); }
    else { CJ.employeeView(app, parts, uid); }
    bindGlobal(app);
  };
  function go(h) { if (location.hash === h) CJ.render(); else location.hash = h; }
  function bindGlobal(root) {
    root.querySelectorAll('[data-act="theme"]').forEach((b) => b.addEventListener('click', toggleTheme));
    root.querySelectorAll('[data-act="logout"]').forEach((b) => b.addEventListener('click', () => { session.clear(); go('#/login'); }));
    root.querySelectorAll('[data-act="reset"]').forEach((b) => b.addEventListener('click', () => { CJ.api.reset(); toast('Sample data reset'); CJ.render(); }));
  }

  // Demo/screenshot helpers via query string: ?as=<userId>&reset=1&theme=dark
  function applyQuery() {
    const q = new URLSearchParams(location.search);
    if (q.get('data')) localStorage.setItem('cj-data-mode', q.get('data') === 'real' && CJ.REAL_SEED ? 'real' : 'sample'); // ?data=real only works where the local-only seed file exists
    if (q.get('reset') || (q.get('data') && (CJ.api.db() || {}).dataMode !== localStorage.getItem('cj-data-mode'))) CJ.api.reset();
    if (q.get('as')) session.set(q.get('as'));
    if (q.get('co')) CJ.api.setCompanyFilter(q.get('co')); // screenshot helper: owner's company filter (cj | us | all)
    if (q.get('theme')) theme(q.get('theme'));
  }

  Object.assign(CJ, { $, esc, fmtTime, fmtDate, fmtDateLong, fmtDT, hours, fmtDur, toLocalInput, ago, startOfWeek, initials, mBadge, session, toast, modal, logo, themeBtn, go, query: () => new URLSearchParams(location.search) });

  window.addEventListener('hashchange', CJ.render);
  window.addEventListener('DOMContentLoaded', () => { CJ.api.load(); applyQuery(); CJ.render(); setInterval(() => { document.querySelectorAll('[data-live-clock]').forEach((el) => (el.textContent = fmtTime(new Date().toISOString()))); document.querySelectorAll('[data-elapsed]').forEach((el) => (el.textContent = fmtDur(hours(el.dataset.elapsed, new Date().toISOString())))); }, 15000); });
})();
