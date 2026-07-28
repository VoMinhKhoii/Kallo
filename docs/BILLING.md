# Billing & Entitlements Runbook

How subscriptions work in Kallo, how to configure the provider dashboards, how
to test in sandbox, and how to roll the paywall out (and roll it back).

## Architecture

RevenueCat (RC) is the **single brain** for purchase state across every
platform:

- **Apple App Store** in-app purchases (iOS)
- **Google Play** billing (Android)
- **RevenueCat Billing** for web checkout, backed by Stripe and exposed through
  `@revenuecat/purchases-js`

Clients never grant access to themselves. A purchase/restore flows through RC.
The signed **webhook** is the normal update path; an authenticated, rate-limited
reconciliation endpoint is the recovery path after a purchase, restore, or
missed webhook. Both fetch canonical CustomerInfo from RC and project it into
the same server-owned grant tables.

```
Apple / Google / RevenueCat Billing
        │  purchase, renewal, cancel, refund, expiration
        ▼
   RevenueCat  ──webhook──▶  POST /api/webhooks/revenuecat
       ▲                             │
       └── server lookup ── POST /api/v1/account/entitlements/reconcile
                                     │ writes atomically
                                     ▼
                          entitlement_grants  (source of truth)
                                     │ read by
                                     ▼
        lib/entitlements/service.ts  (getEntitlementState / checkFeatureAccess)
                                     │ served by
                                     ▼
                    GET /api/v1/account/entitlements
                             │                  │
                        web paywall        Flutter paywall
```

### Source of truth: `entitlement_grants`

Each grant row (see `lib/db/schema.ts`) records `entitlement_key` (`premium`),
`status`, `expires_at` (NULL = lifetime), `will_renew`, an environment-scoped
RC customer/product `external_ref`, and `store` (lowercased: `app_store`,
`play_store`, `rc_billing`, ...). `source`
is always `revenuecat`; **branch UI on `store`, never `source`** (the settings
"manage subscription" deep link keys on `store`).

The webhook does not reconstruct lifecycle state from one event's fields. For
purchases, renewals, cancellations, refunds, expirations, redemptions, and
transfers it fetches the affected customer's current RC CustomerInfo and
atomically replaces that environment's projection. Provider timestamps make
concurrent writes monotonic, so an older response cannot undo a newer refund
or renewal.

RevenueCat's v1 lookup creates an empty customer when an ID is missing. If that
happens while local active grants exist, `billing_provider_syncs` records
`customer_missing_since` and quarantines later 200/empty responses too. Only a
non-empty transaction-backed snapshot clears the latch; investigate any latch
before removing it manually because it usually means the REST key/project or
customer identity is wrong.

Ordinary lifecycle events resolve to exactly one existing local owner; aliases
are fallbacks, not additional recipients. Transfers reconcile every existing
source/destination in one transaction. A separate monotonic
`ownership_event_at` clock and `ownership_revoked` flag reject delayed transfer
events without comparing them to CustomerInfo timestamps. Event priority makes
a paired `TRANSFER` outrank a redemption/lifecycle event at the same
millisecond, with event ID as a deterministic final tie-breaker. All
participants must accept the event before any grant moves. Deleted aliases are
finalized as orphaned rather than poisoning webhook retries.

The webhook is idempotent on
`(source, external_event_id, deployment_environment)`. The deployment
environment is distinct from RC's event environment: deployments can receive
the same delivery while sharing a database without suppressing one another.
Grants and provider watermarks also include the RC transaction environment. A
failed attempt records a `processing_error` but leaves
`processed_at` NULL, so an RC redelivery **re-runs** the event instead of
short-circuiting as a duplicate.

### Trial (derived, not stored)

There is no trial row. The trial is computed in
`lib/entitlements/config.ts` + `service.ts` from the profile:

- trial window = `[max(profile.created_at, SUBSCRIPTION_LAUNCH_DATE), +TRIAL_DAYS]`
- starting the window at the later of signup and launch gives **existing users
  a fresh trial** when the paywall goes live, not an already-expired one.
- while enforcement is off, an unset launch date **fails open** so nobody is
  locked out during setup;
- enabling enforcement without a valid launch date fails closed at runtime.

### Enforcement kill-switch

`BILLING_ENFORCEMENT_ENABLED` (default `false`) gates whether routes actually
block. Gating is always *computed*; it is only *enforced* when the flag is on.
The check lives at the route layer — `app/api/analyze-meal/route.ts` calls
`checkFeatureAccess({ userId, profileCreatedAt }, 'ai_analysis')` after auth/
profile and **before** the rate-limit guards, and returns a pre-stream HTTP
**402** when blocked. Clients key on the 402 status to open the paywall.

Only routes that actually spend Gemini meal analysis are gated. Today that is
`/api/analyze-meal` only (both precise and cheat modes). `cheat-repeat`,
`cheat-occasions`, `barcode/*`, and `ingredients/search` do **not** run AI
meal analysis and are intentionally ungated.

`BILLING_PURCHASES_ENABLED` is a separate default-off commerce switch. When it
is false, free users do not see paywalls/trial upsells and both web and mobile
purchase boundaries refuse to load offerings. Disable purchases first during
rollback, independently of access enforcement.

The 402 body:

```json
{
  "error": {
    "code": "feature_locked",
    "status": 402,
    "retryable": false,
    "message": "<localized>",
    "feature": "ai_analysis",
    "reason": "trial_expired"
  }
}
```

`reason` is `trial_expired` or `not_entitled`.

## Environment variables

| Var | Default | Purpose |
|---|---|---|
| `BILLING_ENVIRONMENT` | required | `sandbox` outside production; `production` only in production. Isolates DB projections and webhook idempotency. |
| `SUBSCRIPTION_LAUNCH_DATE` | unset → trial fails open only while enforcement is off | ISO date the paywall goes live; trial starts at `max(signup, this)` |
| `TRIAL_DAYS` | `7` | App-level trial length (positive integer) |
| `BILLING_ENFORCEMENT_ENABLED` | `false` | Global kill-switch. Requires a valid launch date and RC app allowlist before `true`. |
| `BILLING_PURCHASES_ENABLED` | `false` | Independent commerce switch. Hides and blocks new checkout while false. |
| `BILLING_SANDBOX_USER_IDS` | empty | Comma-separated UUIDs for dedicated App Review accounts. On production only these users reconcile/read sandbox grants. |
| `REVENUECAT_REST_API_KEY` | required for reconciliation | App-specific public v1 SDK key used only for CustomerInfo reads. Do not put a project-wide secret key in the runtime. |
| `REVENUECAT_CUSTOMER_DELETE_API_KEY` | required for account deletion | Server-only v2 secret key restricted to `customer_information:customers:read_write`; used only to erase the authenticated user's RevenueCat customer. |
| `REVENUECAT_PROJECT_ID` | required for account deletion | Public RevenueCat project identifier used by the v2 customer deletion endpoint. |
| `REVENUECAT_WEB_API_KEY` | unset → web purchases unavailable | Runtime public Web Billing key returned only to an authenticated web client. |
| `REVENUECAT_APPLE_API_KEY` | unset → iOS purchases unavailable | Client-public iOS SDK key. A Test Store key may be used locally. |
| `REVENUECAT_GOOGLE_API_KEY` | unset → Android purchases unavailable | Client-public Android SDK key. A Test Store key may be used locally. |
| `REVENUECAT_WEBHOOK_SECRET` | unset → webhook returns 503 | Shared secret; RC echoes it verbatim in the `Authorization` header |
| `REVENUECAT_WEBHOOK_HMAC_SECRET` | optional, inactive until configured in the dashboard | Dashboard-generated HMAC key for `X-RevenueCat-Webhook-Signature`; when set, raw-body signature and 5-minute timestamp are required. The current deployments use static Authorization until this one-time secret is captured. |
| `REVENUECAT_INFER_MISSING_EVENT_ENVIRONMENT` | default `false` | Production override. Set `true` only after the production integration is environment-filtered and verified. Allows valid transfer/redemption events that omit `environment` to inherit that authenticated boundary. |
| `REVENUECAT_ALLOW_OWNERSHIP_TRANSFER` | `false` | Break-glass only. Kallo dead-letters cross-account transfers unless a separately reviewed ownership-migration workflow explicitly enables them. |
| `REVENUECAT_ALLOWED_APP_IDS` | required for billing webhooks | Comma-separated Apple, Google, and Web Billing app IDs accepted from grant-mutating webhook events. |

## Account deletion policy

Deleting a Kallo account is available immediately even when a renewable
subscription is active. The confirmation UI warns that Apple and Google
subscriptions continue until canceled in their store, while a RevenueCat
Billing web subscription is canceled as part of RevenueCat customer deletion.
Cancellation is recommended but never required to erase the account.

Deletion requires a server-verified authentication method used within the last
10 minutes. The server removes all public avatar objects with fail-closed
pagination, cleans local audit data, and persists a provider-erasure outbox job
before deleting the Supabase Auth user. It then erases RevenueCat immediately;
transient provider failures leave the local account deleted and are retried
hourly by `.github/workflows/account-deletion-retry.yml`. This avoids canceling
a web subscription while leaving a live Kallo account after a later failure.
RevenueCat `200`, queued `202`, and already-absent `404` results are idempotent
successes. RevenueCat customer deletion does not cancel Apple/Google store
subscriptions, but does cancel RevenueCat Billing subscriptions immediately.

## Owner dashboard setup checklist

### RevenueCat

1. Create the RC project; add an **iOS app**, an **Android app**, and a **Web
   Billing** app.
2. Create one entitlement: **`premium`**.
3. Create products and attach them to `premium`. Every store uses the same
   canonical ids from `lib/billing/products.ts`: `kallo_premium_monthly`,
   `kallo_premium_annual`, and `kallo_premium_lifetime`. Google reports the
   subscription products with their exact `:monthly` and `:annual` base plans.
4. Build an **offering** with the three packages.
5. In Project settings → General, set **Restore behavior** to **Keep with
   original App User ID**. Kallo requires login before purchase; this prevents
   one signed-in account from silently taking another account's purchase.
   Keep `REVENUECAT_ALLOW_OWNERSHIP_TRANSFER=false` as defense in depth.
6. Add one production-only, environment-filtered webhook after `kallo.fit` is
   deployed. Use the HMAC signing secret when available; otherwise configure
   an `Authorization` value equal to `REVENUECAT_WEBHOOK_SECRET`. For sandbox
   server testing, use a local or explicitly approved temporary tunnel with a
   separate secret.
7. Put every production dashboard app ID in `REVENUECAT_ALLOWED_APP_IDS`.
   Production must receive production events only. Never point an unfiltered
   sandbox integration at production.
8. Copy the matching app-specific public v1 SDK key and public Web Billing key into
   `REVENUECAT_REST_API_KEY` and `REVENUECAT_WEB_API_KEY`.
9. Create a v2 secret key with only
   `customer_information:customers:read_write`, store it as
   `REVENUECAT_CUSTOMER_DELETE_API_KEY`, and set
   `REVENUECAT_PROJECT_ID=proj5c917f9b`.
10. Confirm monthly/annual/lifetime packages map to the matching product id and
   cadence. Unknown or mismatched products are intentionally hidden and cannot
   grant server access.

### App Store Connect (iOS)

1. Sign the **Paid Apps** agreement (Apple pays nothing until this is signed).
2. Create the **3 IAPs** matching the mobile product ids above.
3. Create a **sandbox tester** account for testing.

### Google Play Console (Android)

1. Complete the **merchant / payments profile**.
2. Create the matching subscription + one-time products.

### RevenueCat Billing (web)

1. Connect a Stripe account to RevenueCat. This is a merchant/financial setup
   step and must be completed by the account owner.
2. Add a RevenueCat Billing app named **Kallo Web**, then create/import the
   matching monthly, annual, and lifetime products.
3. Attach those products to the existing `premium` entitlement and the
   matching packages in the current `default` offering.
4. Configure the web checkout support email, default currency, tax settings,
   and payment domains. Review prices and tax treatment with the account owner
   before publishing; do not infer them from mobile store fees.
5. Never surface or promote web pricing inside the iOS app without a separate
   App Review policy check.

## Sandbox test plan

- **RC test events**: fire `TEST` and lifecycle events from the RC dashboard;
  confirm rows land in `billing_webhook_events` and grants update.
- **StoreKit config**: use a local StoreKit configuration file to exercise the
  iOS purchase flow in the simulator.
- **TestFlight + sandbox tester**: full iOS purchase/restore against the App
  Store sandbox.
- **purchases-js sandbox key**: use the RC Web Billing sandbox key to run the
  web checkout end-to-end without real charges.
- **Account isolation**: on one device/store account, buy as app account A,
  sign out, sign in as B, and restore. With **Keep with original App User ID**,
  B must not acquire A's entitlement or management URL.
- **Lifecycle matrix**: verify monthly purchase, annual purchase, lifetime,
  cancel-at-period-end, renewal, billing grace period, refund, expiration,
  already-owned, payment-pending, app resume, and A→B account switching.
- **Plan changes**: monthly↔annual changes happen in the Apple/Google/web
  management surface. Upgrades may be immediate and downgrades normally apply
  at the next renewal according to store rules; both remain the same `premium`
  entitlement. Lifetime is hidden from already-premium users to avoid a second
  concurrent charge.

Note: sandbox webhook events (`environment=SANDBOX`) are always recorded, but
in **production** they do NOT mutate grants (recorded as
`environment_ignored:sandbox`). A local server with
`BILLING_ENVIRONMENT=sandbox` applies them for testing. The submitted App Store
binary uses Apple's sandbox during TestFlight/App Review; add only the dedicated
review account UUID to `BILLING_SANDBOX_USER_IDS`. That account reconciles its
sandbox CustomerInfo on production without making sandbox grants valid for any
normal production account.

## Rollout runbook

Apply the data boundary first, then ship dark and flip switches:

1. **Apply migrations**: the owner runs
   `20260728123331_add_billing_reconciliation.sql` followed by
   `20260728123400_harden_billing_trial_anchor.sql`. Verify the three billing
   tables, RLS, revokes, constraints, indexes, and trial-anchor trigger before
   deploying code. Dark mode still reads these tables, so code must never
   precede the schema.
2. **Ship dark**: deploy with `BILLING_ENFORCEMENT_ENABLED=false`,
   `BILLING_PURCHASES_ENABLED=false`, and
   `SUBSCRIPTION_LAUNCH_DATE` unset. Everything is computed, nothing blocks.
3. **Configure webhooks**: create the production-only integration after the
   endpoint is deployed. Keep
   `REVENUECAT_INFER_MISSING_EVENT_ENVIRONMENT=false` until production delivery
   and app-ID filtering are verified; only then may the production variable be
   set to `true` for transfer/redemption events that omit environment.
4. **Configure dashboards**: complete the remaining store checklists.
5. **Set `SUBSCRIPTION_LAUNCH_DATE`**: this starts trial windows (existing users
   get a fresh `TRIAL_DAYS` window from the launch date).
6. **Announce** the launch to users.
7. **Open commerce**: set `BILLING_PURCHASES_ENABLED=true`, verify offerings,
   prices, and purchase activation, then set `BILLING_ENFORCEMENT_ENABLED=true`.
   Locked-out
   users now get the paywall (web 402 → PaywallDialog; Flutter 402 → paywall).

Monitor `billing_webhook_events` for `processed_at IS NULL`. RevenueCat retries
webhooks only for a bounded period; schedule the replay command below (for
example every five minutes) in each environment, and alert when it exits
non-zero:

```bash
bun --env-file=.env.local scripts/replay-revenuecat-webhooks.ts
```

The command re-enters the authenticated/idempotent handler, processes up to
`BILLING_REPLAY_LIMIT` rows (default 100), and is safe to run repeatedly.

Webhook rows contain only the explicit replay/identity envelope, not provider
passthrough fields or subscriber attributes. Run
`scripts/prune-revenuecat-webhooks.ts` daily: successfully processed envelopes
default to 30 days of retention and dead letters to 90 days. Pending rows are
never pruned. Override those windows only after product/privacy review.

```bash
bun --env-file=.env.local scripts/prune-revenuecat-webhooks.ts
```

Dead letters are terminal by design. After fixing the underlying cause, an
operator may requeue one reviewed event by clearing `dead_lettered_at`, setting
`next_attempt_at = now()`, and leaving `processed_at` NULL. Never bulk-requeue
without checking `processing_error`; the replay worker will claim the row on
its next scheduled run.

**Rollback**: set `BILLING_PURCHASES_ENABLED=false` first, then
`BILLING_ENFORCEMENT_ENABLED=false`. New checkout and enforcement stop
independently; existing grants are untouched.

## Known limitations

- **Temporary outage grants**: RevenueCat says SDK/API CustomerInfo already
  reflects these short grants, but v1 entitlement objects do not expose an
  environment flag. The server intentionally requires a matching backing
  transaction to prevent sandbox access leaking into production. During the
  rare store-validation outage, the device SDK may show temporary access
  before the server projection does; never weaken environment isolation to
  remove this availability tradeoff.
- **Multiple stores**: CustomerInfo exposes one management URL. If a customer
  somehow buys renewable subscriptions on more than one store, access remains
  correct but the app cannot display every store's cancellation link. Treat
  duplicate subscriptions as a support/refund case and monitor provider data.
- **No VietQR / direct-bank web payment yet.** Web checkout uses RevenueCat
  Billing backed by Stripe. The
  entitlement model (`source`, `store`) is designed to allow adding another
  gateway later without schema changes.
- **Tax and payout configuration requires owner review.** RevenueCat Billing
  uses Stripe for payment processing; confirm merchant, tax, payout, and local
  reporting obligations before enabling real charges.
