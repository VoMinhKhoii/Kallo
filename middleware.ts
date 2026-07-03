import type { NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/navigation';
import { buildCsp } from '@/lib/security/csp';
import { updateSession } from '@/lib/supabase/middleware';

const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  // Per-request CSP nonce. Set it on the *request* headers BEFORE next-intl
  // runs: next-intl forwards a clone of request.headers, so the nonce (and the
  // CSP it lives in) reach the RSC render, where Next extracts `nonce-…` and
  // stamps its own inline scripts. btoa (not Buffer) keeps this Edge-safe.
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce, process.env.NODE_ENV === 'development');
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
    // `auth/callback` is excluded so the OAuth code-exchange route is not
    // rewritten to /{locale}/auth/callback by next-intl. The handler is
    // intentionally locale-agnostic and reads the locale from the `next`
    // query parameter. New /auth/* routes must opt out individually here so
    // they keep getting locale rewriting + Supabase session refresh.
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|api|auth/callback|auth/verify|.*\\.(?:svg|png|jpg|jpeg|gif|webp|geojson)$).*)',
  ],
};
