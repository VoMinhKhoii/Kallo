import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';

export async function createClient() {
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
      cookieOptions: {
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'lax',
        secure: true,
        path: '/',
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // setAll called from Server Component — ignore
          }
        },
      },
    }
  );
}
