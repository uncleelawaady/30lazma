// ===== NewlyNow — shared UI widgets: top ticker + moving services marquee =====
(function () {
  'use strict';
  if(window.__NEWLYNOW_WIDGETS__) return;
  window.__NEWLYNOW_WIDGETS__=true;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const toList = v => Array.isArray(v) ? v : String(v || '').split('|').map(s => s.trim()).filter(Boolean);
  const tickerDefaults = ['NewlyNow.com — كل ما هو جديـد الآن', 'خدمـات رقميـة مميـزة ⭐', 'دعـم ومتابعـة', 'تنفيـذ منظـم وآمـن 🔒', 'أقسـام وخدمـات متعـددة', 'تجربـة شـراء احترافيـة'];

  function buildTicker(items) {
    const track = document.getElementById('tickerTrack'); if (!track) return;
    if (!items || !items.length) items = tickerDefaults;
    const one = items.map(t => '<span>' + esc(t) + '</span><span class="tk-dot">◆</span>').join('');
    track.innerHTML = one + one;
  }

  let cachedTicker = null;
  try {
    const cached=JSON.parse(localStorage.getItem('newlynowConfig') || localStorage.getItem('elwasetConfig') || 'null') || {};
    cachedTicker=cached.ticker;
  } catch (_) {}
  buildTicker(cachedTicker ? toList(cachedTicker) : tickerDefaults);
  document.addEventListener('siteconfig', e => { const t = e.detail && e.detail.ticker; buildTicker(t ? toList(t) : tickerDefaults); });

  const track = document.getElementById('mqTrack');
  if (track && window.CATEGORIES) {
    const ids = Object.keys(window.CATEGORIES);
    const card = id => {
      const c = window.CATEGORIES[id];
      const ico = c.img ? '<img src="' + esc(c.img) + '" alt="">' : '<i class="' + (window.faIcon ? window.faIcon(c.icon) : ('fas ' + esc(c.icon || 'fa-layer-group'))) + '"></i>';
      return '<a class="mq-card" href="category.html?id=' + encodeURIComponent(id) + '" style="--g1:' + esc(c.g1 || '#F20F62') + ';--g2:' + esc(c.g2 || '#7C103B') + '">' +
        '<div class="mq-ico">' + ico + '</div><h4>' + esc(c.title || '') + '</h4></a>';
    };
    const one = ids.map(card).join('');
    track.innerHTML = one + one;
  }
})();
