import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client. Bypasses RLS and exposes `auth.admin.*`, so it
 * must ONLY be constructed in trusted server contexts (e.g. permanent account
 * deletion, where we delete the `auth.users` row and every app row cascades
 * off it). The `SUPABASE_SERVICE_ROLE_KEY` is a secret — it is referenced by
 * name only and is never sent to the browser.
 *
 * Throws a clear error if the secret is missing so the failure is obvious in
 * logs rather than surfacing as a vague 500.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Account deletion requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL to be set.'
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
