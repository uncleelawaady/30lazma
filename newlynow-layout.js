// NewlyNow — editorial storefront layout inspired by the supplied reference
(function () {
  'use strict';
  if (window.__NEWLYNOW_LAYOUT_LOADED__) return;
  window.__NEWLYNOW_LAYOUT_LOADED__ = true;

  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once:true });
    else fn();
  }

  onReady(() => {
    const specs = [
      ['.coverflow-sec', '01', 'pink'],
      ['#categories', '02', 'pink'],
      ['#featured', '03', 'pink'],
      ['#portfolio', '04', 'pink'],
      ['#testimonials', '05', 'pink'],
      ['#payments', '06', 'pink'],
      ['#partners', '07', 'pink']
    ];

    specs.forEach(([selector, number, accent]) => {
      const section = document.querySelector(selector);
      if (!section) return;
      section.classList.add('nn-section');
      section.dataset.accent = accent;
      let n = section.querySelector(':scope > .nn-section-number');
      if (!n) {
        n = document.createElement('span');
        n.className = 'nn-section-number';
        n.setAttribute('aria-hidden', 'true');
        section.prepend(n);
      }
      n.textContent = number;
    });

    const rails = [
      ['#categories .cat-grid', 'nn-rail nn-categories-rail'],
      ['#featured .svc-grid', 'nn-rail nn-services-rail'],
      ['#portfolio .port-grid', 'nn-rail nn-portfolio-rail'],
      ['#testimonials .rev-grid', 'nn-rail nn-reviews-rail']
    ];

    function ensureRails() {
      rails.forEach(([selector, classes]) => {
        const el = document.querySelector(selector);
        if (!el) return;
        classes.split(' ').forEach(c => el.classList.add(c));
      });
    }

    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let io = null;
    if (!reduceMotion && 'IntersectionObserver' in window) {
      io = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        });
      }, { threshold:.08, rootMargin:'0px 0px -5% 0px' });
    }

    function reveal(el) {
      if (!el || el.dataset.nnRevealBound === '1') return;
      el.dataset.nnRevealBound = '1';
      if (!io) { el.classList.add('is-visible'); return; }
      el.classList.add('nn-reveal');
      io.observe(el);
    }

    function decorateDynamicContent() {
      ensureRails();
      document.querySelectorAll('#categories .cat, #featured .svc, #portfolio .port').forEach(card => {
        card.classList.add('nn-editorial-card');
        reveal(card);
      });
      document.querySelectorAll('#testimonials .review-card, #testimonials .rev-card').forEach(reveal);
      document.querySelectorAll('.nn-section .head, .proof-cta, .pay-strip, .cta-box').forEach(reveal);
    }

    decorateDynamicContent();
    let queued = false;
    const mo = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; decorateDynamicContent(); });
    });
    ['categories','featured','portfolio','testimonials'].forEach(id => {
      const el = document.getElementById(id);
      if (el) mo.observe(el, { childList:true, subtree:true });
    });

    const hero = document.querySelector('.hero');
    if (hero && !hero.querySelector('.nn-scroll-cue')) {
      const cue = document.createElement('a');
      cue.className = 'nn-scroll-cue';
      cue.href = '#categories';
      cue.setAttribute('aria-label','الانتقال إلى الأقسام');
      cue.innerHTML = '<span>استكشف</span><i class="fas fa-arrow-down" aria-hidden="true"></i>';
      hero.appendChild(cue);
    }
  });
})();
