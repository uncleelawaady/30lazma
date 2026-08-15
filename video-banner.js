// Video Banner Module for NewlyNow
// Handles animated video backgrounds with fallback to static images

(function() {
  const setupVideoBanner = (selector = '.hero', videoSrc = 'assets/trx-1.mp4', fallbackImg = null) => {
    const container = document.querySelector(selector);
    if (!container) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'video-banner-wrapper';
    wrapper.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 0;
      overflow: hidden;
      background: linear-gradient(135deg, rgba(34, 180, 165, 0.1), rgba(247, 148, 30, 0.05));
    `;

    const video = document.createElement('video');
    video.style.cssText = `
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
    `;
    video.autoplay = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;

    const source = document.createElement('source');
    source.src = videoSrc;
    source.type = 'video/mp4';
    video.appendChild(source);

    // Fallback to static image if video doesn't load
    video.addEventListener('error', () => {
      if (fallbackImg) {
        wrapper.style.backgroundImage = `url(${fallbackImg})`;
        wrapper.style.backgroundSize = 'cover';
        wrapper.style.backgroundPosition = 'center';
      }
      wrapper.removeChild(video);
    });

    wrapper.appendChild(video);
    container.style.position = 'relative';
    container.insertBefore(wrapper, container.firstChild);

    // Ensure content is above video
    container.querySelectorAll('*').forEach(el => {
      if (window.getComputedStyle(el).position === 'static') {
        el.style.position = 'relative';
        el.style.zIndex = '1';
      }
    });

    return { video, wrapper };
  };

  // Setup animated category banners between sections
  const setupSectionBanners = () => {
    const banners = document.querySelectorAll('[data-banner-video]');
    banners.forEach(banner => {
      const videoSrc = banner.dataset.bannerVideo;
      setupVideoBanner(banner, videoSrc);
    });
  };

  // Parallax video effect on scroll
  const setupVideoParallax = (videoElement, speed = 0.3) => {
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrollY = window.scrollY;
          videoElement.style.transform = `translateY(${scrollY * speed}px)`;
          ticking = false;
        });
        ticking = true;
      }
    });
  };

  window.VideoBanner = {
    setup: setupVideoBanner,
    setupSectionBanners,
    parallax: setupVideoParallax
  };

  // Auto-setup on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupSectionBanners);
  } else {
    setupSectionBanners();
  }
})();
