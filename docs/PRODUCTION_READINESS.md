# Production Readiness Checklist — Elawaady XDigital (Elwaset)

Status as of 2026-08-28 on `claude/vercel-skills-load-5qy960`.
A box is ticked only when an executed test or an inspected artifact proves it.

**Verdict: NOT ready for production launch.**
The storefront is sound. The commerce engine — pricing, payment, fulfillment,
suppliers, ledger — does not exist yet, and cannot exist on the current
static-only hosting.

---

## Gate 0 — Blockers that must clear before anything else

- [ ] **A trusted backend is chosen and provisioned.** Nothing in Gate 4, 5 or 6
      can start until this exists. (See `AUDIT.md` §6, B1.)
- [ ] Firebase billing raised to **Blaze**, if Cloud Functions is the choice.
- [ ] Firebase Console access available for rules deploy, indexes and App Check.

## Gate 1 — Frontend

- [x] All 8 routes return 200 and render — verified across 3 viewports.
- [x] No horizontal overflow on mobile (390), tablet (820), desktop (1440).
- [x] `dir="rtl"` and `lang="ar"` on every route.
- [x] No JavaScript errors on any route.
- [x] No broken same-origin assets.
- [x] Visual identity and reference design preserved.
- [x] Approved fonts (Cairo, IBM Plex Sans Arabic) loaded.
- [ ] Arabic kashida applied where visually appropriate.
- [ ] English locale available.
- [ ] Home page renders each main category as a banner with its subcategories.

## Gate 2 — Accounts and roles

- [x] Email/password registration.
- [x] Google and Facebook sign-in.
- [x] Login / logout.
- [x] Password reset.
- [x] A user cannot escalate their own role — tested.
- [x] A user cannot credit their own balance — tested.
- [x] A user cannot read another user's profile — tested.
- [x] An unverified email matching an admin address gets no admin rights — tested.
- [ ] Merchant registration flow (UI checkbox only today).
- [ ] Supplier registration flow (does not exist).
- [ ] A roles/permissions engine beyond the admin email allowlist.

## Gate 3 — Admin

- [x] Admin surface is gated behind login — tested.
- [x] Only an admin writes storefront config — tested.
- [x] Only an owner writes the admin list — tested.
- [x] Manage: users, categories, services, orders, policies, notifications, reviews, theme, texts, admins.
- [ ] Manage: merchants, suppliers, payments, banners, media library, SEO.
- [ ] Pagination on orders and users (currently loads everything).
- [ ] Admin actions written to an audit log.

## Gate 4 — Catalog and commerce

- [x] Main category → service → details → add-to-cart funnel renders — tested.
- [x] Cart persists into checkout — tested.
- [x] Checkout refuses an empty cart — tested.
- [ ] Subcategory exists as a real entity.
- [ ] A service is a record (id, type, price, pre-discount price, duration, warranty, instructions, required fields, packages) rather than a string.
- [ ] The six service types are modelled.
- [ ] Favorites and most-used sections are admin-driven.
- [ ] Checkout computes a real total.
- [ ] Payment is taken.
- [ ] The order stores an immutable snapshot of service and price.
- [x] A placed order cannot be mutated by the customer — tested.

## Gate 5 — Suppliers and fulfillment

- [ ] Unified provider API layer.
- [ ] Per-provider: endpoint, key, balance, import, mapping, create order, status, refill, cancel.
- [ ] Store service ↔ provider service mapping, provider never exposed to the customer.
- [ ] Cost / profit / markup / custom selling price.
- [ ] Automatic dispatch and status sync.
- [ ] Provider failure never loses an order; error logged; retry available.
- [ ] Provider flow tested end to end.

## Gate 6 — Money

- [ ] More than one payment gateway, plus a manual method.
- [ ] Ledger: no balance moves without a recorded transaction.
- [x] The ledger is not writable from a browser — tested.
- [ ] Mediation (وساطة) workflow with its own states and history.

## Gate 7 — Security

- [x] Authentication: verified email required for privileged identity.
- [x] Authorization: 49 rule tests covering direct HTTP access attempts.
- [x] Privilege escalation closed and regression-tested.
- [x] Input validation on every publicly writable collection.
- [x] Secure uploads: image-only, 5 MB cap, folder allowlist.
- [x] Customer proofs private per uid, not guessable by URL.
- [x] Secrets: none in the repository; provider collections closed.
- [x] Password hashing: delegated to Firebase Auth.
- [x] Session security: delegated to Firebase Auth tokens.
- [x] Default deny on unmatched collections.
- [x] XSS: all dynamic HTML is escaped (`esc()` used consistently).
- [x] SQL injection: not applicable (Firestore).
- [x] CSRF: not applicable (no cookie-based session server).
- [ ] Rate limiting.
- [ ] API authentication (no API exists yet).
- [ ] Webhook signature verification (no webhooks yet).
- [ ] Firebase App Check enabled.

## Gate 8 — Performance

- [x] Lazy loading on generated content images.
- [x] `decoding="async"` on the same.
- [ ] Images optimized — 4 assets exceed 200 KB (largest 375 KB).
- [ ] Caching headers configured.
- [ ] Firestore composite indexes defined.
- [ ] Pagination in admin lists.
- [ ] N+1 read patterns reviewed.

## Gate 9 — Testing

- [x] Firestore rules: 37 tests, emulator-executed.
- [x] Storage rules: 12 tests, emulator-executed.
- [x] E2E storefront: 29 tests, real Chromium.
- [x] `npm test` runs everything.
- [ ] Registration → Login covered end to end in E2E.
- [ ] Checkout → Payment → Order → Fulfillment (flow does not exist).
- [ ] CI runs the suite on every push.

## Gate 10 — Release

- [x] Work isolated on a branch; every commit revertible.
- [x] Rules migration documented with a rollback path (`AUDIT.md` §5).
- [ ] Rules deployed to Firebase and re-verified against the live project.
- [ ] `config/admins` migration executed.
- [ ] Production smoke test after deploy.

---

## How to run the tests

```bash
npm install
npm run test:rules   # Firestore + Storage rules, via the Firebase emulator
npm run serve        # in a second shell
npm run test:e2e     # Playwright against the static site
```
