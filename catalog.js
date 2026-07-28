// ===== Elwaset — store catalog loader (categories/services from Firestore) =====
// Exposes window.getCatalog() -> Promise<categoriesObject|null>
// Shape matches data.js CATEGORIES: { id: { title, intro, icon, img, active, order, groups:[{h, items:[...]}] } }
(function () {
  let promise = null;
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
        const { getFirestore, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
        const app = getApps().some(a => a.name === 'catApp') ? getApp('catApp') : initializeApp(cfg, 'catApp');
        const snap = await getDoc(doc(getFirestore(app), 'config', 'catalog'));
        if (snap.exists()) {
          const data = snap.data();
          const cats = data.categories || null;
          if (cats) { localStorage.setItem('elwasetCatalog', JSON.stringify(cats)); return cats; }
        }
        return cached;
      } catch (e) { return cached; }
    })();
    return promise;
  };
})();
