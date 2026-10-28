/* v2-keepscroll.js – keep the page where it is when an in-page action rebuilds the screen.
   Cause: render() replaces #app and then always calls window.scrollTo(0,0) (js/ui.js). Ticking Active cleaner,
   saving a form, filters, toggles and opening or closing a panel all call render(), so the window jumps to the top.
   Replacing a focused node (the site-assignments board redraw, closing a panel) can do the same.
   Fix, in one place: wrap render(). Before the rebuild, remember window scroll, open/closed sections, inner
   scrollers (tables and any other box that has been scrolled) and the field or control that had focus. After the
   rebuild, put them back only when it is still the same screen:
     same screen = same person + same address (#/people, #/invoicesadmin, …, ignoring ?…) + same main heading
     (digits ignored, so a count change is still the same screen).
   A real navigation to another route still starts at the top (the address change calls the original render, which
   scrolls to the top). The browser Back and Forward buttons keep their own saved position. A screen can force the
   top with PAGE_STATE.ksTop = true before render(). Code that moves the page on purpose after render()
   (scrollIntoView, or its own scrollTo) still wins. Load last. Turn off: remove this script in index.html. */
(function () {
  'use strict';
  if (typeof render !== 'function') return;
  var SEL_DET = 'details', SEL_INNER = '.tw,.table-wrap,[data-keepscroll]';
  function who() { try { return (typeof ME !== 'undefined' && ME) ? (ME.type + ':' + ME.id) : '-'; } catch (e) { return '-'; } }
  function route() { return (location.hash || '#/').split('?')[0] || '#/'; }
  function head() {
    var m = document.getElementById('main') || document.getElementById('app'); if (!m) return '';
    var h = m.querySelector('h1') || m.querySelector('h2');
    return h ? String(h.textContent || '').replace(/\d+/g, '#').replace(/\s+/g, ' ').trim().slice(0, 80) : '';
  }
  function curKey() { return who() + '|' + route(); }
  function sumText(d) { var s = d.querySelector('summary'); return s ? String(s.textContent || '').replace(/\d+/g, '#').replace(/\s+/g, ' ').trim().slice(0, 60) : ''; }
  function escSel(s) { try { if (window.CSS && CSS.escape) return CSS.escape(s); } catch (e) {} return String(s).replace(/[^a-zA-Z0-9_-]/g, '\\$&'); }
  function pathOf(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id) return '#' + escSel(el.id);
    var parts = [], n = el;
    while (n && n.nodeType === 1 && n !== document.body && n !== document.documentElement) {
      if (n.id) { parts.unshift('#' + escSel(n.id)); break; }
      var i = 1, s = n;
      while ((s = s.previousElementSibling)) { if (s.tagName === n.tagName) i++; }
      parts.unshift(n.tagName.toLowerCase() + ':nth-of-type(' + i + ')');
      n = n.parentElement;
    }
    return parts.join(' > ');
  }
  function extraBoxes() {
    var out = [], seen = {};
    var root = document.getElementById('app'); if (!root) return out;
    [].forEach.call(root.querySelectorAll('*'), function (el) {
      if (!(el.scrollTop || el.scrollLeft)) return;
      if (el.matches && el.matches(SEL_INNER)) return;
      var id = el.id || '', path = id ? '' : pathOf(el), key = id || path;
      if (!key || seen[key]) return;
      seen[key] = 1;
      out.push({ id: id, path: path, l: el.scrollLeft, t: el.scrollTop });
    });
    return out;
  }
  function capture() {
    var app = document.getElementById('app');
    var s = { key: app && app.getAttribute('data-ks') || '', head: head(), y: window.scrollY || window.pageYOffset || 0, x: window.scrollX || window.pageXOffset || 0, inner: [], boxes: [], focus: null };
    [].forEach.call(document.querySelectorAll('#app ' + SEL_INNER), function (el, i) { if (el.scrollLeft || el.scrollTop) s.inner.push({ id: el.id, i: i, l: el.scrollLeft, t: el.scrollTop }); });
    try { s.boxes = extraBoxes(); } catch (e) { s.boxes = []; }
    var a = document.activeElement;
    if (a && a !== document.body && app && app.contains(a) && /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(a.tagName)) {
      var f = { tag: a.tagName, id: a.id, name: a.getAttribute('name') || '', act: a.getAttribute('data-act') || '', did: a.getAttribute('data-id') || '', type: a.type || '' };
      var same = [].filter.call(document.querySelectorAll('#app ' + a.tagName.toLowerCase()), function (x) { return (x.getAttribute('name') || '') === f.name && (x.getAttribute('data-act') || '') === f.act && (x.getAttribute('data-id') || '') === f.did; });
      f.n = same.indexOf(a);
      try { if (typeof a.selectionStart === 'number') { f.ss = a.selectionStart; f.se = a.selectionEnd; } } catch (e) {}
      s.focus = f;
    }
    return s;
  }
  function findFocus(f) {
    if (f.id) { var e = document.getElementById(f.id); if (e && e.tagName === f.tag) return e; }
    var sel = '#app ' + f.tag.toLowerCase();
    var same = [].filter.call(document.querySelectorAll(sel), function (x) { return (x.getAttribute('name') || '') === f.name && (x.getAttribute('data-act') || '') === f.act && (x.getAttribute('data-id') || '') === f.did; });
    if (!f.name && !f.act && !f.id) return null;
    return same[f.n] || (same.length === 1 ? same[0] : null);
  }
  function restore(s) {
    [].forEach.call(document.querySelectorAll('#app ' + SEL_DET), function (d) { var k = detKey(d); if (k && Object.prototype.hasOwnProperty.call(DET, k) && d.open !== DET[k]) d.open = DET[k]; });
    var I = document.querySelectorAll('#app ' + SEL_INNER);
    s.inner.forEach(function (o) { var el = (o.id && document.getElementById(o.id)) || I[o.i]; if (el) { el.scrollLeft = o.l; el.scrollTop = o.t; } });
    (s.boxes || []).forEach(function (o) {
      var el = null;
      if (o.id) el = document.getElementById(o.id);
      if (!el && o.path) { try { el = document.querySelector(o.path); } catch (e) { el = null; } }
      if (el) { el.scrollLeft = o.l; el.scrollTop = o.t; }
    });
    if (s.focus) {
      var e = findFocus(s.focus);
      if (e && e !== document.activeElement && !e.disabled) {
        try { e.focus({ preventScroll: true }); } catch (x) { try { e.focus(); } catch (y) {} }
        try { if (s.focus.ss != null && typeof e.selectionStart === 'number' && /^(text|search|tel|email|url|password|)$/.test(e.type || '')) { var L = String(e.value || '').length; e.setSelectionRange(Math.min(s.focus.ss, L), Math.min(s.focus.se, L)); } } catch (x) {}
      }
    }
    window.scrollTo(s.x, s.y);
    window.KS_LAST = { y: s.y, restoredTo: window.scrollY };
  }
  var ANC = null, DET = {};
  function detKey(d) { var t = d.id || sumText(d); return t ? route() + '|' + t : ''; }
  document.addEventListener('click', function (e) {
    var sm = e.target && e.target.closest && e.target.closest('#app details > summary'); if (!sm) return; var d = sm.parentNode;
    setTimeout(function () { if (document.contains(d)) { var k = detKey(d); if (k) DET[k] = d.open; } }, 0);
  }, true);
  document.addEventListener('submit', function (e) { var d = e.target && e.target.closest && e.target.closest('#app details'); if (d) { var k = detKey(d); if (k) delete DET[k]; } }, true);
  function ancSig(el) {
    var app = document.getElementById('app'); if (!app) return null;
    var a = el.closest && el.closest('#app [data-act],#app [id],#app form[data-form] [name]');
    if (!a || !app.contains(a)) return null;
    var g = { act: a.getAttribute('data-act') || '', id: a.getAttribute('data-id') || '', f: a.getAttribute('data-f') || a.getAttribute('data-d') || a.getAttribute('data-m') || a.getAttribute('data-n') || '', eid: a.id || '', name: a.getAttribute('name') || '', form: (a.form && a.form.getAttribute('data-form')) || '' };
    if (!g.act && !g.eid && !g.name) return null;
    g.top = a.getBoundingClientRect().top; g.at = Date.now(); return g;
  }
  function ancFind(g) {
    var L = [];
    if (g.eid) { var e = document.getElementById(g.eid); if (e) return e; }
    if (g.act) L = [].filter.call(document.querySelectorAll('#app [data-act="' + g.act.replace(/"/g, '') + '"]'), function (x) { return (x.getAttribute('data-id') || '') === g.id && (x.getAttribute('data-f') || x.getAttribute('data-d') || x.getAttribute('data-m') || x.getAttribute('data-n') || '') === g.f; });
    else if (g.name) L = [].filter.call(document.querySelectorAll('#app form[data-form="' + g.form.replace(/"/g, '') + '"] [name="' + g.name.replace(/"/g, '') + '"]'), function () { return true; });
    return L.length === 1 ? L[0] : null;
  }
  function remember(e) { try { if (e.target && e.target.closest) { var g = ancSig(e.target); if (g) ANC = g; } } catch (x) {} }
  document.addEventListener('click', remember, true);
  document.addEventListener('change', remember, true);
  document.addEventListener('submit', function (e) { try { var b = e.submitter || e.target.querySelector('button'); if (b) { var g = ancSig(b); if (g) ANC = g; } } catch (x) {} }, true);
  function nudge(g) {
    if (!g || Date.now() - g.at > 4000) return;
    var e = ancFind(g); if (!e) return;
    var d = e.getBoundingClientRect().top - g.top;
    if (Math.abs(d) >= 1 && Math.abs(d) < window.innerHeight * 0.5) window.scrollBy(0, d);
  }
  var MINE = false, MOVED = 0;
  (function () {
    var w = window, oT = w.scrollTo, oB = w.scrollBy, oI = Element.prototype.scrollIntoView;
    function mark() { if (!MINE) MOVED = Date.now(); }
    try {
      w.scrollTo = function () { mark(); return oT.apply(this, arguments); };
      w.scrollBy = function () { mark(); return oB.apply(this, arguments); };
      Element.prototype.scrollIntoView = function () { mark(); return oI.apply(this, arguments); };
    } catch (e) {}
    ['wheel', 'touchstart', 'keydown', 'mousedown', 'pointerdown'].forEach(function (t) { w.addEventListener(t, function () { MOVED = Date.now(); }, { capture: true, passive: true }); });
  })();
  function own(f) { MINE = true; try { f(); } finally { MINE = false; } }
  function later(s, g, base) {
    var pass = function () {
      if (MOVED !== base) return;
      own(function () {
        if (window.scrollY !== s.y && (document.documentElement.scrollHeight - window.innerHeight) > window.scrollY + 1) window.scrollTo(s.x, s.y);
        nudge(g);
      });
    };
    setTimeout(pass, 0); setTimeout(pass, 150);
  }
  var prev = null;
  function stamp() { var app = document.getElementById('app'); if (app) app.setAttribute('data-ks', curKey()); }
  var inHash = 0;
  window.addEventListener('hashchange', function () { inHash++; }, true);
  window.addEventListener('hashchange', function () { setTimeout(function () { inHash = Math.max(0, inHash - 1); }, 0); });
  /* Removing the focused control inside a panel (the ×) makes some browsers jump the page to the top. */
  if (typeof closeModal === 'function') {
    var cm = closeModal;
    closeModal = function () {
      var y = window.scrollY || window.pageYOffset || 0, x = window.scrollX || window.pageXOffset || 0;
      var m = document.getElementById('modal'), ae = document.activeElement;
      if (m && ae && ae.blur && m.contains(ae)) { try { ae.blur(); } catch (e) {} }
      var r = cm.apply(this, arguments);
      if (!inHash && (Math.abs((window.scrollY || 0) - y) > 1 || Math.abs((window.scrollX || 0) - x) > 1)) own(function () { window.scrollTo(x, y); });
      return r;
    };
    try { if (typeof ACT !== 'undefined') ACT.closeModal = closeModal; } catch (e) {}
  }
  var r0 = render;
  var wrapped = function () {
    var s = null; try { s = capture(); } catch (e) { s = null; }
    var top = !!(typeof PAGE_STATE !== 'undefined' && PAGE_STATE && PAGE_STATE.ksTop); if (top && PAGE_STATE) PAGE_STATE.ksTop = false;
    var r = r0.apply(this, arguments);
    try {
      var k = curKey(), h = head();
      if (s && !top && s.key === k) {
        if (s.head === h) {
          own(function () { restore(s); nudge(ANC); });
          window.KS_LAST.final = window.scrollY;
          /* The click that rebuilt the page removed the focused control, and the browser then
             drops focus. Put it back once that click has finished, without moving the page. */
          var focusSnap = s.focus, focusBase = MOVED;
          if (focusSnap) setTimeout(function () {
            if (MOVED !== focusBase || document.getElementById('modal')) return;
            var e = findFocus(focusSnap); if (!e || e.disabled || document.activeElement === e) return;
            own(function () {
              try { e.focus({ preventScroll: true }); } catch (x) { try { e.focus(); } catch (y) {} }
              try { if (focusSnap.ss != null && typeof e.selectionStart === 'number' && /^(text|search|tel|email|url|password|)$/.test(e.type || '')) { var L = String(e.value || '').length; e.setSelectionRange(Math.min(focusSnap.ss, L), Math.min(focusSnap.se, L)); } } catch (x) {}
            });
          }, 0);
          later(s, ANC, MOVED);
        }
        else { var p = prev; prev = { key: k, head: s.head, snap: s }; if (p && p.key === k && p.head === h) { own(function () { restore(p.snap); }); later(p.snap, null, MOVED); } }
      } else prev = null;
      stamp();
    } catch (e) { try { console.warn('[keepscroll]', e); } catch (x) {} }
    return r;
  };
  render = wrapped; try { window.render = wrapped; } catch (e) {}
  /* Address changes call the original render (scroll to top). Remember which screen is showing.
     Back / Forward are left to the browser, which restores the position it saved for that entry. */
  window.addEventListener('hashchange', function () { prev = null; DET = {}; stamp(); });
  stamp();
})();
