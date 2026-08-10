// ===== NewlyNow — live config + storefront theme foundation =====
(function () {
  'use strict';

  const cfg = window.FIREBASE_CONFIG;
  const root = document.documentElement;
  const CACHE_KEY = 'newlynowConfig';

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
    radius: '24px'
  };

  function loadThemeCss() {
    if (document.querySelector('link[data-newlynow-theme]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'newlynow-theme.css?v=1';
    link.dataset.newlynowTheme = '1';
    document.head.appendChild(link);
  }

  function enforceTheme() {
    Object.entries(THEME).forEach(([key, value]) => root.style.setProperty('--' + key, value));
    root.style.setProperty('--grad', 'linear-gradient(100deg,#00E5FF 0%,#00C2FF 46%,#FF2A85 100%)');
    root.style.setProperty('--grad-btn', 'linear-gradient(100deg,#00E5FF 0%,#00C2FF 100%)');
    root.dataset.brand = 'newlynow';
  }

  function replaceTextNode(node) {
    if (!node || !node.nodeValue) return;
    let s = node.nodeValue;
    s = s.replace(/EXD\s*\|\s*Elawaady\s*XDigital/gi, 'NewlyNow');
    s = s.replace(/Elawaady\s*XDigital/gi, 'NewlyNow');
    s = s.replace(/Elwaset\.net/gi, 'NewlyNow.com');
    s = s.replace(/\bElwaset\b/gi, 'NewlyNow');
    s = s.replace(/أحمد\s+الوسيط/g, 'فريق NewlyNow');
    node.nodeValue = s;
  }

  function cleanLegacyBranding() {
    document.title = 'NewlyNow — كل خدماتك الرقمية في منصة واحدة';
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.content = 'NewlyNow — منصة واحدة للخدمات والمنتجات الرقمية باحترافية وتجربة شراء واضحة.';

    document.querySelectorAll('.brand-name').forEach(el => {
      el.innerHTML = 'NewlyNow<em>.com</em>';
      el.setAttribute('aria-label', 'NewlyNow.com');
    });

    document.querySelectorAll('img[alt]').forEach(img => {
      if (/Elwaset|Elawaady\s*XDigital|EXD/i.test(img.alt)) img.alt = 'NewlyNow';
    });

    document.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href') || '';
      if (/https?:\/\/(www\.)?elawaady\.com/i.test(href)) a.setAttribute('href', 'https://newlynow.com');
    });

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(replaceTextNode);

    const founder = document.getElementById('founder');
    if (founder) founder.remove();

    const line2 = document.querySelector('[data-k="heroLine2"]');
    if (line2 && /مكان واحد/.test(line2.textContent || '')) line2.textContent = 'في منصة واحدة';
  }

  function decorateSections() {
    const accents = ['cyan', 'pink', 'lime', 'gold'];
    const sections = Array.from(document.querySelectorAll('body > section, main > section'))
      .filter(s => !s.classList.contains('hero') && !s.classList.contains('stats-strip'));

    sections.forEach((section, index) => {
      section.classList.add('nn-section');
      if (!section.dataset.accent) section.dataset.accent = accents[index % accents.length];
      if (!section.querySelector(':scope > .nn-section-number')) {
        const n = document.createElement('span');
        n.className = 'nn-section-number';
        n.setAttribute('aria-hidden', 'true');
        n.textContent = String(index + 1).padStart(2, '0');
        section.prepend(n);
      }
    });
  }

  function finishUi() {
    loadThemeCss();
    enforceTheme();
    cleanLegacyBranding();
    decorateSections();
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

    const KNOWN = ['categories','featured','portfolio','testimonials','proofs','payments','partners'];
    if (Array.isArray(c.hidden)) {
      KNOWN.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = ''; });
      c.hidden.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    }

    finishUi();
  }

  loadThemeCss();
  enforceTheme();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', finishUi, { once: true });
  else finishUi();

  window.addEventListener('load', () => setTimeout(finishUi, 250), { once: true });
  document.addEventListener('catalogready', finishUi);

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
      const db = getFirestore(initializeApp(cfg, 'newlynowCfgApp'));
      onSnapshot(doc(db, 'config', 'site'), snap => {
        if (!snap.exists()) return;
        const c = snap.data();
        localStorage.setItem(CACHE_KEY, JSON.stringify(c));
        apply(c);
      });
    } catch (_) {
      console.warn('NewlyNow config load skipped');
    }
  })();
})();
