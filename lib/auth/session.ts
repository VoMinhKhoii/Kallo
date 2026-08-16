import { eq } from 'drizzle-orm';
import { cache } from 'react';
import { db } from '@/lib/db';
import { userProfiles } from '@/lib/db/schema';
import { Errors } from '@/lib/errors/catalog';
import { createClient } from '@/lib/supabase/server';

interface AuthResult {
  user: { id: string; email?: string };
  profile: typeof userProfiles.$inferSelect;
}

async function resolveAuthAndProfile(deps?: {
  supabase?: Awaited<ReturnType<typeof createClient>>;
  database?: typeof db;
}): Promise<AuthResult> {
  const supabase = deps?.supabase ?? (await createClient());
  const database = deps?.database ?? db;

  const { data, error: authError } = await supabase.auth.getUser();
  if (authError || !data.user) {
    throw Errors.notAuthenticated();
  }

  const rows = await database
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, data.user.id))
    .limit(1);

  const profile = rows[0];
  if (!profile) {
    throw Errors.profileNotFound();
  }

  return { user: data.user, profile };
}

// Per-request memoization for the production (no-DI) path: routes/actions that
// fan out (e.g. the aggregate dashboard endpoint's four parallel loaders) share
// ONE `getUser()` JWT check + ONE profile query instead of repeating both per
// loader. React.cache is scoped to a single request in the App Router.
const cachedResolveAuthAndProfile = cache(() => resolveAuthAndProfile());

/**
 * Verify the current user is authenticated AND has completed onboarding.
 *
 * Accepts optional dependency injection for testability:
 * - `supabase` — override the Supabase server client
 * - `database` — override the Drizzle DB client
 *
 * The no-arg production path is memoized per request; injected deps (tests)
 * bypass the cache.
 */
export function requireAuthAndProfile(deps?: {
  supabase?: Awaited<ReturnType<typeof createClient>>;
  database?: typeof db;
}): Promise<AuthResult> {
  return deps ? resolveAuthAndProfile(deps) : cachedResolveAuthAndProfile();
}
