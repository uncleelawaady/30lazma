// ===== Elwaset — live site config (theme + texts + sections) from Firestore =====
(function () {
  const cfg = window.FIREBASE_CONFIG;
  const root = document.documentElement;

  function apply(c) {
    if (!c) return;
    // expose full config (theme/texts/policies/contact...) for other pages
    window.SITE_CONFIG = c;
    try { document.dispatchEvent(new CustomEvent('siteconfig', { detail: c })); } catch (e) {}
    // theme colors -> CSS variables
    if (c.theme) for (const k in c.theme) { if (c.theme[k]) root.style.setProperty('--' + k, c.theme[k]); }
    // unify category tile colors with the theme (optional)
    if (document.body) document.body.classList.toggle('unify-cats', !!c.unifyCats);
    // editable texts -> elements tagged with data-k
    if (c.texts) for (const k in c.texts) {
      const v = c.texts[k];
      if (v == null || v === '') continue;
      document.querySelectorAll('[data-k="' + k + '"]').forEach(el => { el.textContent = v; });
    }
    // show/hide sections by id
    const KNOWN = ['founder', 'categories', 'featured', 'portfolio', 'testimonials', 'proofs', 'payments', 'partners'];
    if (Array.isArray(c.hidden)) {
      KNOWN.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = ''; });
      c.hidden.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    }
  }

  // instant apply from cache (avoids flash), then live
  try { const cached = JSON.parse(localStorage.getItem('elwasetConfig') || 'null'); if (cached) apply(cached); } catch (e) {}

  if (!cfg || !cfg.apiKey) return;
  (async function () {
    try {
      const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
      const { getFirestore, doc, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
      const db = getFirestore(initializeApp(cfg, 'cfgApp'));
      onSnapshot(doc(db, 'config', 'site'), snap => {
        if (snap.exists()) {
          const c = snap.data();
          localStorage.setItem('elwasetConfig', JSON.stringify(c));
          apply(c);
        }
      });
    } catch (e) { console.warn('config load skipped', e); }
  })();
})();
