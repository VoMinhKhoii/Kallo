# Billing & Entitlements Runbook

How subscriptions work in Nhẩm, how to configure the provider dashboards, how
to test in sandbox, and how to roll the paywall out (and roll it back).

## Architecture

RevenueCat (RC) is the **single brain** for purchase state across every
platform:

- **Apple App Store** in-app purchases (iOS)
- **Google Play** billing (Android)
- **Paddle** for web checkout, via RC **Web Billing** (`@revenuecat/purchases-js`)

Clients never grant access to themselves. A purchase/restore flows through RC;
RC then calls our **webhook**, which is the only writer of entitlement state.

```
Apple / Google / Paddle
        │  purchase, renewal, cancel, refund, expiration
        ▼
   RevenueCat  ──webhook──▶  POST /api/webhooks/revenuecat
                                     │ writes
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
`status`, `expires_at` (NULL = lifetime), `will_renew`, the RC `external_ref`
(the upsert key — `original_transaction_id`), and `store` (RC's `event.store`
lowercased: `app_store`, `play_store`, `paddle`, `rc_billing`, ...). `source`
is always `revenuecat`; **branch UI on `store`, never `source`** (the settings
"manage subscription" deep link keys on `store`).

Grant lifecycle mapping lives in `app/api/webhooks/revenuecat/route.ts`:

| RC event | Effect |
|---|---|
| `INITIAL_PURCHASE`, `RENEWAL`, `UNCANCELLATION`, `PRODUCT_CHANGE` | upsert active grant |
| `NON_RENEWING_PURCHASE` | active grant, `will_renew=false` |
| `CANCELLATION` (`CUSTOMER_SUPPORT`) | refund → `status=refunded` |
| `CANCELLATION` (other reasons) | auto-renew off → `will_renew=false`, access runs to period end |
| `EXPIRATION` | `status=expired` |
| `REFUND` | `status=refunded` (forward-compat; RC has no literal REFUND today) |
| `TRANSFER` | **unhandled** — recorded as `processing_error='transfer_unhandled'` (see Known limitations) |

The webhook is idempotent on `(source, external_event_id)`. A failed attempt
records a `processing_error` but leaves `processed_at` NULL, so an RC
redelivery **re-runs** the event instead of short-circuiting as a duplicate.

### Trial (derived, not stored)

There is no trial row. The trial is computed in
`lib/entitlements/config.ts` + `service.ts` from the profile:

- trial window = `[max(profile.created_at, SUBSCRIPTION_LAUNCH_DATE), +TRIAL_DAYS]`
- starting the window at the later of signup and launch gives **existing users
  a fresh trial** when the paywall goes live, not an already-expired one.
- if `SUBSCRIPTION_LAUNCH_DATE` is unset, the trial **fails open** (always
  active) — nobody is locked out before the owner configures launch.

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
| `SUBSCRIPTION_LAUNCH_DATE` | unset → trial fails open | ISO date the paywall goes live; trial starts at `max(signup, this)` |
| `TRIAL_DAYS` | `7` | App-level trial length (positive integer) |
| `BILLING_ENFORCEMENT_ENABLED` | `false` | Global enforcement kill-switch — routes block only when `true` |
| `REVENUECAT_WEBHOOK_SECRET` | unset → webhook returns 503 | Shared secret; RC echoes it verbatim in the `Authorization` header |
| `NEXT_PUBLIC_REVENUECAT_WEB_API_KEY` | unset → web purchase buttons hidden | RC Web Billing public API key for `purchases-js` |

## Owner dashboard setup checklist

### RevenueCat

1. Create the RC project; add an **iOS app**, an **Android app**, and a **Web
   Billing** app.
2. Create one entitlement: **`premium`**.
3. Create products and attach them to `premium`. Product ids must match
   `lib/billing/products.ts`:
   - mobile: `nham_premium_monthly`, `nham_premium_annual`, `nham_premium_lifetime`
   - web: `nham_premium_monthly_web`, `nham_premium_annual_web`, `nham_premium_lifetime_web`
4. Build an **offering** with the three packages.
5. Add the **webhook**: URL `https://<domain>/api/webhooks/revenuecat`, with an
   `Authorization` header whose value equals `REVENUECAT_WEBHOOK_SECRET`.
6. Copy the Web Billing public key into `NEXT_PUBLIC_REVENUECAT_WEB_API_KEY`.

### App Store Connect (iOS)

1. Sign the **Paid Apps** agreement (Apple pays nothing until this is signed).
2. Create the **3 IAPs** matching the mobile product ids above.
3. Create a **sandbox tester** account for testing.

### Google Play Console (Android)

1. Complete the **merchant / payments profile**.
2. Create the matching subscription + one-time products.

### Paddle (web)

1. Open a Paddle account (an **indie / personal** account is fine; Paddle
   supports **worldwide payouts**, including payout to **Vietnam**).
2. Connect Paddle to RC's **Web Billing** configuration.
3. **Set web prices LOWER than mobile** to offset the ~30% App Store / Play
   cut. **Never surface or mention web pricing inside the iOS app** (App Store
   guideline compliance).

## Sandbox test plan

- **RC test events**: fire `TEST` and lifecycle events from the RC dashboard;
  confirm rows land in `billing_webhook_events` and grants update.
- **StoreKit config**: use a local StoreKit configuration file to exercise the
  iOS purchase flow in the simulator.
- **TestFlight + sandbox tester**: full iOS purchase/restore against the App
  Store sandbox.
- **purchases-js sandbox key**: use the RC Web Billing sandbox key to run the
  web checkout end-to-end without real charges.

Note: sandbox webhook events (`environment=SANDBOX`) are always recorded, but
in **production** they do NOT mutate grants (recorded as `sandbox_ignored`). In
dev/preview they DO apply so the flow is testable.

## Rollout runbook

Ship dark, then flip switches — no code deploy needed to go live:

1. **Ship dark**: deploy with `BILLING_ENFORCEMENT_ENABLED=false` and
   `SUBSCRIPTION_LAUNCH_DATE` unset. Everything is computed, nothing blocks.
2. **Configure dashboards**: complete the checklists above; verify a sandbox
   purchase writes a grant via the webhook.
3. **Set `SUBSCRIPTION_LAUNCH_DATE`**: this starts trial windows (existing users
   get a fresh `TRIAL_DAYS` window from the launch date).
4. **Announce** the launch to users.
5. **Enable enforcement**: set `BILLING_ENFORCEMENT_ENABLED=true`. Locked-out
   users now get the paywall (web 402 → PaywallDialog; Flutter 402 → paywall).

**Rollback**: set `BILLING_ENFORCEMENT_ENABLED=false`. Enforcement stops
immediately; grants and trials are untouched.

## Known limitations

- **TRANSFER is unhandled.** RC's `TRANSFER` payload carries only from/to App
  User ID arrays, no transaction ids, so we cannot determine which grants to
  reassign. These are recorded as `processing_error='transfer_unhandled'`
  rather than guessed. `reassignGrants` exists for admin tooling that knows the
  refs.
- **No VietQR / direct-bank web payment yet.** Web checkout is Paddle-only. The
  entitlement model (`source`, `store`) is designed to allow adding another
  gateway later without schema changes.
- **Personal income tax on payouts is the owner's responsibility** (Paddle is a
  merchant of record for VAT/sales tax on the sale side, but not for the
  owner's personal income tax).
