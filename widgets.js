// ===== Elwaset — shared UI widgets: top ticker + moving services marquee =====
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const toList = v => Array.isArray(v) ? v : String(v || '').split('|').map(s => s.trim()).filter(Boolean);
  const tickerDefaults = ['متجر الوسيط — Elwaset.net', 'خدمات مميزة ⭐', 'دعم فني 24/7', 'جروب الوسيط الرسمي', 'أسعار تنافسية 🔥', 'تنفيذ فوري وآمن 🔒'];

  function buildTicker(items) {
    const track = document.getElementById('tickerTrack'); if (!track) return;
    if (!items || !items.length) items = tickerDefaults;
    const one = items.map(t => '<span>' + esc(t) + '</span><span class="tk-dot">◆</span>').join('');
    track.innerHTML = one + one; // duplicate for a seamless loop
  }
  // instant from cached config, then live via the 'siteconfig' event (config.js)
  let cachedTicker = null;
  try { cachedTicker = (JSON.parse(localStorage.getItem('elwasetConfig') || 'null') || {}).ticker; } catch (e) {}
  buildTicker(cachedTicker ? toList(cachedTicker) : tickerDefaults);
  document.addEventListener('siteconfig', e => { const t = e.detail && e.detail.ticker; buildTicker(t ? toList(t) : tickerDefaults); });

  // moving services marquee (built from the default categories set)
  const track = document.getElementById('mqTrack');
  if (track && window.CATEGORIES) {
    const ids = Object.keys(window.CATEGORIES);
    const card = id => {
      const c = window.CATEGORIES[id];
      const ico = c.img ? '<img src="' + esc(c.img) + '" alt="">' : '<i class="' + (window.faIcon ? window.faIcon(c.icon) : ('fas ' + esc(c.icon || 'fa-layer-group'))) + '"></i>';
      return '<a class="mq-card" href="category.html?id=' + encodeURIComponent(id) + '" style="--g1:' + esc(c.g1 || '#17A85E') + ';--g2:' + esc(c.g2 || '#0E7A45') + '">' +
        '<div class="mq-ico">' + ico + '</div><h4>' + esc(c.title || '') + '</h4></a>';
    };
    const one = ids.map(card).join('');
    track.innerHTML = one + one; // duplicate for a seamless loop
  }
})();
