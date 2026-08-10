// ===== NewlyNow — live config + storefront theme foundation =====
(function () {
  'use strict';

  const cfg = window.FIREBASE_CONFIG;
  const root = document.documentElement;
  const CACHE_KEY = 'newlynowConfig';

  const THEME = {
    bg: '#0D0E12', 'bg-2': '#1A1C23', yellow: '#00E5FF', orange: '#00C2FF',
    pink: '#FF2A85', purple: '#FF007A', violet: '#00C2FF', teal: '#00E5FF',
    text: '#FFFFFF', muted: '#A0A5B5', dim: '#707686', glass: 'rgba(26,28,35,.72)',
    'glass-brd': 'rgba(255,255,255,.08)', 'grad-from': '#00E5FF', 'grad-mid': '#00C2FF',
    'grad-to': '#FF2A85', 'ticker-bg': '#11131A', radius: '24px'
  };

  const brandReplace = s => String(s || '')
    .replace(/EXD\s*\|\s*Elawaady\s*XDigital/gi, 'NewlyNow')
    .replace(/Elawaady\s*XDigital/gi, 'NewlyNow')
    .replace(/Elwaset\.net/gi, 'NewlyNow.com')
    .replace(/\bElwaset\b/gi, 'NewlyNow')
    .replace(/فريق\s+الوسيط/g, 'فريق NewlyNow')
    .replace(/متجر\s+الوسيط/g, 'متجر NewlyNow')
    .replace(/أحمد\s+الوسيط/g, 'فريق NewlyNow');

  function loadThemeCss() {
    if (document.querySelector('link[data-newlynow-theme],link[data-newlynow-ui]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = 'newlynow-theme.css?v=1'; link.dataset.newlynowTheme = '1';
    document.head.appendChild(link);
  }

  function enforceTheme() {
    Object.entries(THEME).forEach(([key, value]) => root.style.setProperty('--' + key, value));
    root.style.setProperty('--grad', 'linear-gradient(100deg,#00E5FF 0%,#00C2FF 46%,#FF2A85 100%)');
    root.style.setProperty('--grad-btn', 'linear-gradient(100deg,#00E5FF 0%,#00C2FF 100%)');
    root.dataset.brand = 'newlynow';
  }

  function sanitizeHref(a) {
    if (!a || !a.getAttribute) return;
    const raw = a.getAttribute('href') || '';
    let next = raw;
    if (/https?:\/\/(www\.)?elawaady\.com/i.test(next)) next = next.replace(/https?:\/\/(www\.)?elawaady\.com/ig, 'https://newlynow.com');
    if (/https?:\/\/wa\.me\//i.test(next) && /[?&]text=/.test(next)) {
      try {
        const u = new URL(next, location.href);
        const oldText = u.searchParams.get('text');
        if (oldText) u.searchParams.set('text', brandReplace(oldText));
        next = u.toString();
      } catch (_) {}
    }
    if (next !== raw) a.setAttribute('href', next);
  }

  function cleanNode(node) {
    if (!node) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const next = brandReplace(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
    if (node.matches && node.matches('a[href]')) sanitizeHref(node);
    if (node.matches && node.matches('img[alt]') && /Elwaset|Elawaady\s*XDigital|EXD/i.test(node.alt || '')) node.alt = 'NewlyNow';
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const texts = [];
    while (walker.nextNode()) texts.push(walker.currentNode);
    texts.forEach(cleanNode);
    if (node.querySelectorAll) {
      node.querySelectorAll('a[href]').forEach(sanitizeHref);
      node.querySelectorAll('img[alt]').forEach(img => { if (/Elwaset|Elawaady\s*XDigital|EXD/i.test(img.alt || '')) img.alt = 'NewlyNow'; });
    }
  }

  function upsertMeta(selector, attr, value) {
    let el = document.head.querySelector(selector);
    if (!el) {
      el = document.createElement(selector.startsWith('link') ? 'link' : 'meta');
      if (selector.includes('property=')) el.setAttribute('property', selector.match(/property="([^"]+)"/)[1]);
      else if (selector.includes('name=')) el.setAttribute('name', selector.match(/name="([^"]+)"/)[1]);
      else if (selector.startsWith('link')) el.setAttribute('rel', 'canonical');
      document.head.appendChild(el);
    }
    el.setAttribute(attr, value);
  }

  function cleanMetadata() {
    const fallbackTitle = 'NewlyNow — كل خدماتك الرقمية في منصة واحدة';
    let title = brandReplace(document.title || fallbackTitle);
    if (/Elwaset|Elawaady|EXD|الوسيط/i.test(title)) title = fallbackTitle;
    document.title = title || fallbackTitle;

    const oldDesc = document.querySelector('meta[name="description"]');
    const fallbackDesc = 'NewlyNow منصة رقمية للخدمات والمنتجات الرقمية، السوشيال ميديا، الذكاء الاصطناعي، الاشتراكات والحلول التقنية.';
    const description = brandReplace(oldDesc && oldDesc.content || fallbackDesc) || fallbackDesc;
    upsertMeta('meta[name="description"]', 'content', description);
    upsertMeta('meta[property="og:title"]', 'content', document.title);
    upsertMeta('meta[property="og:description"]', 'content', description);
    upsertMeta('meta[property="og:site_name"]', 'content', 'NewlyNow');
    upsertMeta('meta[property="og:type"]', 'content', 'website');
    upsertMeta('meta[name="twitter:title"]', 'content', document.title);
    upsertMeta('meta[name="twitter:description"]', 'content', description);

    try {
      const canonical = new URL(location.pathname + location.search, 'https://newlynow.com');
      canonical.hash = '';
      upsertMeta('link[rel="canonical"]', 'href', canonical.href);
      upsertMeta('meta[property="og:url"]', 'content', canonical.href);
    } catch (_) {}
  }

  function cleanLegacyBranding() {
    cleanMetadata();
    document.querySelectorAll('.brand-name').forEach(el => {
      el.innerHTML = 'NewlyNow<em>.com</em>'; el.setAttribute('aria-label', 'NewlyNow.com');
    });
    cleanNode(document.body);

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
        const n = document.createElement('span'); n.className = 'nn-section-number'; n.setAttribute('aria-hidden', 'true');
        n.textContent = String(index + 1).padStart(2, '0'); section.prepend(n);
      }
    });
  }

  function finishUi() { loadThemeCss(); enforceTheme(); cleanLegacyBranding(); decorateSections(); }

  function watchBrand() {
    if (window.__newlynowBrandObserver) return;
    const obs = new MutationObserver(mutations => {
      mutations.forEach(m => {
        if (m.type === 'attributes' && m.target && m.target.matches && m.target.matches('a[href]')) sanitizeHref(m.target);
        m.addedNodes && m.addedNodes.forEach(cleanNode);
        if (m.type === 'characterData') cleanNode(m.target);
      });
    });
    obs.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['href'] });
    window.__newlynowBrandObserver = obs;
  }

  function apply(c) {
    if (!c) c = {};
    window.SITE_CONFIG = c;
    try { document.dispatchEvent(new CustomEvent('siteconfig', { detail: c })); } catch (_) {}
    if (c.texts) for (const k in c.texts) {
      const v = c.texts[k]; if (v == null || v === '') continue;
      document.querySelectorAll('[data-k="' + k + '"]').forEach(el => { el.textContent = brandReplace(v); });
    }
    const KNOWN = ['categories','featured','portfolio','testimonials','proofs','payments','partners'];
    if (Array.isArray(c.hidden)) {
      KNOWN.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = ''; });
      c.hidden.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    }
    finishUi();
  }

  loadThemeCss(); enforceTheme();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { finishUi(); watchBrand(); }, { once: true });
  else { finishUi(); watchBrand(); }
  window.addEventListener('load', () => { setTimeout(finishUi, 250); setTimeout(finishUi, 2200); }, { once: true });
  document.addEventListener('catalogready', finishUi);

  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || localStorage.getItem('elwasetConfig') || 'null');
    if (cached) { localStorage.setItem(CACHE_KEY, JSON.stringify(cached)); localStorage.removeItem('elwasetConfig'); apply(cached); }
  } catch (_) {}

  if (!cfg || !cfg.apiKey) return;
  (async function () {
    try {
      const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
      const { getFirestore, doc, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
      const db = getFirestore(initializeApp(cfg, 'newlynowCfgApp'));
      onSnapshot(doc(db, 'config', 'site'), snap => {
        if (!snap.exists()) return;
        const c = snap.data(); localStorage.setItem(CACHE_KEY, JSON.stringify(c)); apply(c);
      });
    } catch (_) { console.warn('NewlyNow config load skipped'); }
  })();
})();
