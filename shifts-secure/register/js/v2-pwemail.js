/* v2-pwemail.js – Password reset by email (owner request Oct 5, 2026, 1:51 AM Toronto). TEST ONLY – loaded last.
   1) Self-service "Forgot password?": person enters email / phone / username. App ALWAYS shows the same neutral
      message. Mock mode "sends" a 6-digit code (15 min, max 5 tries) to the account's real contact email into the
      test outbox – never reveals whether an account exists. Accounts with no real email get the same message
      (office must reset). Rate limit: 3 requests per account per hour.
   2) Office "Email the temporary password": after Reset password, preview-before-send (same pattern as welcome
      email) alongside Copy. TEST: lands in Outbox (test), password masked there; never logged.
   Flags: window.REG_FEATURES.forgotPassword / resetEmail (default on in the test copy). Live gates them in
   store-config.js. */
'use strict';
(function () {
  if (typeof ACT !== 'object' || typeof FORMS !== 'object' || typeof VIEWS !== 'object') return;
  var FEAT = window.REG_FEATURES || (window.REG_FEATURES = {});
  /* Live: flags come from store-config.js. Test copy (no store-config): default ON. */
  if (window.REG_STORE) {
    if (FEAT.forgotPassword == null) FEAT.forgotPassword = !!window.REG_STORE.forgotPassword;
    if (FEAT.resetEmail == null) FEAT.resetEmail = !!window.REG_STORE.resetEmail;
  } else {
    if (FEAT.forgotPassword == null) FEAT.forgotPassword = true;
    if (FEAT.resetEmail == null) FEAT.resetEmail = true;
  }

  var LOGIN_URL = 'https://www.chiefjanitorial.com/shifts-secure/register/';
  var FROM = 'UnScramble <admin@unscramble.ca>';
  var CODE_MIN = 15, CODE_TRIES = 5, REQ_PER_HOUR = 3;
  function live() { return !!(window.REG_STORE && window.REG_STORE.mode === 'supabase'); }
  function digits10(s) {
    var d = String(s || '').replace(/\D/g, '');
    if (d.length === 11 && d[0] === '1') d = d.slice(1);
    return d.length === 10 ? d : '';
  }
  function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || '').trim()); }
  /* Live: reject synthetic auth emails (phone@loginDomain / u-name@loginDomain). Test seed uses @example.com as real contact emails. */
  function realEmail(u) {
    if (!u) return '';
    var e = String(u.email || '').trim().toLowerCase();
    if (!e || !validEmail(e)) return '';
    if (live()) {
      var dom = String((window.REG_STORE && window.REG_STORE.loginDomain) || 'example.com').toLowerCase();
      if (e.slice(-dom.length - 1) === '@' + dom) return '';
    }
    return e;
  }
  function firstName(u) {
    return (u.profile && u.profile.firstName) || String(u.name || '').split(/\s+/)[0] || 'there';
  }
  function findAccount(login) {
    var s = String(login || '').trim().toLowerCase();
    if (!s) return null;
    var ph = digits10(s);
    return DB.users.filter(function (u) {
      if (u.username && u.username.toLowerCase() === s) return true;
      if (u.email && u.email.toLowerCase() === s) return true;
      if (ph && digits10(u.phone) === ph) return true;
      if (ph && u.company && digits10(u.company.phone) === ph) return true;
      if (ph && u.profile && digits10(u.profile.phone) === ph) return true;
      return false;
    })[0] || null;
  }
  function genCode() {
    var a = new Uint32Array(1);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return String(100000 + (a[0] % 900000));
  }
  function ensureOutbox() { DB.apOutbox = DB.apOutbox || []; return DB.apOutbox; }
  var CODE_MEM = {};                                      /* plaintext codes: memory only, never saved */
  function ensureForgot() {
    DB.forgotAttempts = DB.forgotAttempts || [];
    DB.forgotCodes = DB.forgotCodes || [];                 /* metadata only (no plaintext code) */
    return DB;
  }
  function hashCode(c) { return hashPw('reset-code:' + String(c || '')); }
  function maskCode(body, code) { return code ? String(body).split(code).join('••••••') : body; }
  function maskPw(body, pw) { return pw ? String(body).split(pw).join('••••-••••-••••') : body; }
  function emailHtml(m, id) {
    return '<div class="ap-email" id="' + (id || 'pwemail') + '"><div class="ap-hdr"><div><span>From</span><b>' + esc(m.from) +
      '</b></div><div><span>To</span><b>' + esc(m.toName) + ' &lt;' + esc(m.to) + '&gt;</b></div><div><span>Subject</span><b>' +
      esc(m.subject) + '</b></div></div><pre class="ap-body">' + esc(m.body) + '</pre></div>';
  }
  function rateOk(userId) {
    ensureForgot();
    var cut = Date.now() - 60 * 60000;
    var n = DB.forgotAttempts.filter(function (a) { return a.userId === userId && a.atMs > cut && a.kind === 'request'; }).length;
    return n < REQ_PER_HOUR;
  }
  function recordAttempt(kind, login, userId, detail) {
    ensureForgot();
    DB.forgotAttempts.unshift({
      id: uid('fa'), kind: kind, login: String(login || '').slice(0, 80), userId: userId || null,
      detail: detail || '', at: new Date().toISOString(), atMs: Date.now()
    });
    if (DB.forgotAttempts.length > 500) DB.forgotAttempts.length = 500;
  }

  /* ---------- Self-service forgot password ---------- */
  var NEUTRAL = 'If we find an account with that login, we\'ll email a short reset code to the email on file. ' +
    'Codes expire in ' + CODE_MIN + ' minutes. If you don\'t get an email, check spam or contact the UnScramble office' +
    ' (' + ADMIN_EMAIL + ').';

  function forgotEmail(u, code) {
    var body = 'Hello ' + firstName(u) + ',\n\nSomeone asked to reset the password for your UnScramble account' +
      (u.username ? ' (' + u.username + ')' : '') + '.\n\nYour reset code: ' + code + '\n\n' +
      'Enter this code on the password-reset screen within ' + CODE_MIN + ' minutes, then choose a new password.\n\n' +
      'If you did not ask for this, you can ignore this email – your password stays the same. ' +
      'For help, contact the UnScramble office at ' + ADMIN_EMAIL + '.\n\nUnScramble – The HR Company Inc.';
    return { from: FROM, to: realEmail(u), toName: u.name, subject: 'Your UnScramble password reset code', body: body };
  }

  function showNeutral(login) {
    PAGE_STATE.reset = { step: 'sent', login: String(login || '').trim(), at: Date.now() };
    render();
  }

  function showCodeForm() {
    var st = PAGE_STATE.reset;
    return '<div class="login-wrap"><div class="card pwforgot" data-step="code"><h1>Enter reset code</h1>' +
      '<div class="alert info">' + esc(NEUTRAL) + '</div>' +
      (st && st.mockHint ? '<div class="alert warn small" id="pwmockhint"><b>TEST:</b> nothing is really sent. The reset email to <b>' +
        esc(st.mockHint.to) + '</b> would contain code <b>' + esc(st.mockHint.code) +
        '</b> (also in Outbox (test); code never stored in the audit log).</div>' : '') +
      '<form data-form="reset2">' +
      inp('code', '6-digit code', '', { req: true, extra: ' inputmode="numeric" maxlength="6" data-autofocus autocomplete="one-time-code"' }) +
      inp('pw', 'New password', '', { type: 'password', req: true }) +
      inp('pw2', 'Repeat new password', '', { type: 'password', req: true, extra: ' autocomplete="new-password"' }) +
      '<button>Set new password</button></form>' +
      '<p class="small muted"><a href="#/forgot" data-act="pwforgotagain">Request another code</a> · <a href="#/">Back to sign in</a></p></div></div>';
  }

  if (FEAT.forgotPassword) {
    VIEWS.forgot = function () {
      var st = PAGE_STATE.reset;
      if (st && st.step === 'sent') return showCodeForm();
      return '<div class="login-wrap"><div class="card pwforgot" data-step="request"><h1>Forgot your password?</h1>' +
        '<p>Enter the email, phone number or username you use to sign in. We never say whether an account was found.</p>' +
        '<form data-form="reset1">' +
        inp('login', 'Email, phone or username', '', { req: true, extra: ' data-autofocus autocomplete="username"' }) +
        '<button>Email me a reset code</button></form>' +
        '<p class="small muted">If there is no email on your account, please contact the UnScramble office – they can give you a temporary password.</p>' +
        '<p><a href="#/">Back to sign in</a></p></div></div>';
    };

    FORMS.reset1 = function (f, d) {
      var login = String(d.login || '').trim();
      if (!login) { toast('Enter your email, phone or username.'); return; }
      if (live()) {
        if (typeof window.REG_FORGOT_REQUEST !== 'function') {
          toast('Password reset by email is not switched on for the live site yet. Please contact the office.');
          return;
        }
        var btn = f.querySelector('button'); if (btn) btn.disabled = true;
        Promise.resolve(window.REG_FORGOT_REQUEST(login)).then(function (r) {
          if (btn) btn.disabled = false;
          if (r && r.error) { toast(r.error); return; }
          showNeutral(login);
        }, function (e) { if (btn) btn.disabled = false; toast(String(e && e.message || e)); });
        return;
      }
      /* MOCK: always the same UI outcome; never reveal whether found / has email */
      ensureForgot();
      var u = findAccount(login);
      var em = realEmail(u);
      recordAttempt('request', login, u && u.id, u ? (em ? 'would email contact on file' : 'no real email on file') : 'no account');
      audit('Password reset requested', u ? u.name : '(unknown)', 'login typed · TEST mock · ' +
        (u ? (em ? 'reset code would go to the email on file' : 'no real email – office reset needed') : 'no matching account') +
        ' (existence not revealed to the person)');
      if (u && em && rateOk(u.id)) {
        var code = genCode();
        DB.forgotCodes = DB.forgotCodes.filter(function (c) { return c.userId !== u.id; });
        delete CODE_MEM[u.id];
        DB.forgotCodes.unshift({
          userId: u.id, codeHash: hashCode(code), tries: 0, exp: Date.now() + CODE_MIN * 60000, at: new Date().toISOString(), login: login
        });
        CODE_MEM[u.id] = code;
        var m = forgotEmail(u, code);
        ensureOutbox().unshift({
          id: uid('mail'), userId: u.id, kind: 'forgot', from: m.from, to: m.to, toName: m.toName,
          subject: m.subject, body: maskCode(m.body, code), at: new Date().toISOString(), by: '(self-service)', test: true
        });
        if (DB.apOutbox.length > 200) DB.apOutbox.length = 200;
        PAGE_STATE.reset = {
          step: 'sent', login: login, uid: u.id, at: Date.now(),
          mockHint: { to: em, code: code }               /* TEST only – shown on screen like 2-step codes */
        };
        save();
        render();
        return;
      }
      if (u && em && !rateOk(u.id)) {
        recordAttempt('rate', login, u.id, 'rate limited');
        /* still the same neutral screen – do not say "too many" specifically tied to the account */
      }
      save();
      showNeutral(login);
    };

    FORMS.reset2 = function (f, d) {
      var st = PAGE_STATE.reset;
      if (!st || st.step !== 'sent') { go('#/forgot'); return; }
      if (d.pw !== d.pw2) { toast('Passwords do not match.'); return; }
      if (live()) {
        if (typeof window.REG_FORGOT_CONFIRM !== 'function') {
          toast('Password reset by email is not switched on for the live site yet.');
          return;
        }
        var btn = f.querySelector('button'); if (btn) btn.disabled = true;
        Promise.resolve(window.REG_FORGOT_CONFIRM(st.login, d.code, d.pw)).then(function (r) {
          if (btn) btn.disabled = false;
          if (r && r.error) { toast(r.error); return; }
          PAGE_STATE.reset = null;
          toast('Password changed. Please sign in.');
          go('#/');
        }, function (e) { if (btn) btn.disabled = false; toast(String(e && e.message || e)); });
        return;
      }
      ensureForgot();
      var uid = st.uid || (findAccount(st.login) && findAccount(st.login).id);
      var row = uid && DB.forgotCodes.filter(function (c) { return c.userId === uid; })[0];
      if (!row || !CODE_MEM[row.userId]) {
        toast('That code is not valid or has expired. Request a new one, or contact the office.');
        recordAttempt('confirm_fail', st.login, null, 'no active code');
        save();
        return;
      }
      if (Date.now() > row.exp) {
        DB.forgotCodes = DB.forgotCodes.filter(function (c) { return c !== row; });
        delete CODE_MEM[row.userId];
        toast('That code has expired. Please request a new one.');
        recordAttempt('confirm_fail', st.login, row.userId, 'expired');
        PAGE_STATE.reset = null; save(); go('#/forgot'); return;
      }
      if (hashCode(d.code) !== row.codeHash && String(d.code || '') !== CODE_MEM[row.userId]) {
        row.tries = (row.tries || 0) + 1;
        recordAttempt('confirm_fail', st.login, row.userId, 'wrong code');
        if (row.tries >= CODE_TRIES) {
          DB.forgotCodes = DB.forgotCodes.filter(function (c) { return c !== row; });
          delete CODE_MEM[row.userId];
          toast('Too many wrong codes. Please request a new one.');
          PAGE_STATE.reset = null; save(); go('#/forgot'); return;
        }
        save(); toast('Wrong code.'); return;
      }
      var u = user(row.userId);
      if (!u) { toast('That code is not valid or has expired.'); PAGE_STATE.reset = null; save(); go('#/forgot'); return; }
      var chk = typeof pwCheck === 'function' ? pwCheck(d.pw, u) : { ok: d.pw && d.pw.length >= 10, msgs: [] };
      if (!chk.ok) { toast('Password needs: ' + (chk.msgs || []).join(', ') + '.'); return; }
      if (hashPw(d.pw) === u.passHash) { toast('Choose a different password.'); return; }
      u.passHash = hashPw(d.pw); u.mustChangePw = false; u.failed = 0; u.lockedUntil = 0;
      DB.forgotCodes = DB.forgotCodes.filter(function (c) { return c.userId !== u.id; });
      delete CODE_MEM[u.id];
      recordAttempt('confirm_ok', st.login, u.id, 'password changed');
      audit('Password reset by email', u.name, 'self-service reset code · TEST mock (code and new password never logged)');
      PAGE_STATE.reset = null; save();
      toast('Password changed. Please sign in.'); go('#/');
    };

    ACT.pwforgotagain = function () { PAGE_STATE.reset = null; go('#/forgot'); };
  }

  /* ---------- Office: Email the temporary password (preview-before-send) ---------- */
  var TEMP_EMAIL = {};                                       /* memory only: {id: {pw, at, sentAt}} */
  function tempEmailGet(id) {
    var t = TEMP_EMAIL[id];
    if (t && Date.now() - t.at > 30 * 60000) { delete TEMP_EMAIL[id]; return null; }
    return t || null;
  }
  function officeTempEmail(u, pw) {
    var body = 'Hello ' + firstName(u) + ',\n\nThe UnScramble office reset the password for your account' +
      (u.username ? ' (' + u.username + ')' : '') + '.\n\n' +
      'Sign in here: ' + LOGIN_URL + '\nUsername: ' + (u.username || u.email || '') + '\nTemporary password: ' + pw + '\n\n' +
      'You can also sign in with the email on your account instead of the username.\n\n' +
      'The first time you sign in you must choose your own new password. The temporary password stops working after that.\n\n' +
      'Please do not share this email. If you did not expect it, contact the UnScramble office at ' + ADMIN_EMAIL + '.\n\n' +
      'UnScramble – The HR Company Inc.';
    return {
      from: FROM, to: realEmail(u), toName: u.name,
      subject: 'Your UnScramble temporary password', body: body
    };
  }

  if (FEAT.resetEmail) {
    ['pwemail', 'pwemailsend', 'pwemailback'].forEach(function (a) {
      if (typeof ADMIN_ONLY_ACT !== 'undefined' && ADMIN_ONLY_ACT.indexOf(a) < 0) ADMIN_ONLY_ACT.push(a);
    });

    var origShow = window.showTempPassword;
    window.showTempPassword = function (u, pw) {
      if (u && pw) TEMP_EMAIL[u.id] = { pw: pw, at: Date.now(), sentAt: null };
      if (typeof origShow === 'function') origShow(u, pw);
      else {
        modal('<div class="pwreset" data-step="done"><h2>Temporary password for ' + esc(u ? u.name : 'the person') + '</h2>' +
          '<div class="tpw-box"><code class="tpw" id="tpw">' + esc(pw) + '</code></div>' +
          '<div class="row pwreset-actions"><button type="button" class="tpw-copy" data-act="pwcopy">Copy</button></div>' +
          '<div class="row pwreset-actions"><button type="button" class="sec" data-act="closeModal">Done</button></div></div>');
      }
      try {
        var m = document.querySelector('#modal .pwreset[data-step=done]');
        if (!m || !u) return;
        var actions = m.querySelector('.pwreset-actions');
        if (!actions) return;
        /* insert Email button after Copy row */
        if (!m.querySelector('[data-act=pwemail]')) {
          var row = document.createElement('div');
          row.className = 'row pwreset-actions';
          var can = !!realEmail(u);
          row.innerHTML = '<button type="button" data-act="pwemail" data-id="' + u.id + '"' + (can ? '' : ' disabled title="No real email on this account"') +
            '>Email the temporary password</button>' +
            (can ? '' : '<span class="small muted">No email on file – use Copy, or ask them for an email first.</span>');
          var note = m.querySelector('.tpw-note');
          if (note && note.parentNode) note.parentNode.insertBefore(row, note);
          else actions.parentNode.insertBefore(row, actions.nextSibling);
        }
      } catch (e) {}
    };

    ACT.pwemail = function (el) {
      var u = user(el.dataset.id), t = u && tempEmailGet(u.id);
      if (!u) return;
      if (!t) { toast('The temporary password is no longer in memory. Reset again.'); return; }
      var em = realEmail(u);
      if (!em) { toast('This person has no valid email. Use Copy instead.'); return; }
      var m = officeTempEmail(u, t.pw);
      modal('<div class="pwreset addperson-result" data-step="email" id="pwemailprev" data-id="' + u.id + '">' +
        '<h2>Email the temporary password to ' + esc(u.name) + '?</h2>' +
        '<h3>Exactly what will be sent</h3>' + emailHtml(m, 'pwtempmail') +
        (t.sentAt
          ? '<div class="alert ok small">✓ Already emailed to ' + esc(em) + ' at ' + esc(fmtStamp(t.sentAt)) +
            (live() ? '' : ' – TEST: placed in "Outbox (test)", not really sent') + '.</div>'
          : '<div class="alert warn small">Nothing has been sent yet. The email goes out only when you click <b>Send email</b>.' +
            (live() ? '' : ' (TEST: it goes to "Outbox (test)" – never really sent.)') + '</div>') +
        '<div class="row pwreset-actions ap-actions">' +
        '<button type="button" data-act="pwemailsend" data-id="' + u.id + '"' + (t.sentAt ? ' disabled' : '') + '>' +
        (t.sentAt ? 'Sent ✓' : 'Send email') + '</button>' +
        '<button type="button" class="sec" data-act="pwemailback" data-id="' + u.id + '">Back</button>' +
        '<button type="button" class="sec" data-act="closeModal">Done</button></div>' +
        '<div class="small muted">The temporary password is shown only in this preview (kept in memory briefly, never saved). Password is never written to the audit log.</div></div>');
    };

    ACT.pwemailback = function (el) {
      var u = user(el.dataset.id), t = u && tempEmailGet(u.id);
      if (u && t) window.showTempPassword(u, t.pw);
      else closeModal();
    };

    ACT.pwemailsend = function (el) {
      var u = user(el.dataset.id), t = u && tempEmailGet(u.id);
      if (!u || !t) { toast('The temporary password is no longer in memory. Reset again.'); return; }
      if (t.sentAt) { toast('Already sent.'); return; }
      var em = realEmail(u);
      if (!em) { toast('This person has no valid email. Use Copy instead.'); return; }
      el.disabled = true;
      var done = function () {
        t.sentAt = new Date().toISOString();
        if (!live()) {
          audit('Temporary password emailed', u.name, 'to ' + em + ' · TEST outbox – not really sent · by ' +
            (ME ? ME.name : 'office') + ' (password not logged)');
        }
        save();
        toast(live() ? 'Temporary password emailed.' : 'Email placed in the test outbox (not really sent).');
        ACT.pwemail({ dataset: { id: u.id } });
      };
      if (live()) {
        if (typeof window.REG_SEND_TEMP_PW !== 'function') {
          el.disabled = false;
          toast('Emailing the temporary password is not switched on for the live site yet. Use Copy.');
          return;
        }
        Promise.resolve(window.REG_SEND_TEMP_PW(u.id, t.pw)).then(function (r) {
          if (r && r.error) { el.disabled = false; toast(r.error); return; }
          done();
        }, function (e) { el.disabled = false; toast(String(e && e.message || e)); });
        return;
      }
      var m = officeTempEmail(u, t.pw);
      ensureOutbox().unshift({
        id: uid('mail'), userId: u.id, kind: 'temp-pw', from: m.from, to: m.to, toName: m.toName,
        subject: m.subject, body: maskPw(m.body, t.pw), at: new Date().toISOString(),
        by: ME ? ME.name : 'office', test: true
      });
      if (DB.apOutbox.length > 200) DB.apOutbox.length = 200;
      done();
    };
  }

  /* allow new public acts when signed out */
  if (typeof actionAllowed === 'function') {
    var _aa = actionAllowed;
    actionAllowed = function (name, kind) {
      if (!ME && (name === 'pwforgotagain')) return true;
      return _aa(name, kind);
    };
  }
})();
