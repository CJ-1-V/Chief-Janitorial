/* Client portal shell. Talks only to CJClientV1 (the cj_client_v1 field list).
   ?store=mock loads the demo fixture. Any other address shows a closed screen and
   does not read the fixture into the page. This file does not call the network. */
(function () {
  'use strict';

  var V = window.CJClientV1;
  var D = window.CJClientDemo;
  var C = window.CJ_CLIENT;

  function qs(name) {
    return new URLSearchParams(location.search).get(name) || '';
  }

  function storeMode() {
    return qs('store') === 'mock' ? 'mock' : '';
  }

  function asOf() {
    var q = qs('asof');
    if (/^\d{4}-\d{2}-\d{2}$/.test(q)) return q;
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Halifax', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    } catch (e) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function demoKey() {
    var key = qs('demo');
    var known = (D.clients() || []).filter(function (c) { return c.key === key; })[0];
    return known ? known.key : '';
  }

  function pageName() {
    var h = (location.hash || '').replace(/^#\/?/, '');
    return V.PAGES.indexOf(h) >= 0 ? h : 'visits';
  }

  function setApp(html) {
    var el = document.getElementById('app');
    el.innerHTML = html;
  }

  function nav(active) {
    var items = [
      ['visits', 'Visits'],
      ['hours', 'Hours'],
      ['checklists', 'Checklists'],
      ['requests', 'Requests'],
      ['invoices', 'Invoices']
    ];
    return '<nav class="tabs" aria-label="Client portal">' + items.map(function (it) {
      var on = it[0] === active;
      return '<a href="#/' + it[0] + '"' + (on ? ' aria-current="page"' : '') + '>' + it[1] + '</a>';
    }).join('') + '</nav>';
  }

  function brand() {
    return '<a class="brand" href="#/visits"><img src="../assets/cj_Logo.png" alt="Chief Janitorial" width="168" height="44"></a>';
  }

  function shell(view, active) {
    var demos = D.clients();
    var current = demoKey();
    var options = demos.map(function (c) {
      return '<option value="' + V.esc(c.key) + '"' + (c.key === current ? ' selected' : '') + '>' + V.esc(c.label) + '</option>';
    }).join('');
    return '<header class="top">' + brand() +
      '<div class="who"><b>' + V.esc(view.client_label) + '</b><span>' + V.esc(view.role || 'Client') + '</span></div></header>' +
      '<div class="banner"><p><b>Demo client.</b> Sample data as of ' + V.esc(V.shortDay(asOf())) + '. People on site are shown as Cleaner or a crew number.</p>' +
      '<label>Demo client <select id="demo-client">' + options + '</select></label></div>' +
      nav(active) +
      '<main id="portal-data">' + V.renderData(view, active) + '</main>' +
      '<footer>Client portal · ' + V.esc(C.version) + '</footer>';
  }

  function renderClosed() {
    setApp('<header class="top">' + brand() + '<div class="who"><b>Client portal</b><span>' + V.esc(C.version) + '</span></div></header>' +
      '<main class="gate" id="portal-gate"><h1>Client portal</h1>' +
      '<p>Open this page with <b>?store=mock</b> to use the demo client. The demo uses fictional sites and sample visits, hours, checklists, cleaning requests and invoices.</p>' +
      '<p>Live reading stays on the versioned functions ' + V.esc(C.rpcs.join(', ')) + '. This page does not call the database.</p></main>');
  }

  function renderOff() {
    setApp('<main class="gate" id="portal-gate"><h1>Client portal</h1><p>This portal is switched off.</p></main>');
  }

  function renderChooser() {
    var cards = D.clients().map(function (c) {
      return '<a class="choice" href="?store=mock&amp;demo=' + V.esc(c.key) + '&amp;asof=' + V.esc(asOf()) + '#/visits">' +
        '<b>' + V.esc(c.label) + '</b><span>Demo client</span></a>';
    }).join('');
    setApp('<header class="top">' + brand() + '<div class="who"><b>Client portal</b><span>Demo</span></div></header>' +
      '<main class="gate" id="portal-gate"><h1>Demo client</h1>' +
      '<p>Sample sites and sample invoices. These are not real clients. People on site are shown as Cleaner or a crew number.</p>' +
      '<div class="choices">' + cards + '</div></main>');
  }

  function renderPortal() {
    var key = demoKey();
    var rec = D.clients().filter(function (c) { return c.key === key; })[0];
    var data = D.dataset(asOf());
    var view = V.buildPortal(data, rec.id);
    window.CJ_CLIENT_VIEW = view;
    setApp(shell(view, pageName()));
    document.title = view.client_label + ' · Client portal';
  }

  function boot() {
    if (!C || C.cjClientPortal !== true || !C.rpcs || C.rpcs.join() !== V.RPCS.join()) {
      renderOff();
      return;
    }
    if (storeMode() !== 'mock') {
      renderClosed();
      return;
    }
    if (!demoKey()) {
      renderChooser();
      return;
    }
    renderPortal();
  }

  document.addEventListener('change', function (e) {
    if (!e.target || e.target.id !== 'demo-client') return;
    var u = new URL(location.href);
    u.searchParams.set('store', 'mock');
    u.searchParams.set('demo', e.target.value);
    if (!u.searchParams.get('asof')) u.searchParams.set('asof', asOf());
    location.href = u.pathname + '?' + u.searchParams.toString() + (location.hash || '#/visits');
  });

  window.addEventListener('hashchange', function () {
    if (storeMode() === 'mock' && demoKey()) renderPortal();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
