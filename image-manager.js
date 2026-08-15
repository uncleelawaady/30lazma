// Image Manager for NewlyNow
// Handles image loading, distribution, and caching

(function() {
  const STORE_PATH = 'assets/store/';
  const CACHE_KEY = 'nn_images_manifest';

  // Image pool organized by category
  let imagePool = {
    facebook: [],
    instagram: [],
    tiktok: [],
    youtube: [],
    telegram: [],
    snapchat: [],
    ai: [],
    subscriptions: [],
    games: [],
    design: [],
    programming: [],
    finance: []
  };

  // Load manifest from server
  const loadManifest = async () => {
    try {
      const response = await fetch(STORE_PATH + 'manifest.json');
      if (!response.ok) throw new Error('Manifest not found');
      const manifest = await response.json();
      return manifest;
    } catch (error) {
      console.warn('Failed to load manifest:', error);
      return { pool: [], big: [] };
    }
  };

  // Distribute images across categories
  const distributeImages = (images) => {
    const categories = Object.keys(imagePool);
    let imageIndex = 0;

    // Shuffle distribution for variety
    const shuffled = images.sort(() => Math.random() - 0.5);

    shuffled.forEach((img, idx) => {
      const category = categories[idx % categories.length];
      if (imagePool[category]) {
        imagePool[category].push(img);
      }
    });

    return imagePool;
  };

  // Get random image from category
  const getRandomImage = (category, width = null) => {
    const pool = imagePool[category];
    if (!pool || pool.length === 0) return null;

    const random = pool[Math.floor(Math.random() * pool.length)];
    return STORE_PATH + random;
  };

  // Get N images from category
  const getImages = (category, count = 3) => {
    const pool = imagePool[category] || [];
    const result = [];
    for (let i = 0; i < count; i++) {
      const img = pool[Math.floor(Math.random() * pool.length)];
      if (img) result.push(STORE_PATH + img);
    }
    return result;
  };

  // Preload images
  const preloadImages = (urls) => {
    urls.forEach(url => {
      const img = new Image();
      img.src = url;
    });
  };

  // Apply images to service cards
  const applyServiceImages = () => {
    document.querySelectorAll('[data-category]').forEach(card => {
      const category = card.dataset.category;
      const imgContainer = card.querySelector('.cat-ico, .svc-img, .card-image');

      if (imgContainer && !imgContainer.querySelector('img')) {
        const imageUrl = getRandomImage(category);
        if (imageUrl) {
          const img = document.createElement('img');
          img.src = imageUrl;
          img.alt = category;
          img.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: center;
          `;
          imgContainer.innerHTML = '';
          imgContainer.appendChild(img);
        }
      }
    });
  };

  // Initialize image manager
  const init = async () => {
    const manifest = await loadManifest();

    if (manifest.pool && manifest.pool.length > 0) {
      distributeImages(manifest.pool);
      console.log('Image pool loaded:', imagePool);

      // Apply to visible cards
      setTimeout(applyServiceImages, 100);

      // Preload first batch
      const preloadList = Object.values(imagePool)
        .flat()
        .slice(0, 20)
        .map(img => STORE_PATH + img);
      preloadImages(preloadList);
    }

    // Re-apply images when new content loads
    const observer = new MutationObserver(() => {
      applyServiceImages();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  };

  // Public API
  window.ImageManager = {
    init,
    getRandomImage,
    getImages,
    getPool: () => imagePool,
    distribute: distributeImages,
    apply: applyServiceImages,
    preload: preloadImages
  };

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
