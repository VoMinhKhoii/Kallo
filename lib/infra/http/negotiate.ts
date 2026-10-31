import { locales } from '@/i18n/config';
import { isKnownDocSlug } from '@/lib/domain/docs/navigation';
import { MEDIA_MARKDOWN, preferredType } from '@/lib/infra/http/accept';
import {
  FOOD_PAGE_PREFIX,
  FOOD_SLUGS,
  foodPagePath,
} from '@/lib/seo/food-pages/slugs';
import { isKnownNonMarkdownPath } from '@/lib/seo/private-paths';

/**
 * Which representation a request should get — decided as a pure function so
 * the rules are testable without standing up a middleware runtime.
 *
 * `proxy.ts` owns the transport (rewrite, 406, `Vary`); this owns the
 * decision. Anything that reads a request or writes a response belongs there,
 * not here.
 */

export type Negotiation =
  /** Proceed with the normal HTML pipeline. */
  | { kind: 'pass' }
  /** Serve the markdown variant at `rewriteTo`. */
  | { kind: 'markdown'; rewriteTo: string }
  /** No such page: serve the markdown recovery body with a 404. */
  | { kind: 'markdown-not-found'; rewriteTo: string }
  /** The client accepts neither HTML nor Markdown. */
  | { kind: 'not-acceptable' };

/** Internal route family that renders every markdown variant. */
const MD_ROOT = '/md';

const LOCALE_SET: ReadonlySet<string> = new Set(locales);

interface LocalePath {
  locale: string;
  /** Locale-relative remainder, always leading-slash or empty for the root. */
  rest: string;
}

function splitLocale(pathname: string): LocalePath | null {
  const [, first, ...others] = pathname.split('/');
  if (!LOCALE_SET.has(first)) return null;
  return { locale: first, rest: others.length ? `/${others.join('/')}` : '' };
}

/** `/en/docs/overview` → the doc slug, or null when it is not a docs URL. */
function docSlug(rest: string): string | null {
  if (!rest.startsWith('/docs/')) return null;
  const slug = rest.slice('/docs/'.length);
  return isKnownDocSlug(slug) ? slug : null;
}

/**
 * The markdown route for a locale-relative path, or null when that path has no
 * markdown representation.
 */
function markdownTarget(locale: string, rest: string): string | null {
  if (rest === '') return `${MD_ROOT}/${locale}/index`;
  const slug = docSlug(rest);
  return slug ? `${MD_ROOT}/${locale}/docs/${slug}` : null;
}

function notFoundTarget(locale: string): string {
  return `${MD_ROOT}/${locale}/not-found`;
}

/**
 * The `.md` sibling URL for a page that has a Markdown representation, or null.
 *
 * Used for the `Link: rel="alternate"` header on the HTML response, so an agent
 * that reads headers but does not parse HTML still finds the variant.
 */
export function markdownAlternatePath(pathname: string): string | null {
  const split = splitLocale(pathname);
  if (!split) return null;
  return markdownTarget(split.locale, split.rest) ? `${pathname}.md` : null;
}

/**
 * Where to send an HTML request for a docs URL that names no docs page, or null
 * when the path is not one.
 *
 * A docs slug the build did not list is served from a shell that has already
 * committed a 200 by the time `notFound()` runs, which leaves a mistyped URL
 * answering 200 with only an injected `noindex`. Next's guide for real status
 * codes is to reject early in the proxy; the target is a path no route owns, so
 * `app/[locale]/[...rest]` answers it with the branded 404. The slug list is
 * exact: `/docs/Overview`, `/docs/overview.html`, `/docs/overview/extra` and
 * `/docs/logging` (a section, not a page) all qualify.
 */
export function unknownDocsTarget(pathname: string): string | null {
  const split = splitLocale(pathname);
  if (!split?.rest.startsWith('/docs/')) return null;
  const decoded = pagePath(split.rest);
  if (decoded === null) return null;
  return docSlug(decoded) ? null : `/${split.locale}/not-found`;
}

/**
 * The same early 404 for the food pages: a URL under the food folder is a page
 * only when it is exactly a published page's path (`foodPagePath`), so the
 * bare folder, another locale and a mistyped slug all get the real 404.
 */
export function unknownFoodPageTarget(pathname: string): string | null {
  const split = splitLocale(pathname);
  if (!split) return null;
  const { locale, rest } = split;
  if (rest !== FOOD_PAGE_PREFIX && !rest.startsWith(`${FOOD_PAGE_PREFIX}/`))
    return null;
  const decoded = pagePath(rest);
  if (decoded === null) return null;
  const known = FOOD_SLUGS.some(
    (slug) => foodPagePath(slug) === `/${locale}${decoded}`
  );
  return known ? null : `/${locale}/not-found`;
}

/**
 * A locale-relative path as the page will see it, or null for a malformed
 * escape, which is left for Next to answer.
 *
 * A trailing slash names the same page; Next normally redirects it away before
 * the proxy runs, but the check must not depend on that. The pathname arrives
 * percent-encoded and Next decodes it before it reaches the page, so
 * `/docs/%6fverview` is a real page.
 */
function pagePath(rest: string): string | null {
  const trimmed = rest.endsWith('/') ? rest.slice(0, -1) : rest;
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return null;
  }
}

export interface NegotiationInput {
  pathname: string;
  accept: string | null;
  method: string;
}

/**
 * React Server Component payload fetch — the router asking for a navigation,
 * not a client negotiating a representation.
 *
 * Detected from the Accept header rather than the `RSC` request header, which
 * would be the obvious signal but never arrives: Next strips it before
 * the proxy runs (verified against the standalone server — the proxy sees
 * only `accept, host, user-agent, x-forwarded-*`). Getting this wrong answers
 * every client-side navigation with a 406.
 */
function isRscRequest(accept: string | null): boolean {
  return accept?.toLowerCase().includes('text/x-component') ?? false;
}

export function negotiate({
  pathname,
  accept,
  method,
}: NegotiationInput): Negotiation {
  if (isRscRequest(accept)) return { kind: 'pass' };
  if (method !== 'GET' && method !== 'HEAD') return { kind: 'pass' };

  // The `.md` suffix is stripped before the locale split so that both
  // `/en.md` (the landing's sibling) and `/en/docs/x.md` resolve.
  const isExplicitMd = pathname.endsWith('.md');
  const split = splitLocale(isExplicitMd ? pathname.slice(0, -3) : pathname);
  if (!split) return { kind: 'pass' };
  const { locale } = split;

  const target = markdownTarget(locale, split.rest);

  // An explicit `.md` URL is markdown whatever the Accept header says: it is
  // what `Link: rel="alternate"` points at, and a crawler following that link
  // may send no Accept at all.
  if (isExplicitMd) {
    return target
      ? { kind: 'markdown', rewriteTo: target }
      : { kind: 'markdown-not-found', rewriteTo: notFoundTarget(locale) };
  }

  const preferred = preferredType(accept);

  if (preferred === null) {
    // 406 only where negotiation is actually on offer. Everywhere else a
    // spec-correct default beats rejecting a client over a header it probably
    // did not mean literally — the "don't 406 eagerly" rule.
    return target ? { kind: 'not-acceptable' } : { kind: 'pass' };
  }

  if (preferred !== MEDIA_MARKDOWN) return { kind: 'pass' };
  if (target) return { kind: 'markdown', rewriteTo: target };

  // Markdown was asked for and this is a real page that simply has no markdown
  // form (the app shell, an invite link). Serve the HTML.
  if (isKnownNonMarkdownPath(split.rest)) return { kind: 'pass' };

  // Nothing here. A markdown-speaking agent gets a markdown 404 carrying the
  // links it needs to recover, rather than an HTML page it has to strip.
  return { kind: 'markdown-not-found', rewriteTo: notFoundTarget(locale) };
}
