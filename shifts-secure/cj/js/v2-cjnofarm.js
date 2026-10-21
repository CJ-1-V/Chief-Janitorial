/* v2-cjnofarm.js – CJ twin (TEST): last-line safety net so NO farm wording reaches any CJ screen. calendar1, Oct 21 2026.
   Owner (Oct 21 2026): remove everything farm-related from the user-visible side (farm, grower, harvest, picking, packhouse,
   field labour, TFA …) and use cleaning terms (site, client, cleaner, visit). v2-cj-brand.js already rewrites most wording;
   this file catches anything left (new screens, pop-ups, notifications, toasts, page titles, placeholders, PDF/invoice text,
   download file names). Internal identifiers (file names, functions, DB columns shared with UnScramble) are NOT renamed.
   Loads LAST. TEST COPY ONLY. */
'use strict';
(function () {
  var R = [
    [/Grader \/ packer \/ field labour( \(all other roles\))?/g, 'Cleaner$1'],
    [/\bfarm ?workers?\b/gi, 'cleaners'], [/\bfarm ?hands?\b/gi, 'cleaners'], [/\bfarmers\b/gi, 'clients'], [/\bfarmer\b/gi, 'client'],
    [/\bfarm ?rates?\b/gi, 'site rates'], [/\bfarm ?codes?\b/gi, 'site code'], [/\bfarms\b/gi, 'sites'], [/\bfarm\b/gi, 'site'], [/farm/gi, 'site'],
    [/\bgrowers\b/gi, 'clients'], [/\bgrower\b/gi, 'client'], [/\bharvest(ing|s)?\b/gi, 'busy season'],
    [/\bfruit picking\b/gi, 'cleaning'], [/\bpickers\b/gi, 'cleaners'], [/\bpicker\b/gi, 'cleaner'], [/\bpicking\b/gi, 'cleaning'],
    [/\bpack ?houses?\b/gi, 'site'], [/\bpackers?\b/gi, 'cleaner'], [/\borchards?\b/gi, 'site'],
    [/\bfield (labour|labor)(ers?)?\b/gi, 'cleaning staff'], [/\bfield workers?\b/gi, 'cleaners'], [/\bfield work\b/gi, 'cleaning work'], [/\bfield crews?\b/gi, 'cleaning crew'], [/\bin the field\b/gi, 'on site'],
    [/\bTFA\b/g, 'agency']
  ];
  var TEST = /farm|grower|harvest|picker|picking|pack ?house|packer|orchard|field (labou?r|work|crew)|in the field|\bTFA\b|Grader \//i;
  function keepCase(src, rep) { if (src === src.toUpperCase() && /[A-Z]/.test(src) && src.length > 1) return rep.toUpperCase(); if (src[0] === src[0].toUpperCase() && /[A-Z]/.test(src[0])) return rep.charAt(0).toUpperCase() + rep.slice(1); return rep; }
  function clean(s) { if (s == null) return s; s = String(s); if (!TEST.test(s)) return s; R.forEach(function (r) { s = s.replace(r[0], function (m) { var out = m.replace(new RegExp(r[0].source, r[0].flags.replace('g', '')), r[1]); return keepCase(m, out); }); }); return s; }
  window.cjNoFarm = clean;
  function scrub(root) {
    if (!root) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), n;
    while ((n = w.nextNode())) { if (n.parentNode && /^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentNode.nodeName)) continue; if (TEST.test(n.nodeValue)) n.nodeValue = clean(n.nodeValue); }
    [].forEach.call(root.querySelectorAll ? root.querySelectorAll('[placeholder],[title],[aria-label],[alt],[download]') : [], function (e) { ['placeholder', 'title', 'aria-label', 'alt', 'download'].forEach(function (k) { var v = e.getAttribute(k); if (v && TEST.test(v)) e.setAttribute(k, clean(v)); }); });
    if (TEST.test(document.title)) document.title = clean(document.title);
  }
  window.cjNoFarmScrub = scrub;
  if (typeof afterRender === 'function') { var oar = afterRender; afterRender = function (root) { oar.apply(this, arguments); try { scrub(root || document.body); } catch (e) {} }; }
  if (typeof toast === 'function') { var ot = toast; toast = function (m) { return ot.call(this, clean(m)); }; window.toast = toast; }
  if (typeof notify === 'function') { var on = notify; notify = function (to, text, key) { return on.call(this, to, clean(text), key); }; window.notify = notify; }
  if (typeof invDoc === 'function') { var oi = invDoc; invDoc = function () { return (oi.apply(this, arguments) || []).map(function (l) { return l.map(function (x, i) { return i && typeof x === 'string' ? clean(x) : x; }); }); }; window.invDoc = invDoc; }
  if (typeof invFileName === 'function') { var of = invFileName; invFileName = function () { return clean(of.apply(this, arguments)); }; window.invFileName = invFileName; }
  try { new MutationObserver(function () { if (TEST.test(document.title)) document.title = clean(document.title); }).observe(document.querySelector('title') || document.head, { childList: true, subtree: true, characterData: true }); } catch (e) {}
})();
