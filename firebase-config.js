// ===== NewlyNow Firebase web config =====
// Firebase web config and App Check site keys are public client identifiers.
// Private gateway/API secrets must remain server-side only.
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyD2yPbgNPppQc1wxhFvbYojY8XCwSnm9JQ",
  authDomain: "elwaset-store.firebaseapp.com",
  projectId: "elwaset-store",
  storageBucket: "elwaset-store.firebasestorage.app",
  messagingSenderId: "528440617091",
  appId: "1:528440617091:web:004cac53d438f279ce53b6"
};

window.NEWLYNOW_SECURITY_CONFIG = window.NEWLYNOW_SECURITY_CONFIG || {
  appCheckSiteKey: ''
};

(function () {
  const path = location.pathname.toLowerCase();
  const isAdmin = /(?:^|\/)(?:admin|admin\.html)\/?$/.test(path);
  const isAccount = /(?:^|\/)(?:account|account\.html)\/?$/.test(path);
  const isHome = path === '/' || /(?:^|\/)index\.html\/?$/.test(path);
  const isInner = /(?:^|\/)(?:category|service)(?:\.html)?\/?$/.test(path);

  const files = isAdmin
    ? ['newlynow-admin-theme.css?v=1']
    : ['newlynow-theme.css?v=1','newlynow-brand.css?v=1']
        .concat(isHome ? ['newlynow-home-theme.css?v=1'] : [])
        .concat(isInner ? ['newlynow-inner-theme.css?v=1'] : [])
        .concat(isAccount ? ['newlynow-account-theme.css?v=1'] : []);

  files.forEach((href, i) => {
    if (document.querySelector('link[href^="' + href.split('?')[0] + '"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = href; link.dataset.newlynowUi = String(i + 1);
    document.head.appendChild(link);
  });

  if (!isAdmin && !document.querySelector('script[data-newlynow-app-check]')) {
    const s = document.createElement('script');
    s.src = 'app-check.js?v=2';
    s.dataset.newlynowAppCheck = '1';
    s.defer = true;
    document.head.appendChild(s);
  }

  if (isHome) {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.querySelector('script[data-newlynow-layout]')) return;
      const s = document.createElement('script');
      s.src = 'newlynow-layout.js?v=1';
      s.dataset.newlynowLayout = '1';
      document.body.appendChild(s);
    }, { once:true });
  }

  if (isAdmin) {
    document.title = 'لوحة تحكم NewlyNow';
    document.addEventListener('DOMContentLoaded', () => {
      const rep = s => String(s || '')
        .replace(/EXD\s*\|\s*Elawaady\s*XDigital/gi, 'NewlyNow')
        .replace(/Elawaady\s*XDigital/gi, 'NewlyNow')
        .replace(/Elwaset\.net/gi, 'NewlyNow.com')
        .replace(/\bElwaset\b/gi, 'NewlyNow');
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const nodes = []; while (w.nextNode()) nodes.push(w.currentNode);
      nodes.forEach(n => { const v = rep(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; });

      const loadAdminScript = (src, key) => {
        if (document.querySelector(`script[data-newlynow-${key}]`)) return;
        const s = document.createElement('script');
        s.src = src;
        s.dataset[`newlynow${key[0].toUpperCase()}${key.slice(1)}`] = '1';
        s.defer = true;
        document.body.appendChild(s);
      };
      loadAdminScript('admin-payments.js?v=3', 'payments');
      loadAdminScript('admin-pricing.js?v=1', 'pricing');
      loadAdminScript('admin-audit.js?v=1', 'audit');
      loadAdminScript('admin-security.js?v=1', 'security');
    }, { once: true });
  }
})();
