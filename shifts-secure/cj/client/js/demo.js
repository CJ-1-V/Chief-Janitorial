/* Demo client fixture for ?store=mock only.
   Every business, site and person here is fictional. The screen must not show the
   worker names, pay figures or bill rates stored below — privacy.test.js fails if it does.
   The other client's sites are in this file so the same test can prove they are filtered out. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CJClientDemo = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var TASKS = [
    'Empty garbage and replace liners',
    'Clean and stock washrooms',
    'Sweep and mop floors',
    'Wipe counters, desks and touch points',
    'Vacuum mats and carpets',
    'Lock up and set the alarm'
  ];

  function addDays(iso, n) {
    var p = String(iso).split('-');
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function tasks(doneIdx) {
    return TASKS.map(function (label, i) {
      return { label: label, done: doneIdx.indexOf(i) >= 0 };
    });
  }

  function dataset(asOf) {
    asOf = asOf || '2026-10-28';
    var d2 = addDays(asOf, -2);
    var d1 = addDays(asOf, -1);
    var old = addDays(asOf, -40);
    return {
      asOf: asOf,
      workers: [
        { id: 'w-hidden-1', name: 'Pat Hiddenworker', payRate: 18.75, payCode: 'PAY-SECRET-1875' },
        { id: 'w-hidden-2', name: 'Sam Hiddenworker', payRate: 19.40, payCode: 'PAY-SECRET-1940' }
      ],
      clients: [
        {
          id: 'demo-north',
          key: 'north',
          label: 'North Sample Plaza',
          billRate: 24.50,
          rateCode: 'RATE-SECRET-2450',
          sites: [
            { code: 'NSP-01', name: 'North lobby', ownerName: 'Fictional Owner Label' },
            { code: 'NSP-02', name: 'North washroom wing', ownerName: 'Fictional Owner Label' }
          ]
        },
        {
          id: 'demo-harbour',
          key: 'harbour',
          label: 'Harbour Sample Clinic',
          billRate: 31.75,
          rateCode: 'RATE-SECRET-3175',
          sites: [
            { code: 'HSC-01', name: 'Clinic sample wing', ownerName: 'Other Owner Label' }
          ]
        },
        {
          id: 'demo-quiet',
          key: 'quiet',
          label: 'Quiet Sample Office',
          billRate: 22.10,
          rateCode: 'RATE-SECRET-2210',
          sites: []
        }
      ],
      visits: [
        { id: 'v-n1', clientId: 'demo-north', site: 'NSP-01', date: d2, start: '18:00', end: '21:30', workerId: 'w-hidden-1', payRate: 18.75, billRate: 24.50 },
        { id: 'v-n2', clientId: 'demo-north', site: 'NSP-01', date: d2, start: '18:05', end: '21:05', workerId: 'w-hidden-2', payRate: 19.40, billRate: 24.50 },
        { id: 'v-n3', clientId: 'demo-north', site: 'NSP-02', date: d1, start: '17:00', end: '20:00', workerId: 'w-hidden-1', payRate: 18.75, billRate: 24.50 },
        { id: 'v-old', clientId: 'demo-north', site: 'NSP-01', date: old, start: '09:00', end: '10:00', workerId: 'w-hidden-1', payRate: 18.75, billRate: 24.50 },
        { id: 'v-h1', clientId: 'demo-harbour', site: 'HSC-01', date: d2, start: '19:00', end: '22:30', workerId: 'w-hidden-2', payRate: 19.40, billRate: 31.75 }
      ],
      checklists: [
        { id: 'c-n1', clientId: 'demo-north', site: 'NSP-01', date: d2, workerId: 'w-hidden-1', status: 'Done', at: d2 + 'T21:28:00', note: 'Supply closet was low on liners.', tasks: tasks([0, 1, 2, 3, 4, 5]) },
        { id: 'c-n2', clientId: 'demo-north', site: 'NSP-01', date: d2, workerId: 'w-hidden-2', status: 'Done', at: d2 + 'T21:10:00', note: 'Mats at the side door vacuumed.', tasks: tasks([0, 1, 2, 3, 4, 5]) },
        { id: 'c-n3', clientId: 'demo-north', site: 'NSP-02', date: d1, workerId: 'w-hidden-1', status: 'Partial', at: d1 + 'T19:40:00', note: 'Paper store was locked, washroom stock left short.', tasks: tasks([0, 2, 3, 4, 5]) },
        { id: 'c-h1', clientId: 'demo-harbour', site: 'HSC-01', date: d2, workerId: 'w-hidden-2', status: 'Missed', at: d2 + 'T22:10:00', note: 'Call Sam Hiddenworker about the alarm code.', tasks: tasks([]) }
      ],
      requests: [
        { id: 'r-n1', clientId: 'demo-north', no: 'CR-4401', site: 'NSP-02', kind: 'Window cleaning', date: addDays(asOf, 6), when: 'Evening (after 5 PM)', freq: 'One time only', status: 'Requested', note: 'Front windows only.' },
        { id: 'r-n2', clientId: 'demo-north', no: 'CR-4408', site: 'NSP-01', kind: 'Extra clean (same as regular service)', date: addDays(asOf, 2), when: 'Evening (after 5 PM)', freq: 'One time only', status: 'Scheduled', schedDate: addDays(asOf, 3), note: 'After the regular evening clean.' },
        { id: 'r-h1', clientId: 'demo-harbour', no: 'CR-4499', site: 'HSC-01', kind: 'Deep clean', date: addDays(asOf, 4), when: 'Morning (before noon)', freq: 'One time only', status: 'Declined', note: 'Sam Hiddenworker asked for a deep clean.' }
      ],
      invoices: [
        { id: 'i-n1', clientId: 'demo-north', number: 'CJ-DEMO-104', periodStart: '2026-09-01', periodEnd: '2026-09-30', amount: 1860, hst: 279, total: 2139, issued: '2026-10-02', due: '2026-11-01', paidAt: '', billRate: 24.50 },
        { id: 'i-n2', clientId: 'demo-north', number: 'CJ-DEMO-098', periodStart: '2026-08-01', periodEnd: '2026-08-31', amount: 1420, hst: 213, total: 1633, issued: '2026-09-02', due: '2026-10-02', paidAt: '2026-10-01', billRate: 24.50 },
        { id: 'i-n3', clientId: 'demo-north', number: 'CJ-DEMO-090', periodStart: '2026-07-01', periodEnd: '2026-07-31', amount: 980, hst: 147, total: 1127, issued: '2026-08-02', due: '2026-09-01', paidAt: '', billRate: 24.50 },
        { id: 'i-h1', clientId: 'demo-harbour', number: 'CJ-DEMO-HARB', periodStart: '2026-09-01', periodEnd: '2026-09-30', amount: 7026.78, hst: 1054.02, total: 8080.80, issued: '2026-10-02', due: '2026-11-01', paidAt: '', billRate: 31.75 }
      ]
    };
  }

  function clients() {
    return dataset('2026-10-28').clients.map(function (c) {
      return { key: c.key, id: c.id, label: c.label };
    });
  }

  return { dataset: dataset, clients: clients, tasks: TASKS };
});
