import { createServerClient } from '@supabase/ssr';
import {
  type AuthError,
  isAuthApiError,
  isAuthSessionMissingError,
} from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { locales } from '@/i18n/config';
import { safeNextPath } from '@/lib/infra/auth/safe-next';
import {
  sessionCookieOptions,
  sessionCookieWriteOptions,
} from '@/lib/infra/supabase/cookie-options';
import { needsSignIn } from '@/lib/seo/private-paths';

export async function updateSession(
  request: NextRequest,
  response?: NextResponse
) {
  let supabaseResponse = response ?? NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: sessionCookieOptions(),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = response ?? NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(
              name,
              value,
              sessionCookieWriteOptions(options)
            );
          }
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Extract locale from URL path (e.g., /en/logging → en). A path with no
  // locale is left alone: next-intl is already redirecting it to one (from the
  // NEXT_LOCALE cookie or Accept-Language), and the next request lands here.
  const pathname = request.nextUrl.pathname;
  const locale = locales.find(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`)
  );
  if (!locale) return supabaseResponse;
  const pathWithoutLocale = pathname.slice(locale.length + 1) || '/';

  // Carry any session cookies `getUser()` just cleared or refreshed: a
  // rotated refresh token that never reaches the browser signs the user out.
  const redirectTo = (url: URL) => {
    const redirect = NextResponse.redirect(url);
    for (const cookie of supabaseResponse.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  };

  // A signed-in visitor on the landing page goes into the app — to the page
  // the sign-in redirect below was holding for them, if there is one.
  if (user && pathWithoutLocale === '/') {
    const next = safeNextPath(request.nextUrl.searchParams.get('next'));
    if (next) return redirectTo(new URL(next, request.nextUrl.origin));
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/logging`;
    return redirectTo(url);
  }

  // A signed-out visitor opening an app page goes to the sign-in dialog, which
  // returns them here afterwards. The commonest way in is the browser's Back
  // button after signing out (sign-out lands on the landing page, one history
  // entry past the app page). Left to render, the page's own session read
  // threw "You need to sign in" (KALLO-WEB-2) before the layout's redirect.
  if (
    isSignedOut(user, error) &&
    isPageLoad(request) &&
    needsSignIn(decodedPath(pathWithoutLocale))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}`;
    url.search = '';
    url.searchParams.set('auth', 'sign-in');
    const next =
      safeNextPath(`${pathname}${request.nextUrl.search}`) ??
      safeNextPath(pathname);
    if (next) url.searchParams.set('next', next);
    return redirectTo(url);
  }

  return supabaseResponse;
}

/**
 * Only a page load or a client navigation (both GET) is redirected. A Server
 * Action is a POST: following a 307 it would replay against the landing page,
 * which has no such action, so it is left to return its own "sign in" error.
 */
function isPageLoad(request: NextRequest) {
  return request.method === 'GET' || request.method === 'HEAD';
}

/** Next routes on the decoded path, so `/%64ashboard` must match too. */
function decodedPath(path: string) {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

/**
 * The auth-js error codes that mean this visitor's session is gone: the token
 * was rejected, or the session or user behind it no longer exists. A reused
 * refresh token is on the list because GoTrue revokes the session for it.
 */
const SESSION_GONE_CODES = new Set<string>([
  'bad_jwt',
  'session_not_found',
  'session_expired',
  'refresh_token_not_found',
  'refresh_token_already_used',
  'user_not_found',
  'user_banned',
]);

/**
 * True only when Supabase positively says there is no session: no cookie at
 * all, or a session it rejected. Anything else — a network failure, a 5xx, a
 * 429, a bad API key, an unparseable response — is an outage, not a
 * signed-out visitor, and sending a signed-in reader to the sign-in dialog
 * would strand them there.
 */
function isSignedOut(user: unknown, error: AuthError | null) {
  if (user) return false;
  if (!error || isAuthSessionMissingError(error)) return true;
  return isAuthApiError(error) && SESSION_GONE_CODES.has(error.code ?? '');
}
