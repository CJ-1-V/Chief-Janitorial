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

  /* Emails the 6-digit code. Supabase "Confirm email" stays off (shared with UnScramble).
     Mock (?store=mock, or no live store) records the email and does not call the network.
     Live mode hands the code to CJ_EMAIL_CODE_TRANSPORT (edge function cj-send-email).
     Do not log the code. Company other than cj is refused. */
  var CJ_EMAIL_FROM = 'Chief Janitorial Support <support@chiefjanitorial.com>';
  var CJ_EMAIL_REPLY_TO = 'admin@chiefjanitorial.com';
  var OUTBOX = [];

  function cjSignInCodeText(code) {
    return 'Your Chief Janitorial sign-in code is ' + code + '.\n\nThis code expires in 15 minutes.\n\nIf you did not ask for this, you can ignore this email.';
  }

  /* ?store=mock records instead of sending. On the public site that link is ignored,
     same as the data-store switch: only this computer (file or localhost) can force it. */
  function cjEmailMockFor(search, hostname, protocol, mode) {
    var host = String(hostname || '');
    var local = protocol === 'file:' || host === 'localhost' || host === '127.0.0.1';
    if (local && /[?&]store=mock\b/.test(String(search || ''))) return true;
    return String(mode || '') !== 'supabase';
  }

  function cjEmailIsMock() {
    var g = typeof globalThis !== 'undefined' ? globalThis : {};
    var w = typeof window !== 'undefined' ? window : g;
    var loc = null;
    try { loc = (typeof location !== 'undefined' && location) || w.location || null; } catch (e) { loc = null; }
    var mode = '';
    try { mode = String((w.REG_STORE && w.REG_STORE.mode) || (g.REG_STORE && g.REG_STORE.mode) || ''); } catch (e2) { mode = ''; }
    return cjEmailMockFor(loc && loc.search, loc && loc.hostname, loc && loc.protocol, mode);
  }

  function CJ_EMAIL_CODE_SEND(email, code, company, opts) {
    var co = String(company || '').trim().toLowerCase();
    if (co !== 'cj') return { sent: false, refused: true, reason: 'not-cj' };
    var to = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { sent: false, refused: true, reason: 'no-email' };
    var digits = String(code || '').trim();
    if (!/^\d{6}$/.test(digits)) return { sent: false, refused: true, reason: 'bad-code' };
    var mail = {
      to: to,
      from: CJ_EMAIL_FROM,
      replyTo: CJ_EMAIL_REPLY_TO,
      subject: 'Your Chief Janitorial sign-in code',
      text: cjSignInCodeText(digits),
      code: digits,
      company: 'cj',
      at: new Date().toISOString()
    };
    var store = opts && opts.store;
    var mock = store === 'mock' ? true : (store === 'supabase' ? false : cjEmailIsMock());
    if (mock) {
      mail.mock = true;
      OUTBOX.push(mail);
      try { if (typeof window !== 'undefined') window.CJ_EMAIL_OUTBOX = OUTBOX; } catch (e) {}
      return { sent: false, mock: true, recorded: true };
    }
    var send = opts && opts.transport;
    try { if (typeof send !== 'function') send = (typeof window !== 'undefined' && window.CJ_EMAIL_CODE_TRANSPORT) || (typeof globalThis !== 'undefined' && globalThis.CJ_EMAIL_CODE_TRANSPORT); } catch (e2) { send = null; }
    if (typeof send !== 'function') return { sent: false, mock: false, reason: 'not-wired' };
    try {
      var pending = send(mail);
      if (pending && typeof pending.then === 'function') pending.then(function () {}, function () {});
      return { sent: false, pending: true, mock: false };
    } catch (e3) {
      return { sent: false, mock: false, reason: 'not-sent' };
    }
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
    CJ_EMAIL_CODE_SEND(u.email || '', code, u.companyId || '');
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
    cjSignInCodeText: cjSignInCodeText,
    cjEmailMockFor: cjEmailMockFor,
    cjEmailOutbox: function () { return OUTBOX.slice(); },
    cjEmailOutboxClear: function () { OUTBOX.length = 0; },
    CJ_EMAIL_CODE_SEND: CJ_EMAIL_CODE_SEND
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  Object.keys(api).forEach(function (k) { root[k] = api[k]; });
})(typeof window !== 'undefined' ? window : globalThis);
