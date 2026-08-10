# NewlyNow — Secure Deployment Runbook

> Do not merge or enable `Secure Commerce Only` until every required gate below passes.

## 1. Pre-merge quality gates

- `NewlyNow Quality Gate` must be green on the exact PR head.
- Server pricing tests must pass.
- Firestore Emulator authorization tests must pass.
- No private gateway keys, webhook secrets, service-account JSON, `.env`, or private keys may exist in Git.

## 2. Firebase environment

Use the intended Firebase project/environment explicitly. Do not rely on an accidental CLI default project.

Deploy only the components defined in `firebase.json`:

```bash
firebase deploy --only functions,firestore:rules,storage
```

This repository intentionally has no Firebase Hosting configuration in `firebase.json` so deploying backend security cannot silently replace the live website hosting.

## 3. App Check

1. Register the NewlyNow web app/domain in Firebase App Check using reCAPTCHA Enterprise.
2. Put only the PUBLIC reCAPTCHA Enterprise site key in Admin → Security.
3. Confirm the storefront can obtain an App Check token.
4. Confirm `createOrder`, `createPaymentAttempt`, and `initPayment` reject requests without a valid App Check token.
5. Enable App Check enforcement for the intended Firebase products only after valid traffic has been tested.

## 4. Secure Commerce API

After Functions deploy, copy the HTTPS Functions base URL into Admin → Security → `Firebase Functions API Base URL`.

Smoke-test:

- `POST /createOrder`
- `POST /createPaymentAttempt`
- `POST /initPayment`
- provider webhook endpoint after adapters are installed

All browser-originating commerce API calls must carry `X-Firebase-AppCheck`.

## 5. Structured pricing

Before enabling automatic payment for a service, configure Admin → Pricing:

- numeric price in minor currency units via the dashboard UI
- ISO 4217 currency code
- fixed or per-unit mode
- unit size
- minimum and maximum quantity
- active = true
- automatic payment eligible = true

Automatic payment must remain unavailable for:

- services without structured server pricing
- mixed-currency carts
- invalid quantity ranges
- coupon orders until a server-side coupon engine is implemented

## 6. Payment gateway adapters

The gateway registry is deny-by-default. Do not store provider secrets in Firestore or frontend code.

For each of the two real gateways:

1. Implement `createCheckout()`.
2. Implement `verifyWebhook(req)` using the provider's raw-body/signature rules.
3. Store provider secrets in the server secret manager/runtime only.
4. Use `paymentAttemptId` as, or as part of, the provider idempotency key where supported.
5. Return the verified amount and currency from paid webhook events.
6. Test duplicate/replayed webhooks.
7. Test forged signatures.
8. Test wrong amount/currency.
9. Test payment success, failure, and refund transitions.

No adapter should be registered until all of those tests pass.

## 7. Manual payments

Test end-to-end:

1. Customer creates an order.
2. Customer selects a manual method and submits the transaction reference.
3. Attempt becomes `pending_verification`.
4. Authorized admin reviews the actual transfer.
5. Approve/reject changes only permitted payment fields.
6. An immutable Audit Log entry is created.

Never approve a manual payment based only on a user-supplied reference string.

## 8. Secure Commerce Only cutover

Only after Functions + App Check + secure API have been smoke-tested:

1. Open Admin → Security.
2. Confirm App Check Site Key and HTTPS API Base URL are both configured.
3. Enable `Secure Commerce Only`.
4. Verify direct browser Firestore creates to `orders` and `paymentAttempts` are rejected.
5. Verify normal checkout still succeeds through Functions.

This switch is the final migration from compatibility-mode public order creation to server-first commerce.

## 9. Final staging tests

Before production merge test at minimum:

- desktop + mobile home/category/service/cart/checkout/account/admin
- owner login with verified email
- unverified owner/admin rejection
- regular admin cannot edit admins/payment gateway/security/pricing configuration
- order state transitions
- payment state transitions
- duplicate payment initiation
- replayed webhook
- wrong webhook signature
- wrong amount/currency
- file upload type and 10 MB size limits
- XSS attempts in names/notes/links/reviews/announcements
- IDOR/access-control attempts against orders/payment attempts/pricing/audit logs
- disabled payment method hidden from checkout
- unavailable automatic gateway cannot appear to customers

## 10. Merge rule

Merge PR #2 into `main` only after:

- current PR-head CI is green
- staging smoke tests pass
- Firebase rules/functions are deployed to the intended environment
- App Check is configured
- the two real gateway adapters are installed and verified
- rollback point/backup is confirmed

Until then, keep the PR in Draft state.
