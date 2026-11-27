/**
 * kallo-proxy — the Cloudflare Worker in front of Cloud Run on `kallo.fit/*`
 * and `*.kallo.fit/*` (`media.kallo.fit` and `admin.kallo.fit` have their own
 * routes). Deployed by hand with wrangler; see `../README.md`. It forwards every request to the Cloud Run origin with the
 * origin-lock secret, and refuses per-IP floods on the anonymous surfaces
 * before they cost a Cloud Run request.
 *
 * The flood limit is a breaker, never the real limit: carrier NAT puts many
 * real users behind one address, and Workers rate limits count per Cloudflare
 * location, approximately. The app's own limiter (docs/RATE_LIMITING.md)
 * stays the authority. A refusal here answers in the shape each client
 * already parses, so no client needs to know the edge exists.
 */

import { MEDIA_HTML, preferredType } from '@/lib/infra/http/accept';

/** The Workers Rate Limiting binding (`ratelimits` in wrangler.jsonc). */
export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  /** The Cloud Run hostname every request is forwarded to. */
  ORIGIN: string;
  /** Sent as `X-Origin-Verify`; the app refuses requests without it. */
  ORIGIN_SECRET: string;
  /** 100 requests a minute per IP and surface. */
  ANON_FLOOD: RateLimiter;
  /**
   * Session refresh: about one per signed-in device an hour, but one carrier
   * address fronts thousands of devices, so 600 a minute — the same number
   * the app's own `authRefresh` breaker uses.
   */
  REFRESH_FLOOD: RateLimiter;
  /**
   * Bearer for the app's meal-reminder tick (`POST /api/v1/reminders/tick`),
   * the same value as the Cloud Run secret. Unset → the cron does nothing.
   */
  REMINDER_TICK_SECRET?: string;
}

/** The slice of the Workers `ScheduledController` the cron reads. */
export interface ScheduledEvent {
  cron: string;
  scheduledTime: number;
}

/** How a surface's refusal has to look to the client that called it. */
type Dialect = 'gotrue' | 'gotrue-refresh' | 'app';

interface Surface {
  name: string;
  dialect: Dialect;
}

const RETRY_AFTER_SECONDS = 60;

/**
 * The anonymous app routes the breaker covers. `getOnly` keeps the invite
 * lookup's prefix from also catching the signed-in `POST .../invite/accept`.
 */
const APP_SURFACES: readonly {
  prefix: string;
  exact: boolean;
  name: string;
  getOnly?: boolean;
}[] = [
  { prefix: '/api/v1/waitlist', exact: true, name: 'waitlist' },
  { prefix: '/api/v1/waitlist/confirm', exact: true, name: 'waitlist' },
  { prefix: '/api/healthz', exact: true, name: 'healthz' },
  { prefix: '/api/csp-report', exact: true, name: 'csp-report' },
  {
    prefix: '/api/v1/groups/invite/',
    exact: false,
    name: 'invite',
    getOnly: true,
  },
  { prefix: '/api/v1/barcode/image/', exact: false, name: 'barcode-image' },
];

/**
 * Decode once and lowercase, so `/API/Supabase-Proxy/...` or a
 * percent-encoded spelling cannot step around the breaker. A path that does
 * not decode is matched as sent.
 */
function normalizePath(pathname: string): string {
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    // Malformed escapes: match the raw path.
  }
  return decoded.toLowerCase().replace(/\/{2,}/g, '/');
}

export function classifySurface(url: URL, method = 'GET'): Surface | null {
  const path = normalizePath(url.pathname);

  if (path.startsWith('/api/supabase-proxy/auth/v1/')) {
    const refresh =
      path === '/api/supabase-proxy/auth/v1/token' &&
      url.searchParams.get('grant_type') === 'refresh_token';
    return refresh
      ? { name: 'auth-refresh', dialect: 'gotrue-refresh' }
      : { name: 'auth', dialect: 'gotrue' };
  }

  for (const surface of APP_SURFACES) {
    if (surface.getOnly && method !== 'GET' && method !== 'HEAD') continue;
    const hit = surface.exact
      ? path === surface.prefix || path === `${surface.prefix}/`
      : path.startsWith(surface.prefix);
    if (hit) return { name: surface.name, dialect: 'app' };
  }

  return null;
}

/**
 * The counter key for an address. IPv6 is cut to its /64: a home connection
 * is handed at least a /64, so a per-address key would let one household walk
 * through the breaker by rotating addresses. Same rule as the app's limiter.
 */
export function ipKey(ip: string): string {
  if (!ip.includes(':')) return ip;

  const [head, tail = ''] = ip.toLowerCase().split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const fill = ip.includes('::')
    ? Array(Math.max(0, 8 - left.length - right.length)).fill('0')
    : [];
  const hextets = [...left, ...fill, ...right];
  return `${hextets
    .slice(0, 4)
    .map((h) => h.replace(/^0+(?=.)/, ''))
    .join(':')}::/64`;
}

function refusal(dialect: Dialect): Response {
  const headers = {
    'content-type': 'application/json',
    'retry-after': String(RETRY_AFTER_SECONDS),
    'cache-control': 'no-store',
  };

  switch (dialect) {
    // supabase-js and supabase-flutter read `error_code` and map
    // `over_request_rate_limit` to their "too many attempts" copy.
    case 'gotrue':
      return new Response(
        JSON.stringify({
          code: 429,
          error_code: 'over_request_rate_limit',
          msg: 'Request rate limit reached',
        }),
        { status: 429, headers }
      );
    // A 429 on a refresh makes both auth clients drop the session; a 503 is
    // retried with the session kept (docs/RATE_LIMITING.md).
    case 'gotrue-refresh':
      return new Response(
        JSON.stringify({
          code: 503,
          error_code: 'service_unavailable',
          msg: 'Authentication is temporarily unavailable',
        }),
        { status: 503, headers }
      );
    case 'app':
      return new Response(
        JSON.stringify({
          error: {
            code: 'RATE_LIMITED',
            status: 429,
            retryable: true,
            message: 'Too many requests. Please wait a moment and try again.',
            resolution:
              'Wait for Retry-After when present, then retry with backoff.',
          },
        }),
        { status: 429, headers }
      );
  }
}

async function floodRefusal(
  request: Request,
  env: Env
): Promise<Response | null> {
  const surface = classifySurface(new URL(request.url), request.method);
  if (!surface) return null;

  // Always set by Cloudflare on a proxied request. Without one there is
  // nothing to key on; the app's own global budgets still apply.
  const ip = request.headers.get('cf-connecting-ip');
  if (!ip) return null;

  const limiter =
    surface.dialect === 'gotrue-refresh' ? env.REFRESH_FLOOD : env.ANON_FLOOD;
  try {
    const { success } = await limiter.limit({
      key: `${surface.name}:${ipKey(ip)}`,
    });
    return success ? null : refusal(surface.dialect);
  } catch {
    // The breaker failing must never take the site down with it.
    return null;
  }
}

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
const CRAWLER_CACHE_SECONDS = 86_400;
const CRAWLER_CACHE_PARAM = '_edge';
const CRAWLER_CACHE_VALUE = 'crawler';
const CRAWLER_HOST = 'kallo.fit';
// No trailing slash: Next redirects those, and a redirect is never cached.
const CRAWLER_PAGE =
  /^\/(en|vi)\/(calories|tools|compare|alternatives|docs|data)(\/[^/]+)*$/;
const CRAWLER_AGENT =
  /bot|crawl|spider|slurp|ChatGPT-User|Claude-User|Perplexity-User|facebookexternalhit|meta-externalagent|Bytespider|Google-InspectionTool/i;

/**
 * True only when the origin's answer depends on nothing but the path, so one
 * cached copy is right for every request that reaches it. The cache key is the
 * URL alone; any other input that changes the answer must rule the request out.
 */
export function isCrawlerPageRequest(request: Request, url: URL): boolean {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  if (url.hostname !== CRAWLER_HOST || url.search) return false;
  if (!CRAWLER_PAGE.test(url.pathname)) return false;
  const { headers } = request;
  if (
    // Signed in, or mid client-side navigation.
    headers.has('cookie') ||
    headers.has('authorization') ||
    headers.has('rsc') ||
    headers.has('next-router-prefetch') ||
    headers.has('next-router-state-tree') ||
    // A browser, whatever its user agent says ("CUBOT" phones, "Botim").
    headers.has('sec-fetch-mode') ||
    headers.has('sec-ch-ua')
  ) {
    return false;
  }
  // The docs pages answer Markdown to an agent that prefers it (proxy.ts,
  // `negotiate`). Only requests the origin answers with HTML share the copy.
  if (preferredType(headers.get('accept')) !== MEDIA_HTML) return false;
  return CRAWLER_AGENT.test(headers.get('user-agent') ?? '');
}

/** A redirect must point at the public URL, never the cache's own address. */
function withoutCacheParam(response: Response): Response {
  const location = response.headers.get('location');
  if (!location?.includes(`${CRAWLER_CACHE_PARAM}=`)) return response;
  const target = new URL(location, `https://${CRAWLER_HOST}`);
  target.searchParams.delete(CRAWLER_CACHE_PARAM);
  const cleaned = new Response(response.body, response);
  cleaned.headers.set(
    'location',
    location.startsWith('/')
      ? `${target.pathname}${target.search}${target.hash}`
      : target.toString()
  );
  return cleaned;
}

/**
 * The meal-reminder scheduler: every 15 minutes (`triggers.crons` in
 * wrangler.jsonc) ask the app to run one reminder tick. Cloudflare cron
 * triggers fire on time, which GitHub Actions' schedule does not; the app
 * decides who is due on their own clock. A failed tick is simply retried by
 * the next one — each checkpoint stays open for 90 minutes.
 */
export async function runReminderTick(env: Env): Promise<void> {
  if (!env.REMINDER_TICK_SECRET) {
    console.error('reminder tick skipped: REMINDER_TICK_SECRET is not set');
    return;
  }
  const response = await fetch(`https://${env.ORIGIN}/api/v1/reminders/tick`, {
    method: 'POST',
    headers: {
      'X-Origin-Verify': env.ORIGIN_SECRET,
      Authorization: `Bearer ${env.REMINDER_TICK_SECRET}`,
    },
  });
  const body = await response.text();
  if (!response.ok) {
    console.error(`reminder tick failed: ${response.status} ${body}`);
    return;
  }
  console.log(`reminder tick: ${body}`);
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    await runReminderTick(env);
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const refused = await floodRefusal(request, env);
    if (refused) return refused;

    const url = new URL(request.url);
    const crawler = isCrawlerPageRequest(request, url);
    const originalHost = url.hostname;
    url.hostname = env.ORIGIN;
    url.protocol = 'https:';
    if (crawler) url.searchParams.set(CRAWLER_CACHE_PARAM, CRAWLER_CACHE_VALUE);

    const forwarded = new Request(url, request);
    forwarded.headers.set('X-Origin-Verify', env.ORIGIN_SECRET);
    forwarded.headers.set('X-Forwarded-Host', originalHost);
    forwarded.headers.set('X-Forwarded-Proto', 'https');
    if (!crawler) return fetch(forwarded);

    // An explicit edge TTL makes Cloudflare cache the page and drop its
    // Set-Cookie (the locale cookie, which a crawler has no use for).
    // Only 2xx answers are kept: a 404 or 500 must not outlive its cause.
    const init: RequestInit & { cf: Record<string, unknown> } = {
      cf: {
        cacheEverything: true,
        cacheTtlByStatus: { '200-299': CRAWLER_CACHE_SECONDS, '300-599': -1 },
      },
    };
    return withoutCacheParam(await fetch(forwarded, init));
  },
};
