'use strict';

const crypto = require('node:crypto');
const { onRequest } = require('firebase-functions/v2/https');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAppCheck } = require('firebase-admin/app-check');
const { getPaymentAdapter } = require('./payment-adapters');

if (!getApps().length) initializeApp();
const db = getFirestore();

const CORS = ['https://newlynow.com', 'https://www.newlynow.com'];
const id = (v, max = 160) => String(v || '').trim().slice(0, max);
const httpsUrl = value => {
  try {
    const u = new URL(String(value || ''));
    return u.protocol === 'https:' ? u.href : '';
  } catch (_) { return ''; }
};

function send(res, status, body) {
  res.status(status).set('Cache-Control', 'no-store').json(body);
}

async function requireAppCheck(req) {
  const token = req.get('X-Firebase-AppCheck');
  if (!token) throw Object.assign(new Error('APP_CHECK_REQUIRED'), { status: 401 });
  try {
    return await getAppCheck().verifyToken(token);
  } catch (_) {
    throw Object.assign(new Error('INVALID_APP_CHECK'), { status: 401 });
  }
}

async function loadAutomaticMethod(methodId) {
  const snap = await db.doc('config/site').get();
  const methods = snap.exists && snap.get('payments.methods');
  const method = Array.isArray(methods)
    ? methods.find(m => m && m.id === methodId && m.enabled !== false && m.type === 'automatic')
    : null;
  if (!method) throw Object.assign(new Error('PAYMENT_METHOD_DISABLED'), { status: 400 });
  return method;
}

function authoritativeAmount(order) {
  const amountMinor = Number(order && order.amountMinor);
  const currency = id(order && order.currency, 12).toUpperCase();
  const locked = order && order.pricingLocked === true;
  if (!locked || !Number.isSafeInteger(amountMinor) || amountMinor <= 0 || !/^[A-Z]{3}$/.test(currency)) {
    throw Object.assign(new Error('ORDER_PRICE_NOT_LOCKED'), { status: 409 });
  }
  return { amountMinor, currency };
}

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

    const pricing = authoritativeAmount(order);
    const adapter = getPaymentAdapter(methodId);
    if (!adapter) return send(res, 501, { error: 'PAYMENT_ADAPTER_NOT_INSTALLED' });

    // The adapter must pass attemptId as its provider idempotency key.
    const session = await adapter.createCheckout({
      orderId, attemptId, methodId, order, attempt, method,
      amountMinor: pricing.amountMinor, currency: pricing.currency,
      idempotencyKey: attemptId
    });
    const checkoutUrl = httpsUrl(session && session.checkoutUrl);
    if (!checkoutUrl) throw Object.assign(new Error('INVALID_PROVIDER_CHECKOUT_URL'), { status: 502 });

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
        updatedAt: FieldValue.serverTimestamp()
      });
      tx.update(orderRef, {
        paymentMethod: methodId,
        paymentAttemptId: attemptId,
        paymentUpdatedAt: FieldValue.serverTimestamp()
      });
      tx.set(db.collection('auditLogs').doc(), {
        action: 'payment.automatic.started', actor: 'server', targetType: 'paymentAttempt', targetId: attemptId,
        details: { orderId, orderNo: order.orderNo, methodId }, createdAt: FieldValue.serverTimestamp()
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

    // Provider-specific signature verification MUST happen inside the adapter using req.rawBody.
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
      if (!attemptSnap.exists) throw Object.assign(new Error('ATTEMPT_NOT_FOUND'), { status: 404 });
      const attempt = attemptSnap.data();
      if (attempt.methodId !== adapterId || attempt.type !== 'automatic') {
        throw Object.assign(new Error('WEBHOOK_ATTEMPT_MISMATCH'), { status: 409 });
      }
      const orderRef = db.doc(`orders/${attempt.orderId}`);
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists) throw Object.assign(new Error('ORDER_NOT_FOUND'), { status: 404 });

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
