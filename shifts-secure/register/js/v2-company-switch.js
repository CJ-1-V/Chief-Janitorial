/* v2-company-switch.js – UnScramble sign-in: optional "Switch to Chief Janitorial" link.
   Shown ONLY when js/store-config.js has a real https:// twinUrl (the CJ app). While twinUrl is '' nothing is shown.
   Turn on later: twinUrl: 'https://www.chiefjanitorial.com/shifts-secure/cj/' in store-config.js. */
(function () {
  'use strict';
  function cfg() { return window.REG_STORE || {}; }
  function attr(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  window.companySwitchHtml = function (forCompany) {
    if (forCompany !== 'us') return '';
    var href = String(cfg().twinUrl || '').trim();
    if (!/^https:\/\/[^\s\/?#]+\.[^\s\/?#]+(\/[^\s]*)?$/i.test(href)) return '';   // not a real https URL -> hidden
    var label = cfg().twinLabel || 'Chief Janitorial';
    return '<p class="small muted co-switch-foot" style="margin:10px 0 0;text-align:center">' +
      'Work for ' + attr(label) + ' too? <a href="' + attr(href) + '" data-co-switch="cj">Switch to ' + attr(label) + '</a></p>';
  };
})();
