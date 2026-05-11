import type { NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/navigation';
import { updateSession } from '@/lib/supabase/middleware';

const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  const intlResponse = intlMiddleware(request);
  return await updateSession(request, intlResponse);
}

export const config = {
  matcher: [
    // `auth/callback` is excluded so the OAuth code-exchange route is not
    // rewritten to /{locale}/auth/callback by next-intl. The handler is
    // intentionally locale-agnostic and reads the locale from the `next`
    // query parameter. New /auth/* routes must opt out individually here so
    // they keep getting locale rewriting + Supabase session refresh.
    '/((?!_next/static|_next/image|favicon.ico|api|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
