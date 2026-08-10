// ===== NewlyNow Firebase web config =====
// Firebase web config is a public client identifier; authorization is enforced by Auth + Security Rules.
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyD2yPbgNPppQc1wxhFvbYojY8XCwSnm9JQ",
  authDomain: "elwaset-store.firebaseapp.com",
  projectId: "elwaset-store",
  storageBucket: "elwaset-store.firebasestorage.app",
  messagingSenderId: "528440617091",
  appId: "1:528440617091:web:004cac53d438f279ce53b6"
};

(function () {
  const path = location.pathname.toLowerCase();
  const isAdmin = /(?:^|\/)(?:admin|admin\.html)\/?$/.test(path);
  const isAccount = /(?:^|\/)(?:account|account\.html)\/?$/.test(path);
  const isHome = path === '/' || /(?:^|\/)index\.html\/?$/.test(path);

  const files = isAdmin
    ? ['newlynow-admin-theme.css?v=1']
    : ['newlynow-theme.css?v=1','newlynow-brand.css?v=1']
        .concat(isHome ? ['newlynow-home-theme.css?v=1'] : [])
        .concat(isAccount ? ['newlynow-account-theme.css?v=1'] : []);

  files.forEach((href, i) => {
    if (document.querySelector('link[href^="' + href.split('?')[0] + '"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = href; link.dataset.newlynowUi = String(i + 1);
    document.head.appendChild(link);
  });

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
    }, { once: true });
  }
})();
