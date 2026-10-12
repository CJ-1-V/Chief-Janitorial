/* v2-company-switch.js – CJ twin (TEST). Owner (Oct 6, 2026 7:46 PM): employees can switch to either company at sign-in.
   CJ Spread brand rule: one small text-only link below the sign-in button, no UnScramble logo or colours.
   Live proposed (not deployed): CJ /shifts-secure/cj/ ; US /shifts-secure/register/ */
(function () {
  'use strict';
  function cfg() { return window.REG_STORE || {}; }
  window.companySwitchHtml = function (forCompany) {
    /* Oct 12 2026: 'Switch to UnScramble' link removed from the CJ sign-in page for publishing. */
    return '';
    var href = cfg().twinUrl || 'http://127.0.0.1:8780/';
    if (href.indexOf('store=') < 0) href += (href.indexOf('?') >= 0 ? '&' : '?') + 'store=mock';
    if (href.indexOf('v=') < 0) href += '&v=20261006-cjstrip4c';
    var label = cfg().twinLabel || 'UnScramble';
    return '<p class="small co-switch-foot" style="margin:12px 0 0;text-align:center;color:#808285">' +
      'Work for ' + label + ' too? <a href="' + href + '" data-co-switch="us" style="color:#5956e9">Switch to ' + label + '</a></p>';
  };
})();
