import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
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

  // Extract locale from URL path (e.g., /en/logging → en)
  const pathname = request.nextUrl.pathname;
  const localeMatch = pathname.match(/^\/(en|vi)(\/|$)/);
  const locale = localeMatch?.[1] ?? 'en';
  const pathWithoutLocale = pathname.replace(/^\/(en|vi)/, '') || '/';

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
    return redirectTo(
      new URL(next ?? `/${locale}/logging`, request.nextUrl.origin)
    );
  }

  // A signed-out visitor opening an app page goes to the sign-in dialog, which
  // returns them here afterwards. The commonest way in is the browser's Back
  // button after signing out (sign-out lands on the landing page, one history
  // entry past the app page). Left to render, the page's own session read
  // threw "You need to sign in" (KALLO-WEB-2) before the layout's redirect.
  if (
    isSignedOut(user, error) &&
    localeMatch &&
    isPageNavigation(request) &&
    needsSignIn(pathWithoutLocale)
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
 * Only a page load or a client navigation is redirected. A Server Action POST
 * would follow the 307 and replay itself against the landing page, which has
 * no such action; left alone it gets the action's own "sign in" error.
 */
function isPageNavigation(request: NextRequest) {
  return (
    (request.method === 'GET' || request.method === 'HEAD') &&
    !request.headers.has('next-action')
  );
}

/**
 * True only when Supabase positively says there is no session: no cookie at
 * all, or a token it rejected. Anything else — a network failure, a 5xx, a
 * 429, an unparseable response — is an outage, not a signed-out visitor, and
 * sending a signed-in reader to the sign-in dialog would strand them there.
 */
function isSignedOut(
  user: unknown,
  error: { name: string; status?: number } | null
) {
  if (user) return false;
  if (!error || error.name === 'AuthSessionMissingError') return true;
  const status = error.status ?? 0;
  return (
    error.name === 'AuthApiError' &&
    status >= 400 &&
    status < 500 &&
    status !== 429
  );
}
