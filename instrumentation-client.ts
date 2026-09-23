/**
 * Browser init hook — Next.js runs this before the app hydrates.
 *
 * Sentry only here; product analytics (PostHog) is initialised by
 * `lib/infra/analytics/init.ts`. Both are off unless their public key is set
 * at build time, so local dev and CI ship nothing.
 */
import * as Sentry from '@sentry/nextjs';
import { initAnalytics } from '@/lib/infra/analytics/init';
import {
  clientSentryEnvironment,
  DENIED_URLS,
  sharedSentryOptions,
} from '@/lib/infra/monitoring/sentry-options';

Sentry.init({
  ...sharedSentryOptions(clientSentryEnvironment(window.location.hostname)),
  denyUrls: DENIED_URLS,
});

initAnalytics();

/** Names client-side navigations in Sentry traces. */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
