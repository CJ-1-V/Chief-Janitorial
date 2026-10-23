/* v2-twostep.js – twostep1 (Oct 23 2026). Loaded last. TEST COPY until the owner OKs it.
   2-step sign-in: after the password, a 6-digit code is emailed from admin@unscramble.ca (text if no email and texting is on).
   - Required: office logins (owner, office, billing, Office Assistant) and farm logins. Optional (off by default): employees, workers, subs (Profile switch).
   - Code: 10 minutes, 5 wrong tries, new code after 60 s, at most 5 codes an hour. "Remember this device" = 30 days.
   - LIVE: only when REG_STORE.twoStep === true (migration 027i + reg-messages actions mfa_check / mfa_send / mfa_verify).
     The server decides and records "verified"; this screen only asks. No email and no texting = let in + flagged (no lockout).
   - Mock (?store=mock): the code is shown on screen (nothing is sent). Replaces the old mock pre-sign-in 2-step path. */
'use strict';
(function () {
  var MIN = 10, TRIES = 5, WAIT = 60, HOUR_MAX = 5, DAYS = 30;
  function E(s) { return typeof esc === 'function' ? esc(s) : String(s); }
  function live() { return !!(window.REG_LIVE && window.REG_SB); }
  function on() { return live() ? !!(window.REG_STORE && window.REG_STORE.twoStep === true) : true; }
  function realMe() { var r = ME; try { if (ME && ME.__swReal) r = ME.__swReal; } catch (e) { } return r; }
  function required(u) { return !!u && (u.type === 'admin' || u.type === 'firm'); }
  function optional(u) { return !!u && ['employee', 'worker', 'sub', 'tester'].indexOf(u.type) >= 0; }
  function wants(u) { if (live()) return !!u; return required(u) || (optional(u) && u.mfaOpt === true); }
  function K(u) { return 'reg-mfa-ok:' + (u && u.id); }
  function devTok() { var t = ''; try { t = localStorage.getItem('reg-mfa-dev') || ''; if (!/^dev_[A-Za-z0-9_-]{32,}$/.test(t)) { var a = new Uint8Array(24); crypto.getRandomValues(a); t = 'dev_' + Array.prototype.map.call(a, function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); localStorage.setItem('reg-mfa-dev', t); } } catch (e) { } return t; }
  function devLabel() { var n = navigator.userAgent || ''; return (/iPhone|iPad/.test(n) ? 'iPhone/iPad' : /Android/.test(n) ? 'Android' : /Mac/.test(n) ? 'Mac' : /Windows/.test(n) ? 'Windows' : 'Browser') + ' – ' + new Date().toLocaleDateString(); }
  var S = { uid: null, state: 'idle', to: '', waitUntil: 0, msg: '', bad: false, skipped: '' };   // live: idle|checking|need|ok
  function verified(u) {
    u = u || realMe(); if (!u || !on() || !wants(u)) return true;
    if (live()) return S.uid === u.id && S.state === 'ok';
    try { return sessionStorage.getItem(K(u)) === '1'; } catch (e) { return false; }
  }
  function gated() { return !!ME && !verified(); }
  window.REG_TWOSTEP = { gated: gated, required: required };

  // ---- old mock path off (it asked for the code before sign-in, and only when u.twoStep was on) ----
  function migrateMock() { if (live() || !window.DB || !DB.users) return; DB.users.forEach(function (u) { if (u.twoStep) { if (optional(u)) u.mfaOpt = true; delete u.twoStep; } }); }
  try { migrateMock(); } catch (e) { }
  if (FORMS.login) { var oLogin = FORMS.login; FORMS.login = function () { try { migrateMock(); } catch (e) { } return oLogin.apply(this, arguments); }; }
  ACT.toggle2fa = function () { toast('2-step sign-in is always on for office and farm logins.'); };

  // ---- mock code store (DB.mfaCodes / DB.mfaDevices) ----
  function mockState(u) { DB.mfaCodes = DB.mfaCodes || {}; return DB.mfaCodes[u.id] || (DB.mfaCodes[u.id] = { sends: 0, win: 0 }); }
  function mockTrusted(u) { var t = devTok(), now = Date.now(); return (DB.mfaDevices || []).some(function (x) { return x.uid === u.id && x.dev === t && x.exp > now; }); }
  function mockSend(u) {
    var c = mockState(u), now = Date.now();
    if (c.last && now - c.last < WAIT * 1000) return { ok: false, wait: Math.ceil((c.last + WAIT * 1000 - now) / 1000) };
    if (now - (c.win || 0) > 3600000) { c.win = now; c.sends = 0; }
    if (c.sends >= HOUR_MAX) return { ok: false, error: 'Too many codes in the last hour. Please try again later, or call the office.' };
    c.code = String(100000 + Math.floor(Math.random() * 900000)); c.exp = now + MIN * 60000; c.tries = 0; c.last = now; c.sends++;
    (DB.apOutbox = DB.apOutbox || []).unshift({ id: uid('mail'), userId: u.id, from: 'UnScramble <admin@unscramble.ca>', to: u.email || u.phone || '', toName: u.name,
      subject: 'Your UnScramble sign-in code: ' + c.code, body: 'Your UnScramble sign-in code: ' + c.code + '\n\nEnter it within ' + MIN + ' minutes.', at: new Date().toISOString(), by: 'system', test: true });
    save(); return { ok: true };
  }
  function mask(u) { var e = String(u.email || ''); if (/@/.test(e) && !/@example\.com$/i.test(e)) { var p = e.split('@'); return p[0].charAt(0) + '•••@' + p[1]; } var d = String(u.phone || '').replace(/\D/g, ''); return d ? '•••-•••-' + d.slice(-4) : 'your account'; }

  // ---- live calls ----
  function call(body) { return window.REG_SB.functions.invoke('reg-messages', { body: body }).then(function (r) { if (r && r.data) return r.data; var c = r && r.error && r.error.context; return c && c.json ? c.json().catch(function () { return { ok: false }; }) : { ok: false }; }, function () { return { ok: false, error: 'No connection. Please try again.' }; }); }
  function liveCheck() {
    var u = realMe(); if (!u) return; S.uid = u.id; S.state = 'checking';
    call({ action: 'mfa_check', device: devTok() }).then(function (x) {
      if (x && x.ok && x.verified) { if (typeof x.optional_on === 'boolean') u.mfaOpt = x.optional_on; S.state = 'ok'; S.skipped = x.skipped || ''; render(); return; }
      if (x && x.ok) { S.state = 'need'; S.to = x.to || ''; render(); if (!S.sentOnce) { S.sentOnce = true; send(); } return; }
      S.state = 'need'; S.msg = (x && x.error) || 'Could not check. Please reload.'; S.bad = true; render();
    });
  }
  function send() {
    var u = realMe(); if (!u) return;
    if (!live()) { var r = mockSend(u); if (r.ok) { S.waitUntil = Date.now() + WAIT * 1000; S.msg = 'Code sent to ' + mask(u) + '.'; S.bad = false; } else { if (r.wait) S.waitUntil = Date.now() + r.wait * 1000; S.msg = r.error || ('Please wait ' + r.wait + ' seconds before asking for a new code.'); S.bad = !!r.error; } render(); return; }
    S.msg = 'Sending…'; S.bad = false; render();
    call({ action: 'mfa_send' }).then(function (x) {
      if (x && x.ok) { S.to = x.to || S.to; S.waitUntil = Date.now() + (x.wait || WAIT) * 1000; S.msg = 'Code sent to ' + (x.to || 'your email') + '.'; S.bad = false; }
      else { if (x && x.wait) S.waitUntil = Date.now() + x.wait * 1000; S.msg = (x && x.error) || 'We could not send the code. Please try again.'; S.bad = true; }
      render();
    });
  }
  function passed(u, how, remember) {
    try { audit('Signed in – 2-step code OK', u.name, how + (remember ? ', device remembered 30 days' : '')); } catch (e) { }
    toast('Signed in.'); S.msg = ''; go('#/home'); render();
  }

  // ---- the screen ----
  function VIEW() {
    var u = realMe(), test = !live(), c = test ? mockState(u) : null;
    if (live() && S.state === 'checking') return '<div class="login-wrap"><div class="card" id="tsCard"><h1>2-step sign-in</h1><p>Checking…</p></div></div>';
    var left = Math.max(0, Math.ceil((S.waitUntil - Date.now()) / 1000));
    return '<div class="login-wrap"><div class="card" id="tsCard"><h1>2-step sign-in</h1>' +
      '<p>For your security we sent a 6-digit code to <b>' + E(test ? mask(u) : (S.to || 'your email')) + '</b> from admin@unscramble.ca. Enter it below. It works for ' + MIN + ' minutes.</p>' +
      (test && c && c.code ? '<div class="alert info small" id="tsTest"><b>Test version:</b> nothing is really sent. The code is <b>' + c.code + '</b></div>' : '') +
      (S.msg ? '<div class="alert ' + (S.bad ? 'bad' : 'ok') + ' small" id="tsMsg">' + E(S.msg) + '</div>' : '') +
      '<form data-form="twostep"><label>6-digit code<input name="code" required inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" data-autofocus></label>' +
      '<label class="small" style="display:flex;gap:6px;align-items:center;margin:8px 0"><input type="checkbox" name="remember" value="1" style="width:auto"> Remember this device for ' + DAYS + ' days</label>' +
      '<button>Verify and sign in</button></form>' +
      '<div class="row" style="margin-top:10px;gap:8px;flex-wrap:wrap"><button class="sec small" data-act="tsresend" id="tsResend"' + (left ? ' disabled' : '') + '>' + (left ? 'Send a new code in <span id="tsLeft">' + left + '</span> s' : 'Send a new code') + '</button>' +
      '<button class="sec small" data-act="logout">Sign out</button></div>' +
      '<p class="small muted" style="margin-top:10px">No code? Check spam, or call the office. Did not try to sign in? Change your password.</p></div></div>';
  }
  var tick = null;
  function ticker() { clearInterval(tick); tick = setInterval(function () { var b = document.getElementById('tsResend'); if (!b) { clearInterval(tick); return; } var l = Math.max(0, Math.ceil((S.waitUntil - Date.now()) / 1000)); if (l) { var s = document.getElementById('tsLeft'); if (s) s.textContent = l; } else { b.disabled = false; b.textContent = 'Send a new code'; clearInterval(tick); } }, 1000); }
  function prep(u) {   // runs inside render; never calls render itself
    if (live()) { if (S.uid !== u.id) S = { uid: u.id, state: 'idle', to: '', waitUntil: 0, msg: '', bad: false }; if (S.state === 'idle') { S.state = 'checking'; setTimeout(liveCheck, 0); } return; }
    if (sessionStorage.getItem(K(u)) === '1') return;
    if (mockTrusted(u)) { sessionStorage.setItem(K(u), '1'); try { audit('Signed in – remembered device', u.name); } catch (e) { } return; }
    if (S.uid !== u.id) { S = { uid: u.id, waitUntil: 0, msg: '', bad: false }; var c = mockState(u); if (!c.code || Date.now() > c.exp) { var r = mockSend(u); if (r.ok) { S.waitUntil = Date.now() + WAIT * 1000; S.msg = 'Code sent to ' + mask(u) + '.'; } } }
  }
  var ol = layout;
  layout = function (c) {
    if (ME && on() && wants(realMe())) { prep(realMe()); if (gated()) { setTimeout(function () { var i = document.querySelector('#tsCard [data-autofocus]'); if (i && document.activeElement !== i) try { i.focus(); } catch (e) { } ticker(); }, 0); return VIEW(); } }
    return ol.apply(this, arguments);
  };
  var og = gateRoute; gateRoute = function (h) { return gated() ? '#/home' : og(h); };
  var oa = actionAllowed; actionAllowed = function (name, kind) { if (gated()) return ['twostep', 'tsresend', 'logout', 'closeModal'].indexOf(name) >= 0; return oa(name, kind); };
  ACT.tsresend = function () { send(); };
  FORMS.twostep = function (f, d) {
    var u = realMe(), code = String(d.code || '').replace(/\D/g, ''), rem = !!d.remember;
    if (code.length !== 6) { S.msg = 'Enter the 6-digit code.'; S.bad = true; render(); return; }
    if (live()) {
      call({ action: 'mfa_verify', code: code, remember: rem, device: devTok(), label: devLabel() }).then(function (x) {
        if (x && x.ok) { S.state = 'ok'; passed(u, 'emailed code', rem); } else { S.msg = (x && x.error) || 'That code is not right.'; S.bad = true; render(); }
      }); return;
    }
    var c = mockState(u), now = Date.now();
    if (!c.code || now > c.exp) { c.code = null; S.msg = 'That code has expired. Please send a new code.'; S.bad = true; save(); render(); return; }
    if (c.tries >= TRIES) { S.msg = 'Too many wrong codes. Please send a new code.'; S.bad = true; render(); return; }
    if (code !== c.code) { c.tries++; try { logLogin(u, u.username || u.email, false, 'Wrong 2-step code'); } catch (e) { } save();
      if (c.tries >= TRIES) { c.code = null; S.msg = 'Too many wrong codes. Please send a new code.'; } else S.msg = 'That code is not right. ' + (TRIES - c.tries) + ' tries left.';
      S.bad = true; render(); return; }
    c.code = null; sessionStorage.setItem(K(u), '1');
    if (rem) { DB.mfaDevices = (DB.mfaDevices || []).filter(function (x) { return !(x.uid === u.id && x.dev === devTok()); }); DB.mfaDevices.push({ uid: u.id, dev: devTok(), label: devLabel(), exp: now + DAYS * 86400000 }); }
    save(); passed(u, 'emailed code (test)', rem);
  };
  if (ACT.logout) { var lo = ACT.logout; ACT.logout = function () { try { var u = realMe(); if (u) sessionStorage.removeItem(K(u)); } catch (e) { } S = { uid: null, state: 'idle', waitUntil: 0, msg: '' }; return lo.apply(this, arguments); }; }

  // ---- Profile: optional switch + forget devices (replaces the old mock card) ----
  var opf = VIEWS.profile;
  VIEWS.profile = function () {
    var x = String(opf.apply(this, arguments)), u = realMe();
    x = x.replace(/<div class="card"><h3 style="margin-top:0">2-step sign-in \(optional\)<\/h3>[\s\S]*?data-act="my2fa">[^<]*<\/button><\/div>/, '');
    if (!u || !on()) return x;
    var card = '<div class="card" id="tsProfile"><h3 style="margin-top:0">2-step sign-in</h3>';
    if (required(u)) card += '<p class="small">Always on for office and farm logins: after your password we email a 6-digit code.</p>';
    else card += '<p class="small">Optional for you. When on, signing in also needs a 6-digit code sent to your email.</p><button class="sec" data-act="tsopt">' + (u.mfaOpt ? 'Turn 2-step sign-in OFF' : 'Turn 2-step sign-in ON') + '</button> ';
    card += '<button class="sec" data-act="tsforget">Forget remembered devices</button></div>';
    return x + card;
  };
  ACT.my2fa = function () { ACT.tsopt(); };
  ACT.tsopt = function () {
    var u = realMe(); if (!optional(u)) return; var v = !u.mfaOpt;
    if (live()) { window.REG_SB.rpc('reg_mfa_set_optional', { p_on: v }).then(function (r) { if (r.error) { toast('Could not change it. Please try again.'); return; } u.mfaOpt = v; S.state = 'ok'; S.uid = u.id; toast('2-step sign-in is ' + (v ? 'ON' : 'OFF') + '.'); render(); }); return; }
    u.mfaOpt = v; if (v) sessionStorage.setItem(K(u), '1'); audit('2-step sign-in ' + (v ? 'turned on' : 'turned off'), u.name); save(); toast('2-step sign-in is ' + (v ? 'ON' : 'OFF') + '.'); render();
  };
  ACT.tsforget = function () {
    var u = realMe(); if (!u) return;
    if (live()) { window.REG_SB.rpc('reg_mfa_forget_devices').then(function (r) { toast(r.error ? 'Could not do it. Please try again.' : 'Remembered devices forgotten. Next sign-in asks for a code.'); }); return; }
    DB.mfaDevices = (DB.mfaDevices || []).filter(function (x) { return x.uid !== u.id; }); save(); toast('Remembered devices forgotten. Next sign-in asks for a code.');
  };
  if (typeof ROLE_ONLY === 'object') ROLE_ONLY.tsopt = ['employee', 'worker', 'sub', 'tester'];
})();
