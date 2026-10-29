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
  assert.equal(gate.cjEmailPending(u), false);
  assert.equal(gate.cjUseBlock(u), '');
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
  assert.match(sql, /email_confirmed_at is null/);
  assert.match(sql, /'role', 'account-blocked'/);
  assert.match(sql, /reg_snapshot\(\) is not replaced|Do not add it to public\.reg_snapshot\(\)/);
  assert.doesNotMatch(sql, /create or replace function public\.reg_snapshot/i);
  assert.match(sql, /cj_sec_guard_write/);
  assert.match(sql, /cj_signup_gate/);
  assert.match(back, /drop function if exists public\.cj_may_use_app\(text, uuid\)/);
  assert.match(back, /drop table if exists public\.cj_signup_gate/);
  assert.match(back, /cj_sec_guard_write/);
  assert.match(back, /cj_sec_signup_gate/);
  const registerDir = path.join(root, '..', 'register');
  ['js/cj-sec-gate.js', 'js/v2-cjsec.js'].forEach(function (rel) {
    assert.equal(fs.existsSync(path.join(registerDir, rel)), false);
  });
  assert.equal(fs.existsSync(path.join(registerDir, 'migrations', 'cj-sec-002.sql')), false);
});
