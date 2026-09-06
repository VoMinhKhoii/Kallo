/**
 * One `console.error` per scope per 30s, shared by everything in this folder.
 *
 * Every failure path here fires on the SAME traffic that caused it: a limiter
 * outage means every request logs, a telemetry outage means every block logs.
 * Unthrottled, the log volume of the failure exceeds the cost of the failure —
 * and the logs are how you find out what happened.
 *
 * Per-isolate, so a 20-instance fleet can still emit 20 lines in a window.
 * Accepted: the alternative is coordination state we have nowhere to keep, and
 * the point is to stop ONE instance from turning an outage into a log flood.
 */

const LOG_THROTTLE_MS = 30_000;

const lastLoggedAtMsByScope = new Map<string, number>();

/** `false` when the line was suppressed — useful for asserting in tests. */
export function logThrottled(
  scope: string,
  message: string,
  error?: unknown
): boolean {
  const now = Date.now();
  const last = lastLoggedAtMsByScope.get(scope);

  if (last != null && now - last < LOG_THROTTLE_MS) return false;

  lastLoggedAtMsByScope.set(scope, now);

  if (error === undefined) console.error(message);
  else console.error(message, error);

  return true;
}

/** Drops every throttle timer. Tests only. */
export function resetLogThrottleForTests() {
  lastLoggedAtMsByScope.clear();
}
