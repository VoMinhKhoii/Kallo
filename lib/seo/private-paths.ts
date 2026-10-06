/**
 * The authenticated app surfaces, as locale-relative path prefixes — every
 * route under `app/[locale]/(app)/`.
 *
 * Three consumers need the same list and must never disagree: `app/robots.ts`
 * (which tells crawlers not to index them), the markdown content negotiation
 * in `proxy.ts` (which must let them fall through to the normal HTML pipeline
 * rather than answering with a markdown 404), and the signed-out redirect in
 * `lib/infra/supabase/middleware.ts` (which sends them to the sign-in
 * dialog). A second hand-maintained copy would drift the first time a surface
 * is added.
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
  '/activity',
] as const;

/**
 * The private surfaces it is safe to name in public: everything but `/admin`.
 *
 * `/admin` is excluded on purpose: naming it would publicly advertise that an
 * admin surface exists. It is gated by ADMIN_EMAILS (`requireAdmin()` answers
 * a 404), and a robots entry or a sign-in redirect naming it only helps an
 * attacker enumerate it.
 */
const NAMEABLE_PRIVATE_PREFIXES = PRIVATE_PATH_PREFIXES.filter(
  (path) => path !== '/admin'
);

/** The subset published in robots.txt. */
export const ROBOTS_DISALLOWED_PREFIXES = NAMEABLE_PRIVATE_PREFIXES;

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

/** True when `path` is one of `prefixes` or sits under one of them. */
function underPrefix(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

const KNOWN_NON_MARKDOWN_PREFIXES = [
  ...PRIVATE_PATH_PREFIXES,
  ...PUBLIC_NON_MARKDOWN_PREFIXES,
];

/** True when `path` (locale-relative, e.g. `/dashboard/x`) is a known page. */
export function isKnownNonMarkdownPath(path: string): boolean {
  return underPrefix(path, KNOWN_NON_MARKDOWN_PREFIXES);
}

/**
 * True when a signed-out visitor to `path` (locale-relative) should be sent
 * to the sign-in dialog. `/admin` keeps its 404 instead.
 */
export function needsSignIn(path: string): boolean {
  return underPrefix(path, NAMEABLE_PRIVATE_PREFIXES);
}
