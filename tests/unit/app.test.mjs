// The composition root: it must wire a complete set of adapters, or fail loudly.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { start, getApp, resetApp } from '../../src/app.js';

describe('composition root', () => {
  beforeEach(() => resetApp());

  test('the memory backend wires a full app', async () => {
    const app = await start({ backend: 'memory' });
    assert.equal(app.backend, 'memory');
    for (const k of ['repo', 'auth', 'storage', 'Services']) {
      assert.ok(app[k], `app.${k} is wired`);
    }
    assert.equal(typeof app.Services.normalize, 'function');
  });

  test('the wired app actually works end to end', async () => {
    const app = await start({ backend: 'memory' });
    await app.auth.registerWithPassword({ email: 'a@example.com', password: 'pw' });
    assert.equal(app.auth.currentUser().email, 'a@example.com');

    const { id } = await app.repo.createOrder({
      orderNo: 'EL-1', items: [{ name: 'x', qty: 1 }],
    });
    assert.equal((await app.repo.getOrder(id)).orderNo, 'EL-1');
  });

  test('an incomplete adapter set is rejected at startup, not at first use', async () => {
    await assert.rejects(
      start({ backend: 'memory', adapters: { repo: {}, auth: {}, storage: {} } }),
      /does not implement its port/);
  });

  test('getApp memoises', async () => {
    const a = await getApp({ backend: 'memory' });
    const b = await getApp({ backend: 'memory' });
    assert.equal(a, b);
  });

  test('firebase is the default backend', async () => {
    // No config available in Node, so it must fail with a clear message rather
    // than silently falling back to something else.
    await assert.rejects(start({}), /Firebase config is missing/);
  });
});

// These are the migration guarantee, enforced rather than documented: if a page
// or the core starts importing Firebase directly, moving to a VPS stops being a
// one-directory change and these tests go red.
//
// Comments may name Firebase — explaining why a boundary exists is their job —
// so the checks run against code with comments stripped.
describe('layer boundaries', () => {
  const stripComments = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  const readCode = async (path) => {
    const { readFileSync } = await import('node:fs');
    return stripComments(readFileSync(path, 'utf8'));
  };

  const walk = async (dir) => {
    const { readdirSync, statSync } = await import('node:fs');
    return readdirSync(dir).flatMap((e) => {
      const p = `${dir}/${e}`;
      return statSync(p).isDirectory() ? walkSync(p) : [p];
    });
    function walkSync(d) {
      return readdirSync(d).flatMap((e) => {
        const p = `${d}/${e}`;
        return statSync(p).isDirectory() ? walkSync(p) : [p];
      });
    }
  };

  test('core business logic imports nothing from an adapter', async () => {
    const { readdirSync } = await import('node:fs');
    for (const f of readdirSync('src/core')) {
      const code = await readCode(`src/core/${f}`);
      assert.ok(!/adapters\//.test(code), `src/core/${f} must not reach into an adapter`);
      assert.ok(!/firebase|firestore/i.test(code), `src/core/${f} must not name a vendor`);
    }
  });

  test('the ports layer names no vendor in code', async () => {
    const code = await readCode('src/ports/index.js');
    assert.ok(!/firestore|firebase|getFirestore/i.test(code),
      'the port contract must stay vendor-neutral');
  });

  test('only the firebase adapter and the composition root know Firebase exists', async () => {
    const files = await walk('src');
    const offenders = [];
    for (const p of files.filter((f) => f.endsWith('.js'))) {
      if (p.startsWith('src/adapters/firebase/') || p === 'src/app.js') continue;
      if (/firebase|firestore/i.test(await readCode(p))) offenders.push(p);
    }
    assert.deepEqual(offenders, [],
      'Firebase must stay inside src/adapters/firebase/ and src/app.js');
  });
});
