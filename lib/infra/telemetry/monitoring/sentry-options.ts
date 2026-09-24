/**
 * Sentry options shared by every runtime (browser, Node server, Edge).
 *
 * Sentry is OFF unless `NEXT_PUBLIC_SENTRY_DSN` is set: with no DSN the SDK
 * never initialises, so local dev, CI and tests send nothing. The DSN is a
 * public ingest address (it can only submit events), which is why it rides a
 * `NEXT_PUBLIC_` build arg like the Supabase publishable key.
 *
 * Privacy posture: `sendDefaultPii: false` (no IP, cookies or request
 * headers), every payload through the scrubbers in `scrub.ts` (errors,
 * transactions and breadcrumbs), and no Session Replay integration, ever.
 */
import {
  scrubBreadcrumb,
  scrubEvent,
  scrubSpan,
  scrubTransaction,
} from '@/lib/infra/telemetry/monitoring/scrub';
import { SITE_URL } from '@/lib/seo/site';

const PRODUCTION_HOST = new URL(SITE_URL).hostname;

/**
 * Errors that are not ours to fix: a user cancelling a request, a flaky
 * network on a phone, or a browser extension throwing inside our page. Each
 * one would otherwise eat the free-tier error quota without an action.
 */
export const IGNORED_ERRORS: Array<string | RegExp> = [
  'AbortError',
  /The (user|operation) aborted a request/i,
  /^NetworkError when attempting to fetch resource/,
  /^Failed to fetch$/,
  /^Load failed$/,
  'ResizeObserver loop limit exceeded',
  'ResizeObserver loop completed with undelivered notifications',
];

/** Browser-extension frames — never our code. */
export const DENIED_URLS: RegExp[] = [
  /^chrome-extension:\/\//,
  /^moz-extension:\/\//,
  /^safari-(web-)?extension:\/\//,
];

export function sentryDsn(): string | undefined {
  return process.env.NEXT_PUBLIC_SENTRY_DSN || undefined;
}

/**
 * One CI image serves production AND previews, so the environment cannot be
 * baked at build time. The server reads `SENTRY_ENVIRONMENT`, which only the
 * prod deploy sets (`cloud-run-prod.yml`); any other production build is a
 * preview. The browser tells them apart by hostname.
 */
export function serverSentryEnvironment(): string {
  if (process.env.SENTRY_ENVIRONMENT) return process.env.SENTRY_ENVIRONMENT;
  return process.env.NODE_ENV === 'production' ? 'preview' : 'development';
}

export function clientSentryEnvironment(hostname: string): string {
  if (process.env.NODE_ENV !== 'production') return 'development';
  return hostname === PRODUCTION_HOST || hostname === `www.${PRODUCTION_HOST}`
    ? 'production'
    : 'preview';
}

/** Options every runtime passes to `Sentry.init`. */
export function sharedSentryOptions(environment: string) {
  return {
    dsn: sentryDsn(),
    enabled: Boolean(sentryDsn()),
    environment,
    release: process.env.NEXT_PUBLIC_APP_VERSION,
    sendDefaultPii: false,
    // 10% of requests traced: enough to see slow routes (analyze-meal) and
    // far inside the free tier's span allowance.
    tracesSampleRate: 0.1,
    ignoreErrors: IGNORED_ERRORS,
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
    beforeSendTransaction: scrubTransaction,
    // Standalone spans (INP, LCP, CLS) are sent on their own, not inside a
    // transaction, so `beforeSendTransaction` never sees them.
    beforeSendSpan: scrubSpan,
  };
}
