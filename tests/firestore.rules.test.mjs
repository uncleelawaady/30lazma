import fs from 'node:fs';
import test from 'node:test';
import { after, before, beforeEach } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

let env;
const OWNER = 'elawaady.official@gmail.com';
const ADMIN = 'admin@example.com';

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-newlynow',
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8') }
  });
});

after(async () => { if (env) await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'config', 'site'), {
      admins: [ADMIN],
      payments: { methods: [] },
      security: { appCheckSiteKey: '', apiBaseUrl: '', secureCommerceOnly: false }
    });
    await setDoc(doc(db, 'orders', 'seed-order'), validOrder('NN-SEED'));
  });
});

function auth(uid, email, emailVerified = true) {
  return env.authenticatedContext(uid, { email, email_verified: emailVerified }).firestore();
}

function validOrder(orderNo = 'NN-TEST-1') {
  return {
    orderNo,
    name: 'Test Customer',
    phone: '01000000000',
    notes: '',
    items: [{ name: 'Test Service', category: 'Test', qty: 1, link: '', notes: '', coupon: '', code: '' }],
    count: 1,
    status: 'new',
    paymentStatus: 'unpaid',
    paymentMethod: '',
    paymentAttemptId: '',
    source: 'store',
    createdAt: serverTimestamp()
  };
}

function validAttempt(orderId, orderNo, status = 'pending_verification') {
  return {
    orderId,
    orderNo,
    methodId: 'manual-test',
    methodName: 'Manual Test',
    type: 'manual',
    status,
    reference: '',
    createdAt: serverTimestamp()
  };
}

test('guest can create a valid explicitly unpaid order while compatibility mode is enabled', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertSucceeds(addDoc(collection(db, 'orders'), validOrder()));
});

test('guest cannot forge paid state at order creation', async () => {
  const db = env.unauthenticatedContext().firestore();
  const order = validOrder();
  order.paymentStatus = 'paid';
  await assertFails(addDoc(collection(db, 'orders'), order));
});

test('payment attempt must start in the allowed initial state and match an existing order', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertSucceeds(addDoc(collection(db, 'paymentAttempts'), validAttempt('seed-order', 'NN-SEED')));
  await assertFails(addDoc(collection(db, 'paymentAttempts'), validAttempt('seed-order', 'NN-SEED', 'paid')));
  await assertFails(addDoc(collection(db, 'paymentAttempts'), validAttempt('missing-order', 'NN-MISSING')));
});

test('secure commerce only disables all direct client order/payment-attempt creation', async () => {
  const ownerDb = auth('owner-verified', OWNER, true);
  await assertSucceeds(updateDoc(doc(ownerDb, 'config', 'site'), {
    security: { appCheckSiteKey: 'public-site-key', apiBaseUrl: 'https://example.cloudfunctions.net', secureCommerceOnly: true }
  }));

  const guestDb = env.unauthenticatedContext().firestore();
  await assertFails(addDoc(collection(guestDb, 'orders'), validOrder('NN-LOCKED')));
  await assertFails(addDoc(collection(guestDb, 'paymentAttempts'), validAttempt('seed-order', 'NN-SEED')));
});

test('unverified owner email has no owner privileges', async () => {
  const db = auth('owner-unverified', OWNER, false);
  await assertFails(updateDoc(doc(db, 'config', 'site'), { payments: { methods: [{ id:'x' }] } }));
  await assertFails(setDoc(doc(db, 'pricing', 'p1'), { active:true }));
});

test('verified owner can manage financial configuration', async () => {
  const db = auth('owner-verified', OWNER, true);
  await assertSucceeds(updateDoc(doc(db, 'config', 'site'), { payments: { methods: [] } }));
  await assertSucceeds(setDoc(doc(db, 'pricing', 'p1'), { active:true }));
});

test('unverified listed admin is denied while verified admin can read orders', async () => {
  const unverified = auth('admin-unverified', ADMIN, false);
  const verified = auth('admin-verified', ADMIN, true);
  await assertFails(getDoc(doc(unverified, 'orders', 'seed-order')));
  await assertSucceeds(getDoc(doc(verified, 'orders', 'seed-order')));
});

test('regular verified admin cannot replace payment security or admin configuration', async () => {
  const db = auth('admin-verified', ADMIN, true);
  await assertFails(updateDoc(doc(db, 'config', 'site'), { payments: { methods: [{ id:'evil' }] } }));
  await assertFails(updateDoc(doc(db, 'config', 'site'), { security: { appCheckSiteKey: 'changed' } }));
  await assertFails(updateDoc(doc(db, 'config', 'site'), { admins: ['attacker@example.com'] }));
});

test('regular verified admin may update normal non-sensitive site config', async () => {
  const db = auth('admin-verified', ADMIN, true);
  await assertSucceeds(updateDoc(doc(db, 'config', 'site'), { ticker: ['hello'] }));
});

test('audit logs are append-only', async () => {
  const db = auth('admin-verified', ADMIN, true);
  const ref = doc(collection(db, 'auditLogs'));
  await assertSucceeds(setDoc(ref, {
    action:'test.action', actor:ADMIN, targetType:'test', targetId:'1', details:{ ok:true }, createdAt:serverTimestamp()
  }));
  await assertFails(updateDoc(ref, { action:'tampered' }));
});

test('regular admin cannot write structured pricing', async () => {
  const db = auth('admin-verified', ADMIN, true);
  await assertFails(setDoc(doc(db, 'pricing', 'p1'), { active:true }));
});
