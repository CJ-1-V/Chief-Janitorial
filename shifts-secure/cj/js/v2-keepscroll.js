/* v2-keepscroll.js – keep the page where it is when an in-page action rebuilds the screen.
   Causes:
   - render() replaces #app and then always calls window.scrollTo(0,0) (js/ui.js). Ticking Active cleaner,
     saving a form, filters, toggles and opening or closing a panel all call render(), so the window jumps to the top.
   - <a href="#"> is not a screen. The browser follows it, clears the address hash and scrolls to the top. That hash
     change also runs the original render(), which scrolls to the top again. A link that only repeats the hash you
     are already on, and does not point at an element, does the same scroll-to-top.
   - innerHTML / replaceChild / removeChild that throw away a focused button or checkbox make some browsers jump
     the window (and any scrolled box) to the top, even when that rebuild does not go through render().
   - Focusing the replacement, or the browser focusing the page after the old control is removed, scrolls that
     control into view.
   Fix, still in this one file:
   - wrap render(). Before the rebuild, remember window scroll, open/closed sections, inner scrollers (tables and
     any other box that has been scrolled) and the field or control that had focus. After the rebuild, put them
     back only when it is still the same screen:
       same screen = same person + same address (#/people, #/invoicesadmin, …, ignoring ?…) + same main heading
       (digits ignored, so a count change is still the same screen).
   - cancel the click on a bare "#" link (and on a same-page hash that is not a real element) before the browser
     scrolls. Route links (#/people and the rest) still navigate.
   - around a connected innerHTML / replaceChild / removeChild, blur a focused control inside the markup first
     (so the browser does not scroll it away) and put window and box scroll back. A later jump in the same turn
     is put back too, unless the address changed or code scrolled on purpose.
   A real navigation to another route still starts at the top (the address change calls the original render, which
   scrolls to the top). The browser Back and Forward buttons keep their own saved position. A screen can force the
   top with PAGE_STATE.ksTop = true before render(). Code that moves the page on purpose after render()
   (scrollIntoView, or its own scrollTo) still wins. Focus is put back with preventScroll. Load last.
   Turn off: remove this script in index.html. */
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
    s.inner.forEach(function (o) { var el = (o.id && document.getElementById(o.id)) || I[o.i]; applyBox(el, o); });
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
    /* A counter, not a clock: scrollTo(0,0) and a scrollIntoView right after it often share one millisecond,
       and a clock would treat that on-purpose move as "nobody scrolled" and pull the page back. */
    function bump() { MOVED++; }
    function mark() { if (!MINE) bump(); }
    try {
      w.scrollTo = function () { mark(); return oT.apply(this, arguments); };
      w.scrollBy = function () { mark(); return oB.apply(this, arguments); };
      Element.prototype.scrollIntoView = function () { mark(); return oI.apply(this, arguments); };
    } catch (e) {}
    ['wheel', 'touchstart', 'keydown', 'mousedown', 'pointerdown'].forEach(function (t) { w.addEventListener(t, function () { bump(); }, { capture: true, passive: true }); });
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
  var inHash = 0, skipHold = 0;
  window.addEventListener('hashchange', function () { inHash++; }, true);
  window.addEventListener('hashchange', function () { setTimeout(function () { inHash = Math.max(0, inHash - 1); }, 0); });
  /* href="#" (and a repeat of the current hash that is not an element on the page) scrolls to the top
     and, for "#", clears the route. Stop that click. Real route changes and real in-page targets still run. */
  function bareHashLink(a) {
    if (!a || a.tagName !== 'A') return false;
    if (a.hasAttribute('download')) return false;
    var tgt = a.getAttribute('target');
    if (tgt && tgt !== '_self') return false;
    var raw = a.getAttribute('href');
    if (raw == null) return false;
    raw = String(raw).replace(/^\s+|\s+$/g, '');
    if (raw === '' || raw === '#') return true;
    var u;
    try { u = new URL(raw, location.href); } catch (e) { return false; }
    if (u.origin !== location.origin || u.pathname !== location.pathname || u.search !== location.search) return false;
    var frag = u.hash || '';
    if (frag === '' || frag === '#') return true;
    if (frag !== (location.hash || '')) return false;
    var id = frag.charAt(0) === '#' ? frag.slice(1) : frag;
    if (!id || id.charAt(0) === '/') return true;
    try { id = decodeURIComponent(id); } catch (e2) {}
    try { if (document.getElementById(id)) return false; } catch (e3) {}
    return true;
  }
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var t = e.target, a = t && t.closest && t.closest('a[href]');
    if (!a || !bareHashLink(a)) return;
    e.preventDefault();
  }, true);
  /* innerHTML / replaceChild / removeChild on a connected node. Blur a focused control first so the
     browser does not jump, then put window and box scroll back. A jump a moment later is corrected
     unless the address changed or something scrolled on purpose (scrollTo / scrollIntoView). */
  function holdOk() {
    if (skipHold || inHash) return false;
    try { if (typeof PAGE_STATE !== 'undefined' && PAGE_STATE && PAGE_STATE.ksTop) return false; } catch (e) {}
    return true;
  }
  function connectedHold(el) {
    try { return !!(el && el.nodeType === 1 && el.isConnected && holdOk()); } catch (e) { return false; }
  }
  function blurInside(el) {
    var ae = document.activeElement;
    if (!ae || ae === document.body || ae === document.documentElement || !el.contains || !el.contains(ae)) return;
    var x = window.scrollX || window.pageXOffset || 0, y = window.scrollY || window.pageYOffset || 0;
    try { ae.blur(); } catch (e) {}
    if ((window.scrollX || 0) !== x || (window.scrollY || 0) !== y) own(function () { window.scrollTo(x, y); });
  }
  function boxesUnder(root) {
    var out = [], seen = {}, list = [];
    if (!root || !root.querySelectorAll) return out;
    try { list = [root].concat([].slice.call(root.querySelectorAll('*'))); } catch (e) { list = [root]; }
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (!el || el === document.body || el === document.documentElement || el === document.scrollingElement) continue;
      if (!(el.scrollTop || el.scrollLeft)) continue;
      var id = el.id || '', path = id ? '' : pathOf(el), key = id || path;
      if (!key || seen[key]) continue;
      seen[key] = 1;
      out.push({ id: id, path: path, l: el.scrollLeft, t: el.scrollTop });
    }
    return out;
  }
  function takeSnap(root) {
    var self = null;
    if (root && root !== document.body && root !== document.documentElement && (root.scrollTop || root.scrollLeft)) self = { l: root.scrollLeft, t: root.scrollTop };
    return { x: window.scrollX || window.pageXOffset || 0, y: window.scrollY || window.pageYOffset || 0, self: self, root: root, boxes: boxesUnder(root), hash: location.hash || '' };
  }
  function applyBox(el, o) {
    if (!el || !o) return;
    function apply() {
      if (!el.isConnected) return;
      if (el.scrollLeft !== o.l) el.scrollLeft = o.l;
      if (el.scrollTop !== o.t) el.scrollTop = o.t;
    }
    apply();
    /* The box may not have its width yet, so a scrollLeft set in the same turn is clamped to 0. */
    if (el.isConnected && (el.scrollLeft !== o.l || el.scrollTop !== o.t)) {
      try { if (window.requestAnimationFrame) requestAnimationFrame(apply); } catch (e) {}
      setTimeout(apply, 0); setTimeout(apply, 50);
    }
  }
  function putBoxes(boxes) {
    (boxes || []).forEach(function (o) {
      var el = null;
      if (o.id) el = document.getElementById(o.id);
      if (!el && o.path) { try { el = document.querySelector(o.path); } catch (e) { el = null; } }
      applyBox(el, o);
    });
  }
  function putSnap(snap) {
    if (!snap) return;
    own(function () {
      if (snap.root && snap.root.isConnected && snap.self) { snap.root.scrollLeft = snap.self.l; snap.root.scrollTop = snap.self.t; }
      putBoxes(snap.boxes);
      if ((window.scrollX || 0) !== snap.x || (window.scrollY || 0) !== snap.y) window.scrollTo(snap.x, snap.y);
    });
  }
  function arm(snap, movedAt) {
    function pass() {
      if (!holdOk()) return;
      if ((location.hash || '') !== snap.hash) return;
      if (MOVED !== movedAt) return;
      var x = window.scrollX || 0, y = window.scrollY || 0;
      if (Math.abs(x - snap.x) > 1 || Math.abs(y - snap.y) > 1) putSnap(snap);
      else putBoxes(snap.boxes);
    }
    try { if (window.requestAnimationFrame) requestAnimationFrame(pass); } catch (e) {}
    setTimeout(pass, 0); setTimeout(pass, 180);
  }
  function afterMut(snap, blurred, x1, y1) {
    if (!snap) return;
    var jumped = blurred || Math.abs(x1 - snap.x) > 1 || Math.abs(y1 - snap.y) > 1;
    putSnap(snap);
    if (jumped) arm(snap, MOVED);
  }
  function patchInner() {
    var desc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    if (!desc || !desc.set || desc.set.__ks) return;
    var nativeSet = desc.set, nativeGet = desc.get;
    function set(v) {
      var snap = null, blurred = false;
      try {
        if (connectedHold(this)) {
          snap = takeSnap(this);
          var ae = document.activeElement;
          blurred = !!(ae && ae !== document.body && this.contains(ae));
          if (blurred) blurInside(this);
        }
      } catch (e) { snap = null; }
      try { nativeSet.call(this, v); }
      catch (err) { try { if (snap) putSnap(snap); } catch (e2) {} throw err; }
      try { afterMut(snap, blurred, window.scrollX || 0, window.scrollY || 0); } catch (e3) {}
    }
    set.__ks = true;
    try {
      Object.defineProperty(Element.prototype, 'innerHTML', {
        configurable: true, enumerable: desc.enumerable,
        get: function () { return nativeGet.call(this); }, set: set
      });
    } catch (e4) {}
  }
  function patchMethod(proto, name, oldIndex) {
    var orig = proto && proto[name];
    if (!orig || orig.__ks) return;
    function wrapped() {
      var node = arguments[oldIndex], snap = null, blurred = false;
      try {
        if (connectedHold(node)) {
          snap = takeSnap(node);
          var ae = document.activeElement;
          blurred = !!(ae && ae !== document.body && node.contains(ae));
          if (blurred) blurInside(node);
        }
      } catch (e) { snap = null; }
      var r = orig.apply(this, arguments);
      try { afterMut(snap, blurred, window.scrollX || 0, window.scrollY || 0); } catch (e2) {}
      return r;
    }
    wrapped.__ks = true;
    try { proto[name] = wrapped; }
    catch (e3) { try { Object.defineProperty(proto, name, { configurable: true, writable: true, value: wrapped }); } catch (e4) {} }
  }
  patchInner();
  patchMethod(Node.prototype, 'replaceChild', 1);
  patchMethod(Node.prototype, 'removeChild', 0);
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
    if (top) skipHold++;
    var r;
    try { r = r0.apply(this, arguments); }
    finally { if (top) skipHold--; }
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
