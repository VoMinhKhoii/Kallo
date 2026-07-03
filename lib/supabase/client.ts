import { createBrowserClient } from '@supabase/ssr';

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
  // against, so users get bounced straight back in. Pin the name to the key the
  // server derives so both sides read, write, and clear the same cookie.
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(
    '.'
  )[0];
  return createBrowserClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookieOptions: { name: `sb-${ref}-auth-token` } }
  );
}
