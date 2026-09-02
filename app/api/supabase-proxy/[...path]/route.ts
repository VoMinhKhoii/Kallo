import { type NextRequest, NextResponse } from 'next/server';
import { payloadTooLargeResponse } from '@/app/api/supabase-proxy/_lib/gotrue-error';
import { guardAuthRequest } from '@/app/api/supabase-proxy/_lib/guard-auth-request';
import { PayloadTooLargeError } from '@/lib/core/errors/app-error';
import { readBoundedBody } from '@/lib/infra/http/bounded-body';

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
 * Storage directly, so everything but `auth/v1/*` is rejected.
 *
 * Because every proxied user shares this service's egress IP, Supabase's own
 * per-IP auth limits see one bucket for all of them — they cannot tell our
 * users apart, and we cannot make them (see `_lib/enforce-limits.ts`). So the
 * fairness and abuse controls live HERE: the body is capped before it is
 * buffered, the request is classified by what it actually does, and the
 * matching global / per-IP / per-target budgets are consumed before anything
 * is forwarded. Refusals are spoken in GoTrue's error dialect so supabase-js
 * and supabase-flutter show their existing rate-limited copy.
 */

const ALLOWED_PATH_PREFIX = '/auth/v1/';
/**
 * Admin-only surfaces, refused with the same 404 as anything outside
 * `auth/v1/`. `/admin/*` and `/invite` both require the service key, which no
 * client of this proxy holds — auth-js reaches `/invite` only through
 * `GoTrueAdminApi.inviteUserByEmail`. Forwarding them would mean an anonymous
 * caller gets to ask Supabase to mail an invitation, on a path with no
 * caller-supplied recipient budget behind it.
 */
const BLOCKED_PATHS = ['/auth/v1/admin', '/auth/v1/invite'];
const UPSTREAM_TIMEOUT_MS = 15_000;

/**
 * Body cap. GoTrue's own payloads are a few hundred bytes; 64 KB leaves room
 * for a long SAML assertion or a fat JWT without letting an unauthenticated
 * caller decide how much memory this process allocates.
 */
const MAX_BODY_BYTES = 64 * 1024;

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
    BLOCKED_PATHS.some((blocked) => upstreamUrl.pathname.startsWith(blocked))
  ) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Read the body BEFORE anything else touches it, and only up to the cap:
  // `req.arrayBuffer()` would buffer whatever an anonymous caller chose to
  // send. Everything downstream — the classifier, the limiter, the upstream
  // fetch — works from these bounded bytes.
  let body: Uint8Array<ArrayBuffer> | undefined;
  if (!BODYLESS_METHODS.has(req.method)) {
    try {
      body = await readBoundedBody(req, MAX_BODY_BYTES);
    } catch (error) {
      if (error instanceof PayloadTooLargeError)
        return payloadTooLargeResponse();
      throw error;
    }
  }

  // Classify, refuse what cannot be keyed, and consume the budgets. Anything
  // but `null` is a refusal already spoken in GoTrue's dialect.
  const refusal = await guardAuthRequest(req, {
    method: req.method,
    path: upstreamUrl.pathname.slice(ALLOWED_PATH_PREFIX.length),
    grantType: upstreamUrl.searchParams.get('grant_type'),
    body,
  });
  if (refusal) return refusal;

  const headers = new Headers();
  for (const name of REQUEST_HEADERS) {
    const value = req.headers.get(name);
    if (value !== null) headers.set(name, value);
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
