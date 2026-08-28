// ===== Ports — the contracts between the store and its infrastructure =====
//
// The store talks to these interfaces and never to a vendor SDK. Firestore,
// Firebase Auth and Firebase Storage sit behind them today; MySQL, a custom
// auth provider and object storage on a VPS can sit behind them tomorrow
// without a line of business logic changing.
//
// Rules for anything implementing a port:
//   1. Speak the domain, not the vendor. `listOrders({ limit })`, never
//      `collection(db, 'orders')`. No vendor type ever crosses this boundary.
//   2. Return plain JSON-serialisable objects. No DocumentSnapshot, no Timestamp
//      — dates cross as ISO strings.
//   3. Throw `RepositoryError` / `AuthError` / `StorageError`, never a raw
//      vendor error, so callers can branch on `err.code` portably.
//   4. Every adapter must pass the shared contract suite in tests/contract/.
//      That suite is the definition of correct; a new adapter is done when it
//      goes green.

// ---- portable errors ----------------------------------------------------

export class PortError extends Error {
  constructor(code, message, cause) {
    super(message || code);
    this.name = this.constructor.name;
    this.code = code;
    if (cause) this.cause = cause;
  }
}
export class RepositoryError extends PortError {}
export class AuthError extends PortError {}
export class StorageError extends PortError {}

/** Codes an adapter may raise. Callers branch on these, never on vendor codes. */
export const ERROR_CODES = Object.freeze({
  NOT_FOUND: 'not_found',
  PERMISSION_DENIED: 'permission_denied',
  INVALID: 'invalid',
  CONFLICT: 'conflict',
  UNAVAILABLE: 'unavailable',
  UNAUTHENTICATED: 'unauthenticated',
  TOO_LARGE: 'too_large',
  UNSUPPORTED_TYPE: 'unsupported_type',
});

// ---- the contracts ------------------------------------------------------
//
// Declared as method-name lists rather than abstract classes: an adapter is
// just an object, and `assertImplements` checks it at composition time, so a
// half-finished adapter fails loudly at startup instead of at the first click.

export const REPOSITORY_PORT = Object.freeze([
  // storefront configuration
  'getSiteConfig',      // () -> object|null
  'watchSiteConfig',    // (cb) -> unsubscribe fn
  'saveSiteConfig',     // (patch) -> void
  // catalog
  'getCatalog',         // () -> { categories } | null
  'saveCatalog',        // (catalog) -> void
  // orders
  'createOrder',        // (order) -> { id }
  'getOrder',           // (id) -> order|null
  'listOrders',         // ({ limit, cursor, uid }) -> { items, cursor }
  'updateOrder',        // (id, patch) -> void
  // reviews
  'createReview',       // (review) -> { id }
  'listReviews',        // ({ approved, limit }) -> { items, cursor }
  'updateReview',       // (id, patch) -> void
  // customers & users
  'createCustomer',     // (customer) -> { id }
  'getUser',            // (uid) -> user|null
  'saveUser',           // (uid, patch) -> void
  'listUsers',          // ({ limit, cursor }) -> { items, cursor }
  // announcements
  'listAnnouncements',  // ({ limit }) -> { items, cursor }
  'watchAnnouncements', // (cb, { limit }) -> unsubscribe fn
]);

export const AUTH_PORT = Object.freeze([
  'currentUser',          // () -> AuthUser|null
  'onChange',             // (cb) -> unsubscribe fn
  'registerWithPassword', // ({ email, password, name }) -> AuthUser
  'signInWithPassword',   // ({ email, password }) -> AuthUser
  'signInWithProvider',   // ('google'|'facebook') -> AuthUser
  'sendPasswordReset',    // (email) -> void
  'signOut',              // () -> void
]);

export const STORAGE_PORT = Object.freeze([
  'upload',   // ({ folder, name, data, contentType }) -> { path, url }
  'remove',   // (path) -> void
  'urlFor',   // (path) -> Promise<string>
]);

/**
 * An `AuthUser` as it crosses the boundary. Deliberately small: no vendor
 * token, no provider object, nothing a MySQL-backed auth layer could not also
 * produce.
 *
 * @typedef {{ id: string, email: string, emailVerified: boolean,
 *             name: string, photo: string, provider: string }} AuthUser
 */

/** Limits every storage adapter enforces, mirroring storage.rules. */
export const UPLOAD_LIMITS = Object.freeze({
  maxBytes: 5 * 1024 * 1024,
  imageTypes: Object.freeze([
    'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif',
    'image/avif', 'image/svg+xml',
  ]),
  folders: Object.freeze(['store', 'categories', 'services', 'banners', 'media']),
});

/**
 * Fail fast when an adapter is missing part of its port.
 * Called by the composition root so a bad wiring never reaches a user.
 */
export function assertImplements(adapter, port, label) {
  const missing = port.filter((m) => typeof adapter?.[m] !== 'function');
  if (missing.length) {
    throw new PortError(
      ERROR_CODES.INVALID,
      `${label} does not implement its port — missing: ${missing.join(', ')}`,
    );
  }
  return adapter;
}
