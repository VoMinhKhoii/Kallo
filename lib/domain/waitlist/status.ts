/**
 * Outcomes the waitlist confirm link can produce, surfaced as
 * `?waitlist=<status>`.
 *
 * Not in the signup contract (`lib/api/contracts/waitlist.ts`): the landing
 * page's toast reads this list in the browser, and importing it from there
 * would load classic Zod (~95 KB gzipped) for one array of strings.
 */
export const WAITLIST_STATUSES = [
  'confirmed',
  'already',
  'expired',
  'invalid',
] as const;

export type WaitlistStatus = (typeof WAITLIST_STATUSES)[number];
