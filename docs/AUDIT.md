# Elawaady XDigital (Elwaset) — Production Readiness Audit

**Branch:** `claude/vercel-skills-load-5qy960`
**Date:** 2026-08-28
**Scope:** the 38 launch conditions defined for the platform.

---

## 1. What the project actually is today

Established by reading every source file and by running the site in a real
browser (Chromium, three viewports) — not by inspecting the UI alone.

| Aspect | Reality |
| --- | --- |
| Architecture | Static HTML/CSS/JS. No build step, no bundler, no framework. |
| Hosting | GitHub Pages (`CNAME` → `newlynow.com`). **Static files only.** |
| Backend | **None.** There is no server, no API, no serverless function. |
| Data | Firebase Firestore, read/written directly from the browser. |
| Auth | Firebase Auth (email+password, Google, Facebook). |
| Media | Firebase Storage, uploaded from `admin.html`. |
| Pages | 8: index, category, service, checkout, account, admin, review, proofs. |
| Catalog | 54 categories. A category holds `groups[].items[]` — service **names as plain strings**. |
| Ordering | Cart in `localStorage` → `checkout.html` → best-effort Firestore write → **WhatsApp deep link**. |
| Payment | **None.** No gateway, no total, no price on an order. |
| Tests | **None existed.** (Added by this branch — see §4.) |

### The decisive constraint

A static site has nowhere to keep a secret and nowhere to run trusted code.
Conditions 11–19, 21, 23 and 31 all require exactly that: calling supplier APIs
with a private key, computing prices the client cannot forge, writing a ledger
the client cannot edit, verifying webhooks, enforcing rate limits.

**None of them can be satisfied on GitHub Pages.** They are not "not done yet" —
they are architecturally unreachable until a trusted server exists. This is the
single decision that gates roughly half the checklist.

---

## 2. Security findings

Found by reading `firestore.rules` / `storage.rules` and confirmed by executing
them against the Firebase emulator. Every finding below has a regression test in
`tests/rules/`.

### FIXED on this branch

| # | Severity | Finding |
| --- | --- | --- |
| S1 | **High** | **Privilege escalation.** `match /users/{id} { allow write: if request.auth.uid == id }` let a signed-in user write *any* field to their own profile. The moment `role` or `balance` lives there — which the spec requires — a user could self-promote to admin or credit their own wallet. Now `role`, `status`, `balance`, `verified`, `createdAt` are immutable to the user. |
| S2 | **High** | **Unbounded public writes.** `orders`, `customers` and `reviews` were all `allow create: if true` with no shape, size or field validation. Anyone could write arbitrary documents of arbitrary size into the store's collections. Now every public create is validated: known keys only, length caps, typed and bounded numbers, `status` forced to `new`, `createdAt` forced to `request.time`. |
| S3 | **Medium** | **Review moderation bypass.** A submitted review could arrive with `approved: true` and publish itself. Now rejected. |
| S4 | **Medium** | **Admin-account enumeration.** `config/site` is world-readable and carried the `admins` email array. The list moved to `config/admins` (admin-read, owner-write); the generic `config/{docId}` rule now explicitly excludes it. *This exclusion is load-bearing: Firestore unions all matching rules, so without it the public read still applied — caught by a failing test, not by inspection.* |
| S5 | **Medium** | **Cross-customer order reads.** Orders were admin-only-readable, so a customer could not see their own — and once opened up naively, could see everyone's. Reads are now scoped: staff see all, a customer sees only orders carrying their `uid`. |
| S6 | **Medium** | **Unverified-email admin impersonation.** Admin checks compared `request.auth.token.email` without requiring `email_verified`. A provider that does not verify email could yield a token bearing an admin address. Now `email_verified == true` is required. |
| S7 | **Medium** | **Unrestricted uploads.** `storage.rules` was `match /{allPaths=**} { allow write: if <one hardcoded email> }` — any path, any size, any content type, and the second owner locked out. Now: image-only content types, 5 MB cap, an allowlist of media folders, admin list read from Firestore, and customer proofs private per-uid. |
| S8 | **Low** | **No default deny.** Any collection not explicitly matched fell through. A `match /{document=**} { allow read, write: if false }` now closes the database. |
| S9 | **Low** | **Order immutability.** A customer could not previously be prevented from mutating an order, which makes a price snapshot meaningless. Orders are now read-only to customers after creation. |

### OPEN — cannot be fixed without a backend

| # | Severity | Finding |
| --- | --- | --- |
| S10 | **High** | **No rate limiting.** Firestore rules cannot count requests over time. Guest order/review creation is open to flooding. Needs a server or App Check. |
| S11 | **High** | **No server-side price authority.** Nothing computes or verifies a price. An order's total, if one is ever sent from the browser, is client-controlled. |
| S12 | **Medium** | **Secrets have nowhere to live.** Provider API keys cannot be stored anywhere a browser cannot read. The `providers/` and `provider_secrets/` collections are therefore closed outright rather than left half-open. |
| S13 | **Medium** | **Admin image fallback inlines base64 into Firestore.** `admin.html` falls back to embedding a data URL in the config document when Storage fails. This silently bloats a document toward the 1 MB Firestore limit and bypasses upload validation. |
| S14 | **Low** | **No audit log.** Nothing records administrative actions. The collection and its rules exist; the writer must be a trusted server. |
| S15 | **Low** | **No fallback when the Firebase SDK cannot load.** `account.html`, `admin.html` and `review.html` import the SDK from the CDN at module top level. If that fetch fails the page renders its shell and nothing else, with only a console error. Surfaced by the E2E suite, which now simulates exactly that. |

**Not a finding:** the Firebase web config in `firebase-config.js` (apiKey, appId…)
is public by design. It is an identifier, not a credential. Security comes from
the rules, which is what this branch strengthened.

---

## 3. Condition-by-condition status

`PASS` = verified by an executed test. `PARTIAL` = works in part, gap named.
`FAIL` = not implemented. `BLOCKED` = cannot proceed without something from you.

| # | Condition | Status | Evidence / gap |
| --- | --- | --- | --- |
| 1 | Works on desktop/tablet/mobile, no broken pages | **PASS** | 24 automated checks (8 routes × 3 viewports): HTTP 200, `dir=rtl`, `lang=ar`, non-empty render, **zero horizontal overflow**, zero JS errors. |
| 2 | Accounts: user/merchant/supplier register, login, logout, reset, validation, roles | **PARTIAL** | User register/login/logout/reset **work**. Merchant is a UI checkbox only. **Supplier does not exist.** No roles engine — only an admin email allowlist. Role scaffolding + escalation guards added to the rules. |
| 3 | Admin manages 14 areas | **PARTIAL** | Present: users, categories, services, orders, policies, notifications, media (basic), site settings (theme/texts), admins, reviews. **Missing: merchants, suppliers, payments, banners as entities, media library, SEO.** |
| 4 | Main → Sub → Services → Details → Purchase | **PARTIAL** | The funnel renders end to end (verified). But a subcategory is a heading string, not an entity, and a service is a **plain string** with no record of its own. |
| 5 | Home shows each main category as a banner with its subcategories under it | **FAIL** | Home renders a flat grid of 54 category cards. |
| 6 | Favorites + most-used sections, admin-controlled | **PARTIAL** | A `featured` section exists. "Most used" does not. Neither is driven by usage data. |
| 7 | Service page: images, name, description, price, pre-discount price, duration, warranty, instructions, customer fields, packages, buy button | **PASS** | All of it now renders and is verified by 7 browser tests: gallery, name, description, price, struck-through pre-discount price with a discount badge, duration, warranty, service type, instructions, per-service customer fields (text/url/number/select/textarea) and a package picker that repaints the price. Editable from the dashboard except packages and custom fields, which are preserved on save but not yet editable there. |
| 8 | Cart, Buy Now, Checkout genuinely work | **PARTIAL** | Cart→checkout carry-over is **verified by test**. But checkout is a **WhatsApp handoff**: no total, no payment, no confirmation. |
| 9 | Order stores a snapshot of service + price; later edits don't affect old orders | **PARTIAL** | `Services.snapshot()` freezes name, code, type, package, unit price, pre-discount price, currency, quantity, line total, duration, warranty and the customer's inputs at add-to-cart time; the cart carries it and a test proves a later edit to the service cannot change it. Orders are immutable to the customer (S9). **Still open:** checkout does not yet write the snapshot onto the order, and the price is client-supplied until a server computes it. |
| 10 | Service types: Manual / API / Digital / Subscription / Account / Custom | **PARTIAL** | All six are modelled, each declaring whether it can be fulfilled automatically, selectable per service in the dashboard and shown on the service page. **The behaviour behind a type** (an `api` service actually dispatching) still needs the backend. |
| 11 | Unified Provider/Supplier API layer | **BLOCKED** | Requires a server. |
| 12 | Per-provider: endpoint, key, balance, import, mapping, create order, status, refill, cancel | **BLOCKED** | Requires a server. |
| 13 | Map a store service to a provider service without exposing the provider | **BLOCKED** | Requires a server. |
| 14 | API keys/secrets never in frontend or repo; stored server-side | **BLOCKED** | No server-side exists. Repo scanned: **no leaked secrets today** (only the public Firebase web config). `providers/` and `provider_secrets/` are closed by rules and verified closed by test. |
| 15 | Cost / profit / fixed markup / percentage markup / custom selling price | **FAIL** | No pricing model exists. |
| 16 | Automatic orders dispatch to the right provider and self-update | **BLOCKED** | Requires a server. |
| 17 | Provider failure never loses an order; error logged; retry or manual | **BLOCKED** | Requires a server. |
| 18 | Multiple payment gateways + a manual method, no lock-in | **BLOCKED** | Requires a server **and** gateway credentials. |
| 19 | Ledger; no balance change without a recorded transaction | **FAIL / BLOCKED** | Collection + rules added (client-write denied, verified). The writer must be a server. |
| 20 | Mediation (وساطة) independent of normal orders, with workflow, states and history | **FAIL** | An `escrow` catalog entry exists. No workflow. |
| 21 | Every sensitive admin action in an audit log | **FAIL / BLOCKED** | Collection + rules added (client-write denied, verified). Writer must be a server. |
| 22 | Security review across 13 areas | **PARTIAL** | Performed — see §2. AuthN, AuthZ, XSS, secrets, input validation, session, password hashing, secure uploads: **addressed**. CSRF: N/A (no cookie-session server). SQL injection: N/A (Firestore, no SQL). Rate limiting, API auth, webhook verification: **blocked on a backend**. |
| 23 | A user cannot reach admin APIs or data by direct HTTP | **PASS (for the current surface)** | 37 Firestore + 12 Storage rule tests, executed against the emulator, exercise exactly this — direct authenticated and unauthenticated requests bypassing the UI. All denied as intended. Re-opens as an issue the moment a backend adds new endpoints. |
| 24 | Uploads from the dashboard with size/type validation; no hardcoded content | **PARTIAL** | Size (5 MB) + image-only type now enforced **and tested**. Content is still partly hardcoded (`data.js`, 284 lines of fallback catalog; category links in `index.html`). |
| 25 | Images/banners/services/categories editable from the dashboard without code | **PARTIAL** | Theme, texts, categories, services, policies: **yes**. Banners are not entities; `data.js` remains a hardcoded fallback. |
| 26 | Full RTL + Arabic, English possible | **PARTIAL** | RTL/Arabic verified on all 8 routes. **No English on the store pages.** |
| 27 | Preserve the existing visual identity | **PASS** | No design changes made. Only rules, tests, lazy-loading attributes. |
| 28 | Approved fonts; Arabic kashida where visually appropriate | **PARTIAL** | Cairo + IBM Plex Sans Arabic are loaded. Kashida is not used anywhere. |
| 29 | Performance: lazy loading, image optimization, caching, indexing, pagination, no N+1 | **PARTIAL** | `loading="lazy"` + `decoding="async"` added to all generated content images. **Still open:** 4 assets over 200 KB (largest 375 KB) unoptimized; admin loads orders/users with no pagination; no Firestore composite indexes defined. |
| 30 | Automated tests for the critical path | **PARTIAL** | **89 unit/contract + 77 rules/adapter-contract + 37 E2E = 203 tests, all passing.** Browse→Service→Cart→Checkout is covered, including the full service record and the order snapshot. **Payment→Order→Fulfillment cannot be tested — it does not exist.** |
| 31 | Provider API flow test | **BLOCKED** | Nothing to test. |
| 32 | No existing feature deleted without justification | **PASS** | Nothing removed. Storage rules deliberately keep the legacy `categories/` and `services/` upload folders and legacy root-object reads working. |
| 33 | Understand code + DB + dependencies before refactoring | **PASS** | Full read of all 5,078 lines before any change. No refactor performed. |
| 34 | UI is not proof of completion | **PASS** | This audit is the application of that rule — see conditions 2, 4, 7, 8. |
| 35 | No mock data or placeholders as proof | **PASS** | Noted: `data.js` **is** effectively hardcoded fallback data and is counted as a gap under 24/25, not as completion. |
| 36 | No broken routes / console errors / server errors / failed migrations / critical security issues / hardcoded secrets / broken checkout / auth / order flow | **FAIL** | Routes ✅, console ✅, secrets ✅, critical rules issues ✅ fixed. **Checkout and the order flow remain incomplete** (no payment, no price, no fulfillment). |
| 37 | Final report | **PASS** | This document. |
| 38 | Production readiness checklist | **PASS** | `docs/PRODUCTION_READINESS.md`. |

**Tally:** 9 PASS · 16 PARTIAL · 5 FAIL · 8 BLOCKED.

### Architecture (added after the audit, at your direction)

Firebase is now one adapter behind vendor-neutral ports rather than the
architecture itself. Business logic, database access, authentication and storage
are separated, and the boundaries are enforced by tests rather than convention.
See `docs/ARCHITECTURE.md` for each migration path (Firestore → MySQL/Postgres,
Firebase Auth → custom provider, Firebase Storage → object storage, Cloud
Functions → Node on a VPS).

---

## 4. What this branch changed

| File | Change |
| --- | --- |
| `firestore.rules` | Rewritten. Roles, field-level immutability, payload validation, scoped reads, private admin list, closed provider/ledger/audit collections, default deny. |
| `storage.rules` | Rewritten. Content-type + 5 MB validation, media-folder allowlist, admin list from Firestore, private per-uid customer proofs, no catch-all write. |
| `tests/rules/firestore.rules.test.mjs` | **New** — 37 tests. |
| `tests/rules/storage.rules.test.mjs` | **New** — 12 tests. |
| `tests/e2e/storefront.test.mjs` | **New** — 29 tests. |
| `package.json`, `firebase.json`, `.gitignore` | **New** — test tooling and emulator config. |
| `index.html`, `category.html`, `service.html`, `review.html`, `account.html` | `loading="lazy"` + `decoding="async"` on generated content images. No visual change. |
| `docs/AUDIT.md`, `docs/PRODUCTION_READINESS.md` | **New.** |

No feature was removed. No visual design was altered.

---

## 5. Required migration before deploying these rules

The new rules read the admin list from `config/admins` and fall back to the
legacy `config/site.admins`, so **they are safe to deploy first**. To actually
close the enumeration hole (S4), afterwards:

1. In Firestore, create `config/admins` with `{ emails: [...] }` — the same list
   currently in `config/site.admins`.
2. Verify an admin can still sign into `admin.html`.
3. Delete the `admins` field from `config/site`.

Deploy with `firebase deploy --only firestore:rules,storage:rules`.
Rollback: `git revert` this branch's rules commit and redeploy.

> `admin.html` also reads `config/site.admins` directly for its UI. Once step 3
> runs, that read returns nothing and the "المشرفين" tab will render empty —
> the client change must ship with the migration.

---

## 6. BLOCKED — what is needed from you

Nothing below can be assumed, faked, or worked around. Each needs a decision or
a credential.

| # | Blocker | What is needed |
| --- | --- | --- |
| B1 | **No backend exists.** Gates conditions 11–19, 21, 23-at-scale, 31, and real checkout (8, 9, 16–18). | A decision on where trusted code runs, and billing for it. Firebase Cloud Functions requires the **Blaze (pay-as-you-go)** plan. |
| B2 | Supplier/provider integrations | For each provider: name, API endpoint, API key, and their API docs. |
| B3 | Payment gateways | Which gateways (Paymob, Fawry, Stripe, PayPal, manual transfer…), plus merchant credentials — **test keys first**. |
| B4 | Service catalog data | Real prices, costs, durations, warranties, instructions and per-service required fields. The catalog currently holds only names. |
| B5 | Subcategory structure | Condition 5 needs a real Main→Sub tree. The current data has one flat level of headings. |
| B6 | Firebase Console access | Rules deployment, the `config/admins` migration, index creation, and enabling App Check. |
| B7 | English content | Condition 26 needs Arabic/English copy for every string, or a decision to defer. |

