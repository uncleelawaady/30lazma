// ===== Elwaset — 3D coverflow carousel (categories/services showcase) =====
(function () {
  const stage = document.getElementById('cfStage');
  if (!stage || !window.CATEGORIES) return;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ids = Object.keys(window.CATEGORIES);
  if (!ids.length) return;

  stage.innerHTML = ids.map((id, i) => {
    const c = window.CATEGORIES[id];
    const media = c.img ? '<img src="' + esc(c.img) + '" alt="">'
      : '<i class="' + (window.faIcon ? window.faIcon(c.icon) : ('fas ' + esc(c.icon || 'fa-layer-group'))) + '"></i>';
    return '<a class="cf-card" data-i="' + i + '" href="category.html?id=' + encodeURIComponent(id) + '" ' +
      'style="--g1:' + esc(c.g1 || '#17A85E') + ';--g2:' + esc(c.g2 || '#0E7A45') + '">' +
      '<div class="cf-media">' + media + '</div><div class="cf-title">' + esc(c.title || '') + '</div></a>';
  }).join('');

  const cards = Array.prototype.slice.call(stage.querySelectorAll('.cf-card'));
  const dotsBox = document.getElementById('cfDots');
  if (dotsBox) dotsBox.innerHTML = ids.map((_, i) => '<button class="cf-dot" data-i="' + i + '" aria-label="' + (i + 1) + '"></button>').join('');
  const dots = dotsBox ? Array.prototype.slice.call(dotsBox.querySelectorAll('.cf-dot')) : [];
  let active = Math.min(2, cards.length - 1);

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
  layout();

  const nextBtn = document.querySelector('.cf-next'), prevBtn = document.querySelector('.cf-prev');
  nextBtn && nextBtn.addEventListener('click', () => go(active + 1));
  prevBtn && prevBtn.addEventListener('click', () => go(active - 1));
  dots.forEach(d => d.addEventListener('click', () => go(+d.dataset.i)));
  // clicking a side card centers it; clicking the active card follows the link
  cards.forEach(card => card.addEventListener('click', e => { const i = +card.dataset.i; if (i !== active) { e.preventDefault(); go(i); } }));

  // auto-advance (pause on hover)
  const cf = document.getElementById('coverflow');
  let timer = null;
  const start = () => { timer = setInterval(() => go(active >= cards.length - 1 ? 0 : active + 1), 3500); };
  const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
  start();
  if (cf) { cf.addEventListener('mouseenter', stop); cf.addEventListener('mouseleave', start); }

  // swipe on touch
  let sx = null;
  if (cf) {
    cf.addEventListener('touchstart', e => { sx = e.touches[0].clientX; stop(); }, { passive: true });
    cf.addEventListener('touchend', e => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) go(active + (dx > 0 ? 1 : -1)); sx = null; start(); });
  }
})();
