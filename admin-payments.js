// NewlyNow — admin payment methods + manual verification
(async function () {
  'use strict';
  const tabs = document.querySelector('#app .tabs');
  const appEl = document.getElementById('app');
  if (!tabs || !appEl || document.getElementById('tab-payments-core')) return;

  const tab = document.createElement('button');
  tab.className = 'tab';
  tab.dataset.tab = 'payments-core';
  tab.innerHTML = '<i class="fas fa-credit-card"></i> المدفوعات';
  tabs.appendChild(tab);

  const panel = document.createElement('section');
  panel.className = 'panel';
  panel.id = 'tab-payments-core';
  panel.innerHTML = `
    <div class="card">
      <h3><i class="fas fa-wallet"></i> وسائل الدفع</h3>
      <p class="muted" style="margin-bottom:12px">أضف الطرق الظاهرة في الـCheckout. مفاتيح API وSecrets لا تُحفظ هنا نهائيًا.</p>
      <div id="nnPayMethods"></div>
      <div style="display:flex;gap:.6rem;flex-wrap:wrap;margin-top:.8rem">
        <button class="btn btn-ghost btn-sm" id="nnPayAdd"><i class="fas fa-plus"></i> إضافة طريقة</button>
        <button class="btn btn-sm" id="nnPaySave"><i class="fas fa-floppy-disk"></i> حفظ وسائل الدفع</button>
      </div>
    </div>
    <div class="card">
      <h3><i class="fas fa-shield-halved"></i> مراجعة المدفوعات اليدوية</h3>
      <p class="muted" style="margin-bottom:12px">اعتماد الدفع يغيّر حالة الدفع فقط بعد مراجعتك. الدفع التلقائي يجب أن يتأكد من السيرفر/Webhook.</p>
      <div id="nnPayAttempts"><p class="muted">جاري التحميل...</p></div>
    </div>`;
  appEl.appendChild(panel);

  tab.addEventListener('click', () => {
    document.querySelectorAll('#app .tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('#app .panel').forEach(x => x.classList.remove('active'));
    tab.classList.add('active'); panel.classList.add('active');
    loadAttempts();
  });

  const style = document.createElement('style');
  style.textContent = `
    .nn-pay-row{border:1px solid var(--line);border-radius:14px;padding:12px;margin-bottom:10px;background:rgba(255,255,255,.025)}
    .nn-pay-grid{display:grid;grid-template-columns:1fr 1.4fr .85fr .6fr;gap:8px;align-items:end}.nn-pay-grid .field{margin:0}
    .nn-pay-row select,.nn-pay-row input,.nn-pay-row textarea{width:100%;background:#0d1016;border:1px solid var(--line);color:var(--text);border-radius:10px;padding:.58rem .7rem;font-family:inherit}
    .nn-pay-extra{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}.nn-pay-extra textarea{min-height:64px}
    .nn-pay-head{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px}.nn-pay-enabled{display:flex;align-items:center;gap:6px;font-size:.82rem}
    .nn-attempt{border:1px solid var(--line);border-radius:12px;padding:12px;margin-bottom:8px;background:rgba(255,255,255,.025)}.nn-attempt-top{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}.nn-attempt small{color:var(--muted)}
    @media(max-width:760px){.nn-pay-grid,.nn-pay-extra{grid-template-columns:1fr}.nn-pay-grid{gap:6px}}
  `;
  document.head.appendChild(style);

  const cfg = window.FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey) return;
  const [{ getApps, getApp, initializeApp }, authMod, fs] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js')
  ]);
  const fbApp = getApps().length ? getApp() : initializeApp(cfg);
  const auth = authMod.getAuth(fbApp);
  const db = fs.getFirestore(fbApp);
  const cfgRef = fs.doc(db, 'config', 'site');
  let methods = [];
  let currentPayments = {};

  const esc = s => String(s == null ? '' : s).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  const cleanId = v => String(v || '').trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0,80);
  const toast = m => {
    const t = document.getElementById('toast');
    if (t) { t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2200); }
  };

  function row(m, i) {
    return `<div class="nn-pay-row" data-i="${i}">
      <div class="nn-pay-head"><strong>${esc(m.name || 'طريقة دفع')}</strong><button type="button" class="btn btn-red btn-sm nn-pay-del"><i class="fas fa-trash"></i></button></div>
      <div class="nn-pay-grid">
        <div class="field"><label>ID</label><input class="nn-id" value="${esc(m.id || '')}" maxlength="80"></div>
        <div class="field"><label>الاسم الظاهر</label><input class="nn-name" value="${esc(m.name || '')}" maxlength="120"></div>
        <div class="field"><label>النوع</label><select class="nn-type"><option value="manual"${m.type !== 'automatic' ? ' selected' : ''}>يدوي</option><option value="automatic"${m.type === 'automatic' ? ' selected' : ''}>تلقائي</option></select></div>
        <label class="nn-pay-enabled"><input type="checkbox" class="nn-enabled"${m.enabled !== false ? ' checked' : ''}> مفعلة</label>
      </div>
      <div class="nn-pay-extra">
        <div class="field"><label>بيانات / رقم التحويل</label><input class="nn-account" value="${esc(m.account || '')}" maxlength="240" placeholder="يظهر فقط للطريقة اليدوية"></div>
        <div class="field"><label>Endpoint بدء الدفع</label><input class="nn-endpoint" value="${esc(m.endpoint || '')}" maxlength="2000" placeholder="https://... — للتلقائي فقط"></div>
        <div class="field" style="grid-column:1/-1"><label>تعليمات العميل</label><textarea class="nn-instructions" maxlength="2000">${esc(m.instructions || '')}</textarea></div>
      </div>
    </div>`;
  }

  function renderMethods() {
    const box = document.getElementById('nnPayMethods');
    box.innerHTML = methods.length ? methods.map(row).join('') : '<p class="muted">مفيش وسائل دفع مضافة لسه.</p>';
    box.querySelectorAll('.nn-pay-del').forEach(b => b.addEventListener('click', () => {
      const el = b.closest('.nn-pay-row'); methods.splice(+el.dataset.i, 1); renderMethods();
    }));
  }

  function collectMethods() {
    const out = [];
    document.querySelectorAll('.nn-pay-row').forEach((el, i) => {
      const type = el.querySelector('.nn-type').value === 'automatic' ? 'automatic' : 'manual';
      const endpoint = el.querySelector('.nn-endpoint').value.trim();
      if (type === 'automatic' && endpoint && !/^https:\/\//i.test(endpoint)) throw new Error('Endpoint الدفع التلقائي لازم يبدأ بـ https://');
      const name = el.querySelector('.nn-name').value.trim();
      if (!name) return;
      out.push({
        id: cleanId(el.querySelector('.nn-id').value) || ('method-' + (i + 1)),
        name: name.slice(0,120), type,
        enabled: el.querySelector('.nn-enabled').checked,
        account: el.querySelector('.nn-account').value.trim().slice(0,240),
        endpoint: endpoint.slice(0,2000),
        instructions: el.querySelector('.nn-instructions').value.trim().slice(0,2000)
      });
    });
    return out.slice(0,30);
  }

  document.getElementById('nnPayAdd').addEventListener('click', () => {
    methods = collectMethods();
    methods.push({ id: 'payment-' + Date.now().toString(36), name: 'طريقة دفع جديدة', type: 'manual', enabled: true, account: '', endpoint: '', instructions: '' });
    renderMethods();
  });

  document.getElementById('nnPaySave').addEventListener('click', async () => {
    try {
      methods = collectMethods();
      const payments = Object.assign({}, currentPayments, { methods });
      await fs.setDoc(cfgRef, { payments }, { merge: true });
      currentPayments = payments; toast('اتحفظت وسائل الدفع ✅'); renderMethods();
    } catch (e) { toast(e && e.message ? e.message : 'تعذّر حفظ وسائل الدفع'); }
  });

  async function loadConfig() {
    try {
      const snap = await fs.getDoc(cfgRef);
      const data = snap.exists() ? snap.data() : {};
      currentPayments = data.payments || {};
      methods = Array.isArray(currentPayments.methods) ? currentPayments.methods.slice(0,30) : [];
    } catch (_) { methods = []; currentPayments = {}; }
    renderMethods();
  }

  function attemptCard(a) {
    const manual = a.type === 'manual';
    const pending = a.status === 'pending_verification';
    return `<div class="nn-attempt" data-id="${esc(a._id)}" data-order="${esc(a.orderId || '')}">
      <div class="nn-attempt-top"><strong>${esc(a.orderNo || 'طلب')} — ${esc(a.methodName || a.methodId || '')}</strong><span class="pill ${a.status === 'paid' ? 'ok' : 'wait'}">${esc(a.status || '')}</span></div>
      <small>${manual ? 'يدوي' : 'تلقائي'}${a.reference ? ' · المرجع: ' + esc(a.reference) : ''}</small>
      ${manual && pending ? '<div class="acts" style="margin-top:8px"><button class="btn btn-sm nn-pay-approve"><i class="fas fa-check"></i> اعتماد الدفع</button><button class="btn btn-red btn-sm nn-pay-reject"><i class="fas fa-xmark"></i> رفض</button></div>' : ''}
    </div>`;
  }

  async function loadAttempts() {
    const box = document.getElementById('nnPayAttempts');
    try {
      let snap;
      try { snap = await fs.getDocs(fs.query(fs.collection(db, 'paymentAttempts'), fs.orderBy('createdAt', 'desc'), fs.limit(50))); }
      catch (_) { snap = await fs.getDocs(fs.collection(db, 'paymentAttempts')); }
      const list = []; snap.forEach(d => list.push(Object.assign({ _id:d.id }, d.data())));
      box.innerHTML = list.length ? list.map(attemptCard).join('') : '<p class="muted">مفيش محاولات دفع لسه.</p>';
      box.querySelectorAll('.nn-attempt').forEach(el => {
        const attemptId = el.dataset.id, orderId = el.dataset.order;
        const approve = el.querySelector('.nn-pay-approve'), reject = el.querySelector('.nn-pay-reject');
        if (approve) approve.addEventListener('click', async () => {
          if (!confirm('تأكيد إنك راجعت التحويل وعايز تعتمد الدفع؟')) return;
          try {
            const user = auth.currentUser;
            await fs.updateDoc(fs.doc(db,'paymentAttempts',attemptId), { status:'paid', verifiedAt:fs.serverTimestamp(), verifiedBy:user && user.email || '' });
            if (orderId) await fs.updateDoc(fs.doc(db,'orders',orderId), { paymentStatus:'paid', paymentAttemptId:attemptId, paymentUpdatedAt:fs.serverTimestamp() });
            toast('تم اعتماد الدفع ✅'); loadAttempts();
          } catch (e) { toast('تعذّر اعتماد الدفع'); }
        });
        if (reject) reject.addEventListener('click', async () => {
          if (!confirm('رفض إثبات الدفع؟')) return;
          try {
            const user = auth.currentUser;
            await fs.updateDoc(fs.doc(db,'paymentAttempts',attemptId), { status:'rejected', verifiedAt:fs.serverTimestamp(), verifiedBy:user && user.email || '' });
            if (orderId) await fs.updateDoc(fs.doc(db,'orders',orderId), { paymentStatus:'unpaid', paymentAttemptId:attemptId, paymentUpdatedAt:fs.serverTimestamp() });
            toast('تم رفض الدفع'); loadAttempts();
          } catch (e) { toast('تعذّر رفض الدفع'); }
        });
      });
    } catch (_) { box.innerHTML = '<p class="muted">تعذّر تحميل محاولات الدفع.</p>'; }
  }

  await loadConfig();
})();
