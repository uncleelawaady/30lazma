// The Firebase adapter against the SAME contract the in-memory adapter passes.
// Run via `npm run test:rules` (the emulator wrapper) — see package.json.
//
// Two adapters, one suite. That is the migration guarantee: a MySQL adapter is
// finished when it goes green here too.

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { runRepositoryContract } from './repository.contract.mjs';
import { createFirebaseRepository, createFirebaseAuth, createFirebaseStorage }
  from '../../src/adapters/firebase/index.js';
import {
  assertImplements, REPOSITORY_PORT, AUTH_PORT, STORAGE_PORT, ERROR_CODES,
} from '../../src/ports/index.js';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, addDoc, collection, query, where, orderBy,
  limit, startAfter, getDocs, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

// This suite is about the ADAPTER's behaviour — does it translate shapes and
// errors correctly — not about authorization, which has its own suite in
// tests/rules. So it runs on a separate emulator project with open rules; the
// production rules are exercised there, against exactly the same emulator.
const PROJECT = 'elwaset-contract';
const OPEN_RULES = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} { allow read, write: if true; }
  }
}`;
const OPEN_STORAGE_RULES = `
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} { allow read, write: if true; }
  }
}`;

let env, db, storage;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: OPEN_RULES, host: '127.0.0.1', port: 8080 },
    storage: { rules: OPEN_STORAGE_RULES, host: '127.0.0.1', port: 9199 },
  });
  const ctx = env.unauthenticatedContext();
  db = ctx.firestore();
  storage = ctx.storage();
});

after(async () => { await env?.cleanup(); });

const clearFirestore = () => env.clearFirestore();

const sdk = () => ({
  db, doc, getDoc, setDoc, updateDoc, addDoc, collection, query, where,
  orderBy, limit, startAfter, getDocs, onSnapshot, serverTimestamp,
});

runRepositoryContract('firebase', async () => {
  await clearFirestore();
  return { repo: createFirebaseRepository(sdk()) };
});

describe('every Firebase adapter satisfies its port', () => {
  test('repository', () => {
    assert.doesNotThrow(() =>
      assertImplements(createFirebaseRepository(sdk()), REPOSITORY_PORT, 'firebase repository'));
  });
  test('auth', () => {
    // Constructed with a stub SDK: the port check is structural, not behavioural.
    const stub = new Proxy({ auth: {} }, { get: (t, k) => t[k] ?? (() => {}) });
    assert.doesNotThrow(() =>
      assertImplements(createFirebaseAuth(stub), AUTH_PORT, 'firebase auth'));
  });
  test('storage', () => {
    assert.doesNotThrow(() => assertImplements(
      createFirebaseStorage({ storage, ref, uploadBytes, getDownloadURL, deleteObject }),
      STORAGE_PORT, 'firebase storage'));
  });
});

describe('firebase storage adapter', () => {
  const make = () => createFirebaseStorage({ storage, ref, uploadBytes, getDownloadURL, deleteObject });
  const png = (n = 128) => new Uint8Array(n);

  test('an image uploads and yields a url', async () => {
    const s = make();
    const { path, url } = await s.upload(
      { folder: 'services', name: `c-${Date.now()}.png`, data: png(), contentType: 'image/png' });
    assert.ok(path.startsWith('services/'));
    assert.ok(url.length > 0);
  });

  test('the same limits apply as in the in-memory adapter', async () => {
    const s = make();
    await assert.rejects(
      s.upload({ folder: 'etc', name: 'x.png', data: png(), contentType: 'image/png' }),
      (e) => e.code === ERROR_CODES.PERMISSION_DENIED);
    await assert.rejects(
      s.upload({ folder: 'services', name: 'x.html', data: png(), contentType: 'text/html' }),
      (e) => e.code === ERROR_CODES.UNSUPPORTED_TYPE);
    await assert.rejects(
      s.upload({ folder: 'services', name: 'big.png', data: png(6 * 1024 * 1024), contentType: 'image/png' }),
      (e) => e.code === ERROR_CODES.TOO_LARGE);
  });

  test('a vendor error is translated into a portable code', async () => {
    const s = make();
    await assert.rejects(s.urlFor('services/definitely-missing.png'),
      (e) => {
        assert.equal(e.code, ERROR_CODES.NOT_FOUND, `got ${e.code}`);
        assert.equal(e.name, 'StorageError', 'a port error, not a FirebaseError');
        return true;
      });
  });
});
