/* cj-sec-gate.js – decisions for switched-off accounts and unconfirmed sign-ups.
   Plain checks only. The mock app (js/v2-cjsec.js, ?store=mock) calls these.
   The live database draft is migrations/cj-sec-002.sql (do not run it from here).
   An account with no emailConfirmed flag is already confirmed (sample logins and
   accounts created before this rule). Only emailConfirmed === false waits. */
(function (root) {
  'use strict';
  var OFF = 'This account is switched off, so you cannot sign in or use the app. Please contact the Chief Janitorial office.';
  var HOLD = 'This account is on hold, so you cannot sign in or use the app. Please contact the Chief Janitorial office.';
  var GONE = 'This account was removed, so you cannot sign in or use the app. Please contact the Chief Janitorial office.';
  var EMAIL = 'Confirm your email before you can use the app.';

  function flagOff(v) {
    return v === false || v === 'false' || v === 0 || v === '0';
  }
  function flagOn(v) {
    return v === true || v === 'true' || v === 1 || v === '1';
  }

  function cjAccountOff(u) {
    if (!u) return '';
    if (flagOn(u.removed)) return GONE;
    var st = String(u.status || '').toLowerCase().replace(/[\s_]+/g, '-');
    if (st === 'suspended' || flagOn(u.suspended)) return HOLD;
    if (flagOff(u.active) || st === 'inactive' || st === 'switched-off') return OFF;
    return '';
  }

  function cjEmailPending(u) {
    return !!(u && u.emailConfirmed === false && !cjAccountOff(u));
  }

  function cjUseBlock(u) {
    if (!u) return '';
    return cjAccountOff(u) || (cjEmailPending(u) ? EMAIL : '');
  }

  /* New self sign-up: hold the account until the code matches. Existing rows are left alone. */
  function cjIssueEmailCode(u) {
    if (!u) return '';
    u.emailConfirmed = false;
    u.emailConfirmCode = String(Math.floor(100000 + Math.random() * 900000));
    u.emailConfirmSentAt = new Date().toISOString();
    return u.emailConfirmCode;
  }

  function cjAcceptEmailCode(u, code) {
    if (!u || u.emailConfirmed !== false) return { ok: false, msg: 'This account does not need a code.' };
    if (!u.emailConfirmCode) return { ok: false, msg: 'Add the email address first.' };
    if (String(code || '').trim() !== String(u.emailConfirmCode)) return { ok: false, msg: 'That code is not right. Check the 6 digits and try again.' };
    u.emailConfirmed = true;
    u.emailConfirmedAt = new Date().toISOString();
    delete u.emailConfirmCode;
    return { ok: true };
  }

  var api = {
    cjAccountOff: cjAccountOff,
    cjEmailPending: cjEmailPending,
    cjUseBlock: cjUseBlock,
    cjIssueEmailCode: cjIssueEmailCode,
    cjAcceptEmailCode: cjAcceptEmailCode
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  Object.keys(api).forEach(function (k) { root[k] = api[k]; });
})(typeof window !== 'undefined' ? window : globalThis);
