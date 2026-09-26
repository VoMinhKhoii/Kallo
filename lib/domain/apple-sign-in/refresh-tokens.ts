// ---------------------------------------------------------------------------
// Sign in with Apple refresh tokens — kept only to be revoked
// ---------------------------------------------------------------------------
// Apple requires an app that offers Sign in with Apple to revoke the user's
// tokens when the account is deleted. The iOS client posts the authorization
// code after a native Apple sign-in; we exchange it for a refresh token and
// keep that token sealed until account deletion revokes it. Nothing else ever
// reads it.
//
// Scope: native iOS sign-ins only. An Apple identity linked on the web goes
// through Supabase's OAuth flow, which keeps Apple's tokens inside Supabase
// Auth where Kallo cannot reach them (docs/GOOGLE_CLOUD_RUN.md).

import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { Errors } from '@/lib/core/errors/catalog';
import {
  exchangeAppleAuthorizationCode,
  revokeAppleRefreshToken,
} from '@/lib/infra/apple-auth/apple-auth';
import { readAppleAuthConfig } from '@/lib/infra/apple-auth/config';
import { open, resolveSecretBoxKey, seal } from '@/lib/infra/crypto/secret-box';
import {
  type AppDb,
  type AppTransaction,
  db as appDb,
} from '@/lib/infra/db/client';
import { appleAuthTokens, appleTokenRevocations } from '@/lib/infra/db/schema';
import { isForeignKeyViolation } from '@/lib/infra/db/sql-state';

const ENCRYPTION_KEY_ENV = 'APPLE_TOKEN_ENCRYPTION_KEY';

/**
 * Serializes everything that moves a user's Apple token: linking a new one
 * and copying it into the revocation outbox at deletion. Without it, deletion
 * could read the old token, a link could then store the new one while no
 * pending revocation exists yet, and deletion would queue the stale token.
 * Transaction-scoped, so it is released on commit or rollback.
 */
export async function lockAppleTokenForUser(
  tx: AppTransaction,
  userId: string
): Promise<void> {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext('apple_token'), hashtext(${userId}::text))`
  );
}

/** Binds a sealed token to its owner: copied onto another user it won't open. */
function aadFor(userId: string): string {
  return `apple-refresh-token:${userId}`;
}

export interface LinkAppleTokenInput {
  userId: string;
  /** The `sub` of the caller's Supabase Apple identity. */
  appleSubject: string;
  authorizationCode: string;
}

/**
 * `account_deleted`: the account was deleted mid-exchange; the fresh token was
 * revoked at once (or queued for the retry worker) rather than stored.
 */
export type LinkAppleTokenOutcome =
  | 'stored'
  | 'not_configured'
  | 'account_deleted';

/**
 * Exchange the code and store the sealed refresh token (one row per user; a
 * re-sign-in replaces it with the newer token).
 *
 * The token must belong to the caller's own Apple identity: without that
 * check a user could plant someone else's code on their account and have
 * their own deletion revoke a stranger's Apple sign-in.
 */
export async function linkAppleAuthorizationCode(
  input: LinkAppleTokenInput,
  database: AppDb = appDb
): Promise<LinkAppleTokenOutcome> {
  // Both checks run BEFORE the exchange: the code is single-use, so finding a
  // missing or malformed key only after Apple spent it would lose the token.
  const key = resolveSecretBoxKey(ENCRYPTION_KEY_ENV);
  if (!(readAppleAuthConfig() && key)) {
    console.warn(
      `[apple-sign-in] token revocation is not configured (Apple credentials or a valid ${ENCRYPTION_KEY_ENV} missing)`
    );
    return 'not_configured';
  }
  const result = await exchangeAppleAuthorizationCode(input.authorizationCode);
  if (!result.ok) {
    if (result.reason === 'not_configured') return 'not_configured';
    if (result.reason === 'invalid_grant') {
      throw Errors.validationFailed(
        'The Apple authorization code is invalid or has expired.'
      );
    }
    throw Errors.internal(
      new Error(`apple_token_exchange_${result.reason}`),
      'Could not reach Apple. Please try again.'
    );
  }
  if (result.subject !== input.appleSubject) {
    throw Errors.conflict(
      'The Apple authorization code does not belong to this account.'
    );
  }
  const ciphertext = seal(key, result.refreshToken, aadFor(input.userId));
  try {
    await storeLinkedToken(input.userId, ciphertext, database);
  } catch (error) {
    // The account was deleted while Apple was exchanging the code: the insert
    // fails its FK to auth.users and the whole transaction rolls back. The
    // code is already spent, so this token exists nowhere else — revoke it now.
    if (!isForeignKeyViolation(error)) throw error;
    await revokeOrphanedToken(
      input.userId,
      result.refreshToken,
      ciphertext,
      database
    );
    return 'account_deleted';
  }
  return 'stored';
}

async function storeLinkedToken(
  userId: string,
  ciphertext: string,
  database: AppDb
): Promise<void> {
  const now = new Date();
  await database.transaction(async (tx) => {
    await lockAppleTokenForUser(tx, userId);
    await tx
      .insert(appleAuthTokens)
      .values({ userId, refreshTokenCiphertext: ciphertext })
      .onConflictDoUpdate({
        target: appleAuthTokens.userId,
        set: { refreshTokenCiphertext: ciphertext, updatedAt: now },
      });
    // A deletion may already have enqueued a revocation (with the previous
    // token, or none yet) before this link landed. The auth cascade then
    // drops the row written above, so the pending outbox row is the only
    // place the newest token survives. The lock above orders this against
    // the enqueue, so one of the two always sees the other's write.
    await tx
      .update(appleTokenRevocations)
      .set({ refreshTokenCiphertext: ciphertext, nextAttemptAt: now })
      .where(
        and(
          eq(appleTokenRevocations.userId, userId),
          eq(appleTokenRevocations.status, 'pending')
        )
      );
  });
}

/**
 * Revoke a token whose account is already gone. If Apple can't be reached,
 * park it in the outbox (which has no FK, so it outlives the user) for the
 * retry worker — unless a pending row already holds a token, which the lone
 * pending slot cannot also carry; that rare case is logged loudly instead.
 */
async function revokeOrphanedToken(
  userId: string,
  refreshToken: string,
  ciphertext: string,
  database: AppDb
): Promise<void> {
  const revoked = await revokeAppleRefreshToken(refreshToken);
  if (revoked.ok) return;
  const rows = await database
    .insert(appleTokenRevocations)
    .values({ userId, refreshTokenCiphertext: ciphertext })
    .onConflictDoUpdate({
      target: appleTokenRevocations.userId,
      targetWhere: sql`status = 'pending'`,
      set: { refreshTokenCiphertext: ciphertext, nextAttemptAt: new Date() },
      setWhere: sql`${appleTokenRevocations.refreshTokenCiphertext} is null`,
    })
    .returning({ id: appleTokenRevocations.id });
  if (rows.length === 0) {
    console.error(
      `[apple-sign-in] could not queue an orphaned token for revocation (${revoked.reason}); a pending revocation already holds one`
    );
  }
}

/** The sealed token, for the revocation outbox. `null` = never linked. */
export async function readSealedAppleRefreshToken(
  userId: string,
  database: AppDb | AppTransaction = appDb
): Promise<string | null> {
  const rows = await database
    .select({ ciphertext: appleAuthTokens.refreshTokenCiphertext })
    .from(appleAuthTokens)
    .where(eq(appleAuthTokens.userId, userId))
    .limit(1);
  return rows[0]?.ciphertext ?? null;
}

/**
 * The plaintext refresh token behind a sealed value. Throws when the key is
 * missing or malformed, or the value was sealed for another user or under
 * another key — the revocation outbox turns that into a retry.
 */
export function openAppleRefreshToken(userId: string, sealed: string): string {
  const key = resolveSecretBoxKey(ENCRYPTION_KEY_ENV);
  if (!key) throw new Error('apple_token_encryption_key_unavailable');
  return open(key, sealed, aadFor(userId));
}
