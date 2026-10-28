/* Privacy checks for the frozen client portal. Mock data only. No database. */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const vm = require('vm');

const CLIENT = path.join(__dirname, '..');
const SQL = path.join(CLIENT, '..', 'migrations', 'cj-client-v1-001.sql');
const ROLLBACK = path.join(CLIENT, '..', 'migrations', 'cj-client-v1-001-rollback.sql');
const ASOF = '2026-10-28';

function load(file) {
  const sandbox = { console: console };
  sandbox.globalThis = sandbox;
  sandbox.module = { exports: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
  return sandbox.module.exports;
}

const demo = load(path.join(CLIENT, 'js', 'demo.js'));
const model = load(path.join(CLIENT, 'js', 'model.js'));
const config = load(path.join(CLIENT, 'js', 'config.js'));

const REAL_NAMES = [
  'Canadian Blood Services',
  'Shoppers',
  "Good's",
  'Kinlock',
  'CIBC',
  'Sun Life',
  'SunLife',
  'Canada Post',
  'Home Hardware',
  'Chinova',
  'CASTL',
  'Canada Life'
];

function readTree(dir) {
  const out = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (ent) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'test') return;
      out.push.apply(out, readTree(p));
    } else out.push(p);
  });
  return out;
}

test('portal files do not use real client names or the main app scripts', function () {
  const files = readTree(CLIENT).concat([SQL, ROLLBACK]);
  files.forEach(function (file) {
    const text = fs.readFileSync(file, 'utf8');
    REAL_NAMES.forEach(function (name) {
      assert.ok(text.indexOf(name) < 0, path.relative(CLIENT, file) + ' contains ' + name);
    });
  });
  const html = fs.readFileSync(path.join(CLIENT, 'index.html'), 'utf8');
  assert.ok(html.indexOf('../js/') < 0, 'portal must not load main app scripts');
  assert.ok(html.indexOf('register/') < 0, 'portal must not load the UnScramble app');
  ['js/app.js', 'js/model.js', 'js/demo.js', 'js/config.js'].forEach(function (rel) {
    const text = fs.readFileSync(path.join(CLIENT, rel), 'utf8');
    assert.ok(!/fetch\s*\(|XMLHttpRequest|supabase|WebSocket/.test(text), rel + ' must not call the network');
  });
});

test('draft SQL matches the portal function list and has a rollback', function () {
  const sql = fs.readFileSync(SQL, 'utf8');
  const back = fs.readFileSync(ROLLBACK, 'utf8');
  assert.ok(/DRAFT\. DO NOT RUN/.test(sql));
  assert.ok(/DRAFT\. DO NOT RUN/.test(back));
  assert.ok(/reg_snapshot_for/.test(sql) && /not call public\.reg_snapshot_for/.test(sql));
  const created = [...sql.matchAll(/create or replace function public\.(cj_client_v1_[a-z0-9_]+)/g)].map(function (m) { return m[1]; });
  created.forEach(function (name) {
    assert.ok(back.indexOf(name) >= 0, 'rollback drops ' + name);
  });
  const grants = [...sql.matchAll(/grant execute on function public\.(cj_client_v1_[a-z0-9_]+)/g)].map(function (m) { return m[1]; });
  assert.deepEqual(grants, config.rpcs);
  assert.deepEqual(config.rpcs, model.RPCS);
  ['cj_client_v1_hhmm', 'cj_client_v1_minutes', 'cj_client_v1_client_id', 'cj_client_v1_own_sites', 'cj_client_v1_crew_labels'].forEach(function (name) {
    assert.ok(created.indexOf(name) >= 0, name + ' is created');
    assert.ok(!grants.includes(name), name + ' is not granted to the portal');
    assert.ok(new RegExp('revoke all on function public\\.' + name).test(sql), name + ' is revoked');
  });
  assert.ok(!/ownerName/.test(sql.split('comment on function')[0].split('never contains')[1] || sql) || /Omits ownerName|data\.ownerName/.test(sql));
  assert.ok(sql.indexOf("data->>'ownerName'") < 0, 'SQL must not select ownerName');
  assert.ok(sql.indexOf('reg_special_jobs') >= 0 && /not read/.test(sql));
});

test('a demo client sees only their sites, with crew labels and no worker names', function () {
  const data = demo.dataset(ASOF);
  const north = model.buildPortal(data, 'demo-north');
  const html = model.renderAllData(north);

  assert.equal(north.ok, true);
  assert.equal(north.role, 'Client');
  assert.equal(north.client_label, 'North Sample Plaza');
  assert.deepEqual(north.sites.map(function (s) { return s.site_code; }), ['NSP-01', 'NSP-02']);
  assert.deepEqual(north.visits.map(function (v) { return v.site_code + ' ' + v.start_time + ' ' + v.crew_label; }), [
    'NSP-02 17:00 Cleaner',
    'NSP-01 18:00 Crew 1',
    'NSP-01 18:05 Crew 2'
  ]);
  assert.ok(north.visits.every(function (v) { return v.visit_date >= '2026-10-07' && v.visit_date <= ASOF; }));
  assert.ok(!north.visits.some(function (v) { return v.start_time === '09:00'; }), 'visit outside the period stays hidden');

  assert.deepEqual(north.hours.map(function (h) { return h.hours_on_site; }), [3, 3.5, 3]);
  assert.ok(html.indexOf('9.50 h') >= 0);
  assert.ok(html.indexOf('3.50 h') >= 0);

  assert.deepEqual(north.checklists.map(function (c) { return c.site_code + ' ' + c.crew_label + ' ' + c.status; }), [
    'NSP-02 Cleaner Partial',
    'NSP-01 Crew 1 Done',
    'NSP-01 Crew 2 Done'
  ]);
  const partial = north.checklists.filter(function (c) { return c.status === 'Partial'; })[0];
  assert.ok(partial.tasks.some(function (t) { return t.label === 'Clean and stock washrooms' && t.result === 'Not done'; }));

  assert.deepEqual(north.requests.map(function (r) { return r.request_no + ' ' + r.site_code; }), ['CR-4401 NSP-02', 'CR-4408 NSP-01']);
  assert.deepEqual(north.invoices.map(function (i) { return i.invoice_no + ' ' + i.status; }), [
    'CJ-DEMO-104 Unpaid',
    'CJ-DEMO-098 Paid',
    'CJ-DEMO-090 Overdue'
  ]);

  assert.deepEqual(model.privacyFindings(north, html, data, 'demo-north'), []);
  assert.ok(html.indexOf('Pat Hiddenworker') < 0);
  assert.ok(html.indexOf('Sam Hiddenworker') < 0);
  assert.ok(html.indexOf('HSC-01') < 0);
  assert.ok(html.indexOf('CJ-DEMO-HARB') < 0);
  assert.ok(JSON.stringify(north).indexOf('w-hidden') < 0);
});

test('the other demo client cannot see North sites, and an empty client sees nothing', function () {
  const data = demo.dataset(ASOF);
  const harbour = model.buildPortal(data, 'demo-harbour');
  const harbourHtml = model.renderAllData(harbour);
  assert.deepEqual(harbour.sites.map(function (s) { return s.site_code; }), ['HSC-01']);
  assert.ok(harbour.visits.every(function (v) { return v.site_code === 'HSC-01'; }));
  assert.equal(harbour.visits[0].crew_label, 'Cleaner');
  assert.ok(data.checklists.filter(function (c) { return c.id === 'c-h1'; })[0].note.indexOf('Sam Hiddenworker') >= 0);
  assert.ok(harbour.checklists[0].note.indexOf('Sam Hiddenworker') < 0);
  assert.ok(harbour.checklists[0].note.indexOf('Cleaner') >= 0);
  assert.ok(harbourHtml.indexOf('NSP-01') < 0);
  assert.ok(harbourHtml.indexOf('North lobby') < 0);
  assert.ok(harbourHtml.indexOf('CJ-DEMO-104') < 0);
  assert.deepEqual(model.privacyFindings(harbour, harbourHtml, data, 'demo-harbour'), []);

  const quiet = model.buildPortal(data, 'demo-quiet');
  const quietHtml = model.renderAllData(quiet);
  assert.equal(quiet.sites.length, 0);
  assert.equal(quiet.visits.length, 0);
  assert.equal(quiet.checklists.length, 0);
  assert.equal(quiet.requests.length, 0);
  assert.equal(quiet.invoices.length, 0);
  assert.ok(quietHtml.indexOf('No visits in this period.') >= 0);
  assert.ok(quietHtml.indexOf('NSP-01') < 0 && quietHtml.indexOf('HSC-01') < 0);
  assert.deepEqual(model.privacyFindings(quiet, quietHtml, data, 'demo-quiet'), []);

  const stranger = model.buildPortal(data, 'someone-else');
  assert.equal(stranger.ok, false);
  assert.equal(stranger.visits.length, 0);
  assert.equal(stranger.invoices.length, 0);
});

test('a wider period can include an older own-site visit and still hides the other client', function () {
  const data = demo.dataset(ASOF);
  const wide = model.buildPortal(data, 'demo-north', { from: '2026-01-01', to: ASOF });
  assert.ok(wide.visits.some(function (v) { return v.start_time === '09:00' && v.site_code === 'NSP-01'; }));
  assert.ok(wide.visits.every(function (v) { return v.site_code === 'NSP-01' || v.site_code === 'NSP-02'; }));
  assert.deepEqual(model.privacyFindings(wide, model.renderAllData(wide), data, 'demo-north'), []);
});

test('extra name, pay and rate fields on a payload are dropped', function () {
  const data = demo.dataset(ASOF);
  const bundle = model.demoBundle(data, 'demo-north');
  const clone = JSON.parse(JSON.stringify(bundle));
  clone.visits[0].worker_name = 'Pat Hiddenworker';
  clone.visits[0].pay_rate = 18.75;
  clone.visits[0].user_id = 'w-hidden-1';
  clone.visits[0].crew_label = 'Pat Hiddenworker';
  clone.hours[0].hours_on_site = 18.75;
  clone.hours[0].bill_rate = 24.50;
  clone.invoices[0].ownerName = 'Fictional Owner Label';
  const view = model.mapBundle(clone);
  assert.equal(view.visits[0].crew_label, 'Cleaner');
  assert.equal(view.hours[0].hours_on_site, model.hoursOnSite(view.hours[0].start_time, view.hours[0].end_time));
  assert.notEqual(view.hours[0].hours_on_site, 18.75);
  assert.ok(!Object.prototype.hasOwnProperty.call(view.visits[0], 'worker_name'));
  assert.ok(!Object.prototype.hasOwnProperty.call(view.invoices[0], 'ownerName'));
  const blob = JSON.stringify(view) + model.renderAllData(view);
  assert.ok(blob.indexOf('Pat Hiddenworker') < 0);
  assert.ok(blob.indexOf('w-hidden-1') < 0);
  assert.ok(blob.indexOf('18.75') < 0);
  assert.ok(blob.indexOf('24.50') < 0);
  assert.ok(blob.indexOf('Fictional Owner Label') < 0);
});
