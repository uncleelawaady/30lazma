// NewlyNow Animations Framework — Pure vanilla JS, no dependencies
(function() {
  const setupScrollReveal = () => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal-in');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -100px 0px' });

    document.querySelectorAll('.reveal, .cat, .svc, .step, .pop-card').forEach(el => {
      if (!el.classList.contains('reveal-in')) observer.observe(el);
    });
  };

  const setupStaggerAnimation = () => {
    document.querySelectorAll('[data-stagger]').forEach((container) => {
      Array.from(container.children).forEach((item, i) => {
        item.style.setProperty('--stagger-delay', `${i * 0.08}s`);
        item.classList.add('stagger-item');
      });
    });
  };

  const init = () => {
    setupScrollReveal();
    setupStaggerAnimation();

    const observer = new MutationObserver(() => {
      setupScrollReveal();
      setupStaggerAnimation();
    });

    observer.observe(document.body, { childList: true, subtree: true });
  };

  window.Animations = { init, reveal: setupScrollReveal, stagger: setupStaggerAnimation };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
