// ===== NewlyNow — navbar account link + notifications bell =====
(function () {
  'use strict';
  const nav = document.querySelector('.nav-inner');
  if (!nav) return;

  const acc = document.createElement('a');
  acc.href = 'account.html';
  acc.className = 'nav-account';
  acc.innerHTML = '<i class="fas fa-user"></i>';
  acc.setAttribute('aria-label', 'حسابي');

  const bell = document.createElement('button');
  bell.className = 'notif-bell';
  bell.type = 'button';
  bell.setAttribute('aria-label', 'الإشعارات');
  bell.innerHTML = '<i class="fas fa-bell"></i><span class="notif-badge" id="notifBadge" style="display:none">0</span>';

  const cta = nav.querySelector('.btn-grad, .btn');
  if (cta) { nav.insertBefore(bell, cta); nav.insertBefore(acc, bell); }
  else { nav.appendChild(acc); nav.appendChild(bell); }

  const panel = document.createElement('div');
  panel.className = 'notif-panel';
  panel.innerHTML = '<div class="np-head"><strong><i class="fas fa-bell"></i> الإشعارات</strong></div><div class="np-list" id="npList"><p class="np-empty">لا توجد إشعارات بعد.</p></div>';
  document.body.appendChild(panel);

  const badge = bell.querySelector('#notifBadge');
  const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
  const SEEN_KEY = 'newlynowAnnSeen';
  let anns = [];

  try {
    if (!localStorage.getItem(SEEN_KEY) && localStorage.getItem('annSeen')) {
      localStorage.setItem(SEEN_KEY, localStorage.getItem('annSeen'));
      localStorage.removeItem('annSeen');
    }
  } catch (_) {}

  function safeHref(raw) {
    if (!raw) return '';
    try {
      const u = new URL(raw, location.origin);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
      return u.href;
    } catch (_) { return ''; }
  }

  function seenAt() { return +(localStorage.getItem(SEEN_KEY) || 0); }
  function refreshBadge() {
    const n = anns.filter(a => a._t > seenAt()).length;
    badge.textContent = n;
    badge.style.display = n ? 'grid' : 'none';
  }

  function render() {
    const box = document.getElementById('npList');
    if (!anns.length) { box.innerHTML = '<p class="np-empty">لا توجد إشعارات بعد.</p>'; return; }
    box.innerHTML = anns.map(a => {
      const fresh = a._t > seenAt() ? ' np-new' : '';
      const href = safeHref(a.link);
      const link = href ? '<a href="' + esc(href) + '" target="_blank" rel="noopener noreferrer" class="np-link">عرض</a>' : '';
      return '<div class="np-item' + fresh + '"><strong>' + esc(a.title || 'إشعار') + '</strong><p>' + esc(a.body || '') + '</p>' + link + '</div>';
    }).join('');
  }

  bell.addEventListener('click', e => {
    e.stopPropagation();
    const open = panel.classList.toggle('open');
    if (open) { render(); localStorage.setItem(SEEN_KEY, Date.now()); refreshBadge(); }
  });
  document.addEventListener('click', e => { if (!panel.contains(e.target) && e.target !== bell) panel.classList.remove('open'); });

  const cfg = window.FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey) return;
  (async function () {
    try {
      const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
      const { getFirestore, collection, query, orderBy, limit, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
      const db = getFirestore(initializeApp(cfg, 'newlynowNotifApp'));
      let q;
      try { q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(20)); }
      catch (_) { q = collection(db, 'announcements'); }
      onSnapshot(q, snap => {
        anns = [];
        snap.forEach(d => {
          const a = d.data();
          a._t = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
          anns.push(a);
        });
        anns.sort((x, y) => y._t - x._t);
        refreshBadge();
        if (panel.classList.contains('open')) render();
      });
    } catch (_) { /* non-critical */ }
  })();
})();
