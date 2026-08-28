# Architecture — built to leave Firebase without a rewrite

Firebase is the backend today. The point of this layout is that it does not have
to be. Moving to a Node backend on Hostinger/VPS with MySQL or PostgreSQL means
writing one new directory and changing one line — not rebuilding the store.

---

## The layers

```
┌───────────────────────────────────────────────────────────────┐
│  Pages          index · category · service · checkout · admin │
│                 render + wire events, no vendor calls         │
└──────────────────────────────┬────────────────────────────────┘
                               │  app.repo / app.auth / app.storage
┌──────────────────────────────▼────────────────────────────────┐
│  src/app.js — composition root                                │
│  the ONLY file that picks an implementation                   │
└──────────────────────────────┬────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
┌───────▼────────┐   ┌─────────▼────────┐   ┌─────────▼────────┐
│  src/ports/    │   │  src/core/       │   │  src/adapters/   │
│  the contracts │◄──┤  business logic  │   │  the vendors     │
│  vendor-neutral│   │  pure, testable  │   │  firebase/       │
│                │   │  no I/O at all   │   │  memory/         │
└────────────────┘   └──────────────────┘   └──────────────────┘
```

| Layer | Directory | May depend on | Never contains |
| --- | --- | --- | --- |
| **Business logic** | `src/core/` | `src/ports/` (for error types only) | Any vendor, any I/O, any DOM |
| **Contracts** | `src/ports/` | nothing | Any vendor name, in code |
| **Adapters** | `src/adapters/<vendor>/` | `src/core/`, `src/ports/` | Business rules |
| **Composition** | `src/app.js` | everything | Business rules |
| **Pages** | `*.html` | `src/app.js` only | Any vendor call, any adapter import |

### The four separations that were asked for

| Concern | Contract | Firebase today | After migration |
| --- | --- | --- | --- |
| **Business Logic** | `src/core/` | *(vendor-free already)* | **unchanged** |
| **Database Access** | `REPOSITORY_PORT` | `createFirebaseRepository` | `createMysqlRepository` |
| **Authentication** | `AUTH_PORT` | `createFirebaseAuth` | `createJwtAuth` |
| **Storage** | `STORAGE_PORT` | `createFirebaseStorage` | `createS3Storage` |

---

## The rules that keep it migratable

These are **enforced by tests**, not by good intentions
(`tests/unit/app.test.mjs` → `layer boundaries`):

1. `src/core/**` may not name a vendor or import an adapter.
2. `src/ports/index.js` may not name a vendor in code.
3. Only `src/adapters/firebase/**` and `src/app.js` may mention Firebase at all.
4. A page imports `src/app.js` — never an adapter.

Break one and the suite goes red.

Two more rules, enforced by the contract suite:

5. **No vendor type crosses a port.** A Firestore `Timestamp` becomes an ISO
   string; a `DocumentSnapshot` becomes a plain object. There is a test that
   `structuredClone`s everything a repository returns.
6. **No vendor error escapes an adapter.** `permission-denied`,
   `auth/wrong-password` and `storage/object-not-found` are translated to
   `ERROR_CODES.PERMISSION_DENIED`, `UNAUTHENTICATED`, `NOT_FOUND`. Callers
   branch on those and keep working under any backend.

---

## The contract suite is the migration guarantee

`tests/contract/repository.contract.mjs` is written against the port alone. It
runs twice today:

| Adapter | Runner | Needs |
| --- | --- | --- |
| in-memory | `npm run test:unit` | nothing |
| Firebase | `npm run test:rules` | the Firebase emulator |

A MySQL adapter is **finished** when it goes green in that same suite. Nothing
else has to be re-verified, because nothing else knows which adapter it is
talking to.

```js
// tests/contract/mysql.test.mjs — the whole of a new adapter's test file
import { runRepositoryContract } from './repository.contract.mjs';
import { createMysqlRepository } from '../../src/adapters/mysql/index.js';

runRepositoryContract('mysql', async () => {
  await resetTestDatabase();
  return { repo: createMysqlRepository(pool) };
});
```

---

## How each migration actually happens

### Firestore → MySQL / PostgreSQL

1. Write `src/adapters/mysql/index.js` exporting `createMysqlRepository(pool)`.
2. Add `tests/contract/mysql.test.mjs` (the five lines above). Make it green.
3. In `src/app.js`, add a `mysql` branch to the backend switch.
4. Flip `window.APP_BACKEND`.

The schema follows from the port: `orders`, `reviews`, `customers`, `users`,
`announcements` are tables; `config`/`catalog` are documents, so a
`config(key, json)` table. Cursor paging is already in the port
(`{ limit, cursor }`), so `LIMIT`/`OFFSET` or keyset paging both fit.

### Firebase Auth → a custom provider

Implement `AUTH_PORT`. The `AuthUser` shape crossing the boundary is
`{ id, email, emailVerified, name, photo, provider }` — deliberately small
enough for any provider to produce. There is a test asserting exactly those keys
and nothing more.

### Firebase Storage → VPS / object storage

Implement `STORAGE_PORT` (`upload`, `remove`, `urlFor`). `UPLOAD_LIMITS` in
`src/ports/` holds the 5 MB cap, the image content types and the folder
allowlist, so every adapter enforces the same policy. Today `storage.rules`
enforces it a second time server-side; after migration that job moves to the
Node backend.

### Cloud Functions → Node on a VPS

Cloud Functions has not been written yet, which makes this the cheapest one to
get right: write the trusted logic (provider APIs, pricing, ledger, webhooks) as
plain modules under `src/core/` and `src/server/`, and let the Cloud Function be
a thin HTTP entry point. Moving to Express on a VPS then replaces the entry
point only.

**Nothing vendor-specific goes in `src/core/`. Ever.** That is what makes the
move cheap.

---

## Current state

| Piece | Status |
| --- | --- |
| Ports defined | ✅ repository, auth, storage |
| Business logic extracted | ✅ `services.js`, `orders.js` — vendor-free, 43 + tests |
| Firebase adapter | ✅ passes the contract suite against the emulator |
| In-memory adapter | ✅ passes the same suite, no emulator needed |
| Composition root | ✅ `src/app.js`, fails loudly on an incomplete wiring |
| Boundary enforcement | ✅ tested |
| **Pages migrated onto the ports** | ⏳ **not yet** — the existing pages still call Firebase inline |

That last row is the honest gap. The scaffolding is real and tested; the eight
existing pages have not been moved onto it. They keep working exactly as before
in the meantime, and each can be migrated one at a time without a flag day.
