// NewlyNow — owner-only structured pricing manager for automatic payments
(async function () {
  'use strict';
  const tabs = document.querySelector('#app .tabs');
  const appEl = document.getElementById('app');
  if (!tabs || !appEl || document.getElementById('tab-pricing-core')) return;

  const OWNERS = ['elawaady.official@gmail.com', 'elawadi.store4@gmail.com'];
  const tab = document.createElement('button');
  tab.className = 'tab'; tab.dataset.tab = 'pricing-core'; tab.style.display = 'none';
  tab.innerHTML = '<i class="fas fa-tags"></i> التسعير';
  tabs.appendChild(tab);

  const panel = document.createElement('section');
  panel.className = 'panel'; panel.id = 'tab-pricing-core';
  panel.innerHTML = `
    <div class="card">
      <h3><i class="fas fa-tags"></i> Structured Pricing</h3>
      <p class="muted">الأسعار هنا هي المصدر الموثوق للسيرفر عند الدفع التلقائي. السعر الموجود كنص في صفحة الخدمة لا يُستخدم لتأكيد أي دفعة.</p>
      <div class="nn-price-tools">
        <input type="search" id="nnPriceSearch" placeholder="ابحث باسم الخدمة...">
        <select id="nnPriceCat"><option value="">كل الأقسام</option></select>
        <button class="btn btn-ghost btn-sm" id="nnPriceReload"><i class="fas fa-rotate"></i> تحديث</button>
      </div>
      <p class="hint" id="nnPriceCount"></p>
      <div id="nnPriceList"><p class="muted">جاري التحميل...</p></div>
    </div>`;
  appEl.appendChild(panel);

  const style = document.createElement('style');
  style.textContent = `
    .nn-price-tools{display:grid;grid-template-columns:1fr minmax(180px,.45fr) auto;gap:8px;margin:14px 0}.nn-price-tools input,.nn-price-tools select,.nn-price-row input,.nn-price-row select{width:100%;background:#0d1016;border:1px solid var(--line);color:var(--text);border-radius:10px;padding:.58rem .7rem;font-family:inherit}
    .nn-price-row{border:1px solid var(--line);border-radius:14px;padding:12px;margin-bottom:10px;background:rgba(255,255,255,.025)}.nn-price-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:9px}.nn-price-head small{display:block;color:var(--muted)}
    .nn-price-grid{display:grid;grid-template-columns:1.1fr .7fr .8fr .65fr .65fr .65fr;gap:7px;align-items:end}.nn-price-flags{display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-top:9px}.nn-price-flags label{display:flex;gap:6px;align-items:center;font-size:.82rem}.nn-price-save{margin-inline-start:auto}
    @media(max-width:900px){.nn-price-grid{grid-template-columns:repeat(3,1fr)}}@media(max-width:620px){.nn-price-tools,.nn-price-grid{grid-template-columns:1fr}.nn-price-save{margin-inline-start:0;width:100%;justify-content:center}}
  `;
  document.head.appendChild(style);

  const cfg = window.FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey) return;
  const [appMod, authMod, fs] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js')
  ]);
  const fbApp = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(cfg);
  const auth = authMod.getAuth(fbApp);
  const db = fs.getFirestore(fbApp);
  const listEl = document.getElementById('nnPriceList');
  const searchEl = document.getElementById('nnPriceSearch');
  const catEl = document.getElementById('nnPriceCat');
  let services = [];
  let pricing = new Map();
  let renderToken = 0;

  const esc = s => String(s == null ? '' : s).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  const owner = () => !!auth.currentUser && OWNERS.includes(String(auth.currentUser.email || '').toLowerCase());
  const toast = m => { const t = document.getElementById('toast'); if (t) { t.textContent=m; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2200); } };
  const norm = v => String(v || '').trim().replace(/\s+/g,' ').toLowerCase();
  async function keyFor(category, name) {
    const bytes = new TextEncoder().encode(`${norm(category)}\n${norm(name)}`);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2,'0')).join('');
  }

  function flattenCatalog(categories) {
    const out = [], seen = new Set();
    Object.entries(categories || {}).sort((a,b) => (a[1].order||0)-(b[1].order||0)).forEach(([categoryId,c]) => {
      const category = c.title || categoryId;
      (c.groups || []).forEach(g => (g.items || []).forEach(name => {
        const sig = norm(category) + '\n' + norm(name);
        if (!name || seen.has(sig)) return;
        seen.add(sig); out.push({ categoryId, category, name });
      }));
    });
    return out;
  }

  async function loadAll() {
    listEl.innerHTML = '<p class="muted">جاري التحميل...</p>';
    try {
      const [catalogSnap, pricingSnap] = await Promise.all([
        fs.getDoc(fs.doc(db,'config','catalog')),
        fs.getDocs(fs.collection(db,'pricing'))
      ]);
      const cats = catalogSnap.exists() ? (catalogSnap.data().categories || {}) : {};
      services = flattenCatalog(cats);
      pricing = new Map(); pricingSnap.forEach(d => pricing.set(d.id, d.data()));
      const categoryNames = [...new Set(services.map(s => s.category))].sort((a,b)=>a.localeCompare(b,'ar'));
      catEl.innerHTML = '<option value="">كل الأقسام</option>' + categoryNames.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('');
      await render();
    } catch (e) {
      console.warn(e); listEl.innerHTML = '<p class="muted">تعذّر تحميل التسعير.</p>';
    }
  }

  function amountText(p) {
    const n = Number(p && p.priceMinor);
    return Number.isFinite(n) && n > 0 ? (n / 100).toFixed(2) : '';
  }

  async function rowHtml(s) {
    const key = await keyFor(s.category, s.name);
    const p = pricing.get(key) || {};
    return `<div class="nn-price-row" data-key="${key}" data-category="${esc(s.category)}" data-name="${esc(s.name)}">
      <div class="nn-price-head"><div><strong>${esc(s.name)}</strong><small>${esc(s.category)}</small></div><span class="pill ${p.automaticPaymentEligible ? 'ok':'wait'}">${p.automaticPaymentEligible ? 'Auto Pay':'Manual'}</span></div>
      <div class="nn-price-grid">
        <div class="field"><label>السعر</label><input class="np-price" type="number" min="0.01" step="0.01" value="${esc(amountText(p))}" placeholder="250.00"></div>
        <div class="field"><label>العملة</label><input class="np-currency" maxlength="3" value="${esc(p.currency || 'EGP')}"></div>
        <div class="field"><label>النظام</label><select class="np-mode"><option value="fixed"${p.mode !== 'per_unit'?' selected':''}>ثابت × الكمية</option><option value="per_unit"${p.mode === 'per_unit'?' selected':''}>لكل وحدة</option></select></div>
        <div class="field"><label>حجم الوحدة</label><input class="np-unit" type="number" min="1" step="1" value="${esc(p.unitSize || 1)}"></div>
        <div class="field"><label>أقل كمية</label><input class="np-min" type="number" min="1" step="1" value="${esc(p.minQty || 1)}"></div>
        <div class="field"><label>أقصى كمية</label><input class="np-max" type="number" min="1" step="1" value="${esc(p.maxQty || 100000)}"></div>
      </div>
      <div class="nn-price-flags">
        <label><input class="np-active" type="checkbox"${p.active !== false ? ' checked':''}> السعر فعال</label>
        <label><input class="np-auto" type="checkbox"${p.automaticPaymentEligible ? ' checked':''}> مسموح بالدفع التلقائي</label>
        <button class="btn btn-sm nn-price-save"><i class="fas fa-floppy-disk"></i> حفظ</button>
      </div>
    </div>`;
  }

  async function render() {
    const token = ++renderToken;
    const q = norm(searchEl.value), cat = catEl.value;
    const matches = services.filter(s => (!cat || s.category === cat) && (!q || norm(s.name).includes(q) || norm(s.category).includes(q)));
    document.getElementById('nnPriceCount').textContent = `النتائج: ${matches.length} — يتم عرض أول 80 خدمة لسرعة الداشبورد.`;
    const visible = matches.slice(0,80);
    const rows = await Promise.all(visible.map(rowHtml));
    if (token !== renderToken) return;
    listEl.innerHTML = rows.length ? rows.join('') : '<p class="muted">مفيش خدمات مطابقة.</p>';
    listEl.querySelectorAll('.nn-price-save').forEach(btn => btn.addEventListener('click', () => saveRow(btn.closest('.nn-price-row'))));
  }

  async function saveRow(el) {
    if (!owner()) return toast('التسعير للمالك فقط');
    const major = Number(el.querySelector('.np-price').value);
    const currency = el.querySelector('.np-currency').value.trim().toUpperCase();
    const mode = el.querySelector('.np-mode').value === 'per_unit' ? 'per_unit' : 'fixed';
    const unitSize = Number.parseInt(el.querySelector('.np-unit').value,10);
    const minQty = Number.parseInt(el.querySelector('.np-min').value,10);
    const maxQty = Number.parseInt(el.querySelector('.np-max').value,10);
    if (!Number.isFinite(major) || major <= 0 || !/^[A-Z]{3}$/.test(currency)
        || !Number.isSafeInteger(unitSize) || unitSize < 1 || !Number.isSafeInteger(minQty) || minQty < 1
        || !Number.isSafeInteger(maxQty) || maxQty < minQty) return toast('راجع السعر والعملة وحدود الكمية');
    const priceMinor = Math.round(major * 100);
    if (!Number.isSafeInteger(priceMinor) || priceMinor < 1) return toast('السعر غير صالح');

    const data = {
      serviceKey: el.dataset.key,
      category: el.dataset.category,
      serviceName: el.dataset.name,
      priceMinor, currency, mode, unitSize, minQty, maxQty,
      active: el.querySelector('.np-active').checked,
      automaticPaymentEligible: el.querySelector('.np-auto').checked,
      updatedAt: fs.serverTimestamp(), updatedBy: auth.currentUser.email || ''
    };
    try {
      const batch = fs.writeBatch(db);
      batch.set(fs.doc(db,'pricing',el.dataset.key), data, { merge:false });
      batch.set(fs.doc(fs.collection(db,'auditLogs')), {
        action:'pricing.updated', actor:auth.currentUser.email || '', targetType:'pricing', targetId:el.dataset.key,
        details:{ category:data.category, serviceName:data.serviceName, currency, priceMinor, automaticPaymentEligible:data.automaticPaymentEligible },
        createdAt:fs.serverTimestamp()
      });
      await batch.commit(); pricing.set(el.dataset.key, data); toast('اتحفظ السعر ✅'); await render();
    } catch (e) { console.warn(e); toast('تعذّر حفظ السعر'); }
  }

  searchEl.addEventListener('input', () => { clearTimeout(searchEl._t); searchEl._t=setTimeout(render,180); });
  catEl.addEventListener('change', render);
  document.getElementById('nnPriceReload').addEventListener('click', loadAll);
  tab.addEventListener('click', () => {
    document.querySelectorAll('#app .tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('#app .panel').forEach(x => x.classList.remove('active'));
    tab.classList.add('active'); panel.classList.add('active'); loadAll();
  });
  authMod.onAuthStateChanged(auth, user => { tab.style.display = user && OWNERS.includes(String(user.email||'').toLowerCase()) ? '' : 'none'; });
})();
