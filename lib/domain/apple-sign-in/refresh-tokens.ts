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
import { eq } from 'drizzle-orm';
import { Errors } from '@/lib/core/errors/catalog';
import {
  exchangeAppleAuthorizationCode,
  revokeAppleRefreshToken,
} from '@/lib/infra/apple-auth/apple-auth';
import { readAppleAuthConfig } from '@/lib/infra/apple-auth/config';
import { secretBox } from '@/lib/infra/crypto/secret-box';
import { type AppDb, db as appDb } from '@/lib/infra/db/client';
import { appleAuthTokens } from '@/lib/infra/db/schema';

export const APPLE_TOKEN_ENCRYPTION_KEY_ENV = 'APPLE_TOKEN_ENCRYPTION_KEY';

const box = secretBox(APPLE_TOKEN_ENCRYPTION_KEY_ENV);

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

export type LinkAppleTokenOutcome = 'stored' | 'not_configured';

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
  if (!(readAppleAuthConfig() && box.isConfigured())) {
    console.warn('[apple-sign-in] token revocation is not configured');
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
  const ciphertext = box.seal(result.refreshToken, aadFor(input.userId));
  const now = new Date();
  await database
    .insert(appleAuthTokens)
    .values({ userId: input.userId, refreshTokenCiphertext: ciphertext })
    .onConflictDoUpdate({
      target: appleAuthTokens.userId,
      set: { refreshTokenCiphertext: ciphertext, updatedAt: now },
    });
  return 'stored';
}

/** The sealed token, for the account-deletion outbox. `null` = never linked. */
export async function readSealedAppleRefreshToken(
  userId: string,
  database: AppDb = appDb
): Promise<string | null> {
  const rows = await database
    .select({ ciphertext: appleAuthTokens.refreshTokenCiphertext })
    .from(appleAuthTokens)
    .where(eq(appleAuthTokens.userId, userId))
    .limit(1);
  return rows[0]?.ciphertext ?? null;
}

/**
 * Open and revoke a sealed token. Throws on any failure — including missing
 * config, since a stored token proves config existed — so the deletion job
 * retries instead of dropping the revocation.
 */
export async function revokeSealedAppleRefreshToken(
  userId: string,
  sealed: string
): Promise<void> {
  const refreshToken = box.open(sealed, aadFor(userId));
  const result = await revokeAppleRefreshToken(refreshToken);
  if (!result.ok) throw new Error(`apple_token_revoke_${result.reason}`);
}
