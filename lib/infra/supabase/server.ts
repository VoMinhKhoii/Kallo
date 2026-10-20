import { createServerClient } from '@supabase/ssr';
import { io } from 'next/cache';
import { cookies, headers } from 'next/headers';
import {
  sessionCookieOptions,
  sessionCookieWriteOptions,
} from '@/lib/infra/supabase/cookie-options';

export async function createClient() {
  // The auth client reads the clock as soon as it is built: it checks the
  // session cookie's expiry with `Date.now()` before any network call. With
  // Partial Prefetching on, cookies are already readable in the runtime
  // prefetch, so that read would land in it and Next reports "unstable value
  // `Date.now()` while prerendering". `io()` keeps the client out of
  // prerenders; at request time it resolves at once.
  await io();

  // Bearer-token path (mobile / REST API clients). When an `Authorization:
  // Bearer <jwt>` header is present we build a stateless client configured
  // with that token — no cookies. `supabase.auth.getUser()` then validates
  // the JWT against the auth server, so `requireAuthAndProfile()` and every
  // action work unchanged. Web requests never carry this header and fall
  // through to the existing cookie flow below.
  const requestHeaders = await headers();
  const authHeader = requestHeaders.get('authorization');

  if (authHeader?.startsWith('Bearer ')) {
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        global: { headers: { Authorization: authHeader } },
        cookies: {
          getAll() {
            return [];
          },
          setAll() {
            // Stateless: no cookies are written in the Bearer flow.
          },
        },
      }
    );
  }

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: sessionCookieOptions(),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, sessionCookieWriteOptions(options));
            }
          } catch {
            // setAll called from Server Component — ignore
          }
        },
      },
    }
  );
}
