/* bee-flat.js – flat monthly amounts for the Bee-Clean invoices (test copy).
   Pure helpers: no DOM, no network, no database. The browser and the unit test both use this file.
   Part month (Robyn): daily rate = monthly amount before HST × 12 / 260, rounded to the cent.
   That daily rate × weekdays (Monday–Friday) in the range, then 15% HST rounded to the cent.
   A full calendar month is the flat monthly amount + 15% HST. Billing starts 27 Oct 2026.
   Only CIB119 and CIB120 are billed. CIB115 is refused. */
(function () {
  'use strict';
  var START = '2026-10-27';
  var HST = 0.15;
  var SITES = [
    { code: 'CIB119', name: 'CIBC Alberton', monthly: 586.68, prefix: 'SC-CIA' },
    { code: 'CIB120', name: 'CIBC Souris', monthly: 661.68, prefix: 'SC-CIS' }
  ];
  var EXCLUDED = ['CIB115'];
  var BILL_TO = { name: 'Bee-Clean', address: '1505 Barrington St, Halifax' };

  function roundCent(n) {
    var x = Number(n);
    if (!isFinite(x)) return 0;
    return Math.round((x + (x < 0 ? -1e-9 : 1e-9)) * 100) / 100;
  }
  function utcDate(s) {
    var p = String(s || '').split('-');
    if (p.length !== 3) return null;
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    if (isNaN(d.getTime())) return null;
    if (d.getUTCFullYear() !== +p[0] || d.getUTCMonth() !== +p[1] - 1 || d.getUTCDate() !== +p[2]) return null;
    return d;
  }
  function isoUTC(d) {
    var m = d.getUTCMonth() + 1, day = d.getUTCDate();
    return d.getUTCFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  function lastDay(ym) {
    var y = +ym.slice(0, 4), m = +ym.slice(5, 7);
    return isoUTC(new Date(Date.UTC(y, m, 0)));
  }
  function weekdaysInclusive(from, to) {
    var d = utcDate(from), end = utcDate(to), n = 0;
    if (!d || !end || d.getTime() > end.getTime()) return 0;
    while (d.getTime() <= end.getTime()) {
      var w = d.getUTCDay();
      if (w !== 0 && w !== 6) n++;
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return n;
  }
  function isFullMonth(from, to) {
    var a = utcDate(from), b = utcDate(to);
    if (!a || !b) return false;
    if (a.getUTCDate() !== 1) return false;
    if (a.getUTCFullYear() !== b.getUTCFullYear() || a.getUTCMonth() !== b.getUTCMonth()) return false;
    return isoUTC(b) === lastDay(from.slice(0, 7));
  }
  function beeFlatQuote(monthlyPre, from, to) {
    var monthly = roundCent(monthlyPre);
    var daily = roundCent(monthly * 12 / 260);
    var full = isFullMonth(from, to);
    var weekdays = weekdaysInclusive(from, to);
    var pre = full ? monthly : roundCent(daily * weekdays);
    var hst = roundCent(pre * HST);
    return { full: full, daily: daily, weekdays: weekdays, pre: pre, hst: hst, total: roundCent(pre + hst), monthly: monthly };
  }
  function byCode(code) {
    code = String(code || '');
    for (var i = 0; i < SITES.length; i++) if (SITES[i].code === code) return SITES[i];
    return null;
  }
  function beeRefused(code) { return EXCLUDED.indexOf(String(code || '')) >= 0; }
  function beeQuoteSite(code, from, to, monthlyOverride) {
    if (beeRefused(code) || !byCode(code)) return null;
    var site = byCode(code);
    var monthly = monthlyOverride == null || monthlyOverride === '' ? site.monthly : monthlyOverride;
    var q = beeFlatQuote(monthly, from, to);
    q.code = site.code;
    q.name = site.name;
    q.prefix = site.prefix;
    return q;
  }
  function beeMonthPeriod(ym) {
    if (!/^\d{4}-\d{2}$/.test(ym || '')) return { error: 'Pick a month.' };
    if (ym < START.slice(0, 7)) return { error: 'Billing starts 27 Oct 2026.' };
    var from = ym + '-01', to = lastDay(ym);
    if (ym === START.slice(0, 7)) from = START;
    return { from: from, to: to, month: ym };
  }
  function beeNextNumber(prefix, numbers) {
    var max = 0, re = new RegExp('^' + String(prefix).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '-(\\d+)$', 'i');
    (numbers || []).forEach(function (n) {
      var m = re.exec(String(n || ''));
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    var s = String(max + 1);
    while (s.length < 3) s = '0' + s;
    return prefix + '-' + s;
  }
  function beeSkipClientBill(site) {
    var code = site && site.code ? site.code : site;
    return !!byCode(code);
  }

  var api = {
    START: START,
    HST: HST,
    SITES: SITES,
    EXCLUDED: EXCLUDED,
    BILL_TO: BILL_TO,
    roundCent: roundCent,
    weekdaysInclusive: weekdaysInclusive,
    isFullMonth: isFullMonth,
    beeFlatQuote: beeFlatQuote,
    beeQuoteSite: beeQuoteSite,
    beeMonthPeriod: beeMonthPeriod,
    beeNextNumber: beeNextNumber,
    beeSkipClientBill: beeSkipClientBill,
    beeRefused: beeRefused,
    beeSite: byCode
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.BEE_START = START;
    window.BEE_SITES = SITES;
    window.BEE_EXCLUDED = EXCLUDED;
    window.BEE_BILL_TO = BILL_TO;
    window.beeFlatQuote = beeFlatQuote;
    window.beeQuoteSite = beeQuoteSite;
    window.beeMonthPeriod = beeMonthPeriod;
    window.beeNextNumber = beeNextNumber;
    window.beeSkipClientBill = beeSkipClientBill;
    window.beeRefused = beeRefused;
    window.beeSite = byCode;
  }
})();
