/**
 * The authenticated app surfaces, as locale-relative path prefixes.
 *
 * Two consumers need the same list and must never disagree: `app/robots.ts`
 * (which tells crawlers not to index them) and the markdown content
 * negotiation in `middleware.ts` (which must let them fall through to the
 * normal HTML pipeline rather than answering with a markdown 404). A second
 * hand-maintained copy would drift the first time a surface is added.
 *
 * `/admin` is deliberately absent from the robots output — see the note there
 * — but IS listed here, because negotiation needs to recognise it as a real
 * page rather than an unknown path. Being in this list does not put a path in
 * robots.txt; `app/robots.ts` filters to the subset it publishes.
 */
export const PRIVATE_PATH_PREFIXES = [
  '/dashboard',
  '/settings',
  '/circle',
  '/nutrition',
  '/logging',
  '/onboarding',
  '/admin',
] as const;

/**
 * The subset published in robots.txt.
 *
 * `/admin` is excluded on purpose: listing it would publicly advertise that an
 * admin surface exists. It is gated by ADMIN_EMAILS, and a robots entry only
 * helps an attacker enumerate it.
 */
export const ROBOTS_DISALLOWED_PREFIXES = PRIVATE_PATH_PREFIXES.filter(
  (path) => path !== '/admin'
);

/**
 * Public, non-markdown pages that exist under a locale prefix.
 *
 * Negotiation must not answer these with a markdown 404 — they are real pages,
 * they just have no markdown representation.
 */
export const PUBLIC_NON_MARKDOWN_PREFIXES = [
  '/invite',
  '/reset-password',
  '/design-system',
] as const;

/** True when `path` (locale-relative, e.g. `/dashboard/x`) is a known page. */
export function isKnownNonMarkdownPath(path: string): boolean {
  return [...PRIVATE_PATH_PREFIXES, ...PUBLIC_NON_MARKDOWN_PREFIXES].some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}
