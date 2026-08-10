// ===== NewlyNow — store catalog loader (categories/services from Firestore) =====
// Exposes window.getCatalog() -> Promise<categoriesObject|null>
(function () {
  const CACHE_KEY = 'newlynowCatalog';
  const LEGACY_KEY = 'elwasetCatalog';
  let promise = null;

  function cachedCatalog() {
    try {
      const value = JSON.parse(localStorage.getItem(CACHE_KEY) || localStorage.getItem(LEGACY_KEY) || 'null');
      if (value) {
        localStorage.setItem(CACHE_KEY, JSON.stringify(value));
        localStorage.removeItem(LEGACY_KEY);
      }
      return value;
    } catch (_) { return null; }
  }

  window.getCatalog = function () {
    if (promise) return promise;
    promise = (async function () {
      const cfg = window.FIREBASE_CONFIG;
      const cached = cachedCatalog();
      if (!cfg || !cfg.apiKey) return cached;
      try {
        const { initializeApp, getApps, getApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
        const { getFirestore, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
        const app = getApps().some(a => a.name === 'catApp') ? getApp('catApp') : initializeApp(cfg, 'catApp');
        const snap = await getDoc(doc(getFirestore(app), 'config', 'catalog'));
        if (snap.exists()) {
          const cats = snap.data().categories || null;
          if (cats) {
            localStorage.setItem(CACHE_KEY, JSON.stringify(cats));
            localStorage.removeItem(LEGACY_KEY);
            try { document.dispatchEvent(new CustomEvent('catalogready', { detail: cats })); } catch (_) {}
            return cats;
          }
        }
        return cached;
      } catch (_) { return cached; }
    })();
    return promise;
  };
})();
