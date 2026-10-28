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

  /* Stored email body for an invoice sent under the current template. Older invoices
     keep their own sentCopy and do not pass through this function. */
  function newInvoiceCopy(number, billedTo, monthLabel, from, to, issued, due, lines, subtotal, tax, total) {
    var copy = [
      { k: 'h', t: 'Chief Janitorial Inc.' },
      { k: 's', t: 'Unit I, 56 Burns Avenue, Charlottetown PE C1E 2G1' },
      { k: 's', t: '902-200-4888 | admin@chiefjanitorial.com | www.chiefjanitorial.com' },
      { k: 's', t: 'GST/HST 755653946 RT0001' },
      { k: 's', t: 'Sample invoice for the demo client. Not a real invoice.' },
      { k: 'g' },
      { k: 'b', t: 'Invoice ' + number },
      { k: 't', t: 'Billed to: ' + billedTo },
      { k: 't', t: 'Invoice date: ' + issued },
      { k: 't', t: 'For: ' + monthLabel + ' (' + from + ' to ' + to + ')' },
      { k: 't', t: 'Due: ' + due },
      { k: 'g' }
    ];
    lines.forEach(function (line) { copy.push({ k: 'r', t: line[0], v: line[1] }); });
    copy.push({ k: 'g' });
    copy.push({ k: 'r', t: 'Subtotal', v: subtotal });
    copy.push({ k: 'r', t: 'GST/HST 755653946 RT0001 at 15%', v: tax });
    copy.push({ k: 'rb', t: 'Total', v: total });
    copy.push({ k: 'g' });
    copy.push({ k: 's', t: 'Payment is due within one month of the date this invoice is received.' });
    copy.push({ k: 's', t: 'Payment options: e-transfer to admin@chiefjanitorial.com, or a cheque payable to Chief Janitorial Inc., mailed to Unit I, 56 Burns Avenue, Charlottetown PE C1E 2G1.' });
    copy.push({ k: 's', t: 'Late payment: interest of 2% a month applies to balances more than 2 months overdue.' });
    copy.push({ k: 's', t: 'Please contact us at admin@chiefjanitorial.com with any questions about this invoice.' });
    return copy;
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
          invoicePrefix: 'NS-PLZ',
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
          invoicePrefix: 'HB-SMC',
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
        /* Numbers are the client prefix plus a 3-digit running number (the same shape as DC-CST-035).
           sentCopy is the email body stored when the invoice was sent. The portal prints that copy.
           It does not write today's payment terms onto an older copy. */
        { id: 'i-n1', clientId: 'demo-north', number: 'NS-PLZ-035', periodStart: '2026-09-01', periodEnd: '2026-09-30', amount: 1860, hst: 279, total: 2139, issued: '2026-10-02', due: '2026-11-01', paidAt: '', terms: 'cj-2026-10', billRate: 24.50,
          sentCopy: newInvoiceCopy('NS-PLZ-035', 'North Sample Plaza', 'September 2026', '1 Sep 2026', '30 Sep 2026', '2 Oct 2026', '1 Nov 2026', [
            ['North lobby – Regular cleaning, September 2026', '$1,200.00'],
            ['North washroom wing – Regular cleaning, September 2026', '$660.00']
          ], '$1,860.00', '$279.00', '$2,139.00') },
        { id: 'i-n2', clientId: 'demo-north', number: 'NS-PLZ-034', periodStart: '2026-08-01', periodEnd: '2026-08-31', amount: 1420, hst: 213, total: 1633, issued: '2026-09-02', due: '2026-10-02', paidAt: '2026-10-01', terms: 'cj-2026-10', billRate: 24.50,
          sentCopy: newInvoiceCopy('NS-PLZ-034', 'North Sample Plaza', 'August 2026', '1 Aug 2026', '31 Aug 2026', '2 Sep 2026', '2 Oct 2026', [
            ['North lobby – Regular cleaning, August 2026', '$900.00'],
            ['North washroom wing – Regular cleaning, August 2026', '$520.00']
          ], '$1,420.00', '$213.00', '$1,633.00') },
        { id: 'i-n3', clientId: 'demo-north', number: 'NS-PLZ-033', periodStart: '2026-03-01', periodEnd: '2026-03-31', amount: 980, hst: 147, total: 1127, issued: '2026-04-02', due: '2026-05-02', paidAt: '', billRate: 24.50,
          sentCopy: [
            { k: 'b', t: 'Invoice NS-PLZ-033' },
            { k: 't', t: 'Billed to: North Sample Plaza' },
            { k: 't', t: 'Period: 1 Mar 2026 to 31 Mar 2026' },
            { k: 't', t: 'Issued: 2 Apr 2026    Due: 2 May 2026' },
            { k: 'g' },
            { k: 'r', t: 'Regular cleaning', v: '$980.00' },
            { k: 'r', t: 'HST', v: '$147.00' },
            { k: 'rb', t: 'Invoice total', v: '$1,127.00' },
            { k: 'g' },
            { k: 's', t: 'Payable within 30 days.' }
          ] },
        { id: 'i-h1', clientId: 'demo-harbour', number: 'HB-SMC-008', periodStart: '2026-09-01', periodEnd: '2026-09-30', amount: 7026.78, hst: 1054.02, total: 8080.80, issued: '2026-10-02', due: '2026-11-01', paidAt: '', billRate: 31.75,
          sentCopy: [
            { k: 'b', t: 'Invoice HB-SMC-008' },
            { k: 't', t: 'Billed to: Harbour Sample Clinic' },
            { k: 't', t: 'Period: 1 Sep 2026 to 30 Sep 2026' },
            { k: 'r', t: 'Regular cleaning', v: '$7,026.78' },
            { k: 'r', t: 'HST', v: '$1,054.02' },
            { k: 'rb', t: 'Invoice total', v: '$8,080.80' },
            { k: 's', t: 'Payable within 30 days.' }
          ] }
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
