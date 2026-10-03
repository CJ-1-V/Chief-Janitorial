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
  const siteName = (s) => (!s ? 'Site ?' : s.site_code || ('Site ' + s.site_no));
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
    ST.me = { id: uid, profile: prof, roles, isStaff: !!(prof && prof.is_staff), companies: [...new Set(roles.map((r) => r.company_id))].sort() };
    return ST.me;
  }
  ST.can = (co, list) => !!ST.me && ST.me.roles.some((r) => r.company_id === co && list.includes(r.role));
  ST.canBill = (co) => ST.can(co, ['owner', 'admin', 'billing']);
  ST.canOps = (co) => ST.can(co, ['owner', 'admin', 'ops']);

  // ---------- login / sign-up ----------
  function loginView(msg) {
    return `<div class="auth"><div class="auth-card">
      <div class="auth-logo">${logo('both')}</div>
      <h1>Shift Tracker</h1><p class="muted center small">Chief Janitorial · Unscramble</p>
      <form id="loginForm" class="stack">
        <label class="field"><span>Phone number</span><input name="phone" inputmode="tel" placeholder="902 555 0101" autocomplete="username" required></label>
        <label class="field"><span>Password</span><input name="password" type="password" autocomplete="current-password" required></label>
        <div class="err" id="loginErr">${esc(msg || '')}</div>
        <button class="btn primary big" type="submit">Log in</button>
      </form>
      <p class="muted center">New employee? <a href="#/signup">Create an account</a></p>
      <p class="muted center small">Office staff: type your email address instead of a phone number.<br>Forgot your password? Ask the office.</p>
    </div></div>`;
  }
  function signupView() {
    const co = new URLSearchParams(location.search).get('co');
    return `<div class="auth"><div class="auth-card">
      <div class="auth-logo">${logo('both')}</div>
      <h1>Create employee account</h1>
      <p class="muted">New accounts are checked by your company's office before you can clock in.</p>
      <form id="signupForm" class="stack">
        <label class="field"><span>Your main office (approves your account; you can clock in at any site of either company)</span><select name="company"><option value="cj" ${co === 'cj' ? 'selected' : ''}>Chief Janitorial</option><option value="us" ${co === 'us' ? 'selected' : ''}>Unscramble</option></select></label>
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

  // ---------- router ----------
  const parts = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  ST.render = async function () {
    theme(); const app = $('#app'); const p = parts();
    try {
      if (p[0] === 'signup') { app.innerHTML = signupView(); bindAuth(app); return; }
      const me = await loadMe();
      if (!me || p[0] === 'login') { app.innerHTML = loginView(); bindAuth(app); return; }
      if (!me.profile) { app.innerHTML = loginView('Your account is not set up yet. Ask the office.'); bindAuth(app); await sb.auth.signOut(); return; }
      if (me.profile.status === 'disabled') { app.innerHTML = loginView('This account is turned off. Please contact the office.'); bindAuth(app); await sb.auth.signOut(); return; }
      if (me.isStaff && me.roles.length) { if (p[0] !== 'admin') { location.hash = '#/admin/dashboard'; return; } await ST.adminView(app, p.slice(1)); }
      else { if (p[0] !== 'emp' && me.profile.status === 'active') { location.hash = '#/emp/clock'; return; } await ST.employeeView(app, p.slice(1)); }
      bindGlobal(app);
    } catch (e) { console.error(e); app.innerHTML = `<div class="auth"><div class="auth-card"><h1>Something went wrong</h1><p class="err">${esc(errMsg(e))}</p><button class="btn primary big" onclick="location.reload()">Try again</button> <button class="btn ghost big" data-act="logout">Log out</button></div></div>`; bindGlobal(app); }
  };
  function bindGlobal(root) {
    root.querySelectorAll('[data-act="theme"]').forEach((b) => b.addEventListener('click', () => { theme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); ST.render(); }));
    root.querySelectorAll('[data-act="logout"]').forEach((b) => b.addEventListener('click', async () => { await sb.auth.signOut(); location.hash = '#/login'; ST.render(); }));
  }
  Object.assign(ST, { who, siteName, $, esc, fmtTime, fmtDate, fmtDateLong, fmtDay, fmtDT, hours, fmtDur, money, initials, mBadge, COMPANIES, unpaidBreak, phoneDigits, errMsg, toast, modal, logo, themeBtn, q, download, csv, bindGlobal, tz: () => window.CJ.tz });
  window.addEventListener('hashchange', () => ST.render());
  window.addEventListener('DOMContentLoaded', () => { ST.render(); setInterval(() => { document.querySelectorAll('[data-live-clock]').forEach((el) => (el.textContent = fmtTime(new Date().toISOString()))); document.querySelectorAll('[data-elapsed]').forEach((el) => (el.textContent = fmtDur(hours(el.dataset.elapsed, new Date().toISOString())))); }, 15000); });
})();
