/* v2-needsattn.js – needsattn1 (Oct 22 2026). Loaded last. TEST COPY until the owner OKs it.
   Owner: could not find the "Contact changes" item. Every Needs-attention item now lists the exact items:
   - Contact changes: name, role, old → new phone/email, when asked, inline Approve / Reject + Open person (request highlighted).
   - Missing documents: each open person (name + docs still needed) → opens that person.
   - Late entries: each pending entry (name, site code, date, time) → opens Late entries with that row highlighted.
   No rates or farm names shown (site codes only), so the Office Assistant view stays safe. Turn off: remove the tag. */
'use strict';
(function () {
  if (typeof adminFlags !== 'function') return;
  var MAX = 5;
  function when(iso) { try { return new Date(iso).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } }
  function role(u) { return { firm: 'Farm', employee: 'Employee', worker: 'Worker', sub: 'Subcontractor' }[u.type] || u.type || ''; }
  function more(n) { return n > MAX ? '<li class="small muted">+ ' + (n - MAX) + ' more</li>' : ''; }
  function personLink(u) { return '<a href="#" data-act="naperson" data-id="' + esc(u.id) + '"><b>' + esc(u.name) + '</b></a>'; }

  function contactHtml() {
    var L = (DB.users || []).filter(function (u) { return u.contactChangeReq && u.contactChangeReq.status === 'Pending'; });
    if (!L.length) return null;
    return { n: L.length, h: L.length + ' phone/email change request(s) waiting:<ul class="na-list">' + L.slice(0, MAX).map(function (u) {
      var r = u.contactChangeReq, x = personLink(u) + ' <span class="small muted">' + esc(role(u)) + ' · asked ' + esc(when(r.at)) + '</span>';
      if (r.phoneChanged) x += '<div class="small">Phone: ' + esc(u.phone || '(none)') + ' → <b>' + esc(r.phone || '(none)') + '</b></div>';
      if (r.emailChanged) x += '<div class="small">Email: ' + esc(u.email || '(none)') + ' → <b>' + esc(r.email || '(none)') + '</b></div>';
      x += '<div class="row" style="margin-top:4px"><button class="small" data-act="naclapprove" data-id="' + esc(u.id) + '">Approve</button> <button class="small danger" data-act="naclreject" data-id="' + esc(u.id) + '">Reject</button></div>';
      return '<li>' + x + '</li>';
    }).join('') + more(L.length) + '</ul>' };
  }
  function docsHtml() {
    if (typeof missingDocsPeople !== 'function') return null;
    var L = missingDocsPeople().filter(function (x) { return x.status === 'Open' && x.u; });
    if (!L.length) return null;
    return { n: L.length, h: L.length + ' ' + (L.length === 1 ? 'person' : 'people') + ' clocked in or out with documents still needed:<ul class="na-list">' + L.slice(0, MAX).map(function (x) {
      return '<li>' + personLink(x.u) + ' <span class="small muted">needs ' + esc(((x.now || []).slice(0, 3).join(', ') || 'documents') + ((x.now || []).length > 3 ? ' + ' + ((x.now || []).length - 3) + ' more' : '')) + '</span></li>';
    }).join('') + more(L.length) + '</ul><a href="#/missingdocs">All missing documents →</a>' };
  }
  function lateHtml() {
    var L = (DB.time || []).filter(function (t) { return t.lateEntry === 'pending' && !t.test; });
    if (!L.length) return null;
    return { n: L.length, h: L.length + ' late entr' + (L.length === 1 ? 'y' : 'ies') + ' waiting (not billed until approved):<ul class="na-list">' + L.slice(0, MAX).map(function (t) {
      var u = user(t.userId);
      return '<li><a href="#/lateentries" data-act="nalate" data-id="' + esc(t.id) + '"><b>' + esc(u ? u.name : '?') + '</b></a> <span class="small muted">' + esc(t.site || '') + ' · ' + esc(t.date || '') + ' · ' + esc(t['in'] || '') + '–' + esc(t.out || '') + '</span></li>';
    }).join('') + more(L.length) + '</ul><a href="#/lateentries">Open Late entries →</a>' };
  }

  var of = adminFlags;
  adminFlags = function () {
    var f = of.apply(this, arguments);
    try {
      var rep = { 'Contact changes': contactHtml, 'Missing documents': docsHtml, 'Late entries': lateHtml };
      f = f.map(function (x) {
        var fn = x && rep[x.t]; if (!fn) return x;
        var r = fn(); if (!r) return x;
        return { t: x.t, c: x.t === 'Late entries' ? 's-warn' : x.c, h: r.h, na: 1 };
      });
    } catch (e) { }
    return f;
  };

  function hi(sel) {
    var n = 0, iv = setInterval(function () {
      var el = document.querySelector(sel);
      if (el || ++n > 30) { clearInterval(iv); if (el) { el.classList.add('na-hi'); el.scrollIntoView({ block: 'center' }); } }
    }, 100);
  }
  ACT.naperson = function (el) { showPerson(el.dataset.id); hi('#clpendoffice'); };
  ACT.nalate = function (el) { var id = el.dataset.id; location.hash = '#/lateentries'; hi('#latequeue tr[data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]'); };
  function after() { if (typeof closeModal === 'function') try { closeModal(); } catch (e) { } else { var m = document.getElementById('modal'); if (m) m.innerHTML = ''; } render(); }
  ACT.naclapprove = function (el) { if (!confirm('Approve this phone/email change?')) return; ACT.clapprove(el); after(); };
  ACT.naclreject = function (el) { if (!confirm('Reject this phone/email change?')) return; ACT.clreject(el); after(); };
  if (typeof ADMIN_ONLY_ACT !== 'undefined') ['naclapprove', 'naclreject'].forEach(function (a) { if (ADMIN_ONLY_ACT.indexOf(a) < 0) ADMIN_ONLY_ACT.push(a); });

  var st = document.createElement('style');
  st.textContent = '.na-list{margin:6px 0 6px 0;padding-left:18px}.na-list li{margin:6px 0}.na-hi{outline:3px solid #f5a623;background:#fff7e6!important;transition:background .3s}';
  document.head.appendChild(st);
})();
