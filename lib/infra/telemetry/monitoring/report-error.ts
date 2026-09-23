import * as Sentry from '@sentry/nextjs';

/**
 * Send an error we CAUGHT to Sentry. Uncaught errors in routes, Server
 * Components and Server Actions already reach Sentry through
 * `onRequestError` in `instrumentation.ts`; this is for the paths that catch
 * and recover (an error boundary, the analyze-meal stream, the JSON error
 * serializer), which Sentry would otherwise never see.
 *
 * `scope` is the same `[scope]` prefix the matching `console.error` uses, so
 * a Sentry issue and a Cloud Run log line can be matched by eye. Pass the
 * error only — never the request payload (see `sentry-options.ts`).
 *
 * A no-op when Sentry is not initialised (no DSN).
 */
export function reportError(error: unknown, scope: string): void {
  Sentry.captureException(error, { tags: { scope } });
}
