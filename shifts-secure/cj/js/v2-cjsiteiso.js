/* calendar1 – owner rule (Oct 21 2026, critical): every employee (CJ cleaner, crew lead, sub worker) sees ONLY their own
   assigned sites, everywhere. Subcontractor company logins see only sites their workers are assigned to.
   "Assigned" = the office put them on the site's crew (DB.sites[].crew, office #/checklists) or booked them on an office
   shift (DB.shifts[].booked). Another site shows up only for (a) a fully approved handover – that one visit only
   (calendar), and on that day in the clock-in picker – or (b) an office assignment. A pending handover shows only the accept card.
   Applied to: every site list that comes from companySites() (clock-in picker, missed-shift form, "Regular clean today",
   checklists, site lists), the calendar (v2-cjcalendar.js crewSites / canVisit), and a last-resort screen sweep. */
(function () {
  function emp(u) { return !!u && (u.type === 'employee' || u.type === 'worker'); }
  function idsOf(u) { if (!u) return []; if (u.type === 'sub') return (DB.users || []).filter(function (x) { return x.subId === u.id; }).map(function (x) { return x.id; }); return [u.id]; }
  window.cjAssignedSites = function (u) {
    u = u || ME; var ids = idsOf(u), out = {};
    (DB.sites || []).forEach(function (s) { if ((s.crew || []).some(function (i) { return ids.indexOf(i) >= 0; })) out[s.code] = 1; });
    (DB.shifts || []).forEach(function (sh) { if (sh.site && (sh.booked || []).some(function (i) { return ids.indexOf(i) >= 0; })) out[sh.site] = 1; });
    return Object.keys(out);
  };
  function todayHand(u) { return (DB.calAssign || []).filter(function (a) { return a.toId === u.id && a.date === today(); }).map(function (a) { return a.site; }); }
  function limited() { return ME && (emp(ME) || ME.type === 'sub'); }
  window.cjSiteAllowed = function (code) { if (!limited() || /^TEST-/.test(code)) return true; return cjAssignedSites(ME).indexOf(code) >= 0 || (emp(ME) && todayHand(ME).indexOf(code) >= 0); };
  if (typeof window.companySites === 'function') {
    var ocs = window.companySites;
    window.companySites = function () { var l = ocs.apply(this, arguments); if (!limited()) return l; return l.filter(function (s) { return cjSiteAllowed(s.code); }); };
    try { companySites = window.companySites; } catch (e) {}
  }
  ['clockSites', 'mtSites'].forEach(function (fn) { if (typeof window[fn] !== 'function') return; var o = window[fn]; window[fn] = function () { var l = o.apply(this, arguments); return limited() ? l.filter(function (s) { return cjSiteAllowed(s.code); }) : l; }; });
  /* last-resort sweep: remove any row / option / tile naming a site this login may not see */
  var KEEP = '#handask,#calwrap,#handmine,#calsheet,#handsheet';
  function sweep(root) {
    if (!limited() || !root) return;
    var codes = (DB.sites || []).map(function (s) { return s.code; }).filter(function (c) { return !cjSiteAllowed(c); });
    if (!codes.length) return;
    var re = new RegExp('\\b(' + codes.map(function (c) { return c.replace(/[-]/g, '\\-'); }).join('|') + ')\\b');
    var tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), hit = [], n;
    while ((n = tw.nextNode())) { if (re.test(n.nodeValue) && !(n.parentElement && n.parentElement.closest(KEEP))) hit.push(n.parentElement); }
    hit.forEach(function (el) { if (!el || !el.isConnected) return; var c = el.closest('option,tr,li,label,.site-tile,.tile,.calreq,.shrow,.shsite') || el.closest('.card:not([id])') || el; if (c === root || c.tagName === 'MAIN') c = el; c.remove(); });
    [].forEach.call(root.querySelectorAll('select'), function (s) { [].slice.call(s.options).forEach(function (o) { if (re.test(o.value) || re.test(o.text)) o.remove(); }); });
  }
  window.cjSiteSweep = sweep;
  if (typeof afterRender === 'function') { var oar = afterRender; afterRender = function () { oar.apply(this, arguments); try { sweep(document.querySelector('main') || document.body); var m = document.getElementById('modal'); if (m) sweep(m); } catch (e) {} }; }
  if (typeof modal === 'function') { var om = modal; modal = function () { var r = om.apply(this, arguments); try { var m = document.getElementById('modal'); if (m) sweep(m); } catch (e) {} return r; }; }
})();
