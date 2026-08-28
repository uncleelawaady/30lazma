// ===== In-memory adapters =====
//
// A complete, dependency-free implementation of all three ports. It exists for
// two reasons: the contract suite runs against it with no emulator, and it is
// the reference showing what a future MySQL / custom-auth / S3 adapter has to
// do. If something is hard to express here, it is leaking vendor detail.

import {
  RepositoryError, AuthError, StorageError, ERROR_CODES, UPLOAD_LIMITS,
} from '../../ports/index.js';
import { assertOrderShape } from '../../core/orders.js';

const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
const nowIso = () => new Date().toISOString();

let seq = 0;
const nextId = (prefix) => `${prefix}_${String(++seq).padStart(6, '0')}`;

// ---------------------------------------------------------------- repository

export function createMemoryRepository(seed = {}) {
  const db = {
    config: clone(seed.config) || {},
    catalog: clone(seed.catalog) || null,
    orders: new Map(),
    reviews: new Map(),
    customers: new Map(),
    users: new Map(),
    announcements: new Map(),
  };
  for (const [k, v] of Object.entries(seed.users || {})) db.users.set(k, clone(v));
  for (const o of seed.orders || []) db.orders.set(o.id || nextId('ord'), clone(o));

  const configWatchers = new Set();
  const annWatchers = new Set();

  /** Newest-first page over a Map, with an opaque offset cursor. */
  function page(map, { limit = 50, cursor = null, filter = null } = {}) {
    let items = [...map.values()];
    if (filter) items = items.filter(filter);
    items.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    const start = cursor ? Number(cursor) || 0 : 0;
    const slice = items.slice(start, start + limit);
    const next = start + limit < items.length ? String(start + limit) : null;
    return { items: clone(slice), cursor: next };
  }

  function require(map, id, what) {
    const found = map.get(id);
    if (!found) throw new RepositoryError(ERROR_CODES.NOT_FOUND, `${what} ${id} not found`);
    return found;
  }

  return {
    // --- config
    async getSiteConfig() { return clone(db.config); },
    watchSiteConfig(cb) {
      configWatchers.add(cb);
      Promise.resolve().then(() => cb(clone(db.config)));
      return () => configWatchers.delete(cb);
    },
    async saveSiteConfig(patch) {
      if (patch == null || typeof patch !== 'object') {
        throw new RepositoryError(ERROR_CODES.INVALID, 'site config must be an object');
      }
      db.config = { ...db.config, ...clone(patch) };
      configWatchers.forEach((cb) => cb(clone(db.config)));
    },

    // --- catalog
    async getCatalog() { return clone(db.catalog); },
    async saveCatalog(catalog) {
      if (!catalog || typeof catalog !== 'object') {
        throw new RepositoryError(ERROR_CODES.INVALID, 'catalog must be an object');
      }
      db.catalog = clone(catalog);
    },

    // --- orders
    async createOrder(order) {
      assertOrderShape(order);
      const id = nextId('ord');
      db.orders.set(id, { ...clone(order), id, createdAt: order.createdAt || nowIso() });
      return { id };
    },
    async getOrder(id) { return clone(db.orders.get(id)) || null; },
    async listOrders({ limit, cursor, uid } = {}) {
      return page(db.orders, { limit, cursor, filter: uid ? (o) => o.uid === uid : null });
    },
    async updateOrder(id, patch) {
      const cur = require(db.orders, id, 'order');
      db.orders.set(id, { ...cur, ...clone(patch), id });
    },

    // --- reviews
    async createReview(review) {
      const id = nextId('rev');
      db.reviews.set(id, {
        ...clone(review), id, approved: false, createdAt: review?.createdAt || nowIso(),
      });
      return { id };
    },
    async listReviews({ approved, limit, cursor } = {}) {
      const filter = approved === undefined ? null : (r) => !!r.approved === !!approved;
      return page(db.reviews, { limit, cursor, filter });
    },
    async updateReview(id, patch) {
      const cur = require(db.reviews, id, 'review');
      db.reviews.set(id, { ...cur, ...clone(patch), id });
    },

    // --- customers
    async createCustomer(customer) {
      const id = nextId('cus');
      db.customers.set(id, { ...clone(customer), id, createdAt: customer?.createdAt || nowIso() });
      return { id };
    },

    // --- users
    async getUser(uid) { return clone(db.users.get(uid)) || null; },
    async saveUser(uid, patch) {
      if (!uid) throw new RepositoryError(ERROR_CODES.INVALID, 'uid is required');
      const cur = db.users.get(uid) || { id: uid, role: 'user', createdAt: nowIso() };
      db.users.set(uid, { ...cur, ...clone(patch), id: uid });
    },
    async listUsers({ limit, cursor } = {}) { return page(db.users, { limit, cursor }); },

    // --- announcements
    async listAnnouncements({ limit } = {}) { return page(db.announcements, { limit }); },
    watchAnnouncements(cb, { limit = 20 } = {}) {
      annWatchers.add(cb);
      Promise.resolve().then(() => cb(page(db.announcements, { limit }).items));
      return () => annWatchers.delete(cb);
    },

    /** Test-only seam; not part of the port. */
    _seedAnnouncement(a) {
      const id = nextId('ann');
      db.announcements.set(id, { ...clone(a), id, createdAt: a?.createdAt || nowIso() });
      annWatchers.forEach((cb) => cb(page(db.announcements, { limit: 20 }).items));
      return { id };
    },
  };
}

// ---------------------------------------------------------------------- auth

export function createMemoryAuth(seed = {}) {
  const accounts = new Map();          // email -> { password, user }
  const resets = [];                   // emails a reset was sent to
  let current = seed.currentUser ? { ...seed.currentUser } : null;
  const watchers = new Set();

  for (const a of seed.accounts || []) {
    accounts.set(a.email, { password: a.password, user: toUser(a) });
  }

  function toUser(a) {
    return {
      id: a.id || nextId('usr'),
      email: a.email || '',
      emailVerified: a.emailVerified !== false,
      name: a.name || '',
      photo: a.photo || '',
      provider: a.provider || 'password',
    };
  }

  function emit() { watchers.forEach((cb) => cb(current ? { ...current } : null)); }

  return {
    currentUser() { return current ? { ...current } : null; },
    onChange(cb) {
      watchers.add(cb);
      Promise.resolve().then(() => cb(current ? { ...current } : null));
      return () => watchers.delete(cb);
    },
    async registerWithPassword({ email, password, name } = {}) {
      if (!email || !password) {
        throw new AuthError(ERROR_CODES.INVALID, 'email and password are required');
      }
      if (accounts.has(email)) {
        throw new AuthError(ERROR_CODES.CONFLICT, 'that email is already registered');
      }
      const user = toUser({ email, name, emailVerified: false });
      accounts.set(email, { password, user });
      current = user; emit();
      return { ...user };
    },
    async signInWithPassword({ email, password } = {}) {
      const acc = accounts.get(email);
      if (!acc || acc.password !== password) {
        throw new AuthError(ERROR_CODES.UNAUTHENTICATED, 'wrong email or password');
      }
      current = acc.user; emit();
      return { ...acc.user };
    },
    async signInWithProvider(provider) {
      if (!['google', 'facebook'].includes(provider)) {
        throw new AuthError(ERROR_CODES.INVALID, `unknown provider: ${provider}`);
      }
      const user = toUser({ email: `${provider}@example.com`, provider, emailVerified: true });
      accounts.set(user.email, { password: null, user });
      current = user; emit();
      return { ...user };
    },
    async sendPasswordReset(email) {
      if (!email) throw new AuthError(ERROR_CODES.INVALID, 'email is required');
      resets.push(email);
    },
    async signOut() { current = null; emit(); },

    /** Test-only seam; not part of the port. */
    _resetsSentTo() { return [...resets]; },
  };
}

// ------------------------------------------------------------------- storage

export function createMemoryStorage() {
  const files = new Map();

  return {
    async upload({ folder, name, data, contentType } = {}) {
      if (!UPLOAD_LIMITS.folders.includes(folder)) {
        throw new StorageError(ERROR_CODES.PERMISSION_DENIED, `folder not allowed: ${folder}`);
      }
      if (!UPLOAD_LIMITS.imageTypes.includes(contentType)) {
        throw new StorageError(ERROR_CODES.UNSUPPORTED_TYPE, `type not allowed: ${contentType}`);
      }
      const size = data?.byteLength ?? data?.length ?? 0;
      if (size > UPLOAD_LIMITS.maxBytes) {
        throw new StorageError(ERROR_CODES.TOO_LARGE, `file is larger than ${UPLOAD_LIMITS.maxBytes} bytes`);
      }
      const path = `${folder}/${name || nextId('file')}`;
      files.set(path, { contentType, size });
      return { path, url: `memory://${path}` };
    },
    async remove(path) {
      if (!files.has(path)) throw new StorageError(ERROR_CODES.NOT_FOUND, `no file at ${path}`);
      files.delete(path);
    },
    async urlFor(path) {
      if (!files.has(path)) throw new StorageError(ERROR_CODES.NOT_FOUND, `no file at ${path}`);
      return `memory://${path}`;
    },
  };
}
