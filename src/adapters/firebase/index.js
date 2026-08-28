// ===== Firebase adapters =====
//
// The ONLY place in the project that knows Firebase exists. Everything above it
// talks to the ports. Replacing this directory with `src/adapters/mysql/` and
// `src/adapters/s3/` is the whole migration.
//
// The SDK is injected rather than imported, so the same file serves the browser
// (which loads the SDK from the CDN) and the tests (which load it from npm and
// point it at the emulator).

import {
  RepositoryError, AuthError, StorageError, ERROR_CODES, UPLOAD_LIMITS,
} from '../../ports/index.js';
import { assertOrderShape } from '../../core/orders.js';

// ---- vendor error translation -------------------------------------------

// Vendor codes must not escape this file — callers branch on ERROR_CODES.
const CODE_MAP = {
  'permission-denied': ERROR_CODES.PERMISSION_DENIED,
  'not-found': ERROR_CODES.NOT_FOUND,
  'already-exists': ERROR_CODES.CONFLICT,
  'invalid-argument': ERROR_CODES.INVALID,
  unavailable: ERROR_CODES.UNAVAILABLE,
  unauthenticated: ERROR_CODES.UNAUTHENTICATED,
  'auth/invalid-email': ERROR_CODES.INVALID,
  'auth/missing-password': ERROR_CODES.INVALID,
  'auth/weak-password': ERROR_CODES.INVALID,
  'auth/email-already-in-use': ERROR_CODES.CONFLICT,
  'auth/invalid-credential': ERROR_CODES.UNAUTHENTICATED,
  'auth/wrong-password': ERROR_CODES.UNAUTHENTICATED,
  'auth/user-not-found': ERROR_CODES.UNAUTHENTICATED,
  'storage/unauthorized': ERROR_CODES.PERMISSION_DENIED,
  'storage/object-not-found': ERROR_CODES.NOT_FOUND,
  'storage/quota-exceeded': ERROR_CODES.TOO_LARGE,
};

function translate(ErrorClass, err) {
  const raw = String(err?.code || '').replace(/^firestore\//, '');
  return new ErrorClass(CODE_MAP[raw] || ERROR_CODES.UNAVAILABLE, err?.message || String(err), err);
}

const wrap = (ErrorClass) => async (fn) => {
  try { return await fn(); } catch (err) {
    if (err?.code && Object.values(ERROR_CODES).includes(err.code)) throw err;
    throw translate(ErrorClass, err);
  }
};
const repoCall = wrap(RepositoryError);
const authCall = wrap(AuthError);
const storeCall = wrap(StorageError);

// ---- shape translation ---------------------------------------------------

/** Firestore Timestamps must not cross the port — dates leave as ISO strings. */
function toPlain(value) {
  if (value == null) return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(toPlain);
  if (typeof value === 'object' && value.constructor === Object) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toPlain(v)]));
  }
  return value;
}

const docToItem = (snap) => ({ id: snap.id, ...toPlain(snap.data()) });

// ---------------------------------------------------------------- repository

/**
 * @param {object} deps  the Firestore SDK surface, injected:
 *   { db, doc, getDoc, setDoc, updateDoc, addDoc, collection, query,
 *     where, orderBy, limit, startAfter, getDocs, onSnapshot, serverTimestamp }
 */
export function createFirebaseRepository(deps) {
  const {
    db, doc, getDoc, setDoc, updateDoc, addDoc, collection,
    query, where, orderBy, limit: qLimit, startAfter, getDocs, onSnapshot, serverTimestamp,
  } = deps;

  // Cursors are opaque to callers, so the vendor snapshot stays on this side.
  const cursors = new Map();
  let cursorSeq = 0;

  async function listing(name, { limit = 50, cursor = null, constraints = [] } = {}) {
    return repoCall(async () => {
      const parts = [...constraints, orderBy('createdAt', 'desc'), qLimit(limit)];
      if (cursor && cursors.has(cursor)) parts.push(startAfter(cursors.get(cursor)));
      const snap = await getDocs(query(collection(db, name), ...parts));
      const items = snap.docs.map(docToItem);
      let next = null;
      if (snap.docs.length === limit) {
        next = `c${++cursorSeq}`;
        cursors.set(next, snap.docs[snap.docs.length - 1]);
      }
      return { items, cursor: next };
    });
  }

  async function readDoc(path, id) {
    return repoCall(async () => {
      const snap = await getDoc(doc(db, path, id));
      return snap.exists() ? docToItem(snap) : null;
    });
  }

  return {
    // --- config
    async getSiteConfig() { return readDoc('config', 'site'); },
    watchSiteConfig(cb) {
      return onSnapshot(doc(db, 'config', 'site'),
        (snap) => cb(snap.exists() ? toPlain(snap.data()) : null),
        () => cb(null));
    },
    async saveSiteConfig(patch) {
      return repoCall(() => setDoc(doc(db, 'config', 'site'), patch, { merge: true }));
    },

    // --- catalog
    async getCatalog() {
      const d = await readDoc('config', 'catalog');
      return d ? { categories: d.categories || null } : null;
    },
    async saveCatalog(catalog) {
      return repoCall(() => setDoc(doc(db, 'config', 'catalog'), catalog, { merge: true }));
    },

    // --- orders
    async createOrder(order) {
      assertOrderShape(order);
      return repoCall(async () => {
        const ref = await addDoc(collection(db, 'orders'),
          { ...order, createdAt: serverTimestamp() });
        return { id: ref.id };
      });
    },
    async getOrder(id) { return readDoc('orders', id); },
    async listOrders({ limit, cursor, uid } = {}) {
      return listing('orders', {
        limit, cursor, constraints: uid ? [where('uid', '==', uid)] : [],
      });
    },
    async updateOrder(id, patch) {
      return repoCall(() => updateDoc(doc(db, 'orders', id), patch));
    },

    // --- reviews
    async createReview(review) {
      return repoCall(async () => {
        const ref = await addDoc(collection(db, 'reviews'),
          { ...review, approved: false, createdAt: serverTimestamp() });
        return { id: ref.id };
      });
    },
    async listReviews({ approved, limit, cursor } = {}) {
      return listing('reviews', {
        limit, cursor,
        constraints: approved === undefined ? [] : [where('approved', '==', !!approved)],
      });
    },
    async updateReview(id, patch) {
      return repoCall(() => updateDoc(doc(db, 'reviews', id), patch));
    },

    // --- customers
    async createCustomer(customer) {
      return repoCall(async () => {
        const ref = await addDoc(collection(db, 'customers'),
          { ...customer, createdAt: serverTimestamp() });
        return { id: ref.id };
      });
    },

    // --- users
    async getUser(uid) { return readDoc('users', uid); },
    async saveUser(uid, patch) {
      return repoCall(() => setDoc(doc(db, 'users', uid), patch, { merge: true }));
    },
    async listUsers({ limit, cursor } = {}) { return listing('users', { limit, cursor }); },

    // --- announcements
    async listAnnouncements({ limit } = {}) { return listing('announcements', { limit }); },
    watchAnnouncements(cb, { limit = 20 } = {}) {
      const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), qLimit(limit));
      return onSnapshot(q, (snap) => cb(snap.docs.map(docToItem)), () => cb([]));
    },
  };
}

// ---------------------------------------------------------------------- auth

/**
 * @param {object} deps  the Auth SDK surface, injected:
 *   { auth, onAuthStateChanged, createUserWithEmailAndPassword,
 *     signInWithEmailAndPassword, signInWithPopup, signOut,
 *     sendPasswordResetEmail, updateProfile, GoogleAuthProvider,
 *     FacebookAuthProvider }
 */
export function createFirebaseAuth(deps) {
  const {
    auth, onAuthStateChanged, createUserWithEmailAndPassword,
    signInWithEmailAndPassword, signInWithPopup, signOut: fbSignOut,
    sendPasswordResetEmail, updateProfile, GoogleAuthProvider, FacebookAuthProvider,
  } = deps;

  /** The portable user shape. A vendor User object never leaves this function. */
  const toUser = (u) => (u ? {
    id: u.uid,
    email: u.email || '',
    emailVerified: !!u.emailVerified,
    name: u.displayName || '',
    photo: u.photoURL || '',
    provider: u.providerData?.[0]?.providerId || 'password',
  } : null);

  const PROVIDERS = { google: GoogleAuthProvider, facebook: FacebookAuthProvider };

  return {
    currentUser() { return toUser(auth.currentUser); },
    onChange(cb) { return onAuthStateChanged(auth, (u) => cb(toUser(u))); },

    async registerWithPassword({ email, password, name } = {}) {
      return authCall(async () => {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (name) await updateProfile(cred.user, { displayName: name });
        return toUser(cred.user);
      });
    },
    async signInWithPassword({ email, password } = {}) {
      return authCall(async () =>
        toUser((await signInWithEmailAndPassword(auth, email, password)).user));
    },
    async signInWithProvider(provider) {
      const Provider = PROVIDERS[provider];
      if (!Provider) throw new AuthError(ERROR_CODES.INVALID, `unknown provider: ${provider}`);
      return authCall(async () => toUser((await signInWithPopup(auth, new Provider())).user));
    },
    async sendPasswordReset(email) {
      return authCall(() => sendPasswordResetEmail(auth, email));
    },
    async signOut() { return authCall(() => fbSignOut(auth)); },
  };
}

// ------------------------------------------------------------------- storage

/**
 * @param {object} deps  the Storage SDK surface, injected:
 *   { storage, ref, uploadBytes, getDownloadURL, deleteObject }
 */
export function createFirebaseStorage(deps) {
  const { storage, ref, uploadBytes, getDownloadURL, deleteObject } = deps;

  return {
    async upload({ folder, name, data, contentType } = {}) {
      // Validated here as well as in storage.rules: the rules are the security
      // boundary, this is the fast, legible failure for the dashboard.
      if (!UPLOAD_LIMITS.folders.includes(folder)) {
        throw new StorageError(ERROR_CODES.PERMISSION_DENIED, `folder not allowed: ${folder}`);
      }
      if (!UPLOAD_LIMITS.imageTypes.includes(contentType)) {
        throw new StorageError(ERROR_CODES.UNSUPPORTED_TYPE, `type not allowed: ${contentType}`);
      }
      const size = data?.byteLength ?? data?.size ?? data?.length ?? 0;
      if (size > UPLOAD_LIMITS.maxBytes) {
        throw new StorageError(ERROR_CODES.TOO_LARGE,
          `file is larger than ${UPLOAD_LIMITS.maxBytes} bytes`);
      }
      return storeCall(async () => {
        const path = `${folder}/${name || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
        const snap = await uploadBytes(ref(storage, path), data, { contentType });
        return { path, url: await getDownloadURL(snap.ref) };
      });
    },
    async remove(path) { return storeCall(() => deleteObject(ref(storage, path))); },
    async urlFor(path) { return storeCall(() => getDownloadURL(ref(storage, path))); },
  };
}
