/* cj-sec-gate.js – decisions for switched-off accounts and the CJ 6-digit email code.
   Plain checks only. The mock app (js/v2-cjsec.js, ?store=mock) calls these.
   The live database draft is migrations/cj-sec-002.sql (do not run it from here).
   Supabase "Confirm email" is shared with UnScramble and stays off. This is a
   Chief Janitorial code (company cj only), not that project switch.
   An account with no emailConfirmed flag is already confirmed (sample logins and
   accounts created before this rule). Only emailConfirmed === false waits. */
(function (root) {
  'use strict';
  var OFF = 'This account is switched off, so you cannot sign in or use the app. Please contact the Chief Janitorial office.';
  var HOLD = 'This account is on hold, so you cannot sign in or use the app. Please contact the Chief Janitorial office.';
  var GONE = 'This account was removed, so you cannot sign in or use the app. Please contact the Chief Janitorial office.';
  var EMAIL = 'Confirm your email before you can use the app.';
  var CODE_MS = 15 * 60 * 1000;
  var CODE_MAX = 5;

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
    if (!u || u.emailConfirmed !== false || cjAccountOff(u)) return false;
    if (u.companyId && u.companyId !== 'cj') return false;
    return true;
  }

  /* Same shape as the draft SQL hash: not the 6 digits. The mock still keeps the
     digits so the test screen can show them. The SQL stores only the hash. */
  function cjEmailCodeHash(code) {
    var s = 'cj-email-code:' + String(code || '').trim();
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return 'h' + (h >>> 0).toString(16);
  }

  /* TODO(cj-email-code): email the 6-digit code. Not wired.
     Do not turn on Supabase "Confirm email" — that switch is shared with UnScramble and stays off.
     When wiring, call cj_email_code_issue (draft SQL, postgres only) and send its return value.
     Do not log the code. This function does not send anything. */
  function CJ_EMAIL_CODE_SEND() {
    return { sent: false, todo: true };
  }

  function cjUseBlock(u) {
    if (!u) return '';
    return cjAccountOff(u) || (cjEmailPending(u) ? EMAIL : '');
  }

  /* New CJ self sign-up only. Holds the account until the code matches.
     Existing rows, and any company other than cj, are left alone. */
  function cjIssueEmailCode(u) {
    if (!u) return '';
    if (u.companyId && u.companyId !== 'cj') return '';
    if (!u.companyId) u.companyId = 'cj';
    var code = String(Math.floor(100000 + Math.random() * 900000));
    u.emailConfirmed = false;
    u.emailConfirmCode = code;
    u.emailConfirmHash = cjEmailCodeHash(code);
    u.emailConfirmExpiresAt = new Date(Date.now() + CODE_MS).toISOString();
    u.emailConfirmAttempts = 0;
    u.emailConfirmMax = CODE_MAX;
    u.emailConfirmSentAt = new Date().toISOString();
    CJ_EMAIL_CODE_SEND(u.email || '', code);
    return code;
  }

  function cjAcceptEmailCode(u, code) {
    if (!u || u.emailConfirmed !== false) return { ok: false, msg: 'This account does not need a code.' };
    if (u.companyId && u.companyId !== 'cj') return { ok: true, skipped: true };
    if (!u.emailConfirmHash && !u.emailConfirmCode) return { ok: false, msg: 'Add the email address first.' };
    var max = u.emailConfirmMax || CODE_MAX;
    if ((u.emailConfirmAttempts || 0) >= max) return { ok: false, msg: 'Too many tries. Send a new code.' };
    if (u.emailConfirmExpiresAt && Date.parse(u.emailConfirmExpiresAt) <= Date.now()) return { ok: false, msg: 'That code has expired. Send a new code.' };
    var typed = String(code || '').trim();
    var match = u.emailConfirmHash ? cjEmailCodeHash(typed) === u.emailConfirmHash : typed === String(u.emailConfirmCode);
    if (!match) {
      u.emailConfirmAttempts = (u.emailConfirmAttempts || 0) + 1;
      if (u.emailConfirmAttempts >= max) return { ok: false, msg: 'Too many tries. Send a new code.' };
      return { ok: false, msg: 'That code is not right. Check the 6 digits and try again.' };
    }
    u.emailConfirmed = true;
    u.emailConfirmedAt = new Date().toISOString();
    delete u.emailConfirmCode;
    delete u.emailConfirmHash;
    return { ok: true };
  }

  var api = {
    cjAccountOff: cjAccountOff,
    cjEmailPending: cjEmailPending,
    cjUseBlock: cjUseBlock,
    cjIssueEmailCode: cjIssueEmailCode,
    cjAcceptEmailCode: cjAcceptEmailCode,
    cjEmailCodeHash: cjEmailCodeHash,
    CJ_EMAIL_CODE_SEND: CJ_EMAIL_CODE_SEND
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  Object.keys(api).forEach(function (k) { root[k] = api[k]; });
})(typeof window !== 'undefined' ? window : globalThis);
