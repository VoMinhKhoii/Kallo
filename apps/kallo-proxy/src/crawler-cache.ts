/**
 * Crawlers get public pages from Cloudflare's cache, so a crawl burst does not
 * wait on a Cloud Run instance waking from zero (Ahrefs measured 2 to 20 s on
 * 2026-11-23; warm answers take under 1 s). Only pages that are the same for
 * every visitor qualify: these sections are prerendered (`s-maxage`), unlike
 * the landing page and pricing.
 *
 * People are never served these copies. The cached fetch carries its own
 * query parameter, so its cache entry has an address no browser request uses,
 * and a copy kept across a deploy only reaches crawlers (it can name script
 * files the new build no longer has). Crawlers read the HTML, so a copy up to
 * a day old costs nothing.
 */

import { MEDIA_HTML, preferredType } from '@/lib/infra/http/accept';

const CACHE_PARAM = '_edge';
const CACHE_VALUE = 'crawler';
const PUBLIC_HOST = 'kallo.fit';
// No trailing slash: Next redirects those, and a redirect is never cached.
const PUBLIC_PAGE =
  /^\/(en|vi)\/(calories|tools|compare|alternatives|docs|data)(\/[^/]+)*$/;
const CRAWLER_AGENT =
  /bot|crawl|spider|slurp|ChatGPT-User|Claude-User|Perplexity-User|facebookexternalhit|meta-externalagent|Bytespider|Google-InspectionTool/i;

/** Any of these sends the request to the origin. */
const ORIGIN_ONLY_HEADERS = [
  // Signed in.
  'cookie',
  'authorization',
  // Mid client-side navigation.
  'rsc',
  'next-router-prefetch',
  'next-router-state-tree',
  // A browser, whatever its user agent says ("CUBOT" phones, "Botim").
  'sec-fetch-mode',
  'sec-ch-ua',
] as const;

/**
 * An explicit edge TTL makes Cloudflare cache the page and drop its
 * Set-Cookie (the locale cookie, which a crawler has no use for). Only 2xx
 * answers are kept: a 404 or 500 must not outlive its cause.
 */
const CACHED_FETCH: RequestInit & { cf: Record<string, unknown> } = {
  cf: {
    cacheEverything: true,
    cacheTtlByStatus: { '200-299': 86_400, '300-599': -1 },
  },
};

/**
 * True only when the origin's answer depends on nothing but the path, so one
 * cached copy is right for every request that reaches it. The cache key is the
 * URL alone; any other input that changes the answer must rule the request out.
 */
export function isCrawlerPageRequest(request: Request): boolean {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  const url = new URL(request.url);
  if (url.hostname !== PUBLIC_HOST || url.search) return false;
  if (!PUBLIC_PAGE.test(url.pathname)) return false;
  const { headers } = request;
  if (ORIGIN_ONLY_HEADERS.some((name) => headers.has(name))) return false;
  // The docs pages answer Markdown to an agent that prefers it (proxy.ts,
  // `negotiate`). Only requests the origin answers with HTML share the copy.
  if (preferredType(headers.get('accept')) !== MEDIA_HTML) return false;
  return CRAWLER_AGENT.test(headers.get('user-agent') ?? '');
}

/** A redirect must point at the public URL, never the cache's own address. */
function withoutCacheParam(response: Response): Response {
  const location = response.headers.get('location');
  if (!location?.includes(`${CACHE_PARAM}=`)) return response;
  const target = new URL(location, `https://${PUBLIC_HOST}`);
  target.searchParams.delete(CACHE_PARAM);
  const cleaned = new Response(response.body, response);
  cleaned.headers.set(
    'location',
    location.startsWith('/')
      ? `${target.pathname}${target.search}${target.hash}`
      : target.toString()
  );
  return cleaned;
}

/** Fetch the origin request through the cache, under the crawler address. */
export async function fetchCrawlerCopy(forwarded: Request): Promise<Response> {
  const url = new URL(forwarded.url);
  url.searchParams.set(CACHE_PARAM, CACHE_VALUE);
  return withoutCacheParam(
    await fetch(new Request(url, forwarded), CACHED_FETCH)
  );
}
