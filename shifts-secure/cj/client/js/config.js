/* Frozen client portal config.
   UnScramble's farm screens (register/js/firm.js and the firm views) live inside the
   main app: own sites, a crew number instead of a name, no pay rates. They move
   whenever that app is updated. This folder does not. ../index.html does not load it.
   cjClientPortal is the on/off flag for this page set (the farmPortal idea, for CJ).
   The only live reads are the cj_client_v1_* functions. This copy does not call them:
   open ?store=mock for the demo client. No database request is sent. */
(function (root) {
  'use strict';
  var api = {
    cjClientPortal: true,
    version: 'cj_client_v1',
    rpcs: [
      'cj_client_v1_whoami',
      'cj_client_v1_sites',
      'cj_client_v1_visits',
      'cj_client_v1_hours',
      'cj_client_v1_checklists',
      'cj_client_v1_requests',
      'cj_client_v1_invoices'
    ]
  };
  root.CJ_CLIENT = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
