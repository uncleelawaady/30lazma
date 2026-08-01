// ===== NewlyNow — 3D coverflow carousel (categories/services showcase) =====
// Renders from the LIVE dashboard catalog (Firestore) when available, so
// category images/titles/colors stay in sync with the admin panel; falls back
// to the static window.CATEGORIES from data.js to avoid an initial flash.
(function () {
  const stage = document.getElementById('cfStage');
  if (!stage) return;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const dotsBox = document.getElementById('cfDots');
  const cf = document.getElementById('coverflow');
  let cards = [], dots = [], active = 0, timer = null;

  // Fallback image for a category with no own image: first service image inside it.
  function firstServiceImg(c) {
    const items = (c && c.groups && c.groups[0] && c.groups[0].items) || [];
    const det = (c && c.details) || {};
    for (let i = 0; i < items.length; i++) {
      const d = det[items[i]];
      if (d && d.img) return d.img;
    }
    return '';
  }

  function layout() {
    cards.forEach((card, i) => {
      const off = i - active, abs = Math.abs(off), sign = off < 0 ? -1 : 1;
      if (abs > 3) { card.style.opacity = '0'; card.style.pointerEvents = 'none'; card.style.transform = 'translateX(' + (sign * 620) + 'px) scale(.5)'; return; }
      card.style.opacity = abs === 0 ? '1' : (abs === 1 ? '.9' : '.55');
      card.style.pointerEvents = 'auto';
      card.style.zIndex = String(100 - abs);
      const x = off * 130, z = -abs * 240, ry = off * -38, sc = abs === 0 ? 1.05 : 0.9;
      card.style.transform = 'translateX(' + x + 'px) translateZ(' + z + 'px) rotateY(' + ry + 'deg) scale(' + sc + ')';
      card.classList.toggle('cf-active', abs === 0);
    });
    dots.forEach((d, i) => d.classList.toggle('active', i === active));
  }
  function go(i) { active = Math.max(0, Math.min(cards.length - 1, i)); layout(); }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  function start() { stop(); if (cards.length > 1) timer = setInterval(() => go(active >= cards.length - 1 ? 0 : active + 1), 3500); }

  // (Re)build the whole carousel from a categories object.
  function build(CATS) {
    if (!CATS) return;
    const ids = Object.keys(CATS)
      .filter(id => CATS[id] && CATS[id].active !== false)
      .sort((a, b) => (CATS[a].order || 0) - (CATS[b].order || 0));
    if (!ids.length) return;

    stage.innerHTML = ids.map((id, i) => {
      const c = CATS[id];
      // image priority: the category's own image, else the first service image, else the icon
      const imgSrc = c.img || firstServiceImg(c);
      const media = imgSrc ? '<img src="' + esc(imgSrc) + '" alt="">'
        : '<i class="' + (window.faIcon ? window.faIcon(c.icon) : ('fas ' + esc(c.icon || 'fa-layer-group'))) + '"></i>';
      return '<a class="cf-card" data-i="' + i + '" href="category.html?id=' + encodeURIComponent(id) + '" ' +
        'style="--g1:' + esc(c.g1 || '#17A85E') + ';--g2:' + esc(c.g2 || '#0E7A45') + '">' +
        '<div class="cf-media">' + media + '</div><div class="cf-title">' + esc(c.title || '') + '</div></a>';
    }).join('');

    cards = Array.prototype.slice.call(stage.querySelectorAll('.cf-card'));
    if (dotsBox) {
      dotsBox.innerHTML = ids.map((_, i) => '<button class="cf-dot" data-i="' + i + '" aria-label="' + (i + 1) + '"></button>').join('');
      dots = Array.prototype.slice.call(dotsBox.querySelectorAll('.cf-dot'));
      dots.forEach(d => d.addEventListener('click', () => go(+d.dataset.i)));
    }
    // clicking a side card centers it; clicking the active card follows the link
    cards.forEach(card => card.addEventListener('click', e => { const i = +card.dataset.i; if (i !== active) { e.preventDefault(); go(i); } }));

    active = Math.min(2, cards.length - 1);
    layout();
    start();
  }

  // Persistent controls (bound once; they read the live `active`/`cards`).
  const nextBtn = document.querySelector('.cf-next'), prevBtn = document.querySelector('.cf-prev');
  nextBtn && nextBtn.addEventListener('click', () => go(active + 1));
  prevBtn && prevBtn.addEventListener('click', () => go(active - 1));
  if (cf) {
    cf.addEventListener('mouseenter', stop);
    cf.addEventListener('mouseleave', start);
    let sx = null;
    cf.addEventListener('touchstart', e => { sx = e.touches[0].clientX; stop(); }, { passive: true });
    cf.addEventListener('touchend', e => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) go(active + (dx > 0 ? 1 : -1)); sx = null; start(); });
  }

  // 1) instant render from the static catalog (no flash)
  build(window.CATEGORIES);
  // 2) then sync with the live dashboard catalog (images/titles/colors/order)
  if (window.getCatalog) {
    Promise.resolve(window.getCatalog()).then(cat => { if (cat && Object.keys(cat).length) build(cat); }).catch(() => {});
  }
})();
