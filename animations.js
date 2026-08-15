// NewlyNow Animations Framework
// Smooth entrance + scroll-reveal + parallax + hover effects
// No external dependencies, pure vanilla JS + CSS

(function() {
  // Scroll-reveal with Intersection Observer
  const setupScrollReveal = () => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal-in');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -100px 0px'
    });

    document.querySelectorAll('.reveal, .cat, .svc, .step, .tcard').forEach(el => {
      if (!el.classList.contains('reveal-in')) {
        observer.observe(el);
      }
    });
  };

  // Parallax effect on scroll
  const setupParallax = () => {
    const parallaxElements = document.querySelectorAll('[data-parallax]');
    if (parallaxElements.length === 0) return;

    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrollY = window.scrollY;
          parallaxElements.forEach(el => {
            const speed = parseFloat(el.dataset.parallax) || 0.5;
            el.style.transform = `translateY(${scrollY * speed}px)`;
          });
          ticking = false;
        });
        ticking = true;
      }
    });
  };

  // Stagger animations for grids
  const setupStaggerAnimation = () => {
    document.querySelectorAll('[data-stagger]').forEach((container) => {
      const items = container.children;
      Array.from(items).forEach((item, i) => {
        item.style.setProperty('--stagger-delay', `${i * 0.08}s`);
        item.classList.add('stagger-item');
      });
    });
  };

  // Smooth hover zoom effect
  const setupHoverZoom = () => {
    document.querySelectorAll('.cat, .svc, .glass').forEach(el => {
      el.addEventListener('mouseenter', function() {
        this.style.transition = 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)';
      });
    });
  };

  // Animated counter for stats
  const animateCounter = (el, target, duration = 2000) => {
    let current = 0;
    const increment = target / (duration / 16);
    const interval = setInterval(() => {
      current += increment;
      if (current >= target) {
        el.textContent = target;
        clearInterval(interval);
      } else {
        el.textContent = Math.floor(current);
      }
    }, 16);
  };

  // Initialize all animations
  const init = () => {
    setupScrollReveal();
    setupParallax();
    setupStaggerAnimation();
    setupHoverZoom();

    // Re-run scroll reveal when new content is added
    const observer = new MutationObserver(() => {
      setupScrollReveal();
      setupStaggerAnimation();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  };

  // Expose utility functions globally
  window.Animations = {
    init,
    reveal: setupScrollReveal,
    parallax: setupParallax,
    stagger: setupStaggerAnimation,
    counter: animateCounter
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
