// What a captured page shows wrong, and the report a PR's Evidence section links.
// Pure: capture-web.mjs gathers the observations, this judges them.

/**
 * `finalPath` is where the page ended up, path and query.
 * @typedef {{
 *   route: string, viewport: string, status: number | null, finalPath: string,
 *   signedIn: boolean, consoleErrors: string[], pageErrors: string[],
 *   serverErrors: string[], failedRequests: string[], overflowPx: number,
 *   brokenImages: string[], screenshot: string, captureError: string | null
 * }} Observation
 */

// A signed-in capture that lands here lost its session: the app sends a
// signed-out visit to `/<locale>?auth=sign-in&next=…`, which opens the sign-in
// dialog over the landing page. The dialog opens on exactly `sign-in` or
// `sign-up` (components/auth/request-config/auth-request-config.tsx), so the
// value must end there.
const SIGN_IN =
  /[?&]auth=sign-(?:in|up)(?:&|$)|\/(?:sign-in|sign-up|auth)(?:[/?]|$)/;
// A run cannot pass without a real screenshot of the page, whatever --allow says.
const NOT_CAPTURED = ['capture failed:', 'landed on '];
const MAX_ISSUE_CHARS = 240;

/** The problems one page shows, each a line a person can act on. */
export function issuesFor(observation) {
  const o = observation;
  const issues = [];
  if (o.captureError) issues.push(`capture failed: ${o.captureError}`);
  if (o.status !== null && o.status >= 400) issues.push(`HTTP ${o.status}`);
  if (o.signedIn && SIGN_IN.test(o.finalPath)) {
    issues.push(`landed on ${o.finalPath}: the session did not hold`);
  }
  for (const e of unique(o.pageErrors)) issues.push(`uncaught error: ${e}`);
  for (const e of unique(o.consoleErrors)) issues.push(`console error: ${e}`);
  for (const r of unique(o.serverErrors)) issues.push(`server error: ${r}`);
  for (const r of unique(o.failedRequests)) issues.push(`request failed: ${r}`);
  // One pixel is subpixel rounding, not a layout that scrolls sideways.
  if (o.overflowPx > 1) {
    issues.push(`page scrolls sideways by ${o.overflowPx}px`);
  }
  for (const src of unique(o.brokenImages))
    issues.push(`image did not load: ${src}`);
  // Stack traces stay in report.json; the summary keeps the message.
  return unique(issues.map((i) => i.split('\n')[0].slice(0, MAX_ISSUE_CHARS)));
}

/**
 * Splits a page's problems into those that fail the run and those `allow`
 * excuses: issues already shown to happen on main, matched by substring. A page
 * that was never captured, or captured signed out, is never excused.
 */
export function judge(observation, allow = []) {
  const all = issuesFor(observation);
  const isAllowed = (issue) =>
    !NOT_CAPTURED.some((prefix) => issue.startsWith(prefix)) &&
    allow.some((pattern) => issue.includes(pattern));
  return {
    issues: all.filter((i) => !isAllowed(i)),
    allowed: all.filter(isAllowed),
  };
}

/** The Markdown report: one row per screenshot, then each page's problems. */
export function reportMarkdown(observations, allow = []) {
  const judged = observations.map((o) => ({ o, ...judge(o, allow) }));
  const rows = judged.map(({ o, issues, allowed }) => {
    const landed = o.finalPath === o.route ? '' : ` → ${o.finalPath}`;
    const verdict = [
      issues.length === 0 ? 'ok' : `${issues.length} issue(s)`,
      ...(allowed.length > 0 ? [`${allowed.length} allowed`] : []),
    ].join(', ');
    return `| \`${o.route}\`${landed} | ${o.viewport} | ${o.status ?? '—'} | ${verdict} | ${o.screenshot} |`;
  });
  const details = judged.flatMap(({ o, issues, allowed }) => {
    if (issues.length + allowed.length === 0) return [];
    return [
      `### \`${o.route}\` (${o.viewport})`,
      ...issues.map((i) => `- ${i}`),
      ...allowed.map((i) => `- allowed, also on main: ${i}`),
      '',
    ];
  });
  return [
    '| Route | Width | HTTP | Result | Screenshot |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
    '',
    ...details,
  ].join('\n');
}

function unique(items) {
  return [...new Set(items)];
}
