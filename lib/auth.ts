import { db } from '@/lib/db';
import type { userProfiles } from '@/lib/db/schema';
import { Errors } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateUserProfile } from '@/lib/user-profile';

interface AuthResult {
  user: { id: string; email?: string };
  profile: typeof userProfiles.$inferSelect;
}

/**
 * Verify the current user is authenticated AND has completed onboarding.
 *
 * Accepts optional dependency injection for testability:
 * - `supabase` — override the Supabase server client
 * - `database` — override the Drizzle DB client
 */
export async function requireAuthAndProfile(deps?: {
  supabase?: Awaited<ReturnType<typeof createClient>>;
  database?: typeof db;
}): Promise<AuthResult> {
  const supabase = deps?.supabase ?? (await createClient());
  const database = deps?.database ?? db;

  const { data, error: authError } = await supabase.auth.getUser();
  if (authError || !data.user) {
    throw Errors.notAuthenticated();
  }

  let profile: typeof userProfiles.$inferSelect;
  try {
    profile = await getOrCreateUserProfile(data.user.id, database);
  } catch {
    throw Errors.profileNotFound();
  }

  return { user: data.user, profile };
}
