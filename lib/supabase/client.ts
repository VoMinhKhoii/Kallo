import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  // Browser auth rides the app's own origin (see app/api/supabase-proxy) so
  // login keeps working on ISPs that blackhole the supabase.co edge. The SSR
  // fallback keeps any server-render invocation on the direct URL.
  const url =
    typeof window === 'undefined'
      ? process.env.NEXT_PUBLIC_SUPABASE_URL!
      : `${window.location.origin}/api/supabase-proxy`;
  return createBrowserClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
