import {
  type AuthError,
  isAuthApiError,
  isAuthSessionMissingError,
} from '@supabase/supabase-js';
import { sql } from 'drizzle-orm';
import type { createClient } from '@/lib/infra/supabase/server';

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;
type Database = typeof import('@/lib/infra/db/client').db;

/** The signed-in user, read from the same rows the Auth server would read. */
export interface VerifiedUser {
  id: string;
  email: string | null;
  userMetadata: Record<string, unknown>;
  createdAt: string;
  lastSignInAt: string | null;
}

interface SessionUserRow extends Record<string, unknown> {
  id: string;
  email: string | null;
  raw_user_meta_data: Record<string, unknown> | null;
  created_at: string | Date;
  last_sign_in_at: string | Date | null;
}

/**
 * Who is making this request, without a round trip to the Auth server.
 *
 * `auth.getUser()` sent every request to Supabase Auth, which shares the
 * free-plan database box and answered in 0.5 s at p95 and 1 s at p99. Instead:
 * the access token's ES256 signature and expiry are checked here against the
 * cached signing keys (`getClaims`), then one indexed query confirms what the
 * Auth server used to: the token's session still exists and its user is not
 * banned or deleted. A signed-out or revoked session still stops working at
 * once, as it did with `getUser()`.
 *
 * Pass `accessToken` for a Bearer request (the mobile app): that client has no
 * stored session to read the token from. Without it the cookie session is
 * used, and refreshed when it is about to expire, as `getUser()` did.
 *
 * Returns null when the visitor is positively signed out. Throws when the
 * answer is unknown (the database or the signing-key fetch failed), so an
 * outage is never mistaken for a sign-out.
 */
export async function verifyUser(
  supabase: ServerSupabase,
  database: Database,
  accessToken?: string
): Promise<VerifiedUser | null> {
  const { data, error } = await supabase.auth.getClaims(accessToken);
  if (error) {
    if (isSessionGone(error)) return null;
    throw error;
  }
  const claims = data?.claims;
  if (!claims?.sub || typeof claims.session_id !== 'string') return null;

  const rows = await database.execute<SessionUserRow>(sql`
    SELECT u.id, u.email, u.raw_user_meta_data, u.created_at, u.last_sign_in_at
    FROM auth.sessions s
    JOIN auth.users u ON u.id = s.user_id
    WHERE s.id = ${claims.session_id}::uuid
      AND s.user_id = ${claims.sub}::uuid
      AND (s.not_after IS NULL OR s.not_after > now())
      AND (u.banned_until IS NULL OR u.banned_until <= now())
      AND u.deleted_at IS NULL
    LIMIT 1
  `);
  const row = rows[0];
  if (!row) {
    // The session was revoked or its user removed. Drop the stored session
    // (the cookies, on web), as `getUser()` did when the Auth server answered
    // "session not found"; a Bearer client stores none, so this is a no-op.
    await supabase.auth.signOut({ scope: 'local' });
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    userMetadata: row.raw_user_meta_data ?? {},
    createdAt: new Date(row.created_at).toISOString(),
    lastSignInAt: row.last_sign_in_at
      ? new Date(row.last_sign_in_at).toISOString()
      : null,
  };
}

/**
 * The auth-js error codes that mean this visitor's session is gone: the token
 * was rejected, or the session or user behind it no longer exists. A reused
 * refresh token is on the list because GoTrue revokes the session for it.
 */
const SESSION_GONE_CODES = new Set<string>([
  'bad_jwt',
  'session_not_found',
  'session_expired',
  'refresh_token_not_found',
  'refresh_token_already_used',
  'user_not_found',
  'user_banned',
]);

/**
 * True only when Supabase positively says there is no session: no session at
 * all, a token that fails verification, or a session it rejected. Anything
 * else — a network failure, a 5xx, a 429, a bad API key — is an outage.
 */
export function isSessionGone(error: AuthError) {
  // A token that fails the local signature or expiry check (auth-js
  // AuthInvalidJwtError, not an API error).
  if (isAuthSessionMissingError(error) || error.code === 'invalid_jwt') {
    return true;
  }
  return isAuthApiError(error) && SESSION_GONE_CODES.has(error.code ?? '');
}
