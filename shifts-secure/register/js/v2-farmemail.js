/* v2-farmemail.js – farmemail1 (Oct 22 2026). Loaded last. TEST COPY until the owner OKs it.
   Owner, Oct 22 2026 11:44 PM: "for farms to join, an email is required". No phone-only farm accounts.
   - Farm sign-up / join (#/signup/firm, with or without an invite code): Business email is required + checked.
   - Office "Send invite" to a farm/client (fisend): email required (text can still go too if a mobile is given).
   - Server side: reg-messages office_invite also refuses an invite with no email.
   Existing farms without an email are not locked out; they keep signing in as today. Turn off: remove the tag. */
'use strict';
(function () {
  var MSG = 'A business email is required for farms to join. Please enter the farm\'s email.';
  var BAD = 'That email does not look right. Please check the farm\'s email.';
  function ok(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || '').trim()); }
  function check(e) { e = String(e || '').trim(); return !e ? MSG : !ok(e) ? BAD : null; }
  window.farmEmailCheck = check;
  if (typeof VIEWS !== 'undefined' && VIEWS.signupForm) {
    var ov = VIEWS.signupForm;
    VIEWS.signupForm = function (h) {
      var x = ov.apply(this, arguments);
      if (String(h || '').split('/')[2] !== 'firm') return x;
      return String(x)
        .replace(/<label>Business email<\/label>/, '<label class="req">Business email (required)</label>')
        .replace(/(<input[^>]*name="email")/, '$1 required')
        .replace(/<label>Phone<\/label>/, '<label>Phone (optional)</label>')
        .replace('Phone or email – at least one is required.', 'A business email is required for farms. Phone is optional.');
    };
  }
  function wrap(name) {
    if (typeof FORMS === 'undefined' || !FORMS[name] || FORMS[name]._fe) return;
    var of = FORMS[name];
    FORMS[name] = function (f, d) {
      var err = check(d && d.email);
      if (err) {
        toast(err);
        var i = f && f.querySelector && f.querySelector('input[name=email]');
        if (i) { i.focus(); i.setAttribute('aria-invalid', 'true'); i.style.outline = '2px solid #b3261e'; }
        return;
      }
      return of.apply(this, arguments);
    };
    FORMS[name]._fe = 1;
  }
  function all() { wrap('firmsignup'); wrap('fisend'); }
  all(); setTimeout(all, 0);
})();
