/* cj_client_v1 view model.
   demoBundle() is the mock stand-in for the seven portal functions: it returns the
   same fields the draft SQL returns, and nothing else. mapBundle() copies an
   allow-list so a later column on those functions cannot appear on screen until
   this file is deliberately changed. No table reads, no worker ids, no rates. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CJClientV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var RANGE_DAYS = 21;
  var PAGES = ['visits', 'hours', 'checklists', 'requests', 'invoices'];
  var RPCS = [
    'cj_client_v1_whoami',
    'cj_client_v1_sites',
    'cj_client_v1_visits',
    'cj_client_v1_hours',
    'cj_client_v1_checklists',
    'cj_client_v1_requests',
    'cj_client_v1_invoices'
  ];

  function addDays(iso, n) {
    var p = String(iso).split('-');
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function defaultPeriod(asOf) {
    return { from: addDays(asOf, -RANGE_DAYS), to: asOf };
  }

  function inRange(date, period) {
    return date >= period.from && date <= period.to;
  }

  function minutes(hm) {
    var m = /^(\d{2}):(\d{2})$/.exec(hm || '');
    if (!m) return null;
    var h = +m[1], min = +m[2];
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
  }

  function hoursOnSite(start, end) {
    var s = minutes(start), e = minutes(end);
    if (s == null || e == null) return null;
    var d = e >= s ? e - s : e - s + 1440;
    return Math.round(d / 60 * 100) / 100;
  }

  function scrubNames(text, data) {
    var s = String(text || '');
    (data.workers || []).forEach(function (w) {
      if (w.name) s = s.split(w.name).join('Cleaner');
    });
    return s.replace(/[ ]{2,}/g, ' ').trim();
  }

  function clientOf(data, clientId) {
    return (data.clients || []).filter(function (c) { return c.id === clientId; })[0] || null;
  }

  function siteOf(client, code) {
    return (client.sites || []).filter(function (s) { return s.code === code; })[0] || null;
  }

  function crewMap(rows) {
    var groups = {};
    rows.forEach(function (r) {
      var k = r.site + '|' + r.date;
      var g = groups[k] || (groups[k] = {});
      var cur = g[r.workerId];
      if (!cur || r.sort < cur.sort || (r.sort === cur.sort && r.workerId < cur.workerId)) {
        g[r.workerId] = { workerId: r.workerId, sort: r.sort };
      }
    });
    var out = {};
    Object.keys(groups).forEach(function (k) {
      var list = Object.keys(groups[k]).map(function (id) { return groups[k][id]; });
      list.sort(function (a, b) {
        if (a.sort !== b.sort) return a.sort < b.sort ? -1 : 1;
        return a.workerId < b.workerId ? -1 : a.workerId > b.workerId ? 1 : 0;
      });
      list.forEach(function (p, i) {
        out[k + '|' + p.workerId] = list.length === 1 ? 'Cleaner' : ('Crew ' + (i + 1));
      });
    });
    return out;
  }

  function invoiceStatus(inv, asOf) {
    if (inv.paidAt) return 'Paid';
    if (inv.due && inv.due < asOf) return 'Overdue';
    return 'Unpaid';
  }

  function daysBetween(from, to) {
    if (!dateOk(from) || !dateOk(to)) return 0;
    var a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
    var b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
    return Math.round((b - a) / 86400000);
  }

  /* 2% a month only after the balance is more than 2 months (60 days) overdue,
     and only when the stored invoice is on the current terms. */
  function invoiceInterest(inv, asOf) {
    if (!inv || inv.new_terms !== true || inv.status === 'Paid') return null;
    var over = daysBetween(inv.due, asOf);
    var gate = inv.interest_after_days || 60;
    if (!(over > gate)) return null;
    var pct = inv.interest_pct == null ? 2 : +inv.interest_pct;
    var months = Math.ceil((over - gate) / 30);
    var amount = Math.round((+inv.total || 0) * pct / 100 * months * 100) / 100;
    if (!(amount > 0)) return null;
    return { months: months, pct: pct, amount: amount };
  }

  function requestStatus(status) {
    return { Requested: 1, Scheduled: 1, Declined: 1, Cancelled: 1 }[status] ? status : 'Closed';
  }

  function checklistStatus(status) {
    return { Done: 1, Partial: 1, Missed: 1 }[status] ? status : 'Not recorded';
  }

  /* One mock RPC. Field lists match cj-client-v1-001.sql. */
  function demoCall(data, clientId, name, period) {
    var client = clientOf(data, clientId);
    period = period || defaultPeriod(data.asOf);
    if (name === 'cj_client_v1_whoami') {
      if (!client) return { ok: false, client_label: null, role: null };
      return { ok: true, client_label: client.label, role: 'Client' };
    }
    if (!client) return [];

    if (name === 'cj_client_v1_sites') {
      return client.sites.map(function (s) {
        return { site_code: s.code, site_name: s.name };
      });
    }

    var visitRows = (data.visits || []).filter(function (v) {
      return v.clientId === clientId && inRange(v.date, period) && siteOf(client, v.site);
    });
    var checkRows = (data.checklists || []).filter(function (c) {
      return c.clientId === clientId && inRange(c.date, period) && siteOf(client, c.site);
    });
    var crew = crewMap(visitRows.map(function (v) {
      return { site: v.site, date: v.date, workerId: v.workerId, sort: v.start };
    }).concat(checkRows.map(function (c) {
      return { site: c.site, date: c.date, workerId: c.workerId, sort: (c.at || '').slice(11, 16) || '99:99' };
    })));

    if (name === 'cj_client_v1_visits') {
      return visitRows.map(function (v) {
        var site = siteOf(client, v.site);
        return {
          visit_id: v.id,
          site_code: site.code,
          site_name: site.name,
          visit_date: v.date,
          start_time: v.start,
          end_time: v.end,
          crew_label: crew[v.site + '|' + v.date + '|' + v.workerId] || 'Cleaner'
        };
      }).sort(sortVisits);
    }

    if (name === 'cj_client_v1_hours') {
      return visitRows.map(function (v) {
        var site = siteOf(client, v.site);
        return {
          visit_id: v.id,
          site_code: site.code,
          site_name: site.name,
          visit_date: v.date,
          start_time: v.start,
          end_time: v.end,
          hours_on_site: hoursOnSite(v.start, v.end),
          crew_label: crew[v.site + '|' + v.date + '|' + v.workerId] || 'Cleaner'
        };
      }).sort(sortVisits);
    }

    if (name === 'cj_client_v1_checklists') {
      return checkRows.map(function (c) {
        var site = siteOf(client, c.site);
        return {
          checklist_id: c.id,
          site_code: site.code,
          site_name: site.name,
          visit_date: c.date,
          status: checklistStatus(c.status),
          marked_at: c.at || null,
          crew_label: crew[c.site + '|' + c.date + '|' + c.workerId] || 'Cleaner',
          note: scrubNames(c.note, data),
          tasks: (c.tasks || []).map(function (t) {
            return { label: t.label, result: t.done ? 'Done' : 'Not done' };
          })
        };
      }).sort(function (a, b) {
        if (a.visit_date !== b.visit_date) return a.visit_date < b.visit_date ? 1 : -1;
        if (a.site_code !== b.site_code) return a.site_code < b.site_code ? -1 : 1;
        return a.crew_label < b.crew_label ? -1 : 1;
      });
    }

    if (name === 'cj_client_v1_requests') {
      return (data.requests || []).filter(function (r) {
        return r.clientId === clientId && siteOf(client, r.site);
      }).map(function (r) {
        var site = siteOf(client, r.site);
        return {
          request_no: r.no,
          site_code: site.code,
          site_name: site.name,
          kind: r.kind,
          preferred_date: r.date,
          preferred_time: r.when,
          frequency: r.freq,
          status: requestStatus(r.status),
          scheduled_date: r.status === 'Scheduled' ? (r.schedDate || null) : null,
          details: scrubNames(r.note, data)
        };
      }).sort(function (a, b) {
        if (a.preferred_date !== b.preferred_date) return a.preferred_date < b.preferred_date ? 1 : -1;
        return a.request_no < b.request_no ? 1 : -1;
      });
    }

    if (name === 'cj_client_v1_invoices') {
      return (data.invoices || []).filter(function (i) { return i.clientId === clientId; }).map(function (i) {
        var copy = Array.isArray(i.sentCopy) ? i.sentCopy.map(function (line) {
          return { k: line.k, t: scrubNames(line.t, data), v: line.v == null ? '' : String(line.v) };
        }) : null;
        return {
          invoice_no: i.number,
          period_start: i.periodStart,
          period_end: i.periodEnd,
          amount: i.amount,
          hst: i.hst,
          total: i.total,
          issued: i.issued,
          due: i.due,
          status: invoiceStatus(i, data.asOf),
          new_terms: i.terms === 'cj-2026-10',
          interest_pct: i.terms === 'cj-2026-10' ? 2 : null,
          interest_after_days: i.terms === 'cj-2026-10' ? 60 : null,
          sent_copy: copy
        };
      }).sort(function (a, b) {
        if (a.issued !== b.issued) return a.issued < b.issued ? 1 : -1;
        return a.invoice_no < b.invoice_no ? 1 : -1;
      });
    }

    return [];
  }

  function sortVisits(a, b) {
    if (a.visit_date !== b.visit_date) return a.visit_date < b.visit_date ? 1 : -1;
    if (a.site_code !== b.site_code) return a.site_code < b.site_code ? -1 : 1;
    if (a.start_time !== b.start_time) return a.start_time < b.start_time ? -1 : 1;
    return a.visit_id < b.visit_id ? -1 : 1;
  }

  function demoBundle(data, clientId, period) {
    period = period || defaultPeriod(data.asOf);
    var bundle = { period: { from: period.from, to: period.to }, asOf: data.asOf };
    RPCS.forEach(function (name) {
      var key = name.replace('cj_client_v1_', '');
      bundle[key] = demoCall(data, clientId, name, period);
    });
    return bundle;
  }

  function siteCode(s) { return /^[A-Z0-9-]{2,16}$/.test(s || '') ? s : null; }
  function dateOk(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s : null; }
  function timeOk(s) { return /^\d{2}:\d{2}$/.test(s || '') ? s : null; }
  function crewOk(s) { return /^(Cleaner|Crew [1-9][0-9]*)$/.test(s || '') ? s : 'Cleaner'; }
  function textOk(s, n) { return String(s == null ? '' : s).slice(0, n); }
  function moneyOk(n) {
    if (n == null || n === '' || !isFinite(+n)) return null;
    return Math.round(+n * 100) / 100;
  }

  function mapBundle(bundle) {
    bundle = bundle || {};
    var who = bundle.whoami || {};
    var view = {
      ok: !!who.ok,
      client_label: who.ok ? textOk(who.client_label || 'Client', 120) : '',
      role: who.ok ? 'Client' : '',
      period: bundle.period && dateOk(bundle.period.from) && dateOk(bundle.period.to)
        ? { from: bundle.period.from, to: bundle.period.to }
        : null,
      sites: [],
      visits: [],
      hours: [],
      checklists: [],
      requests: [],
      invoices: []
    };
    if (!view.ok) return view;

    (bundle.sites || []).forEach(function (s) {
      var code = siteCode(s && s.site_code);
      if (!code) return;
      view.sites.push({ site_code: code, site_name: textOk(s.site_name || code, 160) });
    });

    (bundle.visits || []).forEach(function (r) {
      var code = siteCode(r && r.site_code), day = dateOk(r && r.visit_date);
      var start = timeOk(r && r.start_time), end = timeOk(r && r.end_time);
      if (!code || !day || !start || !end) return;
      view.visits.push({
        visit_id: textOk(r.visit_id, 40),
        site_code: code,
        site_name: textOk(r.site_name || code, 160),
        visit_date: day,
        start_time: start,
        end_time: end,
        crew_label: crewOk(r.crew_label)
      });
    });

    (bundle.hours || []).forEach(function (r) {
      var code = siteCode(r && r.site_code), day = dateOk(r && r.visit_date);
      var start = timeOk(r && r.start_time), end = timeOk(r && r.end_time);
      if (!code || !day || !start || !end) return;
      view.hours.push({
        visit_id: textOk(r.visit_id, 40),
        site_code: code,
        site_name: textOk(r.site_name || code, 160),
        visit_date: day,
        start_time: start,
        end_time: end,
        hours_on_site: hoursOnSite(start, end),
        crew_label: crewOk(r.crew_label)
      });
    });

    (bundle.checklists || []).forEach(function (r) {
      var code = siteCode(r && r.site_code), day = dateOk(r && r.visit_date);
      if (!code || !day) return;
      var tasks = [];
      (Array.isArray(r.tasks) ? r.tasks : []).forEach(function (t) {
        var label = textOk(t && t.label, 160);
        if (!label) return;
        tasks.push({ label: label, result: t.result === 'Done' ? 'Done' : 'Not done' });
      });
      view.checklists.push({
        checklist_id: textOk(r.checklist_id, 40),
        site_code: code,
        site_name: textOk(r.site_name || code, 160),
        visit_date: day,
        status: checklistStatus(r.status),
        marked_at: /^\d{4}-\d{2}-\d{2}/.test(r.marked_at || '') ? String(r.marked_at).slice(0, 25) : '',
        crew_label: crewOk(r.crew_label),
        note: textOk(r.note, 500),
        tasks: tasks
      });
    });

    (bundle.requests || []).forEach(function (r) {
      var code = siteCode(r && r.site_code);
      if (!code) return;
      view.requests.push({
        request_no: textOk(r.request_no, 24),
        site_code: code,
        site_name: textOk(r.site_name || code, 160),
        kind: textOk(r.kind, 160),
        preferred_date: dateOk(r.preferred_date) || '',
        preferred_time: textOk(r.preferred_time, 80),
        frequency: textOk(r.frequency, 80),
        status: requestStatus(r.status),
        scheduled_date: dateOk(r.scheduled_date) || '',
        details: textOk(r.details, 1000)
      });
    });

    (bundle.invoices || []).forEach(function (r) {
      var no = textOk(r && r.invoice_no, 32);
      if (!no) return;
      var status = { Paid: 1, Unpaid: 1, Overdue: 1 }[r.status] ? r.status : 'Unpaid';
      var kinds = { h: 1, s: 1, b: 1, t: 1, r: 1, rb: 1, g: 1 };
      var copy = null;
      if (Array.isArray(r.sent_copy)) {
        copy = r.sent_copy.map(function (line) {
          var k = kinds[line && line.k] ? line.k : 't';
          return { k: k, t: textOk(line && line.t, 400), v: textOk(line && line.v, 40) };
        }).filter(function (line) { return line.k === 'g' || line.t; }).slice(0, 80);
      }
      var row = {
        invoice_no: no,
        period_start: dateOk(r.period_start) || '',
        period_end: dateOk(r.period_end) || '',
        amount: moneyOk(r.amount),
        hst: moneyOk(r.hst),
        total: moneyOk(r.total),
        issued: dateOk(r.issued) || '',
        due: dateOk(r.due) || '',
        status: status,
        new_terms: r.new_terms === true,
        interest_pct: r.new_terms === true ? 2 : null,
        interest_after_days: r.new_terms === true ? 60 : null,
        sent_copy: copy
      };
      row.interest = invoiceInterest(row, dateOk(bundle.asOf) || '');
      view.invoices.push(row);
    });

    return view;
  }

  function buildPortal(data, clientId, period) {
    return mapBundle(demoBundle(data, clientId, period));
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function longDay(iso) {
    if (!dateOk(iso)) return '';
    var p = iso.split('-');
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    var w = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getUTCDay()];
    var m = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][d.getUTCMonth()];
    return w + ' ' + d.getUTCDate() + ' ' + m + ' ' + d.getUTCFullYear();
  }

  function shortDay(iso) {
    if (!dateOk(iso)) return '';
    var p = iso.split('-');
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    var m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
    return d.getUTCDate() + ' ' + m + ' ' + d.getUTCFullYear();
  }

  function money(n) {
    if (n == null || !isFinite(+n)) return '—';
    var s = Math.abs(+n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (+n < 0 ? '−$' : '$') + s;
  }

  function hoursText(n) {
    if (n == null || !isFinite(+n)) return '—';
    return (+n).toFixed(2) + ' h';
  }

  function markedText(iso) {
    if (!iso) return '';
    var day = iso.slice(0, 10);
    var hm = (iso.match(/T(\d{2}:\d{2})/) || [])[1] || '';
    return shortDay(day) + (hm ? ', ' + hm : '');
  }

  function pill(status) {
    var cls = {
      Done: 'ok', Partial: 'warn', Missed: 'bad', 'Not recorded': 'mut',
      Requested: 'warn', Scheduled: 'ok', Declined: 'bad', Cancelled: 'mut', Closed: 'mut',
      Paid: 'ok', Unpaid: 'warn', Overdue: 'bad'
    }[status] || 'mut';
    return '<span class="pill ' + cls + '">' + esc(status) + '</span>';
  }

  function periodLine(view) {
    if (!view.period) return '';
    return esc(shortDay(view.period.from) + ' – ' + shortDay(view.period.to));
  }

  function empty(msg) {
    return '<p class="empty">' + esc(msg) + '</p>';
  }

  function renderVisits(view) {
    var rows = view.visits || [];
    var body = rows.length ? rows.map(function (r) {
      return '<article class="card" data-site="' + esc(r.site_code) + '" data-crew="' + esc(r.crew_label) + '">' +
        '<div class="card-top"><div><p class="kicker">' + esc(longDay(r.visit_date)) + '</p>' +
        '<h2>' + esc(r.site_code) + ' · ' + esc(r.site_name) + '</h2></div>' +
        '<b class="when">' + esc(r.start_time) + '–' + esc(r.end_time) + '</b></div>' +
        '<p class="meta"><span class="role">' + esc(r.crew_label) + '</span></p></article>';
    }).join('') : empty('No visits in this period.');
    return '<h1>Visits</h1><p class="lead">Arrival and departure at your sites. ' + periodLine(view) + '.</p>' + body;
  }

  function renderHours(view) {
    var rows = view.hours || [];
    var total = rows.reduce(function (a, r) { return a + (+r.hours_on_site || 0); }, 0);
    var bySite = {};
    rows.forEach(function (r) {
      bySite[r.site_code] = bySite[r.site_code] || { name: r.site_name, hours: 0 };
      bySite[r.site_code].hours += +r.hours_on_site || 0;
    });
    var sites = Object.keys(bySite).sort().map(function (code) {
      return '<li data-site="' + esc(code) + '"><span>' + esc(code) + ' · ' + esc(bySite[code].name) + '</span><b>' + esc(hoursText(bySite[code].hours)) + '</b></li>';
    }).join('');
    var table = rows.length ? '<div class="tw"><table><thead><tr><th>Date</th><th>Site</th><th>Crew</th><th>Time</th><th>Hours</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr data-site="' + esc(r.site_code) + '" data-crew="' + esc(r.crew_label) + '" data-hours="' + esc(hoursText(r.hours_on_site)) + '">' +
          '<td>' + esc(shortDay(r.visit_date)) + '</td><td>' + esc(r.site_code) + ' · ' + esc(r.site_name) + '</td>' +
          '<td>' + esc(r.crew_label) + '</td><td>' + esc(r.start_time) + '–' + esc(r.end_time) + '</td>' +
          '<td class="num">' + esc(hoursText(r.hours_on_site)) + '</td></tr>';
      }).join('') + '</tbody></table></div>' : empty('No hours on site in this period.');
    return '<h1>Hours on site</h1><p class="lead">Time between arrival and departure. ' + periodLine(view) + '.</p>' +
      '<section class="total"><p class="kicker">Hours on site</p><p class="big" id="hours-total">' + esc(hoursText(Math.round(total * 100) / 100)) + '</p>' +
      (sites ? '<ul class="site-totals">' + sites + '</ul>' : '') + '</section>' + table;
  }

  function renderChecks(view) {
    var rows = view.checklists || [];
    if (!rows.length) {
      return '<h1>Checklists</h1><p class="lead">Results recorded at your sites. ' + periodLine(view) + '.</p>' + empty('No checklist results in this period.');
    }
    return '<h1>Checklists</h1><p class="lead">Results recorded at your sites. ' + periodLine(view) + '.</p>' +
      rows.map(function (r) {
        var tasks = (r.tasks || []).map(function (t) {
          return '<li class="' + (t.result === 'Done' ? 'done' : 'open') + '"><span>' + esc(t.label) + '</span><b>' + esc(t.result) + '</b></li>';
        }).join('');
        return '<article class="card" data-site="' + esc(r.site_code) + '" data-crew="' + esc(r.crew_label) + '" data-status="' + esc(r.status) + '">' +
          '<div class="card-top"><div><p class="kicker">' + esc(longDay(r.visit_date)) + '</p>' +
          '<h2>' + esc(r.site_code) + ' · ' + esc(r.site_name) + '</h2></div>' + pill(r.status) + '</div>' +
          '<p class="meta"><span class="role">' + esc(r.crew_label) + '</span>' +
          (r.marked_at ? '<span>Marked ' + esc(markedText(r.marked_at)) + '</span>' : '') + '</p>' +
          (tasks ? '<ul class="tasks">' + tasks + '</ul>' : '') +
          (r.note ? '<p class="note">' + esc(r.note) + '</p>' : '') + '</article>';
      }).join('');
  }

  function renderRequests(view) {
    var rows = view.requests || [];
    if (!rows.length) {
      return '<h1>Cleaning requests</h1><p class="lead">Requests sent for your sites.</p>' + empty('No cleaning requests.');
    }
    return '<h1>Cleaning requests</h1><p class="lead">Requests sent for your sites.</p>' +
      rows.map(function (r) {
        return '<article class="card" data-site="' + esc(r.site_code) + '" data-request="' + esc(r.request_no) + '">' +
          '<div class="card-top"><div><p class="kicker">' + esc(r.request_no) + '</p><h2>' + esc(r.kind) + '</h2></div>' + pill(r.status) + '</div>' +
          '<dl class="facts"><div><dt>Site</dt><dd>' + esc(r.site_code) + ' · ' + esc(r.site_name) + '</dd></div>' +
          '<div><dt>Preferred</dt><dd>' + esc(shortDay(r.preferred_date) || '—') + (r.preferred_time ? ' · ' + esc(r.preferred_time) : '') + '</dd></div>' +
          '<div><dt>How often</dt><dd>' + esc(r.frequency || '—') + '</dd></div>' +
          (r.scheduled_date ? '<div><dt>Scheduled</dt><dd>' + esc(shortDay(r.scheduled_date)) + '</dd></div>' : '') +
          '</dl>' + (r.details ? '<p class="note">' + esc(r.details) + '</p>' : '') + '</article>';
      }).join('');
  }

  function invoicePrefix(rows) {
    var prefs = {};
    (rows || []).forEach(function (r) {
      var m = /^([A-Z0-9]+(?:-[A-Z0-9]+)*)-\d{3}$/.exec(r.invoice_no || '');
      if (m) prefs[m[1]] = 1;
    });
    var keys = Object.keys(prefs);
    return keys.length === 1 ? keys[0] : '';
  }

  function renderInvoices(view) {
    var rows = view.invoices || [];
    if (!rows.length) {
      return '<h1>Invoices</h1><p class="lead">Invoices for your sites.</p>' + empty('No invoices.');
    }
    var prefix = invoicePrefix(rows);
    return '<h1>Invoices</h1><p class="lead">Your invoice numbers use the prefix ' + esc(prefix || 'on the invoice') + ' and a 3-digit running number.</p>' +
      rows.map(function (r) {
        return '<article class="card inv" data-invoice="' + esc(r.invoice_no) + '">' +
          '<div class="card-top"><div><p class="kicker">' + esc(r.invoice_no) + '</p>' +
          '<h2>' + esc(shortDay(r.period_start)) + ' – ' + esc(shortDay(r.period_end)) + '</h2></div>' + pill(r.status) + '</div>' +
          '<dl class="facts money">' +
          '<div><dt>Amount</dt><dd>' + esc(money(r.amount)) + '</dd></div>' +
          '<div><dt>Tax</dt><dd>' + esc(money(r.hst)) + '</dd></div>' +
          '<div><dt>Total</dt><dd><b>' + esc(money(r.total)) + '</b></dd></div>' +
          '</dl><p class="meta"><span>Issued ' + esc(shortDay(r.issued) || '—') + '</span><span>Due ' + esc(shortDay(r.due) || '—') + '</span>' +
          '<a class="inv-open" href="#/invoice/' + esc(r.invoice_no) + '">View invoice</a></p></article>';
      }).join('');
  }

  function renderCopyLine(line) {
    if (line.k === 'g') return '<hr>';
    if (line.k === 'h') return '<p class="co">' + esc(line.t) + '</p>';
    if (line.k === 'b') return '<h1>' + esc(line.t) + '</h1>';
    if (line.k === 's') return '<p class="fine">' + esc(line.t) + '</p>';
    if (line.k === 't') return '<p class="line">' + esc(line.t) + '</p>';
    return '<div class="rowline' + (line.k === 'rb' ? ' total' : '') + '"><span>' + esc(line.t) + '</span><b>' + esc(line.v || '') + '</b></div>';
  }

  /* Prints the stored email copy. Payment terms are not added here. */
  function renderInvoiceDoc(view, no) {
    var rows = (view && view.invoices) || [];
    var inv = rows.filter(function (r) { return r.invoice_no === no; })[0];
    if (!inv) {
      return '<h1>Invoice</h1><p class="empty">That invoice is not on this account.</p><p><a href="#/invoices">All invoices</a></p>';
    }
    var stored = inv.sent_copy && inv.sent_copy.length ? inv.sent_copy.map(renderCopyLine).join('') : (
      '<h1>Invoice ' + esc(inv.invoice_no) + '</h1>' +
      '<div class="rowline"><span>Amount</span><b>' + esc(money(inv.amount)) + '</b></div>' +
      '<div class="rowline"><span>Tax</span><b>' + esc(money(inv.hst)) + '</b></div>' +
      '<div class="rowline total"><span>Total</span><b>' + esc(money(inv.total)) + '</b></div>'
    );
    var extra = '';
    if (inv.interest) {
      var owing = Math.round(((+inv.total || 0) + inv.interest.amount) * 100) / 100;
      extra = '<div class="rowline"><span>Interest on a balance more than 2 months overdue (' + esc(String(inv.interest.months)) +
        (inv.interest.months === 1 ? ' month' : ' months') + ' × ' + esc(String(inv.interest.pct)) + '%)</span><b>' + esc(money(inv.interest.amount)) + '</b></div>' +
        '<div class="rowline total"><span>Now owing</span><b>' + esc(money(owing)) + '</b></div>';
    }
    return '<p class="lead"><a href="#/invoices">All invoices</a></p>' +
      '<article class="paper" id="invoice-doc" data-invoice="' + esc(inv.invoice_no) + '" data-new-terms="' + (inv.new_terms ? 'true' : 'false') + '">' +
      stored + extra + '</article>';
  }

  var RENDER = {
    visits: renderVisits,
    hours: renderHours,
    checklists: renderChecks,
    requests: renderRequests,
    invoices: renderInvoices
  };

  function renderData(view, page, invoiceNo) {
    if (page === 'invoice') return renderInvoiceDoc(view || { ok: false }, invoiceNo || '');
    var fn = RENDER[page] || renderVisits;
    return fn(view || { ok: false });
  }

  function renderAllData(view) {
    return PAGES.map(function (p) { return renderData(view, p); }).join('\n');
  }

  function moneyForms(n) {
    if (n == null || !isFinite(+n)) return [];
    var s = Math.abs(+n).toFixed(2);
    var comma = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return [s, comma, '$' + comma, '−$' + comma];
  }

  function needles(data, clientId) {
    var list = [];
    (data.workers || []).forEach(function (w) {
      if (w.name) list.push(w.name);
      if (w.payCode) list.push(w.payCode);
      moneyForms(w.payRate).forEach(function (x) { list.push(x); });
    });
    (data.clients || []).forEach(function (c) {
      if (c.rateCode) list.push(c.rateCode);
      moneyForms(c.billRate).forEach(function (x) { list.push(x); });
      (c.sites || []).forEach(function (s) { if (s.ownerName) list.push(s.ownerName); });
      if (c.id === clientId) return;
      if (c.label) list.push(c.label);
      (c.sites || []).forEach(function (s) {
        list.push(s.code);
        list.push(s.name);
      });
    });
    (data.requests || []).forEach(function (r) { if (r.clientId !== clientId) list.push(r.no); });
    (data.invoices || []).forEach(function (i) {
      if (i.clientId !== clientId) {
        list.push(i.number);
        moneyForms(i.amount).forEach(function (x) { list.push(x); });
        moneyForms(i.hst).forEach(function (x) { list.push(x); });
        moneyForms(i.total).forEach(function (x) { list.push(x); });
      }
    });
    return list.filter(Boolean);
  }

  function privacyFindings(view, html, data, clientId) {
    var blob = JSON.stringify(view) + '\n' + String(html || '');
    var problems = [];
    needles(data, clientId).forEach(function (n) {
      if (blob.indexOf(n) >= 0) problems.push(n);
    });
    function walk(o, path) {
      if (!o || typeof o !== 'object') return;
      Object.keys(o).forEach(function (k) {
        if (/user|worker|pay|rate|wage|owner|phone|email/i.test(k)) problems.push('key ' + path + k);
        walk(o[k], path + k + '.');
      });
    }
    walk(view, '');
    return problems;
  }

  return {
    RANGE_DAYS: RANGE_DAYS,
    PAGES: PAGES,
    RPCS: RPCS,
    addDays: addDays,
    defaultPeriod: defaultPeriod,
    hoursOnSite: hoursOnSite,
    demoCall: demoCall,
    demoBundle: demoBundle,
    mapBundle: mapBundle,
    buildPortal: buildPortal,
    renderData: renderData,
    renderInvoiceDoc: renderInvoiceDoc,
    invoiceInterest: invoiceInterest,
    renderAllData: renderAllData,
    needles: needles,
    privacyFindings: privacyFindings,
    esc: esc,
    longDay: longDay,
    shortDay: shortDay,
    money: money
  };
});
