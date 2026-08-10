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

    // Turn dense storefront groups into reference-like horizontal showcases.
    const rails = [
      ['#categories .cat-grid', 'nn-rail nn-categories-rail'],
      ['#featured .svc-grid', 'nn-rail nn-services-rail'],
      ['#portfolio .port-grid', 'nn-rail nn-portfolio-rail'],
      ['#testimonials .rev-grid', 'nn-rail nn-reviews-rail']
    ];
    rails.forEach(([selector, classes]) => {
      const el = document.querySelector(selector);
      if (!el) return;
      classes.split(' ').forEach(c => el.classList.add(c));
    });

    // Reuse existing service/category cards but give every card a framed showcase rhythm.
    document.querySelectorAll('#categories .cat, #featured .svc, #portfolio .port').forEach((card, i) => {
      card.classList.add('nn-editorial-card');
      card.style.setProperty('--nn-card-index', String(i + 1));
    });

    // Subtle scroll reveal. No dependency and disabled automatically for reduced motion.
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
      const targets = document.querySelectorAll('.nn-section .head, .nn-editorial-card, .proof-cta, .pay-strip, .cta-box');
      targets.forEach(el => el.classList.add('nn-reveal'));
      const io = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        });
      }, { threshold:.08, rootMargin:'0px 0px -5% 0px' });
      targets.forEach(el => io.observe(el));
    }

    // Hero gets an editorial viewport cue similar to the reference without copying its assets.
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
