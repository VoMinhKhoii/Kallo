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
 * Also starts error reporting (Sentry) and product analytics (PostHog —
 * `lib/infra/analytics/init.ts`). Both are off unless their public key is set
 * at build time, so local dev and CI ship nothing.
 */
import * as Sentry from '@sentry/nextjs';
import { z } from 'zod';
import { initAnalytics } from '@/lib/infra/analytics/init';
import {
  clientSentryEnvironment,
  DENIED_URLS,
  sharedSentryOptions,
} from '@/lib/infra/monitoring/sentry-options';

z.config({ jitless: true });

Sentry.init({
  ...sharedSentryOptions(clientSentryEnvironment(window.location.hostname)),
  denyUrls: DENIED_URLS,
});

initAnalytics();

/** Names client-side navigations in Sentry traces. */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
