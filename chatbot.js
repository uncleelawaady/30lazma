// ===== Elwaset — store chatbot (knowledge-base assistant) =====
// A floating assistant that answers from a keyword-matched knowledge base.
// The knowledge base + bot name/welcome come from Firestore (config/chatbot,
// editable in the dashboard) with a localStorage cache and this built-in seed
// as the offline fallback so the bot always works.
(function () {
  if (window.__elwasetBot) return; window.__elwasetBot = true;

  // ---------- built-in seed knowledge base (shared with the dashboard via chatbot-seed.js) ----------
  const SEED = window.CHATBOT_SEED || { botName: 'مساعد الوسيط', welcome: 'أهلًا! 👋 اسألني عن خدماتنا.', faqs: [] };

  // categories shown as quick chips (order matters)
  const CHIP_ORDER = ['الخدمات', 'الوساطة', 'الدفع', 'الطلب', 'الاسترداد', 'التاجر', 'تواصل', 'عام'];

  // ---------- Arabic-friendly normalization + matcher ----------
  function norm(s) {
    return String(s || '')
      .replace(/[ً-ْٰ]/g, '')     // diacritics
      .replace(/[إأآا]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
      .replace(/[^؀-ۿ\w\s]/g, ' ')      // punctuation
      .replace(/\s+/g, ' ').trim().toLowerCase();
  }
  function scoreFaq(qn, faq) {
    let s = 0;
    const kws = String(faq.kw || '').split(',').map(k => norm(k)).filter(Boolean);
    kws.forEach(k => { if (k && qn.indexOf(k) > -1) s += 3; });
    const qWords = norm(faq.q).split(' ').filter(w => w.length > 2);
    const inWords = qn.split(' ').filter(w => w.length > 2);
    qWords.forEach(w => { if (inWords.indexOf(w) > -1) s += 1; });
    inWords.forEach(w => { if (norm(faq.a).indexOf(w) > -1) s += 0.4; });
    return s;
  }
  function findAnswer(text, faqs) {
    const qn = norm(text);
    if (!qn) return null;
    let best = null, bestScore = 0;
    faqs.forEach(f => { if (f.active === false) return; const sc = scoreFaq(qn, f); if (sc > bestScore) { bestScore = sc; best = f; } });
    return bestScore >= 2 ? best : null;
  }

  // ---------- knowledge base loader (Firestore config/chatbot, cache, seed) ----------
  let KB = null;
  try { const c = JSON.parse(localStorage.getItem('elwasetChatbot') || 'null'); if (c && c.faqs && c.faqs.length) KB = c; } catch (e) {}
  if (!KB) KB = SEED;

  async function loadKB() {
    const cfg = window.FIREBASE_CONFIG;
    if (!cfg || !cfg.apiKey) return;
    try {
      const { initializeApp, getApps, getApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
      const { getFirestore, doc, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
      const app = getApps().some(a => a.name === 'cfgApp') ? getApp('cfgApp') : initializeApp(cfg, 'botApp');
      onSnapshot(doc(getFirestore(app), 'config', 'chatbot'), snap => {
        if (snap.exists()) {
          const d = snap.data();
          if (d && Array.isArray(d.faqs) && d.faqs.length) {
            KB = { botName: d.botName || SEED.botName, welcome: d.welcome || SEED.welcome, faqs: d.faqs };
            localStorage.setItem('elwasetChatbot', JSON.stringify(KB));
            refreshStatic();
          }
        }
      });
    } catch (e) { /* keep seed/cache */ }
  }

  // ---------- UI ----------
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // format an answer: escape, keep line breaks, and turn [label](url) into a clickable link
  function fmt(s) {
    let out = esc(s).replace(/\n/g, '<br>');
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
      const ext = /^https?:\/\//.test(url);
      return '<a class="elbot-link" href="' + url + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + label + ' <i class="fas fa-arrow-left"></i></a>';
    });
    return out;
  }
  const nl = fmt; // welcome/answers all go through the same formatter
  let root, panel, msgs, chipsBox;

  // ---------- live catalog index (for direct service/category links) ----------
  let CATALOG = {};
  function ensureCatalog() {
    if (!Object.keys(CATALOG).length && window.CATEGORIES && Object.keys(window.CATEGORIES).length) CATALOG = window.CATEGORIES;
    if (window.getCatalog) { Promise.resolve(window.getCatalog()).then(c => { if (c && Object.keys(c).length) CATALOG = c; }).catch(() => {}); }
  }
  function searchCatalog(qn) {
    ensureCatalog();
    const CAT = Object.keys(CATALOG).length ? CATALOG : (window.CATEGORIES || {});
    const res = [];
    const qWords = qn.split(' ').filter(w => w.length > 1);
    Object.keys(CAT).forEach(id => {
      const c = CAT[id]; if (!c || c.active === false) return;
      const items = (c.groups && c.groups[0] && c.groups[0].items) || [];
      items.forEach(name => {
        const nn = norm(name); let score = 0;
        qWords.forEach(w => { if (nn.indexOf(w) > -1) score += 2; });
        nn.split(' ').filter(w => w.length > 1).forEach(w => { if (qn.indexOf(w) > -1) score += 1; });
        if (score >= 3) res.push({ type: 'service', name, catId: id, catTitle: c.title || '', score });
      });
      const ct = norm(c.title || ''); let cs = 0;
      ct.split(' ').filter(w => w.length > 1).forEach(w => { if (qn.indexOf(w) > -1) cs += 2; });
      if (cs >= 2) res.push({ type: 'cat', catId: id, catTitle: c.title || '', score: cs });
    });
    // de-dup categories, keep best, sort
    res.sort((a, b) => b.score - a.score);
    return res.slice(0, 5);
  }
  function svcHref(s) {
    return s.type === 'service'
      ? 'service.html?cat=' + encodeURIComponent(s.catId) + '&svc=' + encodeURIComponent(s.name)
      : 'category.html?id=' + encodeURIComponent(s.catId);
  }

  function build() {
    root = document.createElement('div');
    root.className = 'elbot';
    root.innerHTML =
      '<button class="elbot-fab" aria-label="المساعد"><i class="fas fa-robot elbot-i-open"></i><i class="fas fa-xmark elbot-i-close"></i></button>' +
      '<div class="elbot-panel" role="dialog" aria-label="المساعد">' +
        '<div class="elbot-head"><span class="elbot-av"><i class="fas fa-robot"></i></span>' +
          '<div class="elbot-h-tx"><strong class="elbot-name"></strong><small>اسألني عن خدماتنا</small></div>' +
          '<button class="elbot-x" aria-label="إغلاق"><i class="fas fa-xmark"></i></button></div>' +
        '<div class="elbot-msgs"></div>' +
        '<div class="elbot-chips"></div>' +
        '<form class="elbot-input"><input type="text" placeholder="اكتب سؤالك هنا…" aria-label="سؤالك"><button type="submit" aria-label="إرسال"><i class="fas fa-paper-plane"></i></button></form>' +
      '</div>';
    document.body.appendChild(root);
    panel = root.querySelector('.elbot-panel');
    msgs = root.querySelector('.elbot-msgs');
    chipsBox = root.querySelector('.elbot-chips');

    root.querySelector('.elbot-fab').addEventListener('click', toggle);
    root.querySelector('.elbot-x').addEventListener('click', () => setOpen(false));
    root.querySelector('.elbot-input').addEventListener('submit', e => {
      e.preventDefault();
      const inp = root.querySelector('.elbot-input input');
      const v = inp.value.trim(); if (!v) return;
      inp.value = ''; ask(v);
    });
    refreshStatic();
    greet();
  }

  function refreshStatic() {
    if (!root) return;
    root.querySelector('.elbot-name').textContent = KB.botName || 'المساعد';
    // category chips
    const cats = CHIP_ORDER.filter(c => KB.faqs.some(f => f.cat === c && f.active !== false));
    // include any extra categories not in the default order
    KB.faqs.forEach(f => { if (f.cat && f.active !== false && cats.indexOf(f.cat) === -1) cats.push(f.cat); });
    chipsBox.innerHTML = cats.map(c => '<button type="button" class="elbot-chip" data-cat="' + esc(c) + '">' + esc(c) + '</button>').join('');
    chipsBox.querySelectorAll('.elbot-chip').forEach(b => b.addEventListener('click', () => showCategory(b.dataset.cat)));
  }

  function addMsg(html, who) {
    const d = document.createElement('div');
    d.className = 'elbot-msg ' + (who === 'me' ? 'me' : 'bot');
    d.innerHTML = who === 'me' ? '<div class="elbot-b">' + html + '</div>'
      : '<span class="elbot-av sm"><i class="fas fa-robot"></i></span><div class="elbot-b">' + html + '</div>';
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
    return d;
  }
  let greeted = false;
  function greet() {
    if (greeted) return; greeted = true;
    addMsg(nl(KB.welcome || SEED.welcome), 'bot');
  }
  function showCategory(cat) {
    addMsg(esc(cat), 'me');
    const list = KB.faqs.filter(f => f.cat === cat && f.active !== false);
    if (!list.length) { addMsg('مفيش أسئلة في القسم ده حاليًا.', 'bot'); return; }
    const b = addMsg('اختر سؤالك من «' + esc(cat) + '»:', 'bot');
    const wrap = document.createElement('div'); wrap.className = 'elbot-sugg';
    list.slice(0, 8).forEach(f => {
      const s = document.createElement('button'); s.type = 'button'; s.className = 'elbot-sg'; s.textContent = f.q;
      s.addEventListener('click', () => { addMsg(esc(f.q), 'me'); setTimeout(() => addMsg(nl(f.a), 'bot'), 180); });
      wrap.appendChild(s);
    });
    b.querySelector('.elbot-b').appendChild(wrap);
    msgs.scrollTop = msgs.scrollHeight;
  }
  function ask(text) {
    addMsg(esc(text), 'me');
    const qn = norm(text);
    const svc = searchCatalog(qn);
    const hit = findAnswer(text, KB.faqs);
    setTimeout(() => {
      let handled = false;
      if (svc.length) {
        const b = addMsg('لقيتلك ده — اضغط عشان تروح للطلب مباشرة 👇', 'bot');
        const wrap = document.createElement('div'); wrap.className = 'elbot-sugg';
        svc.forEach(s => {
          const a = document.createElement('a'); a.className = 'elbot-link';
          a.href = svcHref(s);
          a.innerHTML = '<i class="fas fa-arrow-left"></i> ' + esc(s.type === 'service' ? s.name : ('قسم ' + s.catTitle));
          wrap.appendChild(a);
        });
        b.querySelector('.elbot-b').appendChild(wrap);
        handled = true;
      }
      if (hit) { addMsg(fmt(hit.a), 'bot'); handled = true; }
      if (!handled) {
        const wa = (window.ElwasetContact && window.ElwasetContact.cfg && window.ElwasetContact.cfg.wa) || '201055578777';
        addMsg('معلش، مش لاقي ده بالظبط 🤔 جرّب تكتب اسم الخدمة (زي «متابعين فيسبوك») أو اختر فئة من تحت، أو تواصل مع الدعم:<br>' +
          '<a class="elbot-wa" href="https://wa.me/' + wa + '" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> تواصل مع الدعم</a>', 'bot');
      }
    }, 220);
  }

  function setOpen(v) { root.classList.toggle('open', v); if (v) { greet(); setTimeout(() => { const i = root.querySelector('.elbot-input input'); i && i.focus(); }, 250); } }
  function toggle() { setOpen(!root.classList.contains('open')); }

  function init() { build(); loadKB(); ensureCatalog(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
