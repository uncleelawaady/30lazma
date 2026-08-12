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
window.NEWLYNOW_SECURITY_CONFIG = window.NEWLYNOW_SECURITY_CONFIG || { appCheckSiteKey: '' };
(function () {
  const path = location.pathname.toLowerCase();
  const isAdmin = /(?:^|\/)(?:admin|admin\.html)\/?$/.test(path);
  const isAccount = /(?:^|\/)(?:account|account\.html)\/?$/.test(path);
  const isHome = path === '/' || /(?:^|\/)index\.html\/?$/.test(path);
  const isInner = /(?:^|\/)(?:category|service)(?:\.html)?\/?$/.test(path);
  const pageFiles = isAdmin ? ['newlynow-admin-theme.css?v=2'] : ['newlynow-theme.css?v=2','newlynow-brand.css?v=1']
    .concat(isHome ? ['newlynow-home-theme.css?v=2'] : [])
    .concat(isInner ? ['newlynow-inner-theme.css?v=2'] : [])
    .concat(isAccount ? ['newlynow-account-theme.css?v=2'] : []);
  const files = ['newlynow-font.css?v=1'].concat(pageFiles).concat(['newlynow-burgundy-overrides.css?v=2']);
  files.forEach((href,i)=>{
    const base=href.split('?')[0];
    const existing=document.querySelector('link[href^="'+base+'"]');
    if(existing){
      if(existing.getAttribute('href')!==href) existing.setAttribute('href',href);
      existing.dataset.newlynowUi=String(i+1);
      return;
    }
    const l=document.createElement('link');l.rel='stylesheet';l.href=href;l.dataset.newlynowUi=String(i+1);document.head.appendChild(l);
  });
  const load=(src,key)=>{ if(document.querySelector(`script[data-newlynow-${key}]`))return; const s=document.createElement('script');s.src=src;s.dataset[`newlynow${key[0].toUpperCase()}${key.slice(1)}`]='1';s.defer=true;document.body.appendChild(s); };
  document.addEventListener('DOMContentLoaded',()=>{
    if(!isAdmin) load('newlynow-interactions.js?v=2','interactions');
    if(isHome){
      load('newlynow-layout.js?v=2','layout');
      load('newlynow-payments-display.js?v=1','paymentsdisplay');
    }
  },{once:true});
  if (!isAdmin && !document.querySelector('script[data-newlynow-app-check]')) { const s=document.createElement('script');s.src='app-check.js?v=2';s.dataset.newlynowAppCheck='1';s.defer=true;document.head.appendChild(s); }
  if (isAdmin) {
    document.title='لوحة تحكم NewlyNow';
    document.addEventListener('DOMContentLoaded',()=>{
      const rep=s=>String(s||'').replace(/EXD\s*\|\s*Elawaady\s*XDigital/gi,'NewlyNow').replace(/Elawaady\s*XDigital/gi,'NewlyNow').replace(/Elwaset\.net/gi,'NewlyNow.com').replace(/\bElwaset\b/gi,'NewlyNow');
      const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),nodes=[];while(w.nextNode())nodes.push(w.currentNode);nodes.forEach(n=>{const v=rep(n.nodeValue);if(v!==n.nodeValue)n.nodeValue=v;});
      load('admin-auth-hardening.js?v=1','auth');load('admin-orders.js?v=1','orders');load('admin-payments.js?v=3','payments');load('admin-pricing.js?v=1','pricing');load('admin-audit.js?v=1','audit');load('admin-security.js?v=1','security');
    },{once:true});
  }
})();
