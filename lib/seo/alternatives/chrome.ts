/** The labels every alternatives page shares: table heads and per-app fields. */
export const ALTERNATIVES_CHROME = {
  /** The English footer column that links every alternatives page. */
  footerLabel: 'App alternatives',
  /** The line under the title, from the page's `checkedOn` (`YYYY-MM-DD`). */
  checked: (isoDate: string) =>
    `Prices checked ${new Date(`${isoDate}T00:00:00Z`).toLocaleDateString(
      'en-GB',
      { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }
    )}`,
  tableHeads: {
    app: 'App',
    logs: 'Logs a meal by',
    free: 'Free plan',
    paid: 'Paid plan (US)',
  },
  labels: {
    logs: 'Logs a meal by',
    free: 'Free',
    paid: 'Paid (US)',
    platforms: 'Platforms',
    bestFor: 'Best for',
    drawback: 'Drawback',
    sources: 'Sources',
    ours: 'our app',
  },
} as const;
