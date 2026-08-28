// The in-memory adapter against the shared contract.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { runRepositoryContract } from './repository.contract.mjs';
import { createMemoryRepository, createMemoryAuth, createMemoryStorage }
  from '../../src/adapters/memory/index.js';
import {
  assertImplements, REPOSITORY_PORT, AUTH_PORT, STORAGE_PORT, ERROR_CODES,
} from '../../src/ports/index.js';

runRepositoryContract('in-memory', async () => ({ repo: createMemoryRepository() }));

describe('every in-memory adapter satisfies its port', () => {
  test('repository', () => {
    assert.doesNotThrow(() =>
      assertImplements(createMemoryRepository(), REPOSITORY_PORT, 'memory repository'));
  });
  test('auth', () => {
    assert.doesNotThrow(() => assertImplements(createMemoryAuth(), AUTH_PORT, 'memory auth'));
  });
  test('storage', () => {
    assert.doesNotThrow(() =>
      assertImplements(createMemoryStorage(), STORAGE_PORT, 'memory storage'));
  });
  test('a half-finished adapter fails loudly', () => {
    assert.throws(() => assertImplements({ getSiteConfig() {} }, REPOSITORY_PORT, 'partial'),
      /does not implement its port/);
  });
});

describe('auth contract — in-memory', () => {
  const seeded = () => createMemoryAuth({
    accounts: [{ email: 'a@example.com', password: 'pw', name: 'أحمد' }],
  });

  test('register then sign out then sign in', async () => {
    const auth = createMemoryAuth();
    const user = await auth.registerWithPassword(
      { email: 'new@example.com', password: 'pw', name: 'جديد' });
    assert.equal(user.email, 'new@example.com');
    assert.equal(auth.currentUser().id, user.id);

    await auth.signOut();
    assert.equal(auth.currentUser(), null);

    const back = await auth.signInWithPassword({ email: 'new@example.com', password: 'pw' });
    assert.equal(back.id, user.id);
  });

  test('a wrong password is rejected with a portable code', async () => {
    const auth = seeded();
    await assert.rejects(auth.signInWithPassword({ email: 'a@example.com', password: 'nope' }),
      (e) => e.code === ERROR_CODES.UNAUTHENTICATED);
  });

  test('registering an existing email conflicts', async () => {
    const auth = seeded();
    await assert.rejects(
      auth.registerWithPassword({ email: 'a@example.com', password: 'pw' }),
      (e) => e.code === ERROR_CODES.CONFLICT);
  });

  test('provider sign-in works and an unknown provider is rejected', async () => {
    const auth = createMemoryAuth();
    const u = await auth.signInWithProvider('google');
    assert.equal(u.provider, 'google');
    await assert.rejects(auth.signInWithProvider('myspace'),
      (e) => e.code === ERROR_CODES.INVALID);
  });

  test('a password reset is recorded', async () => {
    const auth = seeded();
    await auth.sendPasswordReset('a@example.com');
    assert.deepEqual(auth._resetsSentTo(), ['a@example.com']);
  });

  test('onChange fires and unsubscribes', async () => {
    const auth = createMemoryAuth();
    const seen = [];
    const stop = auth.onChange((u) => seen.push(u));
    await auth.registerWithPassword({ email: 'x@example.com', password: 'pw' });
    assert.ok(seen.length >= 1);
    stop();
    const before = seen.length;
    await auth.signOut();
    assert.equal(seen.length, before, 'no further calls after unsubscribing');
  });

  test('the user shape carries no vendor object', async () => {
    const auth = seeded();
    const u = await auth.signInWithPassword({ email: 'a@example.com', password: 'pw' });
    assert.deepEqual(Object.keys(u).sort(),
      ['email', 'emailVerified', 'id', 'name', 'photo', 'provider']);
  });
});

describe('storage contract — in-memory', () => {
  const png = (bytes = 100) => new Uint8Array(bytes);

  test('an image uploads and reads back a url', async () => {
    const s = createMemoryStorage();
    const { path, url } = await s.upload(
      { folder: 'services', name: 'a.png', data: png(), contentType: 'image/png' });
    assert.equal(path, 'services/a.png');
    assert.equal(await s.urlFor(path), url);
  });

  test('a folder outside the allowlist is refused', async () => {
    const s = createMemoryStorage();
    await assert.rejects(
      s.upload({ folder: 'etc', name: 'x.png', data: png(), contentType: 'image/png' }),
      (e) => e.code === ERROR_CODES.PERMISSION_DENIED);
  });

  test('a non-image type is refused', async () => {
    const s = createMemoryStorage();
    await assert.rejects(
      s.upload({ folder: 'services', name: 'x.html', data: png(), contentType: 'text/html' }),
      (e) => e.code === ERROR_CODES.UNSUPPORTED_TYPE);
  });

  test('a file over 5 MB is refused', async () => {
    const s = createMemoryStorage();
    await assert.rejects(
      s.upload({ folder: 'services', name: 'big.png', data: png(6 * 1024 * 1024), contentType: 'image/png' }),
      (e) => e.code === ERROR_CODES.TOO_LARGE);
  });

  test('removing a missing file reports not found', async () => {
    const s = createMemoryStorage();
    await assert.rejects(s.remove('services/ghost.png'), (e) => e.code === ERROR_CODES.NOT_FOUND);
  });
});
