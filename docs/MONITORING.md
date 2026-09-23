# Monitoring: Sentry (errors) + PostHog (product analytics)

Two tools, both on the web app and the Flutter app. Sentry is in its **US region** (the
existing `vo-minh-khoi` organisation, which cannot change region); PostHog is on its
**EU cloud**:

| | Sentry | PostHog |
|---|---|---|
| Answers | "What broke, for whom, since which release?" | "What do people do, and where do they drop off?" |
| Sends | Unhandled + reported errors, 10% of traces | The typed events below, plus page/screen views |
| Never sends | Request bodies, cookies, headers, query strings, email, IP, screen recordings | Meal text, body metrics, email, clicks (no autocapture), screen recordings |
| Off when | `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` is empty | `NEXT_PUBLIC_POSTHOG_KEY` / `POSTHOG_KEY` is empty |

Both are **key-gated no-ops**: local dev, CI and tests send nothing unless a key is set.
They are listed as providers in the privacy policy (`content/docs/{en,vi}/legal/privacy.mdx`
§2, §4, §5, §9, §12). Change what they collect → update the policy in the same PR.

## Setup (one-time, by a person)

1. **Sentry**: done. The `vo-minh-khoi` organisation (US region) already has two projects,
   `kallo-web` (Next.js) and `kallo-mobile` (Flutter). Each DSN is under Settings →
   Projects → *project* → Client Keys (DSN). A region is fixed when an organisation is
   created; moving to the EU means a new organisation plus changing the `connect-src`
   host in `lib/infra/security/csp.ts` and §5/§9 of the privacy policy.
   - Settings → Subscription → set the on-demand / pay-as-you-go budget to **$0** so the
     free tier can never bill.
   - Done: an Organization Auth Token `kallo-ci-sourcemaps` (scope `org:ci` — source-map
     upload and releases only) is stored as the `SENTRY_AUTH_TOKEN` secret.
2. **PostHog**: done. The `Kallo` organisation on eu.posthog.com (**EU cloud**) has one
   project ("Default project") for both clients; its key (`phc_…`) is under Settings →
   Project → General. Autocapture and exception autocapture are off; session replay
   was never on.
   - Settings → Project → turn **Session replay OFF**, **Autocapture OFF**,
     **Exception autocapture OFF** (the code pins these off too; this keeps the dashboard
     honest).
   - Billing → set a billing limit of **$0** per product.
3. **GitHub → Settings → Secrets and variables → Actions** (all of these are set):

   | Kind | Name | Value |
   |---|---|---|
   | Variable | `NEXT_PUBLIC_SENTRY_DSN` | `kallo-web` DSN |
   | Variable | `NEXT_PUBLIC_POSTHOG_KEY` | PostHog key |
   | Variable | `SENTRY_ORG` / `SENTRY_PROJECT` | org slug / `kallo-web` (source maps only) |
   | Secret | `SENTRY_AUTH_TOKEN` | org auth token (source maps only) |
   | Variable | `KALLO_SENTRY_DSN` | `kallo-mobile` DSN (iOS TestFlight lane) |
   | Variable | `KALLO_POSTHOG_KEY` | PostHog key (iOS TestFlight lane) |

   DSNs and PostHog keys can only *submit* data, which is why they are variables and are
   baked into client bundles. The auth token can read and write your Sentry org: it is a
   secret, passed to `docker build` as a BuildKit secret, so it is never in an image layer.
4. Merge → the next CI image build picks the web keys up; the next TestFlight build the
   mobile ones. Nothing else is needed: the prod deploy sets `SENTRY_ENVIRONMENT=production`.

Local: put the same names in `.env.local` (web), or export `POSTHOG_KEY` / `SENTRY_DSN`
before `bun dev:mobile` (Flutter).

## Where the code lives

**Web**
- `instrumentation.ts`: server + Edge Sentry init, `onRequestError` (uncaught route /
  Server Component / Server Action errors).
- `instrumentation-client.ts`: browser Sentry init + `initAnalytics()`.
- `lib/infra/telemetry/telemetry-url.ts`: every outgoing URL → origin + route template
  (`/vi/invite/abc?ref=x` → `/vi/invite/:param`), built on `routeTemplate`
  (`lib/infra/route-template/`), the same position-based redaction CSP reports use.
- `lib/infra/telemetry/monitoring/`: shared Sentry options, `scrubEvent` / `scrubBreadcrumb`
  (drops console breadcrumbs; allowlists breadcrumb data),
  `reportError(error, scope)` for errors that are caught (error boundaries, the
  analyze-meal stream). `lib/core/errors/serialize.ts` reports unknown 500s directly.
- `lib/infra/telemetry/analytics/`: PostHog init, `events.ts` (the event list), `track()`.
- `components/providers/telemetry-identity.tsx`: one Supabase auth listener → PostHog
  identify/reset + Sentry user (opaque account id only).
- `app/global-error.tsx`: catches errors in the root layout itself.
- `lib/infra/security/csp.ts`: `connect-src` allows `*.ingest.us.sentry.io`,
  `eu.i.posthog.com`, `eu-assets.i.posthog.com`.

**Flutter** (`apps/mobile-flutter/lib/`)
- `main.dart`: boots inside `runWithMonitoring` (Sentry catches startup crashes), then
  `Analytics.setup()`.
- `services/monitoring/monitoring.dart`: Sentry init, `scrubEvent`, `setMonitoringUser`.
- `services/analytics/`: the PostHog facade, `analytics_events.dart`, and
  `screen_tracking.dart` (one screen view per go_router route PATTERN).
- `app.dart` `_syncSession`: identity for PostHog + Sentry on sign-in / sign-out.
- PostHog's native auto-init is disabled in `AndroidManifest.xml` and `Info.plist`.

## Events

| Event | Properties | Web | Flutter |
|---|---|---|---|
| `meal_logged` | `method` (`ai` \| `manual`), `is_cheat` | confirm + manual save | confirm |
| `paywall_viewed` | none | paywall dialog opens | paywall screen |
| `checkout_started` | `package_id` | package picked | package picked |
| `purchase_completed` | `package_id`, `status` (`paid` \| `payment_pending`) | ✓ | ✓ |
| `purchase_failed` | `package_id` | ✓ | ✓ |
| `$pageview` / `$screen` | route template (web) / go_router pattern (Flutter) | automatic | automatic |

**Adding one:** add it to `lib/infra/telemetry/analytics/events.ts` (web; the type makes `track()`
reject anything else) and `services/analytics/analytics_events.dart` (Flutter) with the
**same name**, then call `track(...)` / `analytics.capture(...)`. Properties must be
enums, counts or ids of *our* catalogue (package ids): never free text the user typed.

## Cost

Free tiers at the time of writing (check the pricing pages; they change): Sentry
Developer has 5k errors/month and one seat (Team, $26/mo, adds seats); PostHog has 1M
events/month. With $0 caps, going over the limit drops data rather than billing you.
`IGNORED_ERRORS` in `sentry-options.ts` keeps user-cancelled and flaky-network errors from
using up the error quota.

## Known gaps / follow-ups

- **Exception messages are sent as written.** The scrubbers remove request payloads,
  URLs' identifying parts and console breadcrumbs, but an `Error`'s own `message` goes to
  Sentry verbatim. Never interpolate meal text, body metrics or email into an error
  message; log it separately (console output is not sent) if you need it.
- **Account deletion** does not yet delete the PostHog person or Sentry user data for the
  account. Events carry only the opaque id, but a full erasure should call PostHog's
  person-delete API from the deletion job (`lib/domain/account-deletion/`).
- **Ad blockers** block `*.posthog.com` / `*.sentry.io` for some visitors. A same-origin
  reverse proxy (Sentry `tunnelRoute`, a PostHog `/ingest` rewrite) would fix it, but
  needs its own route-inventory and middleware work.
- **App Store privacy label / Play data safety**: update both by hand ("Diagnostics:
  crash data" and "Usage data: product interaction", linked to the user, not used for
  tracking) before shipping a build with keys.
- **Android** has no release lane in the repo yet; when one is added, pass
  `POSTHOG_KEY` / `SENTRY_DSN` like `ios/fastlane/Fastfile` does.
