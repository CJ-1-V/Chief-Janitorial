/* calendar1 – owner Oct 21 2026: clients (main account and team members) see NO hours.
   Removes "Hours by day", "Past hours" and "Shifts at your sites – ask to change hours" from every client / team screen,
   and blocks their direct routes. Special-cleaning bookings keep their own people × hours order details (priced per hour). */
(function () {
  if (typeof afterRender !== 'function') return;
  var SECT = ['#sect-hours', '#sect-past', '#sect-shifts', '#pasthours', '#hcwrap', '#firmhours', '#cjtfirmhours'];
  var HEAD = /^(Hours by day|Hours and billing by day|Past hours|Shifts at your sites|Hours wrong\?)/i;
  function isClient() { return !!(ME && ME.type === 'firm'); }
  function strip(root) {
    SECT.forEach(function (s) { [].forEach.call(root.querySelectorAll(s), function (e) { var c = e.closest('details.sect') || e.closest('.card') || e; c.remove(); }); });
    [].forEach.call(root.querySelectorAll('h1,h2,h3,summary,.hc-box b'), function (h) { if (!HEAD.test((h.textContent || '').trim())) return; var c = h.closest('details.sect') || h.closest('.card') || h.closest('section') || h.parentElement; if (c && c !== root && !c.querySelector('#calwrap')) c.remove(); });
    [].forEach.call(root.querySelectorAll('a[href="#/pasthours"],a[href="#/hours"],[data-act=hcopen],[data-act=pastcsv]'), function (a) { a.remove(); });
  }
  /* polish Oct 21: drop the older per-client block (duplicate h1 + day-change / special buttons); keep the unique parts
     (client banner, monthly bill, upcoming special jobs, contact) under one tidy "Your account" heading */
  function tidy(root) {
    var top = root.querySelector('.hometop'); if (!top || top.dataset.tidy) return; top.dataset.tidy = '1';
    [].slice.call(top.children).forEach(function (e) {
      if (e.id === 'cjmonthly' || e.querySelector('#cjmonthly')) return;
      if (/^H1$/.test(e.tagName) || e.querySelector('[data-act=calchange],[data-k=special]') || e.matches('[data-act=calchange],[data-k=special]')) e.remove();
    });
    var ban = root.querySelector('#clientlinkbanner'), h = document.createElement('h2'); h.className = 'cjacct-h'; h.id = 'cjaccthead'; h.textContent = 'Your account';
    top.insertBefore(h, top.firstChild); if (ban) top.insertBefore(ban, h.nextSibling);
  }
  window.cjNoHoursStrip = strip;
  var oar = afterRender; afterRender = function (root) { oar.apply(this, arguments); try { if (isClient()) { var R = document.querySelector('main') || document.body; strip(R); tidy(R); [0, 120, 400].forEach(function (ms) { setTimeout(function () { try { if (isClient()) tidy(document.querySelector('main') || document.body); } catch (e) {} }, ms); }); } } catch (e) {} };
  if (typeof NAV !== 'undefined' && NAV.firm) NAV.firm = NAV.firm.filter(function (n) { return !/^#\/(pasthours|hours|hourschange)$/.test(n[0]); });
})();
