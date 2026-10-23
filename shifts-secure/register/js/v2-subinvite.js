/* v2-subinvite.js – subinvite1 (Oct 22 2026). Loaded after v2-msgsend.js. TEST COPY until the owner OKs it.
   Owner, Oct 22 2026 11:37 PM: workers should be added by an invite sent from our email, not a shared join code.
   - Subcontractor dashboard + My workers: "Invite a worker" card (name + email or mobile). Sent by Edge Function
     reg-messages action 'sub_worker_invite' from admin@unscramble.ca (text via SMS_PROVIDER when that is on).
     The invite carries the sub's join link (?join=CODE#/signup/worker), so the worker lands on sign-up with the employer filled in.
   - Fallback kept: the old join-code card moves under "Other way: share a join code" (closed). On live it opens
     by itself while REG_STORE.inviteFn is not true (function not deployed yet), so nothing breaks before go-live.
   - Mock (?store=mock): the invite goes to the test outbox (not really sent). Turn off: remove the tag. */
'use strict';
(function () {
  function E(s) { return typeof esc === 'function' ? esc(s) : String(s); }
  function live() { return !!(window.REG_LIVE && window.REG_SB); }
  function ready() { return !!(window.REG_STORE && window.REG_STORE.inviteFn === true); }
  function emailOk(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e); }
  function digits(p) { var d = String(p || '').replace(/\D/g, ''); if (d.length === 11 && d[0] === '1') d = d.slice(1); return d.length === 10 ? d : ''; }
  var CARD = function () {
    var off = live() && !ready();
    return '<div class="card si-card" id="siCard"><h3 style="margin-top:0">Invite a worker</h3>' +
      '<p class="small">Type your worker\'s name and email (or mobile). UnScramble sends the invite from <b>admin@unscramble.ca</b> with a sign-up link already linked to your company.</p>' +
      (off ? '<div class="alert info small">Sending from our email is being switched on. For now, use “Other way: share a join code” below.</div>' : '') +
      '<form data-form="siinvite"><div class="grid2">' +
      '<label>Worker name<input name="name" required maxlength="80" autocomplete="off"></label>' +
      '<label>Email<input name="email" type="email" maxlength="120" autocomplete="off"></label>' +
      '<label>Mobile (optional if email)<input name="phone" type="tel" maxlength="20" autocomplete="off"></label></div>' +
      '<label class="small" style="display:flex;gap:6px;align-items:center"><input type="checkbox" name="consent" value="1" style="width:auto"> This person expects the invite.</label>' +
      '<button class="small"' + (off ? ' disabled' : '') + '>Send invite</button></form><div id="siNote" class="small" style="margin-top:6px"></div></div>';
  };
  function wrap(x) {
    x = String(x); if (x.indexOf('id="siCard"') >= 0) return x;
    var i = x.indexOf('<div class="card sc-card" id="scCard">');
    if (i < 0) return x;
    var j = x.indexOf('</div></div>', x.indexOf('class="small muted">A new code', i)); if (j < 0) return x;
    j += 12;
    var old = x.slice(i, j), open = live() && !ready() ? ' open' : '';
    return x.slice(0, i) + CARD() + '<details class="si-other"' + open + '><summary class="small">Other way: share a join code</summary>' + old + '</details>' + x.slice(j);
  }
  ['sub:home', 'sub:workers'].forEach(function (k) { var ov = VIEWS[k]; if (typeof ov === 'function') VIEWS[k] = function () { return wrap(ov.apply(this, arguments)); }; });
  function note(t, bad) { var n = document.getElementById('siNote'); if (n) { n.textContent = t; n.style.color = bad ? '#b3261e' : ''; } }
  FORMS.siinvite = function (f, d) {
    if (!ME || ME.type !== 'sub') return;
    var name = String(d.name || '').trim(), email = String(d.email || '').trim(), phone = String(d.phone || '').trim();
    if (!name) { toast('Enter the worker\'s name.'); return; }
    if (email && !emailOk(email)) { toast('That email does not look right.'); return; }
    if (phone && !digits(phone)) { toast('The mobile number needs 10 digits.'); return; }
    if (!email && !phone) { toast('Enter an email or a mobile number.'); return; }
    if (!d.consent) { toast('Tick “This person expects the invite”.'); return; }
    if (live()) {
      if (!ready()) { toast('Sending is not switched on yet – share the join code instead.'); return; }
      var b = f.querySelector('button'); if (b) b.disabled = true;
      window.REG_SB.functions.invoke('reg-messages', { body: { action: 'sub_worker_invite', name: name, email: email, phone: phone, via: email ? 'email' : 'sms', consent: true } }).then(function (r) {
        if (b) b.disabled = false; var x = r && r.data;
        if (x && x.ok) { note(x.summary || 'Invite sent.'); f.reset(); try { audit('Invited a worker', ME.name, name); } catch (e) { } }
        else note((x && x.error) || 'Not sent. Please try again, or share the join code.', true);
      }, function () { if (b) b.disabled = false; note('Not sent. Please try again, or share the join code.', true); });
      return;
    }
    var code = ME.joinCode || '', link = location.origin + location.pathname + '?join=' + code + '#/signup/worker';
    (DB.apOutbox = DB.apOutbox || []).unshift({ id: uid('mail'), userId: ME.id, from: 'UnScramble <admin@unscramble.ca>', to: email || phone, toName: name,
      subject: ME.name + ' invited you to the UnScramble app', body: 'Hello ' + name.split(/\s+/)[0] + ',\n\n' + ME.name + ' invited you to sign up as a farm worker.\n\nSign up here: ' + link, at: new Date().toISOString(), by: ME.name, test: true });
    try { audit('Invited a worker', ME.name, name + ' (test outbox – not really sent)'); } catch (e) { }
    save(); toast('Invite placed in the test outbox (not really sent).'); render();
    setTimeout(function () { note('Invite to ' + name + ' (' + (email || phone) + ') ready – test outbox, not really sent.'); }, 50);
  };
  if (typeof ROLE_ONLY === 'object') ROLE_ONLY.siinvite = ['sub'];
  var st = document.createElement('style');
  st.textContent = '.si-other{margin:8px 0 12px}.si-other summary{cursor:pointer;color:inherit;opacity:.9;text-decoration:underline;margin:4px 0}.si-card .grid2 label{display:block}';
  document.head.appendChild(st);
})();
