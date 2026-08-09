// ===== NewlyNow — live site config + brand/theme foundation =====
(function () {
  'use strict';

  const cfg = window.FIREBASE_CONFIG;
  const root = document.documentElement;
  const CACHE_KEY = 'newlynowConfig';

  // NewlyNow dark-neon design system. Kept here as a single source of truth
  // so legacy Elwaset/EXD theme values cannot leak back into the storefront.
  const THEME = {
    bg: '#0D0E12',
    'bg-2': '#1A1C23',
    yellow: '#00E5FF',
    orange: '#00C2FF',
    pink: '#FF2A85',
    purple: '#FF007A',
    violet: '#00C2FF',
    teal: '#00E5FF',
    text: '#FFFFFF',
    muted: '#A0A5B5',
    dim: '#707686',
    glass: 'rgba(26,28,35,.72)',
    'glass-brd': 'rgba(255,255,255,.08)',
    'grad-from': '#00E5FF',
    'grad-mid': '#00C2FF',
    'grad-to': '#FF2A85',
    'ticker-bg': '#11131A',
    radius: '18px'
  };

  function enforceTheme() {
    Object.entries(THEME).forEach(([key, value]) => root.style.setProperty('--' + key, value));
    root.style.setProperty('--grad', 'linear-gradient(100deg,#00E5FF 0%,#00C2FF 46%,#FF2A85 100%)');
    root.style.setProperty('--grad-btn', 'linear-gradient(100deg,#00E5FF 0%,#00C2FF 100%)');
    root.dataset.brand = 'newlynow';
  }

  function injectThemeLayer() {
    if (document.getElementById('newlynow-theme-layer')) return;
    const style = document.createElement('style');
    style.id = 'newlynow-theme-layer';
    style.textContent = `
      body{background:#0D0E12!important;color:#fff;font-family:'Cairo','Inter',sans-serif!important}
      body::before{background:radial-gradient(55% 32% at 50% 2%,rgba(0,229,255,.11),transparent 70%),radial-gradient(38% 24% at 82% 20%,rgba(255,42,133,.07),transparent 72%)!important;filter:none!important}
      body::after{opacity:.22!important;background-size:52px 52px!important}
      .nav{background:rgba(13,14,18,.82)!important;border-bottom:1px solid rgba(255,255,255,.08)!important;backdrop-filter:blur(18px)!important}
      .glass,.card,.service-card,.product-card{background:linear-gradient(145deg,rgba(26,28,35,.92),rgba(17,19,26,.88))!important;border-color:rgba(255,255,255,.08)!important;box-shadow:0 18px 60px rgba(0,0,0,.22)!important}
      .cat:hover,.card:hover,.service-card:hover,.product-card:hover{border-color:rgba(0,229,255,.55)!important;box-shadow:0 18px 55px rgba(0,229,255,.10)!important}
      .btn-grad,.btn-primary{background:#00E5FF!important;color:#061014!important;border-color:#00E5FF!important;text-shadow:none!important;box-shadow:0 10px 32px rgba(0,229,255,.20)!important}
      .btn-grad:hover,.btn-primary:hover{background:#21e9ff!important;box-shadow:0 14px 38px rgba(0,229,255,.34)!important}
      .btn-ghost{background:rgba(255,255,255,.035)!important;border-color:rgba(255,255,255,.11)!important}
      .btn-ghost:hover{border-color:#00E5FF!important;box-shadow:0 0 24px rgba(0,229,255,.12)!important}
      .grad-text{background:linear-gradient(100deg,#00E5FF 0%,#00C2FF 48%,#FF2A85 100%)!important;-webkit-background-clip:text!important;background-clip:text!important;color:transparent!important}
      .search-bar{background:rgba(26,28,35,.76)!important;border-color:rgba(255,255,255,.10)!important;box-shadow:0 18px 55px rgba(0,0,0,.30)!important}
      .eyebrow,.pill i,.hero-trust i{color:#00E5FF!important}
      .top-ticker{background:#11131A!important;border-bottom:1px solid rgba(0,229,255,.16)!important}
      ::selection{background:#00E5FF;color:#071014}
      :focus-visible{outline:2px solid #00E5FF!important;outline-offset:3px}
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

    // Keep content controls from the dashboard, but the NewlyNow visual identity
    // remains authoritative during this migration.
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
    injectThemeLayer();
    replaceLegacyBranding();
  }

  // Apply immediately to avoid a flash of the old identity.
  enforceTheme();
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
