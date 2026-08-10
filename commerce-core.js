// NewlyNow — order + payment foundation
(function () {
  'use strict';

  const MAX_ITEMS = 50;
  const MAX_QTY = 100000;
  let dbPromise = null;

  const clean = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
  const qty = v => Math.max(1, Math.min(MAX_QTY, Number.parseInt(v, 10) || 1));

  function orderNumber() {
    const d = new Date();
    const stamp = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('');
    const bytes = new Uint8Array(4);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    const token = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    return 'NN-' + stamp + '-' + token;
  }

  function normalizeItems(items) {
    if (!Array.isArray(items) || !items.length) throw new Error('EMPTY_CART');
    return items.slice(0, MAX_ITEMS).map(it => ({
      name: clean(it && it.name, 180),
      category: clean(it && it.category, 140),
      qty: qty(it && it.qty),
      link: clean(it && it.link, 2000),
      notes: clean(it && it.notes, 1500),
      coupon: clean(it && it.coupon, 120),
      code: clean(it && it.code, 120)
    })).filter(it => it.name);
  }

  async function firestore() {
    if (dbPromise) return dbPromise;
    dbPromise = (async () => {
      const cfg = window.FIREBASE_CONFIG;
      if (!cfg || !cfg.apiKey) return null;
      const [{ initializeApp }, fs] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js')
      ]);
      const app = initializeApp(cfg, 'newlynowCommerceApp');
      return { db: fs.getFirestore(app), fs };
    })().catch(err => {
      console.warn('NewlyNow commerce database unavailable', err);
      return null;
    });
    return dbPromise;
  }

  async function createOrder(input) {
    const items = normalizeItems(input && input.items);
    if (!items.length) throw new Error('EMPTY_CART');
    const orderNo = orderNumber();
    const name = clean(input && input.name, 120);
    const phone = clean(input && input.phone, 40);
    const notes = clean(input && input.notes, 3000);
    if (!name || phone.length < 4) throw new Error('INVALID_CUSTOMER');

    const payloadBase = {
      orderNo,
      name,
      phone,
      notes,
      items,
      count: items.reduce((sum, it) => sum + it.qty, 0),
      status: 'new',
      paymentStatus: 'unpaid',
      paymentMethod: '',
      paymentAttemptId: '',
      source: 'store'
    };

    const conn = await firestore();
    if (!conn) return { id: '', orderNo, persisted: false, payload: payloadBase };
    const { db, fs } = conn;
    const payload = Object.assign({}, payloadBase, { createdAt: fs.serverTimestamp() });
    let ref = null;
    try {
      ref = await fs.addDoc(fs.collection(db, 'orders'), payload);
    } catch (err) {
      console.warn('Order persistence failed', err);
      return { id: '', orderNo, persisted: false, payload: payloadBase };
    }

    // Customer lead capture is secondary and must never block the order.
    try {
      await fs.addDoc(fs.collection(db, 'customers'), {
        name, phone, source: 'order', createdAt: fs.serverTimestamp()
      });
    } catch (_) {}

    return { id: ref.id, orderNo, persisted: true, payload: payloadBase };
  }

  function paymentMethods() {
    const site = window.SITE_CONFIG || {};
    const payments = site.payments || {};
    const list = Array.isArray(payments.methods) ? payments.methods : [];
    return list.map((m, i) => ({
      id: clean(m && (m.id || ('method-' + i)), 80),
      name: clean(m && m.name, 120),
      type: m && m.type === 'automatic' ? 'automatic' : 'manual',
      enabled: !(m && m.enabled === false),
      instructions: clean(m && m.instructions, 2000),
      account: clean(m && m.account, 240),
      endpoint: clean(m && m.endpoint, 2000)
    })).filter(m => m.enabled && m.id && m.name);
  }

  async function createPaymentAttempt(order, method, extra) {
    if (!order || !order.persisted || !order.id) return { id: '', persisted: false };
    if (!method || !method.id) throw new Error('INVALID_PAYMENT_METHOD');
    const type = method.type === 'automatic' ? 'automatic' : 'manual';
    const status = type === 'automatic' ? 'initiated' : 'pending_verification';
    const conn = await firestore();
    if (!conn) return { id: '', persisted: false };
    const { db, fs } = conn;
    const doc = {
      orderId: clean(order.id, 128),
      orderNo: clean(order.orderNo, 48),
      methodId: clean(method.id, 80),
      methodName: clean(method.name, 120),
      type,
      status,
      reference: clean(extra && extra.reference, 160),
      createdAt: fs.serverTimestamp()
    };
    const ref = await fs.addDoc(fs.collection(db, 'paymentAttempts'), doc);
    return { id: ref.id, persisted: true, status };
  }

  function safeHttpsUrl(value) {
    try {
      const u = new URL(String(value || ''), location.origin);
      return u.protocol === 'https:' ? u.href : '';
    } catch (_) { return ''; }
  }

  async function startAutomaticPayment(order, method, attempt) {
    const endpoint = safeHttpsUrl(method && method.endpoint);
    if (!endpoint) throw new Error('PAYMENT_ENDPOINT_NOT_CONFIGURED');
    if (!order || !order.persisted || !attempt || !attempt.persisted) throw new Error('ORDER_NOT_PERSISTED');

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      cache: 'no-store',
      body: JSON.stringify({ orderId: order.id, orderNo: order.orderNo, paymentAttemptId: attempt.id, methodId: method.id })
    });
    if (!response.ok) throw new Error('PAYMENT_INIT_FAILED');
    const data = await response.json();
    const checkoutUrl = safeHttpsUrl(data && data.checkoutUrl);
    if (!checkoutUrl) throw new Error('INVALID_CHECKOUT_URL');
    return checkoutUrl;
  }

  function buildOrderText(input) {
    const items = normalizeItems(input && input.items);
    const method = input && input.method;
    let t = 'مرحبًا فريق NewlyNow 👋\nأريد متابعة الطلب التالي:\n\n';
    t += 'رقم الطلب: ' + clean(input && input.orderNo, 48) + '\n';
    t += 'الاسم: ' + clean(input && input.name, 120) + '\n';
    t += 'الواتساب: ' + clean(input && input.phone, 40) + '\n';
    if (method && method.name) t += 'طريقة الدفع: ' + clean(method.name, 120) + '\n';
    t += '\nالخدمات:\n';
    items.forEach((it, i) => {
      t += (i + 1) + ') ' + it.name + ' ×' + it.qty + (it.category ? ' — ' + it.category : '') + '\n';
      if (it.link) t += '   🔗 ' + it.link + '\n';
      if (it.coupon) t += '   🎟️ ' + it.coupon + '\n';
      if (it.notes) t += '   📝 ' + it.notes + '\n';
    });
    const notes = clean(input && input.notes, 3000);
    if (notes) t += '\nملاحظات الطلب: ' + notes + '\n';
    return t;
  }

  window.NewlyNowCommerce = {
    createOrder,
    getPaymentMethods: paymentMethods,
    createPaymentAttempt,
    startAutomaticPayment,
    buildOrderText
  };
})();
