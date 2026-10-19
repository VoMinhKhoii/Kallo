// The app's API calls the dev server answered with an error. The iOS app often
// shows a failed request as an empty or "didn't load" state and logs nothing,
// and a background call (entitlements, invites) can fail on a screen that looks
// fine, so the server's own request log is where it shows.

// `next dev` logs one line per request: " GET /api/v1/dashboard?… 401 in 4.0s".
const REQUEST = /^\s*(GET|POST|PUT|PATCH|DELETE) (\/api\/v1\/\S+) (\d{3}) in /;

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
