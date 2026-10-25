import * as Sentry from '@sentry/nextjs';

/**
 * Send an error we CAUGHT to Sentry. Uncaught errors in routes, Server
 * Components and Server Actions already reach Sentry through
 * `onRequestError` in `instrumentation.ts`; this is for the paths that catch
 * and recover (an error boundary, the analyze-meal stream), which Sentry
 * would otherwise never see.
 *
 * `scope` is the same `[scope]` prefix the matching `console.error` uses, so
 * a Sentry issue and a Cloud Run log line can be matched by eye. Pass the
 * error only — never the request payload.
 *
 * `redactMessage`: for code that handles user input. An exception message is
 * sent verbatim (no scrubber can know which words in it are the user's), and
 * input-derived text gets into messages easily — V8's `JSON.parse` error
 * quotes the start of its input. With it set, the report keeps the error's
 * type and stack frames and loses only the message; the full message stays
 * in the server log next to it.
 *
 * A no-op when Sentry is not initialised (no DSN).
 */
export function reportError(
  error: unknown,
  scope: string,
  {
    redactMessage = false,
    fingerprint,
  }: {
    redactMessage?: boolean;
    /**
     * Groups reports into one Sentry issue per value. A new value is a new
     * issue, which is what fires Sentry's "new issue" alert — use it for an
     * event that must alert every time it happens (one fingerprint per day).
     */
    fingerprint?: string[];
  } = {}
): void {
  const reported =
    redactMessage && error instanceof Error ? withoutMessage(error) : error;
  Sentry.captureException(reported, {
    tags: { scope },
    ...(fingerprint ? { fingerprint } : {}),
  });
}

function withoutMessage(error: Error): Error {
  const redacted = new Error('[message redacted: may contain user input]');
  redacted.name = error.name;
  // The stack repeats the message (over several lines if the message has
  // newlines); keep only the frame lines.
  const frames = error.stack
    ?.split('\n')
    .filter((line) => /^\s+at /.test(line))
    .join('\n');
  redacted.stack = frames
    ? `${error.name}: ${redacted.message}\n${frames}`
    : '';
  return redacted;
}
