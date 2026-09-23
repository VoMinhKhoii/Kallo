/**
 * Turn a URL path into the route it matched, with every user-specific segment
 * replaced by its placeholder and the locale prefix dropped.
 *
 * Analytics needs "how many people opened an invite", not WHICH invite: an
 * invite slug, a shared-meal id or a group id is a capability or an identifier,
 * and would otherwise be stored in every event's URL. Public docs paths are
 * content, not identifiers, so they pass through.
 *
 * Keep in step with the dynamic segments under `app/[locale]/`.
 */
const DYNAMIC_ROUTES: Array<[RegExp, string]> = [
  [/^\/invite\/[^/]+/, '/invite/[slug]'],
  [/^\/circle\/g\/[^/]+/, '/circle/g/[groupId]'],
  [/^\/circle\/(?!g(\/|$))[^/]+/, '/circle/[shareId]'],
  [/^\/admin\/feedback\/[^/]+/, '/admin/feedback/[id]'],
  [/^\/admin\/requests\/[^/]+/, '/admin/requests/[id]'],
  [/^\/admin\/prompts\/[^/]+/, '/admin/prompts/[name]'],
];

const LOCALE_PREFIX = /^\/(en|vi)(?=\/|$)/;

export function routePattern(pathname: string): string {
  const path = pathname.replace(LOCALE_PREFIX, '') || '/';
  for (const [pattern, placeholder] of DYNAMIC_ROUTES) {
    if (pattern.test(path)) return path.replace(pattern, placeholder);
  }
  return path;
}

/**
 * Any URL reduced to origin + route pattern, with no query string or hash.
 * For telemetry that cannot tell our origin from a third party's (server-side
 * Sentry sits behind Cloudflare) — a third-party path is not one of our routes,
 * so `routePattern` leaves it as is. Non-URLs pass through unchanged.
 */
export function patternUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return value;
  }
  return url.origin + routePattern(url.pathname);
}

/**
 * A URL reduced to what analytics may keep. Our own URLs become
 * origin + route pattern — no query string, no hash, since those carry
 * waitlist tokens, auth codes and invite slugs. A third-party URL (a referrer)
 * keeps only its origin.
 */
export function sanitizeUrl(value: string, ownOrigin: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return '';
  }
  if (url.origin !== ownOrigin) return url.origin;
  return url.origin + routePattern(url.pathname);
}
