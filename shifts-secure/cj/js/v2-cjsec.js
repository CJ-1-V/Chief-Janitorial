/* v2-cjsec.js – mock only (?store=mock). Switched-off / inactive accounts cannot sign in
   or keep using the app, and a new sign-up must confirm an email before any screen opens.
   Live enforcement is the draft in migrations/cj-sec-002.sql. This file does not run that SQL
   and does not call Supabase. Sample accounts with no emailConfirmed flag stay confirmed. */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  if (window.REG_LIVE || (window.REG_STORE && window.REG_STORE.mode === 'supabase')) return;
  if (typeof cjAccountOff !== 'function' || typeof FORMS === 'undefined' || typeof DB === 'undefined') return;

  function armDuring(orig) {
    return function (f, d) {
      var origPush = DB.users.push;
      DB.users.push = function (u) {
        if (u && typeof u === 'object' && u.emailConfirmed !== true) {
          if (u.email) cjIssueEmailCode(u);
          else u.emailConfirmed = false;
        }
        return origPush.apply(DB.users, arguments);
      };
      try {
        var result = orig.apply(this, arguments);
        if (typeof ME !== 'undefined' && ME && cjEmailPending(ME)) go('#/confirm-email');
        return result;
      } finally { DB.users.push = origPush; }
    };
  }
  if (typeof FORMS.signup === 'function') FORMS.signup = armDuring(FORMS.signup);
  if (typeof FORMS.firmsignup === 'function') FORMS.firmsignup = armDuring(FORMS.firmsignup);

  if (typeof FORMS.login === 'function') {
    var prevLogin = FORMS.login;
    FORMS.login = function (f, d) {
      var u = null;
      try { u = typeof findLoginLive === 'function' ? findLoginLive(d.login, d.password) : findLogin(d.login); } catch (e) { u = null; }
      if (u && u.passHash === hashPw(d.password)) {
        var why = cjAccountOff(u);
        if (why) {
          try { logLogin(u, d.login, false, 'Blocked: account switched off or inactive'); } catch (e) {}
          try { save(); } catch (e) {}
          PAGE_STATE.loginMsg = why;
          if (typeof toast === 'function') toast(why);
          go('#/');
          return;
        }
      }
      return prevLogin.apply(this, arguments);
    };
  }

  if (typeof gateRoute === 'function') {
    var prevGate = gateRoute;
    gateRoute = function (h) {
      if (typeof ME !== 'undefined' && ME && cjEmailPending(ME)) return '#/confirm-email';
      return prevGate.apply(this, arguments);
    };
    window.gateRoute = gateRoute;
  }
  if (typeof gateNav === 'function') {
    var prevNav = gateNav;
    gateNav = function (u) {
      if (u && cjEmailPending(u)) return [['#/confirm-email', 'Confirm email']];
      return prevNav.apply(this, arguments);
    };
    window.gateNav = gateNav;
  }
  if (typeof actionAllowed === 'function') {
    var prevAct = actionAllowed;
    actionAllowed = function (name, kind) {
      if (typeof ME !== 'undefined' && ME && cjAccountOff(ME)) return name === 'logout' || name === 'closeModal';
      if (typeof ME !== 'undefined' && ME && cjEmailPending(ME)) return ['logout', 'closeModal', 'confirmemail', 'resendconfirm', 'confirmemailset'].indexOf(name) >= 0;
      return prevAct.apply(this, arguments);
    };
  }
  if (typeof save === 'function') {
    var prevSave = save;
    save = function () {
      if (typeof ME !== 'undefined' && ME && cjAccountOff(ME)) return false;
      return prevSave.apply(this, arguments);
    };
    window.save = save;
  }

  VIEWS['confirm-email'] = function () {
    if (!ME) return '';
    var email = String(ME.email || '').trim();
    var x = '<h1>Confirm your email</h1><div class="alert warn" id="cj-email-gate"><b>Your account is created.</b> You cannot use Chief Janitorial until this email is confirmed.</div>';
    if (!email) {
      x += '<div class="card"><form data-form="confirmemailset">' + inp('email', 'Email', '', { type: 'email', req: true, extra: ' data-autofocus autocomplete="email"' }) + '<button type="submit">Email me a code</button></form><p class="small muted">Test copy: nothing is emailed. The code appears on this screen.</p></div>';
      return x;
    }
    x += '<div class="card"><p>We would send a 6-digit code to <b>' + esc(email) + '</b>.</p>';
    x += '<div class="alert info" id="cj-email-code"><b>Test copy:</b> nothing was emailed. Your code is <b>' + esc(ME.emailConfirmCode || '') + '</b></div>';
    x += '<form data-form="confirmemail">' + inp('code', '6-digit code', '', { req: true, extra: ' inputmode="numeric" maxlength="6" data-autofocus autocomplete="one-time-code"' }) + '<button type="submit">Confirm email</button></form>';
    x += '<p><button type="button" class="sec" data-act="resendconfirm">Send a new code</button></p>';
    x += '<p class="small muted">Test copy only. The office still has to approve a new account after the email is confirmed.</p></div>';
    return x;
  };

  FORMS.confirmemailset = function (f, d) {
    if (!ME || !cjEmailPending(ME)) return;
    var email = String(d.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Enter a valid email address.'); return; }
    if (typeof loginTaken === 'function' && loginTaken('', email, ME.id)) { toast('That email is already used.'); return; }
    ME.email = email;
    cjIssueEmailCode(ME);
    try { audit('Email confirmation code prepared (test copy, not sent)', ME.name, email); } catch (e) {}
    save();
    toast('Code ready on this screen (test copy – not sent).');
    render();
  };
  FORMS.confirmemail = function (f, d) {
    if (!ME) return;
    var r = cjAcceptEmailCode(ME, d.code);
    if (!r.ok) { toast(r.msg); return; }
    try { audit('Email confirmed', ME.name, ME.email || ''); } catch (e) {}
    save();
    toast('Email confirmed.');
    go(ME.accountApproved === false ? '#/pending' : '#/home');
  };
  ACT.resendconfirm = function () {
    if (!ME || !ME.email || !cjEmailPending(ME)) return;
    cjIssueEmailCode(ME);
    try { audit('Email confirmation code prepared again (test copy, not sent)', ME.name, ME.email); } catch (e) {}
    save();
    toast('New code ready on this screen (test copy – not sent).');
    render();
  };

  if (typeof VIEWS.login === 'function') {
    var prevView = VIEWS.login;
    VIEWS.login = function () {
      return String(prevView.apply(this, arguments)).replace('class="alert warn"', 'class="alert warn" id="cj-off-msg"');
    };
  }
})();
