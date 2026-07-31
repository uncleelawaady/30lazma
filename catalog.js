// ===== Elwaset — store catalog loader (categories/services from Firestore) =====
// Exposes window.getCatalog() -> Promise<categoriesObject|null>
// Shape matches data.js CATEGORIES: { id: { title, intro, icon, img, active, order, groups:[{h, items:[...]}] } }
// Storage model: each category is its own small document at config/cat_<id>
// (so no single document ever hits Firestore's 1 MiB limit). Falls back to the
// legacy single config/catalog document for older data.
(function () {
  let promise = null;
  // Coupons captured during the same config-collection read (config/coupons).
  window.getCoupons = function () {
    try { return JSON.parse(localStorage.getItem('elwasetCoupons') || '[]'); } catch (e) { return []; }
  };
  window.getCatalog = function () {
    if (promise) return promise;
    promise = (async function () {
      const cfg = window.FIREBASE_CONFIG;
      // instant cache
      let cached = null;
      try { cached = JSON.parse(localStorage.getItem('elwasetCatalog') || 'null'); } catch (e) {}
      if (!cfg || !cfg.apiKey) return cached;
      try {
        const { initializeApp, getApps, getApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
        const { getFirestore, doc, getDoc, collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
        const app = getApps().some(a => a.name === 'catApp') ? getApp('catApp') : initializeApp(cfg, 'catApp');
        const db = getFirestore(app);
        // preferred: per-category documents (config/cat_<id>)
        const snap = await getDocs(collection(db, 'config'));
        const cats = {}; let hasSplit = false;
        snap.forEach(d => {
          if (d.id.indexOf('cat_') === 0) {
            hasSplit = true;
            const data = d.data();
            cats[data._id || d.id.slice(4)] = data;
          } else if (d.id === 'coupons') {
            try { localStorage.setItem('elwasetCoupons', JSON.stringify(d.data().list || [])); } catch (e) {}
          }
        });
        if (hasSplit) { localStorage.setItem('elwasetCatalog', JSON.stringify(cats)); return cats; }
        // fallback: legacy single document
        const legacy = await getDoc(doc(db, 'config', 'catalog'));
        if (legacy.exists()) {
          const c = legacy.data().categories || null;
          if (c) { localStorage.setItem('elwasetCatalog', JSON.stringify(c)); return c; }
        }
        return cached;
      } catch (e) { return cached; }
    })();
    return promise;
  };
})();
