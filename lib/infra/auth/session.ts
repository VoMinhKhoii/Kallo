import { eq } from 'drizzle-orm';
import { cache } from 'react';
import { Errors } from '@/lib/core/errors/catalog';
import { type VerifiedUser, verifyUser } from '@/lib/infra/auth/verified-user';
import { db } from '@/lib/infra/db/client';
import { userProfiles } from '@/lib/infra/db/schema';
import { createClient, requestBearerToken } from '@/lib/infra/supabase/server';

interface AuthResult {
  user: { id: string; email?: string };
  profile: typeof userProfiles.$inferSelect;
}

/**
 * The verified user behind this request, or null when signed out (see
 * `verifyUser`). Memoized per request: a layout, its page and the actions they
 * call share one token check and one session query.
 */
export const getRequestUser = cache(
  async (): Promise<VerifiedUser | null> =>
    verifyUser(await createClient(), db, await requestBearerToken())
);

async function resolveAuthAndProfile(deps?: {
  supabase?: Awaited<ReturnType<typeof createClient>>;
  database?: typeof db;
}): Promise<AuthResult> {
  const database = deps?.database ?? db;
  const user = deps?.supabase
    ? await verifyUser(deps.supabase, database)
    : await getRequestUser();
  if (!user) {
    throw Errors.notAuthenticated();
  }

  const rows = await database
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, user.id))
    .limit(1);

  const profile = rows[0];
  if (!profile) {
    throw Errors.profileNotFound();
  }

  return { user: { id: user.id, email: user.email ?? undefined }, profile };
}

// Per-request memoization for the production (no-DI) path: routes/actions that
// fan out (e.g. the aggregate dashboard endpoint's four parallel loaders) share
// ONE token check + ONE profile query instead of repeating both per loader.
// React.cache is scoped to a single request in the App Router.
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
