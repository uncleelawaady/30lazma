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

// Load the correct NewlyNow visual layer on every legacy page without duplicating markup edits.
(function () {
  const isAdmin = /(?:^|\/)(?:admin|admin\.html)\/?$/i.test(location.pathname);
  const href = isAdmin ? 'newlynow-admin-theme.css?v=1' : 'newlynow-theme.css?v=1';
  if (document.querySelector('link[data-newlynow-ui]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset.newlynowUi = '1';
  document.head.appendChild(link);
})();
