// NewlyNow — professional order management (order status != payment status)
(async function () {
  'use strict';
  const panel = document.getElementById('tab-orders');
  const listEl = document.getElementById('orderList');
  const countEl = document.getElementById('orderCount');
  const tab = document.querySelector('#app .tab[data-tab="orders"]');
  if (!panel || !listEl || !tab || panel.dataset.nnOrders === '1') return;
  panel.dataset.nnOrders = '1';

  const OWNERS = ['elawaady.official@gmail.com', 'elawadi.store4@gmail.com'];
  const cfg = window.FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey) return;
  const [appMod, authMod, fs] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js')
  ]);
  const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(cfg);
  const auth = authMod.getAuth(app);
  const db = fs.getFirestore(app);

  const toolbar = document.createElement('div');
  toolbar.className = 'nn-order-toolbar';
  toolbar.innerHTML = `
    <input type="search" id="nnOrderSearch" placeholder="رقم الطلب / الاسم / الهاتف">
    <select id="nnOrderStatusFilter">
      <option value="">كل حالات الطلب</option>
      <option value="new">جديد</option><option value="pending">بانتظار المراجعة</option>
      <option value="processing">قيد التنفيذ</option><option value="done">مكتمل</option>
      <option value="cancelled">ملغي</option><option value="disputed">نزاع</option>
    </select>
    <select id="nnPaymentStatusFilter">
      <option value="">كل حالات الدفع</option>
      <option value="unpaid">غير مدفوع</option><option value="pending_verification">بانتظار التحقق</option>
      <option value="paid">مدفوع</option><option value="failed">فشل</option>
      <option value="rejected">مرفوض</option><option value="refunded">مسترد</option>
      <option value="partially_refunded">استرداد جزئي</option>
    </select>
    <button class="btn btn-ghost btn-sm" id="nnOrdersRefresh"><i class="fas fa-rotate"></i> تحديث</button>`;
  listEl.parentElement.insertBefore(toolbar, listEl);

  const style = document.createElement('style');
  style.textContent = `
    .nn-order-toolbar{display:grid;grid-template-columns:1.4fr .85fr .85fr auto;gap:8px;margin:0 0 14px}.nn-order-toolbar input,.nn-order-toolbar select,.nn-order-card select,.nn-order-card textarea{width:100%;background:#0d1016;border:1px solid var(--line);color:var(--text);border-radius:10px;padding:.58rem .7rem;font-family:inherit}
    .nn-order-card{border:1px solid var(--line);border-radius:16px;padding:14px;margin-bottom:10px;background:rgba(255,255,255,.025)}.nn-order-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}.nn-order-id{font-weight:900;font-size:1rem}.nn-order-customer{color:var(--muted);font-size:.82rem;margin-top:2px}.nn-order-pills{display:flex;gap:6px;flex-wrap:wrap}.nn-order-pill{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:999px;font-size:.72rem;font-weight:800;border:1px solid var(--line)}.nn-order-pill.order{color:#bdefff;background:rgba(0,194,255,.08)}.nn-order-pill.payment{color:#ffd7e8;background:rgba(255,42,133,.08)}.nn-order-pill.paid{color:#8ef0b4;background:rgba(52,211,153,.1)}
    .nn-order-items{margin:12px 0;padding:10px 12px;border-radius:12px;background:#0d1016;border:1px solid rgba(255,255,255,.05)}.nn-order-item{display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04)}.nn-order-item:last-child{border:0}.nn-order-item small{color:var(--muted)}.nn-order-meta{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:10px 0}.nn-order-meta>div{background:#0d1016;border:1px solid rgba(255,255,255,.05);border-radius:10px;padding:8px}.nn-order-meta small{display:block;color:var(--muted);font-size:.7rem}.nn-order-controls{display:grid;grid-template-columns:minmax(190px,.5fr) 1fr auto;gap:8px;align-items:end;margin-top:10px}.nn-order-controls .field{margin:0}.nn-order-delete{margin-inline-start:6px}
    @media(max-width:760px){.nn-order-toolbar,.nn-order-controls,.nn-order-meta{grid-template-columns:1fr}.nn-order-pills{width:100%}}
  `;
  document.head.appendChild(style);

  const esc = s => String(s == null ? '' : s).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  const toast = m => { const t=document.getElementById('toast'); if(t){t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200);} };
  const email = () => String(auth.currentUser && auth.currentUser.email || '').toLowerCase();
  const isOwner = () => !!auth.currentUser && auth.currentUser.emailVerified === true && OWNERS.includes(email());
  const orderLabels = { new:'جديد',pending:'بانتظار المراجعة',processing:'قيد التنفيذ',done:'مكتمل',cancelled:'ملغي',disputed:'نزاع' };
  const payLabels = { unpaid:'غير مدفوع',pending_verification:'بانتظار التحقق',paid:'مدفوع',failed:'فشل',rejected:'مرفوض',refunded:'مسترد',partially_refunded:'استرداد جزئي' };
  let orders = [];

  function dateText(v) {
    try { const d=v&&v.toDate?v.toDate():null; return d ? new Intl.DateTimeFormat('ar-EG',{dateStyle:'medium',timeStyle:'short'}).format(d) : '—'; } catch(_){ return '—'; }
  }

  function itemRows(items) {
    return (items || []).slice(0,50).map(it => `<div class="nn-order-item"><span>${esc(it.name || 'خدمة')} <small>${esc(it.category || '')}</small></span><strong>×${Number(it.qty)||1}</strong></div>`).join('');
  }

  function card(o) {
    const status = orderLabels[o.status] ? o.status : 'new';
    const payment = payLabels[o.paymentStatus] ? o.paymentStatus : 'unpaid';
    const deleteBtn = isOwner() ? '<button class="btn btn-red btn-sm nn-order-delete" type="button"><i class="fas fa-trash"></i></button>' : '';
    return `<div class="nn-order-card" data-id="${esc(o._id)}">
      <div class="nn-order-top">
        <div><div class="nn-order-id">${esc(o.orderNo || o._id)}</div><div class="nn-order-customer">${esc(o.name || '—')} · ${esc(o.phone || '—')}</div></div>
        <div class="nn-order-pills"><span class="nn-order-pill order"><i class="fas fa-box"></i>${esc(orderLabels[status])}</span><span class="nn-order-pill payment ${payment==='paid'?'paid':''}"><i class="fas fa-credit-card"></i>${esc(payLabels[payment])}</span></div>
      </div>
      <div class="nn-order-items">${itemRows(o.items)}</div>
      <div class="nn-order-meta">
        <div><small>طريقة الدفع</small><strong>${esc(o.paymentMethod || '—')}</strong></div>
        <div><small>محاولة الدفع</small><strong>${esc(o.paymentAttemptId || '—')}</strong></div>
        <div><small>تاريخ الطلب</small><strong>${esc(dateText(o.createdAt))}</strong></div>
      </div>
      <div class="nn-order-controls">
        <div class="field"><label>حالة الطلب</label><select class="nn-order-status">${Object.entries(orderLabels).map(([k,v])=>`<option value="${k}"${k===status?' selected':''}>${v}</option>`).join('')}</select></div>
        <div class="field"><label>ملاحظات إدارية</label><textarea class="nn-order-notes" rows="1" maxlength="3000" placeholder="ملاحظات داخلية لا تظهر للعميل">${esc(o.adminNotes || '')}</textarea></div>
        <div><button class="btn btn-sm nn-order-save" type="button"><i class="fas fa-floppy-disk"></i> حفظ الحالة</button>${deleteBtn}</div>
      </div>
      <p class="hint" style="margin-top:8px">حالة الدفع لا تتغير من هنا؛ تُدار من تبويب المدفوعات أو Webhook الموثق.</p>
    </div>`;
  }

  function render() {
    const q = String(document.getElementById('nnOrderSearch').value || '').trim().toLowerCase();
    const sf = document.getElementById('nnOrderStatusFilter').value;
    const pf = document.getElementById('nnPaymentStatusFilter').value;
    const rows = orders.filter(o => {
      const hay = `${o.orderNo||''} ${o.name||''} ${o.phone||''}`.toLowerCase();
      return (!q || hay.includes(q)) && (!sf || o.status===sf) && (!pf || (o.paymentStatus||'unpaid')===pf);
    });
    countEl.textContent = String(rows.length);
    listEl.innerHTML = rows.length ? rows.map(card).join('') : '<p class="muted">مفيش طلبات مطابقة.</p>';
    listEl.querySelectorAll('.nn-order-card').forEach(el => {
      const save = el.querySelector('.nn-order-save');
      save && save.addEventListener('click', () => saveOrder(el));
      const del = el.querySelector('.nn-order-delete');
      del && del.addEventListener('click', () => deleteOrder(el));
    });
  }

  async function saveOrder(el) {
    const id = el.dataset.id;
    const current = orders.find(x => x._id === id);
    if (!current) return;
    const status = el.querySelector('.nn-order-status').value;
    const adminNotes = el.querySelector('.nn-order-notes').value.trim().slice(0,3000);
    if (!orderLabels[status]) return toast('حالة الطلب غير صالحة');
    if (status === current.status && adminNotes === (current.adminNotes || '')) return toast('مفيش تغيير');
    try {
      const batch = fs.writeBatch(db);
      batch.update(fs.doc(db,'orders',id), { status, adminNotes, updatedAt:fs.serverTimestamp() });
      batch.set(fs.doc(fs.collection(db,'auditLogs')), {
        action:'order.status.updated', actor:email(), targetType:'order', targetId:id,
        details:{ orderNo:current.orderNo||'', from:current.status||'new', to:status }, createdAt:fs.serverTimestamp()
      });
      await batch.commit();
      toast('اتحفظت حالة الطلب ✅'); await load();
    } catch(e){ console.warn(e); toast('تعذّر حفظ حالة الطلب'); }
  }

  async function deleteOrder(el) {
    if (!isOwner()) return toast('حذف الطلبات للمالك فقط');
    const id=el.dataset.id, current=orders.find(x=>x._id===id);
    if (!confirm('حذف الطلب نهائيًا؟ يفضّل الإلغاء بدل الحذف لو له سجل مالي.')) return;
    if (current && current.paymentStatus && current.paymentStatus !== 'unpaid') return toast('لا تحذف طلب له حركة دفع؛ استخدم الإلغاء');
    try { await fs.deleteDoc(fs.doc(db,'orders',id)); toast('اتحذف الطلب'); await load(); }
    catch(e){ console.warn(e); toast('تعذّر حذف الطلب'); }
  }

  async function load() {
    listEl.innerHTML='<p class="muted">جاري تحميل الطلبات...</p>';
    try {
      let snap;
      try { snap=await fs.getDocs(fs.query(fs.collection(db,'orders'),fs.orderBy('createdAt','desc'),fs.limit(150))); }
      catch(_){ snap=await fs.getDocs(fs.collection(db,'orders')); }
      orders=[]; snap.forEach(d=>orders.push(Object.assign({_id:d.id},d.data()))); render();
    } catch(e){ console.warn(e); listEl.innerHTML='<p class="muted">تعذّر تحميل الطلبات.</p>'; }
  }

  ['nnOrderSearch','nnOrderStatusFilter','nnPaymentStatusFilter'].forEach(id => document.getElementById(id).addEventListener(id==='nnOrderSearch'?'input':'change',render));
  document.getElementById('nnOrdersRefresh').addEventListener('click',load);
  tab.addEventListener('click',load);
  authMod.onAuthStateChanged(auth,user=>{ if(user&&user.emailVerified) setTimeout(load,150); });
})();
