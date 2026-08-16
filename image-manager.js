// NewlyNow Image Manager — Handles image distribution
(function() {
  const STORE_PATH = 'assets/store/';

  const loadManifest = async () => {
    try {
      const response = await fetch(STORE_PATH + 'manifest.json');
      if (!response.ok) throw new Error('Manifest not found');
      return await response.json();
    } catch (error) {
      console.warn('Image manifest not found:', error);
      return { pool: [], big: [] };
    }
  };

  const applyImagesToCards = (images) => {
    const cards = document.querySelectorAll('[data-category] .cat-ico, .cat-ico');
    images.forEach((img, idx) => {
      const card = cards[idx % cards.length];
      if (card && !card.querySelector('img')) {
        const imgEl = document.createElement('img');
        imgEl.src = STORE_PATH + img;
        imgEl.alt = 'service';
        imgEl.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:8px;';
        card.innerHTML = '';
        card.appendChild(imgEl);
      }
    });
  };

  const init = async () => {
    const manifest = await loadManifest();
    if (manifest.pool && manifest.pool.length > 0) {
      applyImagesToCards(manifest.pool);
      console.log('Images loaded:', manifest.pool.length);
    }
  };

  window.ImageManager = { init, loadManifest };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
