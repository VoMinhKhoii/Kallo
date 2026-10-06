import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import {
  sessionCookieOptions,
  sessionCookieWriteOptions,
} from '@/lib/infra/supabase/cookie-options';
import { isPrivatePath } from '@/lib/seo/private-paths';

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
  } = await supabase.auth.getUser();

  // Extract locale from URL path (e.g., /en/logging → en)
  const pathname = request.nextUrl.pathname;
  const localeMatch = pathname.match(/^\/(en|vi)(\/|$)/);
  const locale = localeMatch?.[1] ?? 'en';
  const pathWithoutLocale = pathname.replace(/^\/(en|vi)/, '') || '/';

  // Redirect authenticated users from landing page to app
  if (user && pathWithoutLocale === '/') {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/logging`;
    return NextResponse.redirect(url);
  }

  // A signed-out visitor on an app surface goes to the sign-in dialog, which
  // returns them here afterwards. The commonest way in is the browser's Back
  // button after signing out (sign-out lands on the landing page, one history
  // entry past the app page). Left to render, the page's own session read
  // threw "You need to sign in" before the layout's redirect could win.
  if (!user && localeMatch && isPrivatePath(pathWithoutLocale)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}`;
    url.search = '';
    url.searchParams.set('auth', 'sign-in');
    url.searchParams.set('next', pathname);
    const redirect = NextResponse.redirect(url);
    // Carry any session cookies `getUser()` just cleared or refreshed.
    for (const cookie of supabaseResponse.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  }

  return supabaseResponse;
}
