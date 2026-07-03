import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Reverse proxy for Supabase Auth (`auth/v1/*` only).
 *
 * Some Vietnamese ISPs and carriers blackhole TCP to the supabase.co
 * Cloudflare edge, which killed login and token refresh for the mobile app
 * (and fresh web logins) on those networks — while this Cloud Run host stayed
 * reachable. The Flutter app and the web browser client point their
 * SUPABASE_URL at `<this host>/api/supabase-proxy` so auth rides the app's
 * own origin; Cloud Run's egress to Supabase is unaffected.
 *
 * Scope is auth-only by design: neither client uses PostgREST, Realtime, or
 * Storage directly, so everything but `auth/v1/*` is rejected. Caveat:
 * Supabase's per-IP auth rate limits now see this service's egress IP for all
 * proxied users (one shared bucket) — revisit if `over_request_rate_limit`
 * errors ever show up.
 */

const ALLOWED_PATH_PREFIX = '/auth/v1/';
const BLOCKED_PATH_PREFIX = '/auth/v1/admin';
const UPSTREAM_TIMEOUT_MS = 15_000;

/** Request headers forwarded upstream; everything else (cookies…) is dropped. */
const REQUEST_HEADERS = [
  'apikey',
  'authorization',
  'content-type',
  'x-client-info',
  'x-supabase-api-version',
];

/**
 * Response headers forwarded back. Notably NOT content-encoding /
 * content-length / transfer-encoding: fetch has already decompressed the
 * body, so the originals would be wrong — Next re-derives them.
 */
const RESPONSE_HEADERS = [
  'content-type',
  'location',
  'x-supabase-api-version',
  'www-authenticate',
  'retry-after',
];

const BODYLESS_METHODS = new Set(['GET', 'HEAD', 'DELETE', 'OPTIONS']);

async function proxy(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
): Promise<Response> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    console.error('[supabase-proxy] NEXT_PUBLIC_SUPABASE_URL is not set');
    return NextResponse.json({ error: 'proxy_misconfigured' }, { status: 500 });
  }

  const base = supabaseUrl.endsWith('/') ? supabaseUrl : `${supabaseUrl}/`;
  const path = (await params).path.join('/');

  // Validate the RESOLVED URL, not the raw `path` string. A prefix check on
  // the joined segments is escapable: `new URL()` collapses `..` segments
  // (`auth/v1/../../rest/v1/x` → `/rest/v1/x`) and honours protocol-relative
  // references (`//evil.example/auth/v1/x` → a foreign host). Resolving first
  // and then asserting origin + pathname keeps the proxy pinned to
  // `<supabase>/auth/v1/*`, so it can never reach /rest, /storage, /realtime,
  // the admin API, or an attacker-chosen origin.
  let upstreamUrl: URL;
  try {
    upstreamUrl = new URL(`${path}${req.nextUrl.search}`, base);
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // `base` comes from env-validated supabaseUrl; Next's [...path] segments
  // are never absolute URLs, so new URL(base) cannot be reached via a path
  // that bypassed the try/catch above.
  const baseOrigin = new URL(base).origin;
  if (
    upstreamUrl.origin !== baseOrigin ||
    !upstreamUrl.pathname.startsWith(ALLOWED_PATH_PREFIX) ||
    upstreamUrl.pathname.startsWith(BLOCKED_PATH_PREFIX)
  ) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const headers = new Headers();
  for (const name of REQUEST_HEADERS) {
    const value = req.headers.get(name);
    if (value !== null) headers.set(name, value);
  }

  let body: ArrayBuffer | undefined;
  if (!BODYLESS_METHODS.has(req.method)) {
    body = await req.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers,
      body,
      // /authorize and /verify answer 302; the location header must reach the
      // client untouched, not be followed here.
      redirect: 'manual',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: 'no-store',
    });
  } catch (error) {
    console.error('[supabase-proxy] upstream fetch failed', error);
    // 502 is retryable for supabase clients, so apps surface their normal
    // network-error copy instead of hanging.
    return NextResponse.json(
      { error: 'upstream_unreachable' },
      { status: 502 }
    );
  }

  const responseHeaders = new Headers();
  for (const name of RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value !== null) responseHeaders.set(name, value);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export {
  proxy as GET,
  proxy as POST,
  proxy as PUT,
  proxy as PATCH,
  proxy as DELETE,
  proxy as OPTIONS,
};
