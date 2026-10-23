/* Chief Janitorial — page interactions (moving parts) */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Scroll progress bar
  var bar = document.createElement('div');
  bar.className = 'cj-progress';
  document.body.appendChild(bar);
  function onScroll() {
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Scroll reveal
  var els = document.querySelectorAll('.cj-reveal');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach(function (el) { io.observe(el); });
  } else {
    els.forEach(function (el) { el.classList.add('is-in'); });
  }

  // Count-up numbers
  var counts = document.querySelectorAll('.cj-count');
  function runCount(el) {
    var target = parseFloat(el.getAttribute('data-to')) || 0;
    if (reduce) { el.textContent = target; return; }
    var start = null, dur = 1600;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  if ('IntersectionObserver' in window) {
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { runCount(e.target); co.unobserve(e.target); }
      });
    }, { threshold: 0.5 });
    counts.forEach(function (c) { co.observe(c); });
  } else { counts.forEach(runCount); }

  // 3D tilt on hover (desktop only)
  if (!reduce && window.matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('.cj-tilt').forEach(function (card) {
      card.addEventListener('mousemove', function (ev) {
        var r = card.getBoundingClientRect();
        var x = (ev.clientX - r.left) / r.width - 0.5;
        var y = (ev.clientY - r.top) / r.height - 0.5;
        card.style.transform = 'perspective(900px) rotateY(' + (x * 8) + 'deg) rotateX(' + (-y * 8) + 'deg) translateY(-6px)';
      });
      card.addEventListener('mouseleave', function () { card.style.transform = ''; });
    });
  }

  // Mouse parallax on decorative shapes
  if (!reduce && window.matchMedia('(hover: hover)').matches) {
    var px = document.querySelectorAll('[data-parallax]');
    if (px.length) {
      window.addEventListener('mousemove', function (ev) {
        var cx = ev.clientX / window.innerWidth - 0.5;
        var cy = ev.clientY / window.innerHeight - 0.5;
        px.forEach(function (el) {
          var d = parseFloat(el.getAttribute('data-parallax')) || 20;
          el.style.translate = (cx * d) + 'px ' + (cy * d) + 'px';
        });
      }, { passive: true });
    }
  }

  // Hero infographic follows the typed word
  function showScene(i) {
    var box = document.querySelector('.cj-scenes');
    if (!box) return;
    box.querySelectorAll('.cj-scene').forEach(function (sc) {
      var on = parseInt(sc.getAttribute('data-scene'), 10) === i;
      sc.classList.toggle('is-active', on);
      sc.setAttribute('aria-hidden', on ? 'false' : 'true');
    });
    box.querySelectorAll('.cj-scene-dots i').forEach(function (d, k) { d.classList.toggle('on', k === i); });
  }

  // Typing word swap
  document.querySelectorAll('.cj-swap').forEach(function (el) {
    var words = (el.getAttribute('data-words') || '').split('|').filter(Boolean);
    if (!words.length || reduce) return;
    var wi = 0, ci = words[0].length, deleting = true;
    el.textContent = words[0];
    function tick() {
      var w = words[wi];
      if (deleting) {
        ci--; el.textContent = w.slice(0, ci);
        if (ci <= 0) { deleting = false; wi = (wi + 1) % words.length; showScene(wi); }
        setTimeout(tick, 45);
      } else {
        var nw = words[wi]; ci++; el.textContent = nw.slice(0, ci);
        if (ci >= nw.length) { deleting = true; setTimeout(tick, 2200); } else { setTimeout(tick, 85); }
      }
    }
    setTimeout(tick, 2200);
  });

  // Swipe hint above phone carousels
  if (window.matchMedia('(max-width: 767px)').matches) {
    document.querySelectorAll('.row.cj-swipe').forEach(function (row) {
      var h = document.createElement('div');
      h.className = 'cj-swipe-hint';
      h.innerHTML = 'Swipe <i>→</i>';
      row.parentNode.insertBefore(h, row);
      row.addEventListener('scroll', function () { h.style.opacity = row.scrollLeft > 20 ? '0' : '1'; }, { passive: true });
    });
  }

  // Footer year
  document.querySelectorAll('[data-year]').forEach(function (y) { y.textContent = new Date().getFullYear(); });

  // Apply form: require at least one availability chip
  var apply = document.getElementById('apply-form');
  if (apply) {
    apply.addEventListener('submit', function (ev) {
      var days = apply.querySelectorAll('input[name="Available days"]:checked');
      var msg = document.getElementById('days-msg');
      if (!days.length) {
        ev.preventDefault();
        if (msg) { msg.style.display = 'block'; msg.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      } else if (msg) { msg.style.display = 'none'; }
      var file = apply.querySelector('input[type=file]');
      if (file && file.files[0] && file.files[0].size > 5 * 1024 * 1024) {
        ev.preventDefault();
        alert('Please attach a resume under 5 MB.');
      }
    });
  }
})();
