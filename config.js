// ===== NewlyNow — live site config + brand/theme foundation =====
(function () {
  'use strict';

  const cfg = window.FIREBASE_CONFIG;
  const root = document.documentElement;
  const CACHE_KEY = 'newlynowConfig';

  // NewlyNow dark-neon design system. Kept here as a single source of truth
  // so legacy Elwaset/EXD theme values cannot leak back into the storefront.
  const THEME = {
    bg: '#07090D',
    'bg-2': '#111720',
    yellow: '#26D9FF',
    orange: '#00A8FF',
    pink: '#FF3D8F',
    purple: '#FF3D8F',
    violet: '#00A8FF',
    teal: '#26D9FF',
    text: '#FFFFFF',
    muted: '#9CA6B7',
    dim: '#707B8B',
    glass: 'rgba(17,23,32,.82)',
    'glass-brd': 'rgba(255,255,255,.12)',
    'grad-from': '#FFFFFF',
    'grad-mid': '#26D9FF',
    'grad-to': '#FF3D8F',
    'ticker-bg': '#080B10',
    radius: '24px'
  };

  function enforceTheme() {
    Object.entries(THEME).forEach(([key, value]) => root.style.setProperty('--' + key, value));
    root.style.setProperty('--grad', 'linear-gradient(90deg,#FFFFFF 0%,#26D9FF 48%,#FF3D8F 120%)');
    root.style.setProperty('--grad-btn', 'linear-gradient(90deg,#FFFFFF 0%,#FFFFFF 100%)');
    root.dataset.brand = 'newlynow';
  }

  function injectStylesheet() {
    if (document.querySelector('link[data-newlynow-theme]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'newlynow-theme.css?v=1';
    link.dataset.newlynowTheme = 'true';
    document.head.appendChild(link);
  }

  function injectThemeLayer() {
    if (document.getElementById('newlynow-theme-layer')) return;
    const style = document.createElement('style');
    style.id = 'newlynow-theme-layer';
    style.textContent = `
      body{background:#07090D!important;color:#fff;font-family:'Cairo','Inter',sans-serif!important}
      .grad-text{background:linear-gradient(90deg,#fff 0%,#26D9FF 48%,#FF3D8F 120%)!important;-webkit-background-clip:text!important;background-clip:text!important;color:transparent!important}
      .eyebrow,.pill i,.hero-trust i{color:#26D9FF!important}
      ::selection{background:#26D9FF;color:#071014}
      :focus-visible{outline:2px solid #26D9FF!important;outline-offset:3px}
      @media (prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
    `;
    document.head.appendChild(style);
  }

  function replaceLegacyBranding() {
    const replacements = [
      [/Elawaady\s*XDigital/gi, 'NewlyNow'],
      [/Elwaset\.net/gi, 'NewlyNow.com'],
      [/\bElwaset\b/gi, 'NewlyNow'],
      [/الوسيط/g, 'NewlyNow']
    ];

    if (/Elwaset|Elawaady\s*XDigital|الوسيط/i.test(document.title)) {
      let title = document.title;
      replacements.forEach(([from, to]) => { title = title.replace(from, to); });
      document.title = title;
    }

    document.querySelectorAll('.brand-name').forEach(el => {
      el.innerHTML = 'NewlyNow<em>.com</em>';
      el.setAttribute('aria-label', 'NewlyNow.com');
    });

    document.querySelectorAll('img[alt]').forEach(img => {
      if (/Elwaset|Elawaady\s*XDigital/i.test(img.alt)) img.alt = 'NewlyNow';
    });
  }

  function apply(c) {
    if (!c) c = {};
    window.SITE_CONFIG = c;
    try { document.dispatchEvent(new CustomEvent('siteconfig', { detail: c })); } catch (_) {}

    if (c.texts) for (const k in c.texts) {
      const v = c.texts[k];
      if (v == null || v === '') continue;
      document.querySelectorAll('[data-k="' + k + '"]').forEach(el => { el.textContent = v; });
    }

    const KNOWN = ['founder','categories','featured','portfolio','testimonials','proofs','payments','partners'];
    if (Array.isArray(c.hidden)) {
      KNOWN.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = ''; });
      c.hidden.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    }

    enforceTheme();
    injectStylesheet();
    injectThemeLayer();
    replaceLegacyBranding();
  }

  // Apply immediately to avoid a flash of the old identity.
  enforceTheme();
  injectStylesheet();
  injectThemeLayer();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', replaceLegacyBranding, { once:true });
  else replaceLegacyBranding();

  // Migrate cached site content once; never keep using the legacy cache key.
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || localStorage.getItem('elwasetConfig') || 'null');
    if (cached) {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
      localStorage.removeItem('elwasetConfig');
      apply(cached);
    }
  } catch (_) {}

  if (!cfg || !cfg.apiKey) return;
  (async function () {
    try {
      const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
      const { getFirestore, doc, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
      const appName = 'newlynowCfgApp';
      const db = getFirestore(initializeApp(cfg, appName));
      onSnapshot(doc(db, 'config', 'site'), snap => {
        if (!snap.exists()) return;
        const c = snap.data();
        localStorage.setItem(CACHE_KEY, JSON.stringify(c));
        apply(c);
      });
    } catch (e) {
      console.warn('NewlyNow config load skipped');
    }
  })();
})();
