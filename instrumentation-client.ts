/**
 * Runs in the browser before the app hydrates (Next's client instrumentation
 * hook).
 *
 * Zod 4 feature-detects a JIT for object schemas by calling `new Function('')`
 * on first parse. The enforced CSP (lib/infra/security/csp.ts) has no
 * `'unsafe-eval'`, so that probe is refused — Zod catches it and falls back,
 * but the browser still files a `script-src` violation and a report to
 * `/api/csp-report` on every page that parses a schema. `jitless` skips the
 * probe; parsing already ran without the JIT under this policy, so nothing
 * changes except the noise.
 *
 * `config` comes from `zod/mini`, not `{ z } from 'zod'`: this file runs on
 * every page, and the `z` namespace drags all of classic Zod (with every locale,
 * ~95 KB gzipped) into the first bundle. The setting lives in Zod's shared core,
 * so it holds for classic schemas too.
 *
 * Also starts error reporting (Sentry). It is off unless its DSN is set at build
 * time, so local dev and CI ship nothing. Product analytics (PostHog) is NOT
 * started here: it loads on first use (`lib/infra/telemetry/analytics/init.ts`).
 */
import * as Sentry from '@sentry/nextjs';
import { config } from 'zod/mini';
import {
  clientSentryEnvironment,
  DENIED_URLS,
  sharedSentryOptions,
} from '@/lib/infra/telemetry/monitoring/sentry-options';

config({ jitless: true });

Sentry.init({
  ...sharedSentryOptions(clientSentryEnvironment(window.location.hostname)),
  denyUrls: DENIED_URLS,
});

/** Names client-side navigations in Sentry traces. */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
