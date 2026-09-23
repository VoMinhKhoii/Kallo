/**
 * Sentry options shared by every runtime (browser, Node server, Edge).
 *
 * Sentry is OFF unless `NEXT_PUBLIC_SENTRY_DSN` is set: with no DSN the SDK
 * never initialises, so local dev, CI and tests send nothing. The DSN is a
 * public ingest address (it can only submit events), which is why it rides a
 * `NEXT_PUBLIC_` build arg like the Supabase publishable key.
 *
 * Privacy posture — the privacy policy treats meal text and body metrics as
 * sensitive personal data, so an error report carries the stack and the
 * request's route, never its payload:
 *   • `sendDefaultPii: false` — no IP, no cookies, no request headers;
 *   • `scrubEvent` strips request bodies, cookies, query strings and any
 *     user field other than the opaque account id, and reduces the URL to its
 *     route pattern (no invite slug, share id or group id);
 *   • `scrubBreadcrumb` does the same to navigation / fetch breadcrumb URLs;
 *   • no Session Replay integration is ever added.
 */
import { patternUrl, routePattern } from '@/lib/infra/analytics/route-pattern';
import { SITE_URL } from '@/lib/seo/site';

const PRODUCTION_HOST = new URL(SITE_URL).hostname;

/** The subset of a Sentry event `scrubEvent` touches. */
interface ScrubbableEvent {
  request?: {
    url?: string;
    data?: unknown;
    cookies?: unknown;
    headers?: unknown;
    query_string?: unknown;
  };
  user?: { id?: string | number } & Record<string, unknown>;
}

/**
 * Remove anything that could carry user-entered content from an event before
 * it leaves the process. Pure and synchronous so it can be unit-tested and run
 * as `beforeSend` in every runtime.
 */
export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  if (event.request) {
    if (event.request.url) event.request.url = patternUrl(event.request.url);
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.query_string;
  }
  if (event.user) {
    event.user = event.user.id == null ? {} : { id: event.user.id };
  }
  return event;
}

/** Breadcrumb data keys that hold a URL (navigation, fetch, xhr). */
const BREADCRUMB_URL_KEYS = ['url', 'from', 'to'] as const;

interface ScrubbableBreadcrumb {
  data?: Record<string, unknown>;
}

/** Reduce every URL a breadcrumb carries to origin + route pattern. */
export function scrubBreadcrumb<T extends ScrubbableBreadcrumb>(crumb: T): T {
  if (!crumb.data) return crumb;
  for (const key of BREADCRUMB_URL_KEYS) {
    const value = crumb.data[key];
    if (typeof value !== 'string') continue;
    crumb.data[key] = value.startsWith('/')
      ? routePattern(value.split(/[?#]/)[0])
      : patternUrl(value);
  }
  return crumb;
}

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
    beforeSendTransaction: scrubEvent,
  };
}
