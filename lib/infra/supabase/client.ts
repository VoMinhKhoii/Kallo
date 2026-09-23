import {
  createBrowserClient,
  parseCookieHeader,
  serializeCookieHeader,
} from '@supabase/ssr';
import {
  sessionCookieOptions,
  sessionCookieWriteOptions,
} from '@/lib/infra/supabase/cookie-options';

export function createClient() {
  // Browser auth rides the app's own origin (see app/api/supabase-proxy) so
  // login keeps working on ISPs that blackhole the supabase.co edge. The SSR
  // fallback keeps any server-render invocation on the direct URL.
  const url =
    typeof window === 'undefined'
      ? process.env.NEXT_PUBLIC_SUPABASE_URL!
      : `${window.location.origin}/api/supabase-proxy`;
  // Supabase derives the auth cookie name (storageKey) from the client URL's
  // hostname: `sb-<first-label>-auth-token`. Since the browser client rides the
  // proxy origin while the server/middleware clients stay on the real Supabase
  // URL, that derivation would diverge — and signOut() (which only clears its
  // own key's cookie) could never clear the cookie the middleware authenticates
  // against, so users get bounced straight back in. sessionCookieOptions()
  // pins the name to the key the server derives so both sides read, write, and
  // clear the same cookie, with the same Secure/SameSite/Max-Age attributes.
  return createBrowserClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: sessionCookieOptions(),
      // Same document.cookie plumbing @supabase/ssr uses by default, except
      // every write goes through sessionCookieWriteOptions(): the library
      // replaces cookieOptions.maxAge with its 400-day default on each write,
      // including each `.0`/`.1` chunk. Without a document (a server render)
      // there is no cookie jar, matching the library's own fallback.
      cookies: {
        getAll() {
          if (typeof document === 'undefined') return [];
          return parseCookieHeader(document.cookie).map(({ name, value }) => ({
            name,
            value: value ?? '',
          }));
        },
        setAll(cookiesToSet) {
          if (typeof document === 'undefined') return;
          for (const { name, value, options } of cookiesToSet) {
            document.cookie = serializeCookieHeader(
              name,
              value,
              sessionCookieWriteOptions(options)
            );
          }
        },
      },
    }
  );
}
