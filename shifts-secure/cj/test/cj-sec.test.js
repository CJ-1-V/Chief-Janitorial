'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const gate = require(path.join(root, 'js', 'cj-sec-gate.js'));

test('switched-off, inactive, on hold, and removed accounts are blocked', function () {
  assert.equal(gate.cjAccountOff(null), '');
  assert.equal(gate.cjAccountOff({ active: true }), '');
  assert.match(gate.cjAccountOff({ active: false }), /switched off/);
  assert.match(gate.cjAccountOff({ active: 'false' }), /switched off/);
  assert.match(gate.cjAccountOff({ active: true, status: 'inactive' }), /switched off/);
  assert.match(gate.cjAccountOff({ active: true, status: 'switched_off' }), /switched off/);
  assert.match(gate.cjAccountOff({ suspended: true }), /on hold/);
  assert.match(gate.cjAccountOff({ status: 'suspended' }), /on hold/);
  assert.match(gate.cjAccountOff({ removed: true, active: true }), /removed/);
  assert.equal(gate.cjUseBlock({ active: false }), gate.cjAccountOff({ active: false }));
});

test('only a new sign-up with emailConfirmed false waits for a code', function () {
  assert.equal(gate.cjEmailPending({ active: true, name: 'Sample' }), false);
  assert.equal(gate.cjEmailPending({ active: true, emailConfirmed: true }), false);
  assert.equal(gate.cjEmailPending({ active: false, emailConfirmed: false }), false);
  const u = { active: true, name: 'New Person', email: 'new@example.com' };
  const code = gate.cjIssueEmailCode(u);
  assert.equal(u.emailConfirmed, false);
  assert.equal(code.length, 6);
  assert.equal(gate.cjEmailPending(u), true);
  assert.match(gate.cjUseBlock(u), /Confirm your email/);
  const bad = gate.cjAcceptEmailCode(u, '000000');
  assert.equal(bad.ok, false);
  assert.equal(u.emailConfirmed, false);
  const good = gate.cjAcceptEmailCode(u, code);
  assert.equal(good.ok, true);
  assert.equal(u.emailConfirmed, true);
  assert.equal(u.emailConfirmCode, undefined);
  assert.equal(u.emailConfirmHash, undefined);
  assert.equal(gate.cjEmailPending(u), false);
  assert.equal(gate.cjUseBlock(u), '');
  assert.equal(u.companyId, 'cj');
  assert.notEqual(gate.cjEmailCodeHash(code), code);
});

test('the code expires, locks after five tries, skips other companies, and does not send mail', function () {
  const hook = gate.CJ_EMAIL_CODE_SEND('person@example.com', '123456');
  assert.deepEqual(hook, { sent: false, todo: true });
  const expired = { active: true, companyId: 'cj', emailConfirmed: false, emailConfirmHash: gate.cjEmailCodeHash('111111'), emailConfirmExpiresAt: new Date(Date.now() - 1000).toISOString(), emailConfirmAttempts: 0, emailConfirmMax: 5 };
  assert.match(gate.cjAcceptEmailCode(expired, '111111').msg, /expired/);
  assert.equal(expired.emailConfirmed, false);
  const locked = { active: true, companyId: 'cj', emailConfirmed: false, emailConfirmHash: gate.cjEmailCodeHash('222222'), emailConfirmExpiresAt: new Date(Date.now() + 60000).toISOString(), emailConfirmAttempts: 0, emailConfirmMax: 5 };
  for (let i = 0; i < 4; i++) assert.match(gate.cjAcceptEmailCode(locked, '000000').msg, /not right/);
  assert.match(gate.cjAcceptEmailCode(locked, '000000').msg, /Too many tries/);
  assert.equal(locked.emailConfirmAttempts, 5);
  assert.match(gate.cjAcceptEmailCode(locked, '222222').msg, /Too many tries/);
  assert.equal(locked.emailConfirmed, false);
  const other = { active: true, companyId: 'us', emailConfirmed: false };
  assert.equal(gate.cjEmailPending(other), false);
  assert.equal(gate.cjIssueEmailCode(other), '');
  assert.equal(other.emailConfirmHash, undefined);
});

test('mock wiring holds new sign-ups and refuses a switched-off password', function () {
  const users = [];
  const logs = [];
  const ctx = {
    console: console,
    window: {},
    DB: { users: users },
    ME: null,
    PAGE_STATE: {},
    FORMS: {},
    VIEWS: { login: function () { return '<div class="alert warn">x</div>'; } },
    ACT: {},
    gateRoute: function (h) { return 'inner:' + h; },
    gateNav: function () { return [['#/home', 'Home']]; },
    actionAllowed: function () { return true; },
    save: function () { ctx.saved = (ctx.saved || 0) + 1; return true; },
    findLogin: function () { return null; },
    findLoginLive: function (login) {
      return users.filter(function (u) { return u.username === login; })[0] || null;
    },
    hashPw: function (pw) { return 'hash:' + pw; },
    logLogin: function (u, typed, ok, reason) { logs.push({ name: u && u.name, ok: ok, reason: reason }); },
    go: function (h) { ctx.hash = h; },
    toast: function (m) { ctx.lastToast = m; },
    render: function () { ctx.rendered = true; },
    esc: function (s) { return String(s == null ? '' : s); },
    inp: function (name) { return '<input name="' + name + '">'; },
    audit: function () {},
    loginTaken: function () { return false; }
  };
  ctx.window = ctx;
  ctx.REG_STORE = { mode: 'mock' };
  ctx.globalThis = ctx;
  users.push({ id: 'off', username: 'switchedoff', name: 'Riley', passHash: 'hash:test1234', active: false, status: 'inactive' });
  users.push({ id: 'on', username: 'office', name: 'Office', passHash: 'hash:test1234', active: true });
  ctx.FORMS.login = function () { ctx.loginContinued = true; };
  ctx.FORMS.signup = function () {
    const u = { id: 'new', name: 'Ada', email: 'ada@example.com', type: 'employee', active: true };
    ctx.DB.users.push(u);
    ctx.ME = u;
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'cj-sec-gate.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'v2-cjsec.js'), 'utf8'), ctx);

  ctx.FORMS.login({}, { login: 'switchedoff', password: 'test1234' });
  assert.equal(ctx.hash, '#/');
  assert.match(ctx.PAGE_STATE.loginMsg, /switched off/);
  assert.equal(logs[0].ok, false);
  assert.equal(ctx.ME, null);

  ctx.hash = '';
  ctx.PAGE_STATE.loginMsg = null;
  ctx.FORMS.login({}, { login: 'office', password: 'test1234' });
  assert.equal(ctx.loginContinued, true);
  assert.equal(ctx.PAGE_STATE.loginMsg, null);

  ctx.FORMS.signup({}, { email: 'ada@example.com' });
  const created = users[users.length - 1];
  assert.equal(created.emailConfirmed, false);
  assert.equal(String(created.emailConfirmCode).length, 6);
  assert.equal(ctx.gateRoute('#/home'), '#/confirm-email');
  assert.equal(JSON.stringify(ctx.gateNav(created)), JSON.stringify([['#/confirm-email', 'Confirm email']]));
  assert.equal(ctx.actionAllowed('clockin', 'act'), false);
  assert.equal(ctx.actionAllowed('confirmemail', 'form'), true);
  const code = created.emailConfirmCode;
  ctx.FORMS.confirmemail({}, { code: code });
  assert.equal(created.emailConfirmed, true);
  assert.equal(ctx.gateRoute('#/home'), 'inner:#/home');
});

test('draft SQL blocks CJ use and leaves UnScramble alone, and is not applied here', function () {
  const sql = fs.readFileSync(path.join(root, 'migrations', 'cj-sec-002.sql'), 'utf8');
  const back = fs.readFileSync(path.join(root, 'migrations', 'cj-sec-002-rollback.sql'), 'utf8');
  assert.match(sql, /DRAFT\. DO NOT RUN/);
  assert.match(back, /DRAFT\. DO NOT RUN/);
  assert.match(sql, /p_company is distinct from 'cj' then true/);
  assert.match(sql, /not public\.cj_caller_is_cj\(p_user\) then true/);
  assert.match(sql, /cj_account_is_off/);
  assert.match(sql, /Confirm email[\s\S]{0,120}stays OFF/);
  assert.doesNotMatch(sql, /Turn Confirm email on/);
  assert.doesNotMatch(sql, /email_confirmed_at/);
  assert.match(sql, /code_hash/);
  assert.match(sql, /expires_at/);
  assert.match(sql, /max_attempts/);
  assert.match(sql, /company = 'cj'/);
  assert.match(sql, /cj_email_code_issue/);
  assert.match(sql, /cj_email_code_check/);
  assert.match(sql, /TODO\(cj-email-code\)/);
  assert.doesNotMatch(sql, /net\.smtp|pg_net|invoke\(/i);
  assert.match(sql, /'role', 'account-blocked'/);
  assert.match(sql, /reg_snapshot\(\) is not replaced|Do not add it to public\.reg_snapshot\(\)/);
  assert.doesNotMatch(sql, /create or replace function public\.reg_snapshot/i);
  assert.match(sql, /cj_sec_guard_write/);
  assert.match(sql, /cj_email_code/);
  assert.match(back, /drop function if exists public\.cj_may_use_app\(text, uuid\)/);
  assert.match(back, /drop function if exists public\.cj_email_code_issue\(uuid, text\)/);
  assert.match(back, /drop function if exists public\.cj_email_code_check\(text\)/);
  assert.match(back, /drop table if exists public\.cj_email_code/);
  assert.match(back, /stays off/);
  assert.match(back, /cj_sec_guard_write/);
  const registerDir = path.join(root, '..', 'register');
  ['js/cj-sec-gate.js', 'js/v2-cjsec.js'].forEach(function (rel) {
    assert.equal(fs.existsSync(path.join(registerDir, rel)), false);
  });
  assert.equal(fs.existsSync(path.join(registerDir, 'migrations', 'cj-sec-002.sql')), false);
});
