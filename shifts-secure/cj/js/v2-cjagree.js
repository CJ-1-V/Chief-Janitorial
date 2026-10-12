/* v2-cjagree.js – CJ twin (TEST): install the Chief Janitorial Cleaner Agreement. golive2, Oct 9 2026.
   Loads right after agreements/cj-cleaner-agreement-DRAFT.js (which adds TERMS_DEF/TERMS_TEXT.cleaner_agreement) and after every
   file that defines agreement texts (core.js, v2-agreements.js, v2-roles.js, v2-seed.js, v2-icsa*.js).
   - Employees, subcontractors and subcontractor workers sign ONE agreement: "Cleaner Agreement" (+ the Privacy Notice, as before).
   - The UnScramble / farm-labour sample terms are retired for CJ: Master Labour Contract Agreement, Schedule A (commercial terms),
     Schedule C (worker acknowledgement) and the old Employee Terms sample. They are kept in TERMS_DEF only so old acceptance
     records still have a name, but nobody is asked to sign them and the office Terms page does not list them.
   - Mock seed: sample people who had signed the retired terms are recorded as having signed the Cleaner Agreement v1.0 instead,
     so the test flows are unchanged. A browser that already has saved test data gets the Cleaner Agreement added (and is asked to sign).
   - Real data: the settings row (cj-main) gets the agreement from the app defaults; acceptances go to reg_terms_acceptances as before.
   DRAFT – NOT LEGAL ADVICE. The owner (and a lawyer) must approve the wording before real cleaners sign it. */
'use strict';
(function () {
  if (typeof TERMS_DEF === 'undefined' || !TERMS_DEF.cleaner_agreement) return;
  var C = window.REG_STORE || {};
  if (C.companyId && C.companyId !== 'cj') return;
  var RETIRED = ['sub_agreement', 'schedule_a', 'schedule_c', 'employee_terms'];
  RETIRED.forEach(function (k) { if (TERMS_DEF[k]) { TERMS_DEF[k].types = []; TERMS_DEF[k].retired = true; } });
  window.CJ_RETIRED_TERMS = RETIRED;

  function ensureTerm(db) {
    if (!db || !db.settings) return false;
    var t = db.settings.terms = db.settings.terms || {};
    if (t.cleaner_agreement && t.cleaner_agreement.text) return false;
    t.cleaner_agreement = { version: '1.0', publishedAt: (typeof today === 'function' ? today() : new Date().toISOString().slice(0, 10)), text: TERMS_TEXT.cleaner_agreement, note: 'First version (DRAFT – owner to approve)' };
    return true;
  }
  /* mock seed: move sample acceptances of the retired terms to the Cleaner Agreement (one per person) */
  if (typeof seedData === 'function') {
    var _sd = seedData;
    seedData = function () {
      var db = _sd.apply(this, arguments);
      try {
        ensureTerm(db);
        var seen = {};
        (db.acceptances || []).forEach(function (a) {
          if (RETIRED.indexOf(a.key) < 0) return;
          if (seen[a.userId]) { a._drop = true; return; }
          seen[a.userId] = 1; a.key = 'cleaner_agreement'; a.name = TERMS_DEF.cleaner_agreement.name; a.version = '1.0'; delete a.employerId; delete a.warranty;
        });
        db.acceptances = (db.acceptances || []).filter(function (a) { return !a._drop; });
      } catch (e) { console.warn('cjagree seed', e); }
      return db;
    };
  }
  /* saved test data from before golive2: add the agreement (people are then asked to accept it) */
  if (typeof load === 'function') {
    var _ld = load;
    load = function () { var r = _ld.apply(this, arguments); try { if (ensureTerm(DB) && !window.REG_LIVE) save(); } catch (e) {} return r; };
  }
  /* office Terms page: only the terms in use (retired farm terms hidden; their old acceptances stay in the history table) */
  function withoutRetired(fn) {
    return function () {
      var keep = {};
      RETIRED.forEach(function (k) { if (TERMS_DEF[k]) { keep[k] = TERMS_DEF[k]; delete TERMS_DEF[k]; } });
      try { return fn.apply(this, arguments); } finally { Object.keys(keep).forEach(function (k) { TERMS_DEF[k] = keep[k]; }); }
    };
  }
  if (typeof VIEWS !== 'undefined' && typeof VIEWS['admin:termsadmin'] === 'function') VIEWS['admin:termsadmin'] = withoutRetired(VIEWS['admin:termsadmin']);

  /* ---------- no UnScramble / farm-labour legalese on CJ screens (golive2) ----------
     The shared screens still mention the farm agreements (Master Labour Contract, Schedule A/C, Independent Contractor Service
     Agreement). For CJ they are reworded on screen, in pop-ups and on client invoices. The office cards for the farm client
     agreement (signed status, conversion fee 6(e)) are hidden: a CJ client service agreement has not been drafted yet. */
  var LEGAL = [
    [/\s*\(Independent Contractor Service Agreement, s\. 3\)/g, ' (Chief Janitorial payment terms)'],
    [/The office sets the labour rates for your farm; then you sign the Independent Contractor Service Agreement[^.]*\./g, 'The office sets up your site and your cleaning invoices.'],
    [/set the labour rates for your farm\. You will then be asked to sign the Independent Contractor Service Agreement and your Rate Schedule\. No shifts can be booked until both are signed\./g, 'set up your site and your cleaning invoices.'],
    [/Independent Contractor Services? Agreement/g, 'client service agreement'],
    [/attached to your farm/g, 'attached to your account'],
    [/labour rates for your farm/g, 'rates for your sites'],
    [/Master Labour Contract Agreement/g, 'Cleaner Agreement'],
    [/Accept it and Schedule A on the /g, 'Accept it on the '],
    [/ \+ Schedule A \(optional upload – you accept them in the app\)/g, ' (optional upload – you accept it in the app)'],
    [/\s*\(Schedule A\)/g, ''],
    [/accept Schedule C/g, 'accept the Cleaner Agreement'],
    [/\s*For Schedule C, \{EMPLOYER\} is replaced with the worker's employer\./g, ''],
    [/Holdback – season reconciliation/g, 'Holdback – reconciliation'],
    [/end-of-season reconciliation/g, 'reconciliation']
  ];
  function cjLegal(t) { t = String(t == null ? '' : t); if (!/Agreement|Schedule|farm|season/.test(t)) return t; LEGAL.forEach(function (r) { t = t.replace(r[0], r[1]); }); return t; }
  window.cjLegal = cjLegal;
  if (typeof DOCS !== 'undefined' && DOCS.agreement) DOCS.agreement.label = 'Signed Cleaner Agreement (optional upload – you accept it in the app)';
  function scrub(root) {
    if (!root || !root.querySelectorAll) return;
    ['#icsafee', '#firmagradmin'].forEach(function (q) { root.querySelectorAll(q).forEach(function (e) { e.remove(); }); });
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), n, list = [];
    while ((n = w.nextNode())) if (/Agreement|Schedule|farm|season/.test(n.nodeValue)) list.push(n);
    list.forEach(function (x) { var v = cjLegal(x.nodeValue); if (v !== x.nodeValue) x.nodeValue = v; });
  }
  if (typeof afterRender === 'function') { var _ar = afterRender; afterRender = function (root) { _ar.apply(this, arguments); try { scrub(root || document.getElementById('app') || document.body); } catch (e) {} }; }
  document.addEventListener('DOMContentLoaded', function () {       // after every script: invoice lines + pop-ups
    if (typeof invDoc === 'function') { var _inv = invDoc; invDoc = function () { var L = _inv.apply(this, arguments); return (L || []).map(function (l) { return Array.isArray(l) ? l.map(function (c) { return typeof c === 'string' ? cjLegal(c) : c; }) : l; }); }; }
    if (typeof modal === 'function') { var _m = modal; modal = function (html) { var a = Array.prototype.slice.call(arguments); a[0] = cjLegal(html); return _m.apply(this, a); }; }
  });
})();
