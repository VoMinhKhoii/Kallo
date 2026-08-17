import { type NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/navigation';
import { buildCsp } from '@/lib/infra/security/csp';
import { updateSession } from '@/lib/infra/supabase/middleware';

const intlMiddleware = createMiddleware(routing);

// Paths that must reach Next without next-intl locale rewriting or the Supabase
// session refresh — the API surface and the locale-agnostic auth routes. They
// were previously excluded from the matcher entirely; they now pass through the
// matcher so the origin-lock below can protect them, then short-circuit before
// the intl/session logic to preserve their prior behaviour.
const SKIP_INTL_PREFIXES = ['/api', '/auth/callback', '/auth/verify'];

function shouldSkipIntl(pathname: string) {
  return SKIP_INTL_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

// Constant-time compare — the origin-lock is the app's sole trust boundary, so
// avoid the first-differing-byte timing signal of `!==`. Edge-runtime safe (no
// Node crypto); only the secret's length leaks, which is not sensitive.
function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function middleware(request: NextRequest) {
  // Origin-lock. In production the service sits behind Cloudflare, which injects
  // a shared secret header (X-Origin-Verify) on every proxied request via a
  // Transform Rule. Reject anything that did not arrive through Cloudflare so
  // the raw *.run.app URL cannot be hit directly, bypassing the edge WAF. When
  // ORIGIN_SHARED_SECRET is unset (local dev, preview, non-prod) the check is
  // skipped, so nothing off-Cloudflare breaks.
  const originSecret = process.env.ORIGIN_SHARED_SECRET;
  if (originSecret) {
    const provided = request.headers.get('x-origin-verify');
    if (provided === null || !timingSafeEqual(provided, originSecret)) {
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  // API + locale-agnostic auth routes: origin-locked above, but no locale
  // rewrite or session refresh (their behaviour when they were matcher-excluded).
  if (shouldSkipIntl(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  // Per-request CSP nonce. Set it on the *request* headers BEFORE next-intl
  // runs: next-intl forwards a clone of request.headers, so the nonce (and the
  // CSP it lives in) reach the RSC render, where Next extracts `nonce-…` and
  // stamps its own inline scripts. btoa (not Buffer) keeps this Edge-safe.
  const nonce = btoa(crypto.randomUUID());
  // `reportOnly: true` matches the header actually sent below. Flip both
  // together when enforcing.
  const csp = buildCsp(nonce, process.env.NODE_ENV === 'development', true);
  request.headers.set('x-nonce', nonce);
  request.headers.set('content-security-policy', csp);

  const intlResponse = intlMiddleware(request);
  const response = await updateSession(request, intlResponse);

  // Report-Only for now: the browser reports violations but blocks nothing, so
  // static rendering is preserved and there is no white-screen risk. Flip this
  // header name to `content-security-policy` to enforce (see lib/security/csp.ts
  // for the additional force-dynamic step enforcing requires).
  response.headers.set('content-security-policy-report-only', csp);
  return response;
}

export const config = {
  matcher: [
    // The origin-lock must run on everything that reaches Next — including /api
    // and the auth routes (see SKIP_INTL_PREFIXES) — so the matcher only omits
    // truly static public assets that need neither protection nor locale
    // rewriting. `robots.txt`, `sitemap.xml` and `llms.txt` are omitted so
    // next-intl does not rewrite the generated SEO routes to /{locale}/… —
    // each is a single fixed path that crawlers request at the origin root and
    // that has no locale-prefixed counterpart to redirect to.
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|llms.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|geojson)$).*)',
  ],
};
