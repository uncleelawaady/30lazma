// Firestore security-rules tests — run against the Firestore emulator.
//   npm run test:rules
//
// These cover the authorization requirements in the production checklist:
// role separation, admin-only surfaces, direct-HTTP access attempts, input
// validation and privilege escalation.

import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, collection, getDocs, serverTimestamp,
} from 'firebase/firestore';

const OWNER = 'elawaady.official@gmail.com';
const ADMIN = 'staff@elwaset.net';

let env;

// Contexts are cached: creating a fresh RulesTestContext per assertion churns
// emulator connections and makes otherwise-valid requests fail intermittently.
const ctxCache = new Map();
function ctx(key, make) {
  if (!ctxCache.has(key)) ctxCache.set(key, make());
  return ctxCache.get(key);
}
const asGuest = () => ctx('guest', () => env.unauthenticatedContext()).firestore();
const asUser  = (uid = 'user1', email = 'user1@example.com') =>
  ctx(`v:${uid}:${email}`,
      () => env.authenticatedContext(uid, { email, email_verified: true })).firestore();
const asOwner = () => asUser('owner1', OWNER);
const asAdmin = () => asUser('admin1', ADMIN);
const asUnverified = (uid, email) =>
  ctx(`u:${uid}:${email}`,
      () => env.authenticatedContext(uid, { email, email_verified: false })).firestore();

// A well-formed order/review/customer payload the rules should accept.
const goodOrder = (extra = {}) => ({
  orderNo: 'EL-12345', name: 'أحمد', phone: '01055578777', notes: '',
  items: [{ name: 'زيادة متابعين', qty: 1 }], count: 1,
  status: 'new', source: 'store', createdAt: serverTimestamp(), ...extra,
});
const goodReview = (extra = {}) => ({
  name: 'عميل', text: 'خدمة ممتازة', rating: 5,
  approved: false, createdAt: serverTimestamp(), ...extra,
});

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'elwaset-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});

after(async () => { ctxCache.clear(); await env?.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  // Seed the state the rules read: the admin list and a few docs.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'config/admins'), { emails: [ADMIN] });
    await setDoc(doc(db, 'config/site'), { theme: { primary: '#17A85E' }, admins: [ADMIN] });
    await setDoc(doc(db, 'users/user1'), { role: 'user', balance: 0, name: 'User One' });
    await setDoc(doc(db, 'users/merch1'), { role: 'merchant', balance: 0 });
    await setDoc(doc(db, 'users/admin1'), { role: 'user' });
    await setDoc(doc(db, 'orders/o1'), { orderNo: 'EL-1', uid: 'user1', status: 'new', total: 100 });
    await setDoc(doc(db, 'orders/o2'), { orderNo: 'EL-2', uid: 'user2', status: 'new', total: 200 });
    await setDoc(doc(db, 'providers/p1'), { name: 'Provider A', apiKey: 'SECRET', endpoint: 'https://x' });
    await setDoc(doc(db, 'ledger/l1'), { amount: 100 });
    await setDoc(doc(db, 'audit_log/a1'), { action: 'test' });
  });
});

// ---------------------------------------------------------------- config

describe('config — storefront content vs. admin list', () => {
  test('anyone can read storefront config', async () => {
    await assertSucceeds(getDoc(doc(asGuest(), 'config/site')));
  });

  test('the admin email list is NOT publicly readable (no admin enumeration)', async () => {
    await assertFails(getDoc(doc(asGuest(), 'config/admins')));
    await assertFails(getDoc(doc(asUser(), 'config/admins')));
  });

  test('an admin can read the admin list; only an owner can write it', async () => {
    await assertSucceeds(getDoc(doc(asAdmin(), 'config/admins')));
    await assertFails(setDoc(doc(asAdmin(), 'config/admins'), { emails: [ADMIN, 'evil@x.com'] }));
    await assertSucceeds(setDoc(doc(asOwner(), 'config/admins'), { emails: [ADMIN] }));
  });

  test('a normal user cannot rewrite the storefront config', async () => {
    await assertFails(setDoc(doc(asUser(), 'config/site'), { theme: {} }));
    await assertFails(setDoc(doc(asGuest(), 'config/site'), { theme: {} }));
  });

  test('an admin can write the storefront config', async () => {
    await assertSucceeds(setDoc(doc(asAdmin(), 'config/site'), { theme: { primary: '#000' } }));
  });

  test('an UNVERIFIED email matching an admin does not get admin rights', async () => {
    const db = asUnverified('imposter', ADMIN);
    await assertFails(setDoc(doc(db, 'config/site'), { theme: {} }));
  });
});

// ---------------------------------------------------------------- users / escalation

describe('users — privilege escalation', () => {
  test('a user may edit their own harmless profile fields', async () => {
    await assertSucceeds(updateDoc(doc(asUser(), 'users/user1'), { name: 'New Name' }));
  });

  test('a user CANNOT promote themselves to admin/merchant/supplier', async () => {
    await assertFails(updateDoc(doc(asUser(), 'users/user1'), { role: 'admin' }));
    await assertFails(updateDoc(doc(asUser(), 'users/user1'), { role: 'merchant' }));
    await assertFails(updateDoc(doc(asUser(), 'users/user1'), { role: 'supplier' }));
  });

  test('a user CANNOT top up their own balance or flip their status', async () => {
    await assertFails(updateDoc(doc(asUser(), 'users/user1'), { balance: 999999 }));
    await assertFails(updateDoc(doc(asUser(), 'users/user1'), { status: 'vip' }));
    await assertFails(updateDoc(doc(asUser(), 'users/user1'), { verified: true }));
  });

  test('a user cannot read another user profile', async () => {
    await assertFails(getDoc(doc(asUser(), 'users/merch1')));
  });

  test('a user cannot delete their own profile; an admin can', async () => {
    await assertFails(deleteDoc(doc(asUser(), 'users/user1')));
    await assertSucceeds(deleteDoc(doc(asAdmin(), 'users/user1')));
  });

  test('sign-up creates a plain user only — not a pre-privileged one', async () => {
    const db = asUser('newbie', 'newbie@example.com');
    await assertFails(setDoc(doc(db, 'users/newbie'),
      { role: 'admin', balance: 0, createdAt: serverTimestamp() }));
    await assertFails(setDoc(doc(db, 'users/newbie'),
      { role: 'user', balance: 5000, createdAt: serverTimestamp() }));
    await assertSucceeds(setDoc(doc(db, 'users/newbie'),
      { role: 'user', balance: 0, name: 'Newbie', createdAt: serverTimestamp() }));
  });

  test('a user cannot create a profile under someone else uid', async () => {
    const db = asUser('newbie', 'newbie@example.com');
    await assertFails(setDoc(doc(db, 'users/victim'),
      { role: 'user', balance: 0, createdAt: serverTimestamp() }));
  });
});

// ---------------------------------------------------------------- orders

describe('orders — creation, validation and cross-account reads', () => {
  test('a guest can place a well-formed order', async () => {
    await assertSucceeds(addDoc(collection(asGuest(), 'orders'), goodOrder()));
  });

  test('an order cannot be opened in a privileged status', async () => {
    await assertFails(addDoc(collection(asGuest(), 'orders'), goodOrder({ status: 'paid' })));
    await assertFails(addDoc(collection(asGuest(), 'orders'), goodOrder({ status: 'completed' })));
  });

  test('unknown fields are rejected (no field smuggling)', async () => {
    await assertFails(addDoc(collection(asGuest(), 'orders'), goodOrder({ isAdmin: true })));
    await assertFails(addDoc(collection(asGuest(), 'orders'), goodOrder({ providerKey: 'x' })));
  });

  test('oversized and malformed payloads are rejected', async () => {
    await assertFails(addDoc(collection(asGuest(), 'orders'), goodOrder({ name: 'x'.repeat(200) })));
    await assertFails(addDoc(collection(asGuest(), 'orders'), goodOrder({ notes: 'x'.repeat(5000) })));
    await assertFails(addDoc(collection(asGuest(), 'orders'), goodOrder({ items: [] })));
    await assertFails(addDoc(collection(asGuest(), 'orders'), goodOrder({ count: -5 })));
    await assertFails(addDoc(collection(asGuest(), 'orders'), goodOrder({ count: 'many' })));
  });

  test('createdAt cannot be backdated or forged', async () => {
    await assertFails(addDoc(collection(asGuest(), 'orders'),
      goodOrder({ createdAt: new Date('2020-01-01') })));
  });

  test('an order cannot be attributed to another user', async () => {
    const db = asUser('user1', 'user1@example.com');
    await assertFails(addDoc(collection(db, 'orders'), goodOrder({ uid: 'user2' })));
    await assertSucceeds(addDoc(collection(db, 'orders'), goodOrder({ uid: 'user1' })));
  });

  test('a user reads only their OWN orders, never anyone else', async () => {
    const db = asUser('user1', 'user1@example.com');
    await assertSucceeds(getDoc(doc(db, 'orders/o1')));
    await assertFails(getDoc(doc(db, 'orders/o2')));
  });

  test('a guest cannot enumerate the orders collection', async () => {
    await assertFails(getDocs(collection(asGuest(), 'orders')));
    await assertFails(getDoc(doc(asGuest(), 'orders/o1')));
  });

  test('a customer cannot mutate an order after placing it (snapshot integrity)', async () => {
    const db = asUser('user1', 'user1@example.com');
    await assertFails(updateDoc(doc(db, 'orders/o1'), { total: 1 }));
    await assertFails(updateDoc(doc(db, 'orders/o1'), { status: 'completed' }));
    await assertFails(deleteDoc(doc(db, 'orders/o1')));
  });

  test('staff can read and manage orders', async () => {
    await assertSucceeds(getDocs(collection(asAdmin(), 'orders')));
    await assertSucceeds(updateDoc(doc(asAdmin(), 'orders/o1'), { status: 'completed' }));
    // a merchant reads but does not mutate
    const merch = asUser('merch1', 'merch@example.com');
    await assertSucceeds(getDoc(doc(merch, 'orders/o1')));
    await assertFails(updateDoc(doc(merch, 'orders/o1'), { status: 'completed' }));
  });
});

// ---------------------------------------------------------------- reviews

describe('reviews — public submission is constrained', () => {
  test('a guest can submit a pending review', async () => {
    await assertSucceeds(addDoc(collection(asGuest(), 'reviews'), goodReview()));
  });

  test('a review cannot arrive pre-approved', async () => {
    await assertFails(addDoc(collection(asGuest(), 'reviews'), goodReview({ approved: true })));
  });

  test('rating is bounded and typed', async () => {
    await assertFails(addDoc(collection(asGuest(), 'reviews'), goodReview({ rating: 99 })));
    await assertFails(addDoc(collection(asGuest(), 'reviews'), goodReview({ rating: 0 })));
    await assertFails(addDoc(collection(asGuest(), 'reviews'), goodReview({ rating: '5' })));
  });

  test('review text is length-capped (spam/DoS guard)', async () => {
    await assertFails(addDoc(collection(asGuest(), 'reviews'), goodReview({ text: 'x'.repeat(5000) })));
  });

  test('only an admin moderates', async () => {
    await assertFails(updateDoc(doc(asUser(), 'reviews/r-none'), { approved: true }));
    await env.withSecurityRulesDisabled(async (ctx) =>
      setDoc(doc(ctx.firestore(), 'reviews/r1'), { name: 'x', approved: false }));
    await assertSucceeds(updateDoc(doc(asAdmin(), 'reviews/r1'), { approved: true }));
  });
});

// ---------------------------------------------------------------- customers

describe('customers — contact records', () => {
  test('checkout can create a contact record', async () => {
    await assertSucceeds(addDoc(collection(asGuest(), 'customers'),
      { name: 'أحمد', phone: '0100', source: 'order', createdAt: serverTimestamp() }));
  });

  test('field smuggling is rejected', async () => {
    await assertFails(addDoc(collection(asGuest(), 'customers'),
      { name: 'أحمد', phone: '0100', role: 'admin', createdAt: serverTimestamp() }));
  });

  test('a guest cannot read the customer list (PII)', async () => {
    await assertFails(getDocs(collection(asGuest(), 'customers')));
  });

  test('an admin can read the customer list', async () => {
    await assertSucceeds(getDocs(collection(asAdmin(), 'customers')));
  });
});

// ---------------------------------------------------------------- secrets & ledger

describe('provider secrets, ledger and audit log are unreachable from a browser', () => {
  test('nobody — not even an admin — reads provider credentials from the client', async () => {
    await assertFails(getDoc(doc(asGuest(), 'providers/p1')));
    await assertFails(getDoc(doc(asUser(), 'providers/p1')));
    await assertFails(getDoc(doc(asAdmin(), 'providers/p1')));
    await assertFails(getDoc(doc(asOwner(), 'providers/p1')));
  });

  test('provider secrets cannot be written from the client', async () => {
    await assertFails(setDoc(doc(asOwner(), 'provider_secrets/s1'), { key: 'x' }));
  });

  test('the ledger is admin-readable but never client-writable', async () => {
    await assertSucceeds(getDoc(doc(asAdmin(), 'ledger/l1')));
    await assertFails(getDoc(doc(asUser(), 'ledger/l1')));
    await assertFails(setDoc(doc(asAdmin(), 'ledger/l2'), { amount: 1 }));
    await assertFails(setDoc(doc(asOwner(), 'ledger/l2'), { amount: 1 }));
  });

  test('the audit log cannot be edited or erased from the client', async () => {
    await assertSucceeds(getDoc(doc(asAdmin(), 'audit_log/a1')));
    await assertFails(updateDoc(doc(asAdmin(), 'audit_log/a1'), { action: 'tampered' }));
    await assertFails(deleteDoc(doc(asOwner(), 'audit_log/a1')));
  });
});

// ---------------------------------------------------------------- default deny

describe('default deny', () => {
  test('an unknown collection is closed', async () => {
    await assertFails(setDoc(doc(asOwner(), 'anything_else/x'), { a: 1 }));
    await assertFails(getDoc(doc(asGuest(), 'anything_else/x')));
  });
});
