// NewlyNow — editorial storefront layout inspired by the supplied reference
(function () {
  'use strict';

  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once:true });
    else fn();
  }

  onReady(() => {
    const specs = [
      ['.coverflow-sec', '01', 'cyan'],
      ['#categories', '02', 'pink'],
      ['#featured', '03', 'lime'],
      ['#portfolio', '04', 'gold'],
      ['#testimonials', '05', 'cyan'],
      ['#payments', '06', 'pink'],
      ['#partners', '07', 'lime']
    ];

    specs.forEach(([selector, number, accent]) => {
      const section = document.querySelector(selector);
      if (!section) return;
      section.classList.add('nn-section');
      section.dataset.accent = accent;
      if (!section.querySelector(':scope > .nn-section-number')) {
        const n = document.createElement('span');
        n.className = 'nn-section-number';
        n.textContent = number;
        n.setAttribute('aria-hidden', 'true');
        section.prepend(n);
      }
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
        if (!card.classList.contains('nn-editorial-card')) card.classList.add('nn-editorial-card');
        reveal(card);
      });
      document.querySelectorAll('#testimonials .review-card, #testimonials .rev-card').forEach(reveal);
      document.querySelectorAll('.nn-section .head, .proof-cta, .pay-strip, .cta-box').forEach(reveal);
    }

    decorateDynamicContent();

    // Catalog and reviews can arrive after page load from Firestore.
    let queued = false;
    const mo = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        decorateDynamicContent();
      });
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
      cue.innerHTML = '<span>Explore</span><i class="fas fa-arrow-down"></i>';
      hero.appendChild(cue);
    }
  });
})();
