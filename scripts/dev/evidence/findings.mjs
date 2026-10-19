// What a captured page shows wrong, and the report a PR's Evidence section links.
// Pure: capture-web.mjs gathers the observations, this judges them.

/**
 * @typedef {{
 *   route: string, viewport: string, status: number | null, finalPath: string,
 *   signedIn: boolean, consoleErrors: string[], pageErrors: string[],
 *   serverErrors: string[], failedRequests: string[], overflowPx: number,
 *   brokenImages: string[], screenshot: string, captureError: string | null
 * }} Observation
 */

// A signed-in capture that lands here lost its session.
const SIGN_IN_PATH = /\/(?:sign-in|sign-up|auth)(?:\/|$)/;
const MAX_ISSUE_CHARS = 240;

/** The problems one page shows, each a line a person can act on. */
export function issuesFor(observation) {
  const o = observation;
  const issues = [];
  if (o.captureError) issues.push(`capture failed: ${o.captureError}`);
  if (o.status !== null && o.status >= 400) issues.push(`HTTP ${o.status}`);
  if (o.signedIn && SIGN_IN_PATH.test(o.finalPath)) {
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
 * excuses: issues already shown to happen on main, matched by substring.
 */
export function judge(observation, allow = []) {
  const all = issuesFor(observation);
  const isAllowed = (issue) => allow.some((pattern) => issue.includes(pattern));
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
