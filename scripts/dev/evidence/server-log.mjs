// The app's API calls the dev server answered with an error. The iOS app often
// shows a failed request as an empty or "didn't load" state and logs nothing,
// and a background call (entitlements, invites) can fail on a screen that looks
// fine, so the server's own request log is where it shows.

import { createHash } from 'node:crypto';

// `next dev` logs one line per request: " GET /api/v1/dashboard?… 401 in 4.0s".
const REQUEST = /^\s*(GET|POST|PUT|PATCH|DELETE) (\/api\/v1\/\S+) (\d{3}) in /;
// The bytes before a mark that must still be there for the mark to hold.
const WITNESS_BYTES = 256;

/** Each failing endpoint once, with how often it failed. */
export function apiFailures(log) {
  const counts = new Map();
  for (const line of log.split('\n')) {
    const match = line.match(REQUEST);
    if (!match || Number(match[3]) < 400) continue;
    const key = `${match[1]} ${match[2].split('?')[0]} → ${match[3]}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].map(([key, n]) => (n > 1 ? `${key} (${n}×)` : key));
}

/**
 * Marks the end of the log as the start of a run: its length, and a hash of
 * the bytes just before it.
 * @param {Buffer} log
 */
export function markLog(log) {
  return { offset: log.length, witness: witnessAt(log, log.length) };
}

/**
 * The log written since `mark`, or all of it when the mark no longer holds. A
 * dev server restarted with `>` truncates the same file, so once it regrows its
 * length says nothing; the bytes before the offset show whether it is still
 * the log that was marked.
 * @param {Buffer} log
 * @param {{ offset: number, witness: string } | null} mark
 */
export function sinceMark(log, mark) {
  const holds =
    mark !== null &&
    mark.offset <= log.length &&
    witnessAt(log, mark.offset) === mark.witness;
  return {
    text: log.subarray(holds ? mark.offset : 0).toString('utf8'),
    fromMark: holds,
  };
}

function witnessAt(log, offset) {
  return createHash('sha256')
    .update(log.subarray(Math.max(0, offset - WITNESS_BYTES), offset))
    .digest('hex');
}
