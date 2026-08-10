'use strict';

const crypto = require('node:crypto');
const { onRequest } = require('firebase-functions/v2/https');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAppCheck } = require('firebase-admin/app-check');
const { getPaymentAdapter } = require('./payment-adapters');
const { calculateOrderPrice } = require('./pricing');

if (!getApps().length) initializeApp();
const db = getFirestore();

const CORS = ['https://newlynow.com', 'https://www.newlynow.com'];
const id = (v, max = 160) => String(v == null ? '' : v).trim().slice(0, max);
const httpsUrl = value => {
  try {
    const u = new URL(String(value || ''));
    return u.protocol === 'https:' ? u.href : '';
  } catch (_) { return ''; }
};

function send(res, status, body) {
  res.status(status).set('Cache-Control', 'no-store').json(body);
}

function appError(code, status = 400) {
  return Object.assign(new Error(code), { status });
}

async function requireAppCheck(req) {
  const token = req.get('X-Firebase-AppCheck');
  if (!token) throw appError('APP_CHECK_REQUIRED', 401);
  try {
    return await getAppCheck().verifyToken(token);
  } catch (_) {
    throw appError('INVALID_APP_CHECK', 401);
  }
}

function newOrderNo() {
  const d = new Date();
  const stamp = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  return `NN-${stamp}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
}

function normalizeOrderItems(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) throw appError('INVALID_ORDER_ITEMS');
  let count = 0;
  const items = value.map(raw => {
    const name = id(raw && raw.name, 180);
    const category = id(raw && raw.category, 140);
    const qty = Number.parseInt(raw && raw.qty, 10) || 1;
    if (!name || !Number.isSafeInteger(qty) || qty < 1 || qty > 100000) throw appError('INVALID_ORDER_ITEM');
    count += qty;
    if (!Number.isSafeInteger(count) || count > 5000000) throw appError('ORDER_QUANTITY_LIMIT');
    return {
      name,
      category,
      qty,
      link: id(raw && raw.link, 2000),
      notes: id(raw && raw.notes, 1500),
      coupon: id(raw && raw.coupon, 120),
      code: id(raw && raw.code, 120)
    };
  });
  return { items, count };
}

async function loadPaymentMethod(methodId, requiredType) {
  const snap = await db.doc('config/site').get();
  const methods = snap.exists && snap.get('payments.methods');
  const method = Array.isArray(methods)
    ? methods.find(m => m && m.id === methodId && m.enabled !== false)
    : null;
  if (!method) throw appError('PAYMENT_METHOD_DISABLED', 400);
  const type = method.type === 'automatic' ? 'automatic' : 'manual';
  if (requiredType && type !== requiredType) throw appError('PAYMENT_METHOD_TYPE_MISMATCH', 400);
  return Object.assign({}, method, { type });
}

async function loadAutomaticMethod(methodId) {
  return loadPaymentMethod(methodId, 'automatic');
}

async function authoritativeAmount(order) {
  const lockedAmount = Number(order && order.amountMinor);
  const lockedCurrency = id(order && order.currency, 12).toUpperCase();
  if (order && order.pricingLocked === true
      && Number.isSafeInteger(lockedAmount) && lockedAmount > 0
      && /^[A-Z]{3}$/.test(lockedCurrency)) {
    return {
      amountMinor: lockedAmount,
      currency: lockedCurrency,
      pricingHash: id(order.pricingHash, 128),
      lines: Array.isArray(order.pricingLines) ? order.pricingLines : [],
      reused: true
    };
  }
  return calculateOrderPrice(db, order);
}

exports.createOrder = onRequest({ cors: CORS, timeoutSeconds: 20 }, async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  try {
    const app = await requireAppCheck(req);
    const name = id(req.body && req.body.name, 120);
    const phone = id(req.body && req.body.phone, 40);
    const notes = id(req.body && req.body.notes, 3000);
    if (!name || phone.length < 4) throw appError('INVALID_CUSTOMER');
    const normalized = normalizeOrderItems(req.body && req.body.items);
    const orderNo = newOrderNo();
    const ref = db.collection('orders').doc();
    const payload = {
      orderNo,
      name,
      phone,
      notes,
      items: normalized.items,
      count: normalized.count,
      status: 'new',
      paymentStatus: 'unpaid',
      paymentMethod: '',
      paymentAttemptId: '',
      source: 'store',
      creationChannel: 'secure-api',
      appCheckAppId: id(app && app.appId, 240),
      createdAt: FieldValue.serverTimestamp()
    };

    const batch = db.batch();
    batch.set(ref, payload);
    batch.set(db.collection('customers').doc(), {
      name, phone, source: 'order', createdAt: FieldValue.serverTimestamp()
    });
    batch.set(db.collection('auditLogs').doc(), {
      action: 'order.created', actor: 'server', targetType: 'order', targetId: ref.id,
      details: { orderNo, itemCount: normalized.items.length }, createdAt: FieldValue.serverTimestamp()
    });
    await batch.commit();
    return send(res, 201, { id: ref.id, orderNo, persisted: true });
  } catch (err) {
    console.error('createOrder', err);
    return send(res, err.status || 500, { error: err.message || 'ORDER_CREATE_FAILED' });
  }
});

exports.createPaymentAttempt = onRequest({ cors: CORS, timeoutSeconds: 20 }, async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  try {
    await requireAppCheck(req);
    const orderId = id(req.body && req.body.orderId, 128);
    const orderNo = id(req.body && req.body.orderNo, 48);
    const methodId = id(req.body && req.body.methodId, 80);
    const reference = id(req.body && req.body.reference, 160);
    if (!orderId || !orderNo || !methodId) throw appError('INVALID_REQUEST');
    const method = await loadPaymentMethod(methodId);
    const orderRef = db.doc(`orders/${orderId}`);

    const result = await db.runTransaction(async tx => {
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists) throw appError('ORDER_NOT_FOUND', 404);
      const order = orderSnap.data();
      if (order.orderNo !== orderNo) throw appError('ORDER_NUMBER_MISMATCH', 409);
      if (order.paymentStatus === 'paid') throw appError('ORDER_ALREADY_PAID', 409);

      if (order.paymentAttemptId) {
        const existingRef = db.doc(`paymentAttempts/${id(order.paymentAttemptId, 128)}`);
        const existingSnap = await tx.get(existingRef);
        if (existingSnap.exists) {
          const existing = existingSnap.data();
          if (existing.methodId === methodId && ['pending_verification','initiated','awaiting_payment'].includes(existing.status)) {
            return { id: existingRef.id, status: existing.status, type: existing.type, reused: true };
          }
        }
      }

      const attemptRef = db.collection('paymentAttempts').doc();
      const status = method.type === 'automatic' ? 'initiated' : 'pending_verification';
      tx.set(attemptRef, {
        orderId,
        orderNo,
        methodId,
        methodName: id(method.name, 120),
        type: method.type,
        status,
        reference,
        creationChannel: 'secure-api',
        createdAt: FieldValue.serverTimestamp()
      });
      tx.update(orderRef, {
        paymentMethod: methodId,
        paymentAttemptId: attemptRef.id,
        paymentStatus: method.type === 'manual' ? 'pending_verification' : 'unpaid',
        paymentUpdatedAt: FieldValue.serverTimestamp()
      });
      tx.set(db.collection('auditLogs').doc(), {
        action: 'payment.attempt.created', actor: 'server', targetType: 'paymentAttempt', targetId: attemptRef.id,
        details: { orderId, orderNo, methodId, type: method.type }, createdAt: FieldValue.serverTimestamp()
      });
      return { id: attemptRef.id, status, type: method.type, reused: false };
    });

    return send(res, result.reused ? 200 : 201, Object.assign({ persisted: true }, result));
  } catch (err) {
    console.error('createPaymentAttempt', err);
    return send(res, err.status || 500, { error: err.message || 'PAYMENT_ATTEMPT_CREATE_FAILED' });
  }
});

exports.initPayment = onRequest({ cors: CORS, timeoutSeconds: 30 }, async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  try {
    await requireAppCheck(req);
    const orderId = id(req.body && req.body.orderId, 128);
    const attemptId = id(req.body && req.body.paymentAttemptId, 128);
    const methodId = id(req.body && req.body.methodId, 80);
    if (!orderId || !attemptId || !methodId) return send(res, 400, { error: 'INVALID_REQUEST' });

    const [orderSnap, attemptSnap, method] = await Promise.all([
      db.doc(`orders/${orderId}`).get(),
      db.doc(`paymentAttempts/${attemptId}`).get(),
      loadAutomaticMethod(methodId)
    ]);
    if (!orderSnap.exists || !attemptSnap.exists) return send(res, 404, { error: 'ORDER_OR_ATTEMPT_NOT_FOUND' });

    const order = orderSnap.data();
    const attempt = attemptSnap.data();
    if (attempt.orderId !== orderId || attempt.orderNo !== order.orderNo || attempt.methodId !== methodId || attempt.type !== 'automatic') {
      return send(res, 409, { error: 'PAYMENT_ATTEMPT_MISMATCH' });
    }
    if (order.paymentStatus === 'paid') return send(res, 409, { error: 'ORDER_ALREADY_PAID' });
    if (attempt.status === 'paid') return send(res, 409, { error: 'PAYMENT_ALREADY_COMPLETED' });
    if (attempt.checkoutUrl && attempt.status === 'awaiting_payment') {
      const existing = httpsUrl(attempt.checkoutUrl);
      if (existing) return send(res, 200, { checkoutUrl: existing, reused: true });
    }
    if (!['initiated', 'awaiting_payment'].includes(attempt.status)) {
      return send(res, 409, { error: 'PAYMENT_ATTEMPT_NOT_STARTABLE' });
    }

    const pricing = await authoritativeAmount(order);
    const adapter = getPaymentAdapter(methodId);
    if (!adapter) return send(res, 501, { error: 'PAYMENT_ADAPTER_NOT_INSTALLED' });

    const session = await adapter.createCheckout({
      orderId, attemptId, methodId, order, attempt, method,
      amountMinor: pricing.amountMinor, currency: pricing.currency,
      idempotencyKey: attemptId
    });
    const checkoutUrl = httpsUrl(session && session.checkoutUrl);
    if (!checkoutUrl) throw appError('INVALID_PROVIDER_CHECKOUT_URL', 502);

    const attemptRef = db.doc(`paymentAttempts/${attemptId}`);
    const orderRef = db.doc(`orders/${orderId}`);
    await db.runTransaction(async tx => {
      const freshAttempt = await tx.get(attemptRef);
      if (!freshAttempt.exists) throw new Error('ATTEMPT_DISAPPEARED');
      const a = freshAttempt.data();
      if (a.status === 'paid') return;
      tx.update(attemptRef, {
        status: 'awaiting_payment',
        checkoutUrl,
        providerSessionId: id(session && session.providerSessionId, 240),
        providerReference: id(session && session.providerReference, 240),
        amountMinor: pricing.amountMinor,
        currency: pricing.currency,
        updatedAt: FieldValue.serverTimestamp()
      });
      tx.update(orderRef, {
        paymentMethod: methodId,
        paymentAttemptId: attemptId,
        amountMinor: pricing.amountMinor,
        currency: pricing.currency,
        pricingLocked: true,
        pricingHash: pricing.pricingHash || '',
        pricingLines: pricing.lines || [],
        pricedAt: FieldValue.serverTimestamp(),
        paymentUpdatedAt: FieldValue.serverTimestamp()
      });
      tx.set(db.collection('auditLogs').doc(), {
        action: 'payment.automatic.started', actor: 'server', targetType: 'paymentAttempt', targetId: attemptId,
        details: { orderId, orderNo: order.orderNo, methodId, amountMinor: pricing.amountMinor, currency: pricing.currency },
        createdAt: FieldValue.serverTimestamp()
      });
    });

    return send(res, 200, { checkoutUrl });
  } catch (err) {
    console.error('initPayment', err);
    return send(res, err.status || 500, { error: err.message || 'PAYMENT_INIT_FAILED' });
  }
});

exports.paymentWebhook = onRequest({ cors: false, timeoutSeconds: 30 }, async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  try {
    const adapterId = id(req.query && req.query.adapter, 80);
    const adapter = getPaymentAdapter(adapterId);
    if (!adapter) return send(res, 404, { error: 'UNKNOWN_PAYMENT_ADAPTER' });

    const event = await adapter.verifyWebhook(req);
    const eventId = id(event && event.eventId, 240);
    const attemptId = id(event && event.paymentAttemptId, 128);
    const status = id(event && event.status, 40);
    if (!eventId || !attemptId || !['paid', 'failed', 'refunded'].includes(status)) {
      return send(res, 400, { error: 'INVALID_WEBHOOK_EVENT' });
    }

    const eventKey = crypto.createHash('sha256').update(`${adapterId}:${eventId}`).digest('hex');
    const eventRef = db.doc(`webhookEvents/${eventKey}`);
    const attemptRef = db.doc(`paymentAttempts/${attemptId}`);

    const result = await db.runTransaction(async tx => {
      const prior = await tx.get(eventRef);
      if (prior.exists) return { duplicate: true };
      const attemptSnap = await tx.get(attemptRef);
      if (!attemptSnap.exists) throw appError('ATTEMPT_NOT_FOUND', 404);
      const attempt = attemptSnap.data();
      if (attempt.methodId !== adapterId || attempt.type !== 'automatic') throw appError('WEBHOOK_ATTEMPT_MISMATCH', 409);
      const orderRef = db.doc(`orders/${attempt.orderId}`);
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists) throw appError('ORDER_NOT_FOUND', 404);
      const order = orderSnap.data();

      if (status === 'paid') {
        const webhookAmount = Number(event && event.amountMinor);
        const webhookCurrency = id(event && event.currency, 12).toUpperCase();
        if (!Number.isSafeInteger(webhookAmount) || webhookAmount !== Number(order.amountMinor)
            || webhookCurrency !== id(order.currency, 12).toUpperCase()) {
          throw appError('WEBHOOK_AMOUNT_MISMATCH', 409);
        }
      }

      const orderPaymentStatus = status === 'paid' ? 'paid' : (status === 'refunded' ? 'refunded' : 'failed');
      tx.set(eventRef, {
        adapterId, eventId, paymentAttemptId: attemptId, status,
        createdAt: FieldValue.serverTimestamp()
      });
      tx.update(attemptRef, {
        status,
        providerReference: id(event && event.providerReference, 240),
        verifiedAt: FieldValue.serverTimestamp(),
        verifiedBy: `webhook:${adapterId}`
      });
      tx.update(orderRef, {
        paymentStatus: orderPaymentStatus,
        paymentMethod: adapterId,
        paymentAttemptId: attemptId,
        paymentUpdatedAt: FieldValue.serverTimestamp()
      });
      tx.set(db.collection('auditLogs').doc(), {
        action: `payment.automatic.${status}`,
        actor: `webhook:${adapterId}`,
        targetType: 'paymentAttempt', targetId: attemptId,
        details: { orderId: attempt.orderId, orderNo: attempt.orderNo, eventId },
        createdAt: FieldValue.serverTimestamp()
      });
      return { duplicate: false };
    });

    return send(res, 200, { ok: true, duplicate: result.duplicate });
  } catch (err) {
    console.error('paymentWebhook', err);
    return send(res, err.status || 500, { error: err.message || 'WEBHOOK_FAILED' });
  }
});
