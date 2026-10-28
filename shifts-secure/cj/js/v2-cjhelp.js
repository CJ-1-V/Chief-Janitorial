/* v2-cjhelp.js – small help chat on the Chief Janitorial sign-in and sign-up screens.
   Answers come from the fixed list below. Nothing is sent anywhere: no AI, no edge function, no account lookup.
   It cannot reset a password, tick a cleaner active, or see who has an account. Do not type passwords or codes.
   Shown only while signed out (the auth card). Turn off: remove css/cjhelp.css and this script in index.html. */
(function () {
  'use strict';
  var PHONE = (window.CJ_COMPANY && window.CJ_COMPANY.phoneShort) || '902-200-4888';
  var TEL = '+19022004888';
  var EMAIL = (window.CJ_COMPANY && window.CJ_COMPANY.email) || 'admin@chiefjanitorial.com';
  var OFFICE = 'Call or text the office at ' + PHONE + ', or email ' + EMAIL + '.';

  var FORGOT = 'Tap Forgot password? on the sign-in screen. Enter the email, phone number or username you use to sign in, then tap Email me a reset code. Enter that code and choose a new password. If there is no email on the account, the screen stays the same on purpose — ' + OFFICE + ' They can give you a temporary password. Then you sign in and pick your own. Do not type a password in this chat.';
  var INACTIVE = 'A new cleaner cannot use the app until the office ticks Active cleaner on the People page. You will see: Your account isn\'t active in the Chief Janitorial app yet. Please contact the office. Creating the account is not the same as being ticked. ' + OFFICE;
  var WRONG = 'A Chief Janitorial sign-up link is a long code on a QR from the office, not a short site code such as CJC101. Open the link or scan the QR again so the site is filled in. If the page says the link is not valid, the code was turned off or it is not a Chief Janitorial link. Ask the office to print a new QR. Do not guess a code, and do not type the code here.';
  var SIGNUP = 'Cleaners who are paid by Chief Janitorial choose Employee of Chief Janitorial. If you work for a subcontractor, choose Subcontractor worker. Got a QR from your site? Scan it — the site is filled in for you. After you sign up, the office still has to tick you active in People before you can sign in.';
  var SIGNIN = 'On the sign-in screen, type the email, phone number or username you signed up with, then your password, and tap Sign in. Phone numbers can be typed with or without spaces. If the password is not right, use Forgot password? rather than guessing.';
  var CONTACT = OFFICE + ' This chat only answers the common sign-in questions. It cannot change your account.';

  /* Longer phrases are checked as plain text. The highest score wins. No network. */
  var FAQ = [
    { id: 'inactive', q: ['not active yet', 'not active', "isn't active", 'isnt active', 'inactive', 'active cleaner', 'tick me', 'ticked', 'people page', 'account not active'], a: INACTIVE },
    { id: 'wrong', q: ['wrong sign-up code', 'wrong signup code', 'wrong code', 'code is wrong', 'code does not work', "code doesn't work", 'not valid', 'sign-up link', 'signup link', 'qr code', 'join link', 'invite link', "link doesn't work", 'link does not work', 'short code', 'site code', 'qr'], a: WRONG },
    { id: 'forgot', q: ['forgot my password', 'forgotten password', 'forgot password', 'forget password', 'reset password', 'reset code', 'temporary password', 'wrong password', "can't remember", 'cannot remember', '2-step', 'two-step', '6-digit', 'sign-in code', 'forgot', 'password'], a: FORGOT },
    { id: 'signup', q: ['how do i sign up', 'how do i join', 'create an account', 'create account', 'new account', 'sign up', 'signup', 'register'], a: SIGNUP },
    { id: 'signin', q: ['how do i sign in', 'sign in', 'log in', 'login', 'username', 'phone number'], a: SIGNIN },
    { id: 'office', q: ['phone number of the office', 'call the office', 'text the office', 'email the office', 'help line', 'contact', '902'], a: CONTACT }
  ];

  function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function looksSecret(s) {
    var t = String(s || '');
    if (/\b(password|passcode|pin|otp|passwd)\b\s*(is|:|=)/i.test(t)) return true;
    if (/\b[a-hj-np-z2-9]{20,}\b/i.test(t)) return true;
    return false;
  }
  function answer(text) {
    var t = norm(text);
    if (!t) return { id: 'empty', text: 'Type a short question, or tap one of the buttons.' };
    if (looksSecret(t)) return { id: 'secret', text: 'Please do not send passwords or sign-up codes. I did not keep what you typed, and I cannot use it. ' + FORGOT };
    var best = null, bestScore = 0, i, k, item, phrase, score;
    for (i = 0; i < FAQ.length; i++) {
      item = FAQ[i]; score = 0;
      for (k = 0; k < item.q.length; k++) {
        phrase = item.q[k];
        if (t.indexOf(phrase) >= 0) score += phrase.length;
      }
      if (score > bestScore) { bestScore = score; best = item; }
    }
    if (!best || bestScore < 4) return { id: 'fallback', text: 'I can help with a forgotten password, an account that is not active yet, or a sign-up link that does not work. ' + CONTACT };
    return { id: best.id, text: best.a };
  }
  window.CJHELP = { answer: answer, phone: PHONE };

  var btn, panel, log, ta, send, ended = false;
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function add(cls, text) {
    var m = el('div', 'cjh-m ' + cls, text);
    log.appendChild(m);
    log.scrollTop = log.scrollHeight;
    return m;
  }
  function signedOut() {
    return !!document.querySelector('.auth-shell');
  }
  function setOff(v) { if (ta) ta.disabled = v; if (send) send.disabled = v; }
  function greet() {
    log.innerHTML = '';
    ended = false;
    setOff(false);
    add('cjh-note', 'Please do not type passwords or codes. This chat stays on this page.');
    add('cjh-bot', 'Hi. I answer common Chief Janitorial sign-in and sign-up questions from a fixed list. I cannot see or change your account.');
    var row = el('div', 'cjh-chips');
    [['I forgot my password', 'Forgot password'], ['It says my account is not active yet', 'Not active yet'], ['My sign-up link or QR code does not work', 'Wrong code']].forEach(function (pair) {
      var b = el('button', 'cjh-chip', pair[1]);
      b.type = 'button';
      b.onclick = function () { ask(pair[0]); };
      row.appendChild(b);
    });
    log.appendChild(row);
  }
  function ask(text) {
    if (ended || !text) return;
    var shown = looksSecret(text) ? 'I typed something that looked like a password or code.' : text;
    add('cjh-me', shown);
    var chips = log.querySelector('.cjh-chips'); if (chips) chips.remove();
    var hit = answer(text);
    add('cjh-bot', hit.text);
    if (ta) { ta.value = ''; ta.focus(); }
  }
  function open() {
    if (!panel) build();
    panel.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    if (!log.childNodes.length || ended) greet();
    if (ta) ta.focus();
  }
  function close() {
    if (panel) panel.hidden = true;
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }
  function build() {
    panel = el('div', 'cjh-panel');
    panel.id = 'cjhpanel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Sign-in help');
    var head = el('div', 'cjh-head'), title = el('div');
    title.appendChild(el('b', null, 'Chief Janitorial help'));
    title.appendChild(el('small', null, 'Sign-in & sign-up · ' + PHONE));
    var x = el('button', 'cjh-x', '×');
    x.type = 'button';
    x.setAttribute('aria-label', 'Close chat');
    x.onclick = close;
    head.appendChild(title); head.appendChild(x);
    log = el('div', 'cjh-log');
    log.id = 'cjhlog';
    log.setAttribute('aria-live', 'polite');
    var form = el('form', 'cjh-form');
    ta = el('textarea');
    ta.maxLength = 400;
    ta.rows = 1;
    ta.placeholder = 'Type your question…';
    ta.setAttribute('aria-label', 'Your question');
    ta.autocomplete = 'off';
    send = el('button', null, 'Send');
    send.type = 'submit';
    form.appendChild(ta); form.appendChild(send);
    form.onsubmit = function (e) { e.preventDefault(); ask((ta.value || '').trim()); };
    ta.onkeydown = function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask((ta.value || '').trim()); } };
    panel.appendChild(head); panel.appendChild(log); panel.appendChild(form);
    document.body.appendChild(panel);
  }
  function sync() {
    var on = signedOut();
    if (on && !btn) {
      btn = el('button', 'cjh-btn');
      btn.id = 'cjhbtn';
      btn.type = 'button';
      btn.innerHTML = '<span aria-hidden="true">💬</span><span>Need help? Chat with us</span>';
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-controls', 'cjhpanel');
      btn.onclick = function () { panel && !panel.hidden ? close() : open(); };
      document.body.appendChild(btn);
    }
    if (btn) btn.hidden = !on;
    if (!on && panel && !panel.hidden) close();
  }
  function boot() {
    sync();
    if (document.body) new MutationObserver(sync).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
