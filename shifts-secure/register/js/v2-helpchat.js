/* helpchat1: AI help chat on signed-out screens (sign-in, sign-up, forgot password). Explains only – no account actions.
   Talks to edge function reg-help-chat. Never sends passwords: the box warns, and the server masks them. */
(function () {
  'use strict';
  if (!((window.REG_STORE || {}).helpChat) && !window.HELPCHAT_URL) return;   // off until reg-help-chat is deployed
  var S = window.REG_STORE || {}; var CFG = S.supabase || S;
  var BASE = (window.HELPCHAT_URL || ((CFG.url || 'https://lfefpmzfnvgwuicthlyg.supabase.co') + '/functions/v1/reg-help-chat'));
  var IDLE_MS = 5 * 60 * 1000, btn, panel, log, ta, send, chatId = null, idleT = null, ended = false, busy = false;
  function signedOut() { return !!document.querySelector('.auth-shell'); }
  function el(t, c, txt) { var e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; }
  function add(cls, txt) { var m = el('div', 'hc-m ' + cls, txt); log.appendChild(m); log.scrollTop = log.scrollHeight; return m; }
  function post(o) { return fetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CFG.key || '' }, body: JSON.stringify(o) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j._s = r.status; return j; }); }); }
  function end(reason) { if (!chatId || ended) return; ended = true; clearTimeout(idleT);
    var data = JSON.stringify({ action: 'end', id: chatId, reason: reason });
    if (reason === 'unload' && navigator.sendBeacon) navigator.sendBeacon(BASE, new Blob([data], { type: 'text/plain' })); else post({ action: 'end', id: chatId, reason: reason }); }
  function idle() { clearTimeout(idleT); idleT = setTimeout(function () { end('idle'); add('hc-note', 'Chat ended (no reply for 5 minutes). Open again any time.'); setOff(true); }, IDLE_MS); }
  function setOff(v) { ta.disabled = v; send.disabled = v; }
  function start() { ended = false; chatId = null; log.innerHTML = ''; setOff(true);
    add('hc-note', 'Please do not type passwords or codes here.');
    post({ action: 'start' }).then(function (j) { if (j.id) { chatId = j.id; add('hc-bot', j.greeting); setOff(false); ta.focus(); idle(); } else add('hc-bot', j.error || 'Help chat is not working. Call or text 902-200-4888.'); })
      .catch(function () { add('hc-bot', 'Help chat is not working. Call or text 902-200-4888.'); }); }
  function doSend() { var t = ta.value.trim(); if (!t || busy || ended) return;
    if (/\b(password|passcode|pw|code|otp|pin)\b\s*(is|:|=)/i.test(t) && !confirm('It looks like a password or code. Never share these. Send anyway (it will be hidden)?')) return;
    ta.value = ''; add('hc-me', t); busy = true; setOff(true); var w = add('hc-bot', '…');
    post({ action: 'send', id: chatId, text: t.slice(0, 600) }).then(function (j) { w.textContent = j.reply || j.error || 'Sorry, try again.'; if (j.ended || j._s === 409) { ended = true; clearTimeout(idleT); } else { setOff(false); ta.focus(); idle(); } })
      .catch(function () { w.textContent = 'Network problem. Try again, or call 902-200-4888.'; setOff(false); }).then(function () { busy = false; }); }
  function open() { if (!panel) build(); panel.hidden = false; document.body.classList.add('hc-open'); btn.setAttribute('aria-expanded', 'true'); if (!chatId || ended) start(); }
  function close() { if (panel) panel.hidden = true; document.body.classList.remove('hc-open'); btn.setAttribute('aria-expanded', 'false'); end('closed'); }
  function build() {
    panel = el('div', 'hc-panel'); panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Help chat');
    var h = el('div', 'hc-head'), t = el('div'); t.appendChild(el('b', null, 'UnScramble help')); t.appendChild(el('small', null, 'Sign-in & sign-up help · 902-200-4888'));
    var x = el('button', 'hc-x', '×'); x.setAttribute('aria-label', 'Close chat'); x.onclick = close; h.appendChild(t); h.appendChild(x);
    log = el('div', 'hc-log'); log.setAttribute('aria-live', 'polite');
    var f = el('form', 'hc-form'); ta = el('textarea'); ta.maxLength = 600; ta.rows = 1; ta.placeholder = 'Type your question…'; ta.setAttribute('aria-label', 'Your message');
    send = el('button', null, 'Send'); send.type = 'submit'; f.appendChild(ta); f.appendChild(send);
    f.onsubmit = function (e) { e.preventDefault(); doSend(); };
    ta.onkeydown = function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); } };
    panel.appendChild(h); panel.appendChild(log); panel.appendChild(f); document.body.appendChild(panel);
  }
  function sync() { var s = signedOut(); if (s && !btn) { btn = el('button', 'hc-btn'); btn.type = 'button'; btn.innerHTML = '<span aria-hidden="true">💬</span><span>Need help? Chat with us</span>'; btn.setAttribute('aria-expanded', 'false'); btn.onclick = function () { panel && !panel.hidden ? close() : open(); }; document.body.appendChild(btn); }
    if (btn) btn.style.display = s ? '' : 'none'; if (!s && panel && !panel.hidden) close(); }
  window.addEventListener('pagehide', function () { end('unload'); });
  function boot() { sync(); new MutationObserver(sync).observe(document.body, { childList: true, subtree: true }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
