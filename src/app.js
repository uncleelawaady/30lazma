// ===== Composition root =====
//
// The one place that decides which infrastructure the store runs on. Pages ask
// for `repo`, `auth` and `storage` and get whatever is wired here — Firebase
// today, a REST client against a Node backend on a VPS tomorrow.
//
// A page must never import from `src/adapters/` directly. If it does, the
// migration stops being a one-file change.

import {
  assertImplements, REPOSITORY_PORT, AUTH_PORT, STORAGE_PORT, PortError, ERROR_CODES,
} from './ports/index.js';
import * as Services from './core/services.js';

const FIREBASE_SDK_VERSION = '10.12.0';
const cdn = (mod) => `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-${mod}.js`;

let started = null;

/**
 * Build the application services.
 *
 * @param {object} [options]
 * @param {'firebase'|'memory'} [options.backend]  defaults to `firebase`
 * @param {object} [options.config]  Firebase web config; defaults to
 *        `window.FIREBASE_CONFIG` as the existing pages already provide it
 * @param {object} [options.adapters] pre-built adapters, for tests
 */
export async function start(options = {}) {
  const backend = options.backend
    || (typeof window !== 'undefined' && window.APP_BACKEND)
    || 'firebase';

  const built = options.adapters
    ? options.adapters
    : backend === 'memory'
      ? await buildMemory()
      : await buildFirebase(options.config);

  const app = {
    backend,
    repo: assertImplements(built.repo, REPOSITORY_PORT, `${backend} repository`),
    auth: assertImplements(built.auth, AUTH_PORT, `${backend} auth`),
    storage: assertImplements(built.storage, STORAGE_PORT, `${backend} storage`),
    Services,
  };

  if (typeof window !== 'undefined') window.App = app;
  return app;
}

/** Idempotent: every page can call this without racing the others. */
export function getApp(options) {
  if (!started) started = start(options);
  return started;
}

/** Test seam — drop the memoised instance. */
export function resetApp() { started = null; }

// ---- backends ------------------------------------------------------------

async function buildMemory() {
  const { createMemoryRepository, createMemoryAuth, createMemoryStorage } =
    await import('./adapters/memory/index.js');
  return {
    repo: createMemoryRepository(),
    auth: createMemoryAuth(),
    storage: createMemoryStorage(),
  };
}

async function buildFirebase(explicitConfig) {
  const config = explicitConfig
    || (typeof window !== 'undefined' ? window.FIREBASE_CONFIG : null);
  if (!config?.apiKey) {
    throw new PortError(ERROR_CODES.INVALID,
      'Firebase config is missing — firebase-config.js must load before the app');
  }

  const [appMod, storeMod, authMod, fileMod, adapters] = await Promise.all([
    import(/* @vite-ignore */ cdn('app')),
    import(/* @vite-ignore */ cdn('firestore')),
    import(/* @vite-ignore */ cdn('auth')),
    import(/* @vite-ignore */ cdn('storage')),
    import('./adapters/firebase/index.js'),
  ]);

  // One Firebase app per page, reused if a legacy script already made it.
  const existing = appMod.getApps().find((a) => a.name === 'elwaset');
  const fbApp = existing || appMod.initializeApp(config, 'elwaset');

  return {
    repo: adapters.createFirebaseRepository({
      db: storeMod.getFirestore(fbApp),
      doc: storeMod.doc, getDoc: storeMod.getDoc, setDoc: storeMod.setDoc,
      updateDoc: storeMod.updateDoc, addDoc: storeMod.addDoc,
      collection: storeMod.collection, query: storeMod.query, where: storeMod.where,
      orderBy: storeMod.orderBy, limit: storeMod.limit, startAfter: storeMod.startAfter,
      getDocs: storeMod.getDocs, onSnapshot: storeMod.onSnapshot,
      serverTimestamp: storeMod.serverTimestamp,
    }),
    auth: adapters.createFirebaseAuth({
      auth: authMod.getAuth(fbApp),
      onAuthStateChanged: authMod.onAuthStateChanged,
      createUserWithEmailAndPassword: authMod.createUserWithEmailAndPassword,
      signInWithEmailAndPassword: authMod.signInWithEmailAndPassword,
      signInWithPopup: authMod.signInWithPopup,
      signOut: authMod.signOut,
      sendPasswordResetEmail: authMod.sendPasswordResetEmail,
      updateProfile: authMod.updateProfile,
      GoogleAuthProvider: authMod.GoogleAuthProvider,
      FacebookAuthProvider: authMod.FacebookAuthProvider,
    }),
    storage: adapters.createFirebaseStorage({
      storage: fileMod.getStorage(fbApp),
      ref: fileMod.ref, uploadBytes: fileMod.uploadBytes,
      getDownloadURL: fileMod.getDownloadURL, deleteObject: fileMod.deleteObject,
    }),
  };
}
