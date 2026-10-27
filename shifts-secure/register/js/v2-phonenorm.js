/* phonenorm1 – one phone normalizer for the app (same rules as reg-messages/phone.ts and SQL reg_norm_phone).
   Typed 7056500024, 705-650-0024, (705) 650 0024, 1-705…, +1 705…, 0705…, 011 1 705… -> stored as 10 digits "7056500024"
   (the format the database already uses); texts go out as +17056500024. Phone fields are tidied when you leave them. */
(function () {
  function phone10(raw) {
    var s = String(raw == null ? '' : raw).toLowerCase().split(/(?:ext\.?|x|#)/)[0], d = s.replace(/\D/g, '');
    if (d.indexOf('011') === 0) d = d.slice(3); else if (d.indexOf('00') === 0) d = d.slice(2);
    if (d.length === 11 && d[0] === '0') d = d.slice(1);
    if (d.length === 11 && d[0] === '1') d = d.slice(1);
    if (d.length === 12 && d.indexOf('01') === 0) d = d.slice(2);
    return /^[2-9]\d{2}[2-9]\d{6}$/.test(d) ? d : '';
  }
  function pretty(d) { return d ? d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6) : ''; }
  window.REG_PHONE10 = phone10;
  window.REG_E164 = function (raw) { var d = phone10(raw); return d ? '+1' + d : ''; };
  window.REG_PHONE_PRETTY = function (raw) { return pretty(phone10(raw)) || String(raw || ''); };
  function isPhoneField(el) { return el && el.tagName === 'INPUT' && (el.type === 'tel' || /(^|_)phone$|^phone|mobile/i.test(el.name || el.id || '')); }
  document.addEventListener('change', function (e) {
    var el = e.target; if (!isPhoneField(el) || !el.value) return;
    var d = phone10(el.value);
    if (d) { el.value = pretty(d); el.setCustomValidity(''); }
    else if (/\d/.test(el.value)) { el.setCustomValidity('Enter a 10-digit Canada/US number, e.g. 705-650-0024.'); el.reportValidity && el.reportValidity(); }
  }, true);
  document.addEventListener('input', function (e) { var el = e.target; if (isPhoneField(el)) el.setCustomValidity(''); }, true);
})();
