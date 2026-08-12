/* =========================================================
   NewlyNow — premium interactions engine (vanilla, lightweight)
   Pairs with newlynow-theme.css. Respects reduced-motion + touch.
   Public helper: window.nnToast(message, icon?)
   ========================================================= */
(function () {
  'use strict';
  if (window.__NEWLYNOW_INTERACTIONS_LOADED__) return;
  window.__NEWLYNOW_INTERACTIONS_LOADED__ = true;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  var q = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn, { once: true });
  }

  ready(function () {
    var revealSel = '.cat, .svc, .port, .stat, .tcard, .proof-cta, .cta-box, .nn-banner, .head, .pay-strip, .partners-row > *';
    var groups = {};
    q(revealSel).forEach(function (el) {
      if (el.closest('.no-reveal')) return;
      el.classList.add('reveal');
      var key = (el.parentElement || document.body);
      groups.__i = groups.__i || new WeakMap();
      var i = groups.__i.get(key) || 0; groups.__i.set(key, i + 1);
      el.style.transitionDelay = reduce ? '0ms' : (Math.min(i * 60, 360) + 'ms');
    });

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('show'); io.unobserve(x.target); } });
      }, { threshold: 0.12, rootMargin: '0px 0px -6%' });
      q('.reveal').forEach(function (el) { io.observe(el); });
    } else q('.reveal').forEach(function (el) { el.classList.add('show'); });

    function countUp(el) {
      var target = parseFloat(el.getAttribute('data-count')) || 0;
      if (reduce || !target) { el.textContent = target.toLocaleString('en-US'); return; }
      var dur = 1400, start = null;
      (function step(t) {
        if (!start) start = t;
        var p = clamp((t - start) / dur, 0, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased).toLocaleString('en-US');
        if (p < 1) requestAnimationFrame(step);
      })();
    }
    if ('IntersectionObserver' in window) {
      var cio = new IntersectionObserver(function (entries) {
        entries.forEach(function (x) { if (x.isIntersecting) { countUp(x.target); cio.unobserve(x.target); } });
      }, { threshold: 0.5 });
      q('[data-count]').forEach(function (el) { cio.observe(el); });
    } else q('[data-count]').forEach(countUp);

    q('.sat-bar i').forEach(function (bar) {
      var w = bar.style.width || bar.getAttribute('data-w') || '0%';
      bar.style.width = '0%';
      if ('IntersectionObserver' in window) {
        var mio = new IntersectionObserver(function (entries) {
          entries.forEach(function (x) { if (x.isIntersecting) { bar.style.width = w; mio.unobserve(x.target); } });
        }, { threshold: 0.4 });
        mio.observe(bar);
      } else bar.style.width = w;
    });

    var hero = document.querySelector('.hero');
    if (hero && !coarse && !reduce) {
      var orbs = q('.orb', hero);
      hero.addEventListener('pointermove', function (e) {
        var r = hero.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        hero.style.setProperty('--mx', (px * 100) + '%');
        hero.style.setProperty('--my', (py * 100) + '%');
        hero.classList.add('spot');
        orbs.forEach(function (o, i) { var f = (i + 1) * 6; o.style.transform = 'translate(' + ((px - .5) * f) + 'px,' + ((py - .5) * f) + 'px)'; });
      });
      hero.addEventListener('pointerleave', function () { hero.classList.remove('spot'); orbs.forEach(function (o) { o.style.transform = ''; }); });
    }

    if (!coarse && !reduce) {
      q('.cat, .svc, .port, .tcard').forEach(function (el) {
        el.addEventListener('pointermove', function (e) {
          var r = el.getBoundingClientRect();
          var rx = ((e.clientY - r.top) / r.height - .5) * -3;
          var ry = ((e.clientX - r.left) / r.width - .5) * 3;
          el.style.transform = 'translateY(-8px) perspective(900px) rotateX(' + rx + 'deg) rotateY(' + ry + 'deg)';
        });
        el.addEventListener('pointerleave', function () { el.style.transform = ''; });
      });
      q('.btn-grad, .btn-lg').forEach(function (btn) {
        btn.addEventListener('pointermove', function (e) {
          var r = btn.getBoundingClientRect();
          var x = clamp((e.clientX - r.left - r.width / 2) * .12, -5, 5);
          var y = clamp((e.clientY - r.top - r.height / 2) * .12, -5, 5);
          btn.style.transform = 'translate(' + x + 'px,' + (y - 2) + 'px)';
        });
        btn.addEventListener('pointerleave', function () { btn.style.transform = ''; });
      });
    }

    q('.btn, button').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        if (reduce) return;
        var r = btn.getBoundingClientRect();
        var size = Math.max(r.width, r.height) * 1.2;
        var s = document.createElement('span'); s.className = 'ripple';
        s.style.width = s.style.height = size + 'px';
        s.style.left = (e.clientX - r.left - size / 2) + 'px'; s.style.top = (e.clientY - r.top - size / 2) + 'px';
        btn.appendChild(s); setTimeout(function () { s.remove(); }, 620);
      });
    });

    var nav = document.getElementById('nav') || document.querySelector('.nav');
    if (nav) { var onScroll = function () { nav.classList.toggle('scrolled', window.scrollY > 12); }; onScroll(); window.addEventListener('scroll', onScroll, { passive: true }); }
  });

  window.nnToast = function (msg, icon) {
    var t = document.createElement('div'); t.className = 'nn-toast';
    t.innerHTML = '<i class="fas ' + (icon || 'fa-circle-check') + '"></i><span></span>';
    t.querySelector('span').textContent = msg || ''; document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 320); }, 2800);
  };
})();
