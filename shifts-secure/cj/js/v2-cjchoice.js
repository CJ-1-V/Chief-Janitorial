/* v2-cjchoice.js – CJ twin (TEST): two clear choices for clients. golive2, Oct 9 2026.
   Owner wanted BOTH on the client side: the plain "Request cleaning" form (reqclean1, v2-cjrequest.js – extra / one-time cleaning,
   priced by the office) AND "Order special cleaning or site help" (sitehours1, v2-cjspecial.js – per person per hour, live estimate).
   - Client home: two buttons (＋ Request cleaning / ＋ Order special cleaning or site help).
   - Client #/requests: a choice page with the two options side by side, then the chosen form, then one list of
     "My requests & orders" (each row shown with its own card and number: CR-… plain, SJ-… special).
   - Office #/cleanrequests: one queue with both kinds, each labelled (v2-cjspecial.js).
   Loads after v2-cjspecial.js. Mock and real data use the same DB.cleanRequests list (store-supabase.js saves plain rows to
   reg_cleaning_requests and special rows to reg_special_jobs). */
'use strict';
(function () {
  if (typeof VIEWS === 'undefined' || !window.CJ_PLAIN || !window.CJ_SPECIAL) return;
  var P = window.CJ_PLAIN, S = window.CJ_SPECIAL;
  function all() { return DB.cleanRequests = DB.cleanRequests || []; }
  function byId(id) { return all().filter(function (r) { return r.id === id; })[0] || null; }
  function isTemp(no) { return /…/.test(no || ''); }

  ACT.cropen = function (el) { PAGE_STATE.crForm = (el && el.dataset && el.dataset.k === 'special') ? 'special' : 'plain'; PAGE_STATE.crDraft = null; if (location.hash !== '#/requests') go('#/requests'); else render(); };
  ACT.crclose = function () { PAGE_STATE.crForm = null; PAGE_STATE.crDraft = null; render(); };
  // the two forms share id="crform" / data-form="crsend"; the special form is the one with a "people" field
  FORMS.crsend = function (f, d) { return ('people' in d || PAGE_STATE.crForm === 'special') ? S.send(f, d) : P.send(f, d); };

  function choiceCards() {
    return '<div class="crchoices" id="crchoices">' +
      '<div class="card crchoice"><h2>Request cleaning</h2><p>An <b>extra or one-time cleaning</b> at one of your sites – for example an extra clean, a deep clean, floor care, carpets, windows or a move-in / move-out clean. ' +
      'The office contacts you to confirm the date and price.</p><button class="big" id="crchoose-plain" data-act="cropen" data-k="plain">＋ Request cleaning</button></div>' +
      '<div class="card crchoice"><h2>Special cleaning or site help</h2><p>Book <b>people by the hour</b> – deep clean, glass / window cleaning, trash removal, painting, site visit help or other site maintenance. ' +
      'You see an estimate right away: <b>' + money(S.rate()) + ' per person per hour</b>, billed on a separate line of your next invoice.</p>' +
      '<button class="big sec" id="crchoose-special" data-act="cropen" data-k="special">＋ Order special cleaning or site help</button></div></div>';
  }
  VIEWS['firm:requests'] = function () {
    var firm = ME, mine = all().filter(function (r) { return r.firmId === firm.id; }).sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
    var open = mine.filter(function (r) { return r.status === 'Requested' || r.status === 'Scheduled'; }), closed = mine.filter(function (r) { return open.indexOf(r) < 0; });
    var card = function (r) { return r.special ? S.cardClient(r) : P.cardClient(r); };
    var x = '<h1>Cleaning requests &amp; special jobs</h1>';
    if (PAGE_STATE.crDone) {
      var dn = byId(PAGE_STATE.crDone); PAGE_STATE.crDone = null;
      if (dn) x += dn.special
        ? '<div class="alert ok" id="crdone"><b>Order ' + (isTemp(dn.no) ? '' : esc(dn.no) + ' ') + 'sent ✓</b> The Chief Janitorial office will confirm the date with you. You can see its status below.</div>'
        : '<div class="alert ok" id="crdone"><b>Request ' + (isTemp(dn.no) ? '' : esc(dn.no) + ' ') + 'sent ✓</b> The Chief Janitorial office will review it and contact you to confirm the date. You can see its status below.</div>';
    }
    if (PAGE_STATE.crForm === 'special') x += '<h2 class="crformtitle">Order special cleaning or site help</h2>' + S.form(firm);
    else if (PAGE_STATE.crForm) x += '<h2 class="crformtitle">Request cleaning</h2><p class="muted small">Extra or one-time cleaning at one of your sites.</p>' + P.form(firm);
    else x += '<p class="muted">What do you need? Choose one:</p>' + choiceCards();
    x += '<h2 id="crmine">My requests &amp; orders</h2>' + (open.length ? '<div id="crlist">' + open.map(card).join('') + '</div>' : '<p class="muted msg-empty" id="crlist">No open cleaning requests or orders.</p>');
    if (closed.length) x += '<details class="crpast"><summary>Done, declined and cancelled (' + closed.length + ')</summary>' + closed.map(card).join('') + '</details>';
    return x;
  };
  // client cards: never show the temporary number while a real-data save is still on its way
  var pc = P.cardClient, sc = S.cardClient;
  P.cardClient = function (r) { var h = pc(r); return isTemp(r.no) ? h.split(esc(r.no)).join('New request') : h; };
  S.cardClient = function (r) { var h = sc(r); return isTemp(r.no) ? h.split(esc(r.no)).join('New order') : h; };
})();
