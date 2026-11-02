// node tests/visit-hours-flag.test.js
// Flags only. Clocked in/out stay as entered. Typical hours are not a limit.
// Duration uses America/Halifax timestamps unless hrs() already takes a date
// (the DST-safe helper on cursor/cj-bugsweep1).
'use strict';
process.env.TZ = 'America/Halifax';
var fs = require('fs');
var vm = require('vm');
var assert = require('assert');
var path = require('path');
var root = path.join(__dirname, '..');

function wall(a, b) {
  if (!a || !b) return 0;
  var x = String(a).split(':'), y = String(b).split(':');
  var m = ((+y[0]) * 60 + (+y[1])) - ((+x[0]) * 60 + (+x[1]));
  if (m < 0) m += 1440;
  return m / 60;
}

var calls = [];
var ctx = {
  console: console,
  Intl: Intl,
  Date: Date,
  Math: Math,
  String: String,
  Number: Number,
  JSON: JSON,
  Object: Object,
  Array: Array,
  isFinite: isFinite,
  RegExp: RegExp,
  VIEWS: {},
  FORMS: { shsave: function () { calls.push('prev'); } },
  afterRender: function (node) { return node; },
  ME: { type: 'admin', officeRoles: ['owner'], name: 'Owner' },
  DB: { sites: [], time: [], shifts: [], users: [{ id: 'u', name: 'Alex Cleaner' }], audit: [] },
  REG_LIVE: false,
  REG_STORE: { mode: 'mock' },
  esc: function (s) { return String(s == null ? '' : s); },
  hrs: wall,
  toast: function (m) { calls.push('toast:' + m); },
  audit: function (action) { ctx.DB.audit.unshift({ action: action }); },
  user: function (id) { return ctx.DB.users.filter(function (u) { return u.id === id; })[0] || null; },
  document: {
    getElementById: function () { return null; },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; }
  }
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'shifts-secure/cj/js/v2-cjvisithours.js'), 'utf8'), ctx);

assert.strictEqual(ctx.vlClocked({ in: '22:00', out: '06:00', date: '2026-10-31' }), 9, 'fall-back night is 9 real hours');
assert.strictEqual(ctx.vlClocked({ in: '22:00', out: '06:00', date: '2026-10-30' }), 8, 'ordinary night is 8 hours');
assert.strictEqual(ctx.vlClocked({ in: '22:00', out: '01:30', date: '2026-10-31' }), 3.5, 'ends before the clock change');
assert.strictEqual(ctx.vlClocked({ in: '22:00', out: '06:00', date: '2027-03-13' }), 7, 'spring-forward night is 7 real hours');
assert.strictEqual(ctx.vlClocked({ in: '09:00', out: '17:00', date: '2026-11-01' }), 8, 'day shift');
assert.strictEqual(wall.length, 2, 'this test hrs() is the wall-clock helper, not the DST one');

ctx.hrs = function (a, b, date) { return date === 'MARK' ? 42 : wall(a, b); };
assert.strictEqual(ctx.hrs.length, 3);
assert.strictEqual(ctx.vlClocked({ in: '09:00', out: '10:00', date: 'MARK' }), 42, 'uses bugsweep hrs(in, out, date) when present');
ctx.hrs = wall;

var site = { code: 'CPM105', typicalHours: 4 };
ctx.DB.sites.push(site);
var over = { id: 't1', site: 'CPM105', date: '2026-11-02', in: '08:00', out: '13:30', userId: 'u', test: false };
var before = JSON.stringify(over);
site.maxHours = 4;
var flagged = ctx.vlFlagFor(over);
assert.strictEqual(JSON.stringify(over), before, 'flag does not edit the clocked times');
assert.strictEqual(over.in, '08:00');
assert.strictEqual(over.out, '13:30');
assert.ok(flagged && flagged.kind === 'over');
assert.strictEqual(flagged.hours, 5.5);

var exact = { id: 't2', site: 'CPM105', date: '2026-11-02', in: '08:00', out: '12:00', userId: 'u', test: false };
assert.strictEqual(ctx.vlFlagFor(exact), null, 'exactly the max is not flagged');

site.minHours = 2;
site.maxHours = null;
var under = { id: 't3', site: 'CPM105', date: '2026-11-02', in: '08:00', out: '09:00', userId: 'u', test: false };
assert.strictEqual(ctx.vlFlagFor(under).kind, 'under');
var atMin = { id: 't3b', site: 'CPM105', date: '2026-11-02', in: '08:00', out: '10:00', userId: 'u', test: false };
assert.strictEqual(ctx.vlFlagFor(atMin), null, 'exactly the min is not flagged');

site.minHours = null;
site.maxHours = null;
var longVisit = { id: 't4', site: 'CPM105', date: '2026-11-02', in: '08:00', out: '20:00', userId: 'u', test: false };
assert.strictEqual(ctx.vlFlagFor(longVisit), null, 'typical hours alone never flag a visit');

ctx.DB.sites.push({ code: 'X', maxHours: 8 });
var dst = { id: 'td', site: 'X', date: '2026-10-31', in: '22:00', out: '06:00', userId: 'u', test: false };
var dstFlag = ctx.vlFlagFor(dst);
assert.strictEqual(dstFlag.kind, 'over');
assert.strictEqual(dstFlag.hours, 9, '8h max flags the 9 real hours across the fall-back');
assert.strictEqual(dst.in, '22:00');
assert.strictEqual(dst.out, '06:00');

assert.strictEqual(ctx.vlCrossesDst('22:00', '06:00', '2026-10-31'), true, 'fall-back night crosses 2 AM');
assert.strictEqual(ctx.vlCrossesDst('22:00', '01:30', '2026-10-31'), false, 'ends before the 2 AM change');
assert.strictEqual(ctx.vlCrossesDst('22:00', '06:00', '2026-10-30'), false, 'ordinary night does not cross a clock change');
assert.strictEqual(ctx.vlCrossesDst('09:00', '17:00', '2026-11-01'), false, 'day shift after the change');
assert.strictEqual(ctx.vlCrossesDst('01:00', '03:00', '2026-11-01'), true, 'same morning across 2 AM');
assert.strictEqual(ctx.vlCrossesDst('03:00', '06:00', '2026-11-01'), false, 'after the change has already happened');
assert.strictEqual(ctx.vlCrossesDst('22:00', '06:00', '2027-03-13'), true, 'spring-forward night crosses 2 AM');
assert.strictEqual(ctx.vlCrossesDst('22:00', '01:30', '2027-03-13'), false, 'spring night ending before 2 AM');

var fall = { id: 'fall', site: 'CPM105', date: '2026-10-31', in: '22:00', out: '06:00', userId: 'u', test: false };
var fallSnap = JSON.stringify(fall);
var fallDst = ctx.vlDstFlag(fall);
assert.ok(fallDst && fallDst.kind === 'dst', 'clock-change flag with no min/max');
assert.strictEqual(fallDst.hours, 9);
assert.strictEqual(ctx.vlFlagFor(fall), null, 'no range flag when the site has no min or max');
assert.strictEqual(JSON.stringify(fall), fallSnap, 'clock-change flag does not edit stored times');
assert.strictEqual(fall.in, '22:00');
assert.strictEqual(fall.out, '06:00');

var both = { id: 'both', site: 'X', date: '2026-10-31', in: '22:00', out: '06:00', userId: 'u', test: false };
var bothSnap = JSON.stringify(both);
assert.strictEqual(ctx.vlFlagFor(both).kind, 'over');
assert.strictEqual(ctx.vlDstFlag(both).kind, 'dst', 'range flag and clock-change flag both apply');
assert.strictEqual(JSON.stringify(both), bothSnap);
assert.strictEqual(both.in, '22:00');
assert.strictEqual(both.out, '06:00');

var early = { id: 'early', site: 'X', date: '2026-10-31', in: '22:00', out: '01:30', userId: 'u', test: false };
assert.strictEqual(ctx.vlDstFlag(early), null);
var practice = { id: 'prac', site: 'X', date: '2026-10-31', in: '22:00', out: '06:00', userId: 'u', test: true };
assert.strictEqual(ctx.vlDstFlag(practice), null, 'a test clock is not flagged');

ctx.DB.sites.push({ code: 'JSON', data: { minHours: 3, maxHours: 6 } });
var fromJson = ctx.vlLimits(ctx.DB.sites[ctx.DB.sites.length - 1]);
assert.strictEqual(fromJson.min, 3);
assert.strictEqual(fromJson.max, 6);

assert.strictEqual(ctx.vlTypical('CPM105'), 4);
assert.strictEqual(ctx.vlTypical('CPK107'), 1.5);
assert.strictEqual(ctx.vlTypical('CBS101'), 3.5);
assert.strictEqual(ctx.vlTypical('KHH112'), 5);
assert.strictEqual(ctx.vlTypical('SDT114'), null);
assert.strictEqual(ctx.vlTypical('NOPE'), null);

ctx.ME = { type: 'employee', officeRoles: ['owner'] };
assert.strictEqual(ctx.vlCanSee(), false, 'a cleaner does not see flags');
assert.strictEqual(ctx.vlCanEdit(), false);
ctx.ME = { type: 'admin', officeRoles: ['ops'] };
assert.strictEqual(ctx.vlCanSee(), false);
assert.strictEqual(ctx.vlCanEdit(), false);
ctx.ME = { type: 'admin', officeRoles: ['admin'], name: 'Admin' };
assert.strictEqual(ctx.vlCanSee(), true, 'admin sees flags');
assert.strictEqual(ctx.vlCanEdit(), false, 'admin cannot edit the range');
calls.length = 0;
var adminSite = ctx.DB.sites.filter(function (s) { return s.code === 'CPM105'; })[0];
adminSite.minHours = null;
adminSite.maxHours = null;
ctx.FORMS.shsave({}, { code: 'CPM105', minHours: '1', maxHours: '2' });
assert.strictEqual(adminSite.minHours, null, 'admin save does not write a minimum');
assert.strictEqual(adminSite.maxHours, null, 'admin save does not write a maximum');
assert.deepStrictEqual(calls, ['prev']);

ctx.ME = { type: 'admin', officeRoles: ['owner'], name: 'Owner' };
calls.length = 0;
ctx.FORMS.shsave({}, { code: 'CPM105', minHours: '1.5', maxHours: '4' });
assert.strictEqual(adminSite.minHours, 1.5);
assert.strictEqual(adminSite.maxHours, 4);
assert.strictEqual(over.in, '08:00', 'saving a range does not rewrite an existing clock');
assert.strictEqual(over.out, '13:30');

var sql = fs.readFileSync(path.join(root, 'proposed/sql/028b_typical_hours_seed.sql'), 'utf8');
var mig = fs.readFileSync(path.join(root, 'proposed/sql/028b_site_visit_hours.sql'), 'utf8');
var rb = fs.readFileSync(path.join(root, 'proposed/sql/028b_ROLLBACK.sql'), 'utf8');
assert.ok(/NOT APPLIED/i.test(sql) && /NOT APPLIED/i.test(mig) && /NOT APPLIED/i.test(rb));
assert.ok(/add column if not exists min_hours/i.test(mig));
assert.ok(/add column if not exists max_hours/i.test(mig));
assert.ok(/add column if not exists typical_hours/i.test(mig));
assert.ok(/drop column if exists min_hours/i.test(rb));
assert.ok(/drop column if exists max_hours/i.test(rb));
assert.ok(/drop column if exists typical_hours/i.test(rb));
assert.ok(!/set\s+min_hours/i.test(sql), 'seed does not set min_hours');
assert.ok(!/set\s+max_hours/i.test(sql), 'seed does not set max_hours');
var expect = { CPM105: '4', CPS106: '4', CPK107: '1.5', SLF108: '1.5', TDU102: '1.5', CBS101: '3.5', SDS111: '4', TDS103: '1', TDQ104: '3', CAL109: '1', CAS116: '2', CHB117: '2', SDC110: '4', KHH112: '5', GOI113: '3', CIB115: '1.5', CIB119: '1.5', CIB120: '1.5', SDT114: 'null' };
Object.keys(expect).forEach(function (code) {
  var re = new RegExp("\\('" + code + "',\\s*(" + (expect[code] === 'null' ? 'null' : expect[code]) + ')::numeric\\)');
  assert.ok(re.test(sql), code + ' typical_hours ' + expect[code]);
  assert.strictEqual(ctx.vlTypical(code), expect[code] === 'null' ? null : +expect[code]);
});

var store = fs.readFileSync(path.join(root, 'shifts-secure/cj/js/store-supabase.js'), 'utf8');
assert.ok(!/o\.min_hours\s*=/.test(store), 'live save does not send min_hours before the SQL is applied');
assert.ok(!/o\.max_hours\s*=/.test(store));
var clock = fs.readFileSync(path.join(root, 'shifts-secure/cj/js/v2-clock.js'), 'utf8');
assert.ok(!/minHours|maxHours|vlFlag/.test(clock), 'clock in and out do not look at the range');

console.log('PASS visit-hours-flag');
