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
 */
export const PRIVATE_PATH_PREFIXES = [
  '/dashboard',
  '/settings',
  '/circle',
  '/nutrition',
  '/logging',
  '/onboarding',
  '/activity',
] as const;

/** Published in robots.txt. */
export const ROBOTS_DISALLOWED_PREFIXES = PRIVATE_PATH_PREFIXES;

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
 * to the sign-in dialog.
 */
export function needsSignIn(path: string): boolean {
  return underPrefix(path, PRIVATE_PATH_PREFIXES);
}
