// Firebase Storage security-rules tests — run against the Storage emulator.
// Covers condition 24 (upload validation: size + type) and the requirement
// that customer proofs are not readable by URL guessing.

import { test, before, after, beforeEach, describe } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment, assertFails, assertSucceeds,
} from '@firebase/rules-unit-testing';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, setDoc } from 'firebase/firestore';

const OWNER = 'elawaady.official@gmail.com';
const ADMIN = 'staff@elwaset.net';

let env;

// Cached for the same reason as the Firestore suite: a fresh context per
// assertion churns emulator connections and produces flaky authz failures.
const ctxCache = new Map();
const ctxFor = (uid, email, verified = true) => {
  const key = `${uid || 'guest'}:${email || ''}:${verified}`;
  if (!ctxCache.has(key)) {
    ctxCache.set(key, uid
      ? env.authenticatedContext(uid, { email, email_verified: verified })
      : env.unauthenticatedContext());
  }
  return ctxCache.get(key);
};

const st = (uid, email, verified) => ctxFor(uid, email, verified).storage();

const png = (bytes = 1024) =>
  ({ data: new Uint8Array(bytes), meta: { contentType: 'image/png' } });

const put = (storage, path, { data, meta }) => uploadBytes(ref(storage, path), data, meta);

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'elwaset-test',
    storage:   { rules: readFileSync('storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 },
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});

after(async () => { ctxCache.clear(); await env?.cleanup(); });

beforeEach(async () => {
  await env.clearStorage();
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'config/admins'), { emails: [ADMIN] });
  });
});

describe('store media uploads', () => {
  test('an admin can upload an image to a media folder', async () => {
    await assertSucceeds(put(st('admin1', ADMIN), 'categories/a.png', png()));
    await assertSucceeds(put(st('admin1', ADMIN), 'services/b.png', png()));
    await assertSucceeds(put(st('owner1', OWNER), 'store/c.png', png()));
  });

  test('an anonymous visitor cannot upload', async () => {
    await assertFails(put(st(null), 'categories/evil.png', png()));
  });

  test('a signed-in non-admin cannot upload', async () => {
    await assertFails(put(st('user1', 'user1@example.com'), 'categories/evil.png', png()));
  });

  test('an admin with an UNVERIFIED email cannot upload', async () => {
    await assertFails(put(st('imposter', ADMIN, false), 'categories/evil.png', png()));
  });

  test('non-image content types are rejected', async () => {
    await assertFails(put(st('admin1', ADMIN), 'categories/shell.html',
      { data: new Uint8Array(10), meta: { contentType: 'text/html' } }));
    await assertFails(put(st('admin1', ADMIN), 'categories/x.js',
      { data: new Uint8Array(10), meta: { contentType: 'application/javascript' } }));
    await assertFails(put(st('admin1', ADMIN), 'categories/x.pdf',
      { data: new Uint8Array(10), meta: { contentType: 'application/pdf' } }));
  });

  test('oversized images are rejected (5 MB cap)', async () => {
    await assertFails(put(st('admin1', ADMIN), 'categories/huge.png', png(6 * 1024 * 1024)));
  });

  test('uploads outside the allowed folders are rejected', async () => {
    await assertFails(put(st('admin1', ADMIN), 'root.png', png()));
    await assertFails(put(st('owner1', OWNER), 'random/x.png', png()));
  });

  test('store media stays publicly readable', async () => {
    await assertSucceeds(put(st('admin1', ADMIN), 'categories/a.png', png()));
    await assertSucceeds(getDownloadURL(ref(st(null), 'categories/a.png')));
  });
});

describe('customer proofs are private', () => {
  test('a customer uploads their own proof', async () => {
    await assertSucceeds(put(st('user1', 'u1@example.com'), 'proofs/user1/receipt.png', png()));
  });

  test('a customer cannot upload under another uid', async () => {
    await assertFails(put(st('user1', 'u1@example.com'), 'proofs/user2/receipt.png', png()));
  });

  test('a proof is NOT publicly readable', async () => {
    await env.withSecurityRulesDisabled(async (c) =>
      put(c.storage(), 'proofs/user1/receipt.png', png()));
    await assertFails(getDownloadURL(ref(st(null), 'proofs/user1/receipt.png')));
    await assertFails(getDownloadURL(ref(st('user2', 'u2@example.com'), 'proofs/user1/receipt.png')));
    await assertSucceeds(getDownloadURL(ref(st('user1', 'u1@example.com'), 'proofs/user1/receipt.png')));
    await assertSucceeds(getDownloadURL(ref(st('admin1', ADMIN), 'proofs/user1/receipt.png')));
  });

  test('only an admin deletes a proof', async () => {
    await env.withSecurityRulesDisabled(async (c) =>
      put(c.storage(), 'proofs/user1/receipt.png', png()));
    await assertFails(deleteObject(ref(st('user1', 'u1@example.com'), 'proofs/user1/receipt.png')));
    await assertSucceeds(deleteObject(ref(st('admin1', ADMIN), 'proofs/user1/receipt.png')));
  });
});
