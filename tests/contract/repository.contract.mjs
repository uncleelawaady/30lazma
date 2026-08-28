// The repository contract.
//
// This is the definition of a correct repository adapter, and it is deliberately
// written against the port only — no Firestore, no SQL, no vendor anything. Any
// future adapter (MySQL, Postgres, an HTTP API on a VPS) is finished when this
// suite goes green against it.

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ERROR_CODES } from '../../src/ports/index.js';

const order = (extra = {}) => ({
  orderNo: 'EL-10001', name: 'أحمد', phone: '01055578777',
  items: [{ name: 'لايكات فيسبوك', qty: 1 }], count: 1, status: 'new', ...extra,
});

/** Assert a rejection carries a portable code, not a vendor one. */
async function rejectsWithCode(promise, code) {
  await assert.rejects(promise, (err) => {
    assert.equal(err.code, code, `expected code ${code}, got ${err.code}`);
    return true;
  });
}

/**
 * @param {string} label   adapter name, used in the suite title
 * @param {() => Promise<{repo, reset?}>} make  fresh adapter per test
 */
export function runRepositoryContract(label, make) {
  describe(`repository contract — ${label}`, () => {
    let repo;
    beforeEach(async () => { ({ repo } = await make()); });

    describe('site config', () => {
      test('an unset config reads as an empty object or null', async () => {
        const cfg = await repo.getSiteConfig();
        assert.ok(cfg === null || typeof cfg === 'object');
      });

      test('a saved config reads back', async () => {
        await repo.saveSiteConfig({ theme: { primary: '#17A85E' } });
        const cfg = await repo.getSiteConfig();
        assert.equal(cfg.theme.primary, '#17A85E');
      });

      test('saving merges rather than replaces', async () => {
        await repo.saveSiteConfig({ theme: { primary: '#000' } });
        await repo.saveSiteConfig({ ticker: 'مرحبًا' });
        const cfg = await repo.getSiteConfig();
        assert.equal(cfg.ticker, 'مرحبًا');
        assert.ok(cfg.theme, 'the earlier key survived');
      });

      test('watchSiteConfig delivers the current value and unsubscribes', async () => {
        await repo.saveSiteConfig({ ticker: 'أهلًا' });
        const seen = [];
        const stop = repo.watchSiteConfig((c) => seen.push(c));
        await new Promise((r) => setTimeout(r, 150));
        assert.ok(seen.length >= 1, 'the watcher was called at least once');
        assert.equal(typeof stop, 'function', 'watch returns an unsubscribe function');
        stop();
      });
    });

    describe('catalog', () => {
      test('an unsaved catalog reads as null', async () => {
        assert.equal(await repo.getCatalog(), null);
      });

      test('a saved catalog reads back with its categories', async () => {
        await repo.saveCatalog({ categories: { facebook: { title: 'فيسبوك' } } });
        const cat = await repo.getCatalog();
        assert.equal(cat.categories.facebook.title, 'فيسبوك');
      });
    });

    describe('orders', () => {
      test('creating returns an id and the order reads back', async () => {
        const { id } = await repo.createOrder(order());
        assert.ok(id, 'an id was returned');
        const got = await repo.getOrder(id);
        assert.equal(got.orderNo, 'EL-10001');
        assert.equal(got.status, 'new');
      });

      test('a missing order reads as null rather than throwing', async () => {
        assert.equal(await repo.getOrder('does-not-exist'), null);
      });

      test('createdAt crosses the port as a string, never a vendor timestamp', async () => {
        const { id } = await repo.createOrder(order());
        const got = await repo.getOrder(id);
        assert.equal(typeof got.createdAt, 'string',
          'createdAt must be portable — an ISO string, not a Timestamp');
        assert.ok(!Number.isNaN(Date.parse(got.createdAt)), 'createdAt parses as a date');
      });

      test('a listing pages and reports a cursor', async () => {
        for (let i = 0; i < 5; i++) {
          await repo.createOrder(order({ orderNo: `EL-2000${i}` }));
        }
        const first = await repo.listOrders({ limit: 2 });
        assert.equal(first.items.length, 2);
        assert.ok(first.cursor, 'a cursor is returned when more remain');

        const second = await repo.listOrders({ limit: 2, cursor: first.cursor });
        assert.equal(second.items.length, 2);
        const ids = new Set([...first.items, ...second.items].map((o) => o.id));
        assert.equal(ids.size, 4, 'pages do not overlap');
      });

      test('a listing filters by uid', async () => {
        await repo.createOrder(order({ uid: 'u1', orderNo: 'EL-A' }));
        await repo.createOrder(order({ uid: 'u2', orderNo: 'EL-B' }));
        const mine = await repo.listOrders({ uid: 'u1' });
        assert.equal(mine.items.length, 1);
        assert.equal(mine.items[0].orderNo, 'EL-A');
      });

      test('updating changes only what was patched', async () => {
        const { id } = await repo.createOrder(order());
        await repo.updateOrder(id, { status: 'completed' });
        const got = await repo.getOrder(id);
        assert.equal(got.status, 'completed');
        assert.equal(got.orderNo, 'EL-10001', 'untouched fields survive');
      });

      test('an invalid order is rejected with a portable code', async () => {
        await rejectsWithCode(repo.createOrder({}), ERROR_CODES.INVALID);
      });
    });

    describe('reviews', () => {
      test('a created review is never approved on arrival', async () => {
        const { id } = await repo.createReview({ name: 'عميل', text: 'ممتاز', rating: 5, approved: true });
        const pending = await repo.listReviews({ approved: false });
        assert.ok(pending.items.some((r) => r.id === id), 'it landed in the pending list');
        assert.equal(pending.items.find((r) => r.id === id).approved, false);
      });

      test('approving moves it into the approved listing', async () => {
        const { id } = await repo.createReview({ name: 'عميل', text: 'ممتاز', rating: 5 });
        await repo.updateReview(id, { approved: true });
        const approved = await repo.listReviews({ approved: true });
        assert.ok(approved.items.some((r) => r.id === id));
      });
    });

    describe('users', () => {
      test('a missing user reads as null', async () => {
        assert.equal(await repo.getUser('nobody'), null);
      });

      test('saving then reading round-trips, and merges', async () => {
        await repo.saveUser('u1', { name: 'أحمد', role: 'user' });
        await repo.saveUser('u1', { phone: '0100' });
        const u = await repo.getUser('u1');
        assert.equal(u.name, 'أحمد');
        assert.equal(u.phone, '0100');
      });

      test('saving without a uid is rejected', async () => {
        await rejectsWithCode(repo.saveUser('', { name: 'x' }), ERROR_CODES.INVALID);
      });
    });

    describe('customers', () => {
      test('creating returns an id', async () => {
        const { id } = await repo.createCustomer({ name: 'أحمد', phone: '0100', source: 'order' });
        assert.ok(id);
      });
    });

    describe('announcements', () => {
      test('listing returns items and a cursor field', async () => {
        const res = await repo.listAnnouncements({ limit: 5 });
        assert.ok(Array.isArray(res.items));
        assert.ok('cursor' in res);
      });

      test('watchAnnouncements returns an unsubscribe function', async () => {
        const stop = repo.watchAnnouncements(() => {});
        assert.equal(typeof stop, 'function');
        stop();
      });
    });

    describe('portability', () => {
      test('nothing returned carries a vendor object', async () => {
        const { id } = await repo.createOrder(order());
        const got = await repo.getOrder(id);
        // A structured clone proves the value is plain JSON-serialisable data.
        assert.doesNotThrow(() => structuredClone(got),
          'values crossing the port must be plain data');
        assert.equal(JSON.parse(JSON.stringify(got)).orderNo, 'EL-10001');
      });
    });
  });
}
