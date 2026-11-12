/* Proves Robyn's part-month formula and that only Alberton and Souris are billed.
   node shifts-secure/cj/test/bee-flat.test.js
   No database. No network. */
'use strict';
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var bee = require('../js/bee-flat.js');

var checks = 0;
function eq(actual, expected, label) {
  checks++;
  assert.strictEqual(actual, expected, label + ' — got ' + actual + ', expected ' + expected);
}

/* Acceptance: 27–30 Oct 2026. */
var alberton = bee.beeFlatQuote(586.68, '2026-10-27', '2026-10-30');
eq(alberton.daily, 27.08, 'Alberton daily rate');
eq(alberton.weekdays, 4, 'Alberton weekdays 27–30 Oct');
eq(alberton.full, false, 'Alberton 27–30 Oct is a part month');
eq(alberton.pre, 108.32, 'Alberton pre-HST');
eq(alberton.hst, 16.25, 'Alberton HST');
eq(alberton.total, 124.57, 'Alberton total');

var souris = bee.beeFlatQuote(661.68, '2026-10-27', '2026-10-30');
eq(souris.daily, 30.54, 'Souris daily rate');
eq(souris.weekdays, 4, 'Souris weekdays 27–30 Oct');
eq(souris.pre, 122.16, 'Souris pre-HST');
eq(souris.hst, 18.32, 'Souris HST');
eq(souris.total, 140.48, 'Souris total');

/* The October invoice runs through the 31st. The 31st is a Saturday, so the amount matches 27–30 Oct. */
var oct = bee.beeMonthPeriod('2026-10');
eq(oct.from, '2026-10-27', 'October period starts on the billing date');
eq(oct.to, '2026-10-31', 'October period ends on the last day');
eq(bee.weekdaysInclusive(oct.from, oct.to), 4, '27–31 Oct 2026 is 4 weekdays');
var albertonMonth = bee.beeQuoteSite('CIB119', oct.from, oct.to);
var sourisMonth = bee.beeQuoteSite('CIB120', oct.from, oct.to);
eq(albertonMonth.total, 124.57, 'Alberton October invoice total');
eq(sourisMonth.total, 140.48, 'Souris October invoice total');
eq(albertonMonth.prefix, 'SC-CIA', 'Alberton prefix');
eq(sourisMonth.prefix, 'SC-CIS', 'Souris prefix');

/* A full month is the flat amount + 15% HST, not the daily rate. */
var novA = bee.beeFlatQuote(586.68, '2026-11-01', '2026-11-30');
var novS = bee.beeFlatQuote(661.68, '2026-11-01', '2026-11-30');
eq(novA.full, true, 'November is a full month');
eq(novA.pre, 586.68, 'Alberton full month before HST');
eq(novA.hst, 88.00, 'Alberton full month HST');
eq(novA.total, 674.68, 'Alberton full month total');
eq(novS.pre, 661.68, 'Souris full month before HST');
eq(novS.hst, 99.25, 'Souris full month HST');
eq(novS.total, 760.93, 'Souris full month total');
eq(bee.beeMonthPeriod('2026-09').error ? 1 : 0, 1, 'September is before billing starts');

/* Charlottetown stays out. Numbers start at 001. */
eq(bee.beeQuoteSite('CIB115', '2026-10-27', '2026-10-30'), null, 'CIB115 is not quoted');
eq(bee.beeRefused('CIB115'), true, 'CIB115 is refused');
eq(bee.beeSkipClientBill({ code: 'CIB119' }), true, 'Alberton is not on the client monthly invoice');
eq(bee.beeSkipClientBill({ code: 'CIB115' }), false, 'Charlottetown is not a Bee-Clean site');
eq(bee.beeNextNumber('SC-CIA', []), 'SC-CIA-001', 'Alberton first invoice number');
eq(bee.beeNextNumber('SC-CIS', []), 'SC-CIS-001', 'Souris first invoice number');
eq(bee.beeNextNumber('SC-CIA', ['SC-CIA-001', 'SC-CIS-001']), 'SC-CIA-002', 'prefixes are numbered apart');
eq(bee.BILL_TO.name, 'Bee-Clean', 'bill-to name');
eq(bee.BILL_TO.address, '1505 Barrington St, Halifax', 'bill-to address');

var company = fs.readFileSync(path.join(__dirname, '../js/cj-company.js'), 'utf8');
['Interac e-Transfer to admin@chiefjanitorial.com',
  'cheque mailed to Unit I, 56 Burns Ave, Charlottetown, PE C1E 2G1',
  'cheque pickup by a company employee on request'].forEach(function (bit) {
  checks++;
  assert.ok(company.indexOf(bit) >= 0, 'payment wording missing: ' + bit);
});

var sql = fs.readFileSync(path.join(__dirname, '../migrations/cj-beeflat-001.sql'), 'utf8');
checks++;
assert.ok(/DO NOT RUN/i.test(sql), 'migration must say it is not to be run');
checks++;
assert.ok(sql.indexOf('insert into') < 0 && sql.indexOf('INSERT INTO') < 0, 'migration must not insert rows');

console.log('PASS bee-flat (' + checks + ' checks)');
