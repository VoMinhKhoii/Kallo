import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

export async function updateSession(
  request: NextRequest,
  response?: NextResponse
) {
  let supabaseResponse = response ?? NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
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
            supabaseResponse.cookies.set(name, value, options);
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

  return supabaseResponse;
}
