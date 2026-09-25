// ---------------------------------------------------------------------------
// Sign in with Apple revocation outbox
// ---------------------------------------------------------------------------
// Account deletion must revoke the user's Apple authorization, but the sealed
// refresh token lives in `apple_auth_tokens`, which cascades away with the
// auth user. So deletion first copies it into `apple_token_revocations` (no FK
// — the row outlives the user), then revokes after the account is gone.
//
// Deliberately separate from the RevenueCat erasure outbox: a revocation that
// can never succeed (lost encryption key, revoked .p8) must not hold billing
// erasure hostage, and vice versa. Each row retries hourly and parks as
// `dead` after MAX_ATTEMPTS, logged loudly once, so an operator can fix the
// cause and flip it back to `pending`.

import 'server-only';
import { and, eq, lte, sql } from 'drizzle-orm';
import { authUserIsConfirmedAbsent } from '@/lib/domain/account-deletion/jobs';
import { revokeAppleRefreshToken } from '@/lib/infra/apple-auth/apple-auth';
import { type AppDb, db as appDb } from '@/lib/infra/db/client';
import { appleTokenRevocations } from '@/lib/infra/db/schema';
import { createAdminClient } from '@/lib/infra/supabase/admin';
import {
  openAppleRefreshToken,
  readSealedAppleRefreshToken,
} from './refresh-tokens';

const PENDING = 'pending';
const COMPLETED = 'completed';
const DEAD = 'dead';
export const MAX_ATTEMPTS = 10;
const PROCESSING_LEASE_MS = 10 * 60 * 1000;

export interface AppleRevocationRow {
  id: string;
  userId: string;
  refreshTokenCiphertext: string | null;
}

export type AppleRevocationOutcome = 'completed' | 'retry' | 'dead';

const isPending = eq(appleTokenRevocations.status, PENDING);

/**
 * Queue the caller's Apple token for revocation, BEFORE the auth user is
 * deleted. `null` when the account never linked a token. A still-pending row
 * from an earlier attempt is refreshed with the newest token and made due now,
 * so a retried deletion never revokes a stale token.
 */
export async function enqueueAppleRevocation(
  userId: string,
  database: AppDb = appDb
): Promise<{ id: string } | null> {
  const sealed = await readSealedAppleRefreshToken(userId, database);
  if (!sealed) return null;
  const now = new Date();
  const rows = await database
    .insert(appleTokenRevocations)
    .values({ userId, refreshTokenCiphertext: sealed, nextAttemptAt: now })
    .onConflictDoUpdate({
      target: appleTokenRevocations.userId,
      targetWhere: sql`status = 'pending'`,
      set: { refreshTokenCiphertext: sealed, nextAttemptAt: now },
    })
    .returning({ id: appleTokenRevocations.id });
  const id = rows[0]?.id;
  if (!id) throw new Error('apple_revocation_not_persisted');
  return { id };
}

/**
 * Compare-and-set claim on a due pending row. `next_attempt_at` becomes the
 * lease; the returned `claimedAt` (stored as `last_attempt_at`) fences the
 * outcome write so a stale processor cannot overwrite a newer one.
 */
export async function claimAppleRevocation(
  id: string,
  database: AppDb = appDb
): Promise<{ row: AppleRevocationRow; claimedAt: Date } | null> {
  const claimedAt = new Date();
  const rows = await database
    .update(appleTokenRevocations)
    .set({
      lastAttemptAt: claimedAt,
      nextAttemptAt: new Date(claimedAt.getTime() + PROCESSING_LEASE_MS),
    })
    .where(
      and(
        eq(appleTokenRevocations.id, id),
        isPending,
        lte(appleTokenRevocations.nextAttemptAt, claimedAt)
      )
    )
    .returning({
      id: appleTokenRevocations.id,
      userId: appleTokenRevocations.userId,
      refreshTokenCiphertext: appleTokenRevocations.refreshTokenCiphertext,
    });
  const row = rows[0];
  return row ? { row, claimedAt } : null;
}

/**
 * Open and revoke. Never throws for a revocation failure — it records it and
 * answers `retry` (or `dead` at the attempt cap); only a database error
 * escapes. Apple treats an already-dead token as revoked (`invalid_grant`).
 */
export async function processAppleRevocation(
  row: AppleRevocationRow,
  claimedAt: Date,
  database: AppDb = appDb
): Promise<AppleRevocationOutcome> {
  const fence = and(
    eq(appleTokenRevocations.id, row.id),
    isPending,
    eq(appleTokenRevocations.lastAttemptAt, claimedAt)
  );
  try {
    if (row.refreshTokenCiphertext) {
      const token = openAppleRefreshToken(
        row.userId,
        row.refreshTokenCiphertext
      );
      const result = await revokeAppleRefreshToken(token);
      if (!result.ok) throw new Error(`apple_token_revoke_${result.reason}`);
    }
    await database
      .update(appleTokenRevocations)
      .set({
        status: COMPLETED,
        refreshTokenCiphertext: null,
        completedAt: new Date(),
        lastError: null,
      })
      .where(fence);
    return 'completed';
  } catch (error) {
    const message = (
      error instanceof Error ? error.message : String(error)
    ).slice(0, 500);
    const rows = await database
      .update(appleTokenRevocations)
      .set({
        attemptCount: sql`${appleTokenRevocations.attemptCount} + 1`,
        // Decided in SQL from the stored count, so a concurrent enqueue or a
        // stale in-memory row cannot miscount toward the cap.
        status: sql`CASE WHEN ${appleTokenRevocations.attemptCount} + 1 >= ${MAX_ATTEMPTS} THEN 'dead' ELSE 'pending' END`,
        nextAttemptAt: sql`now() + interval '1 hour'`,
        lastError: message,
      })
      .where(fence)
      .returning({ status: appleTokenRevocations.status });
    if (rows[0]?.status === DEAD) {
      console.error(
        `[apple-revocation] ${row.id} gave up after ${MAX_ATTEMPTS} attempts: ${message}`
      );
      return 'dead';
    }
    console.error(`[apple-revocation] ${row.id} queued for retry: ${message}`);
    return 'retry';
  }
}

/**
 * The hourly worker. A row is processed only once Auth confirms its user is
 * gone — a pending row whose deletion failed must not revoke a live account's
 * sign-in. `failed` counts this run's failures (a row turning `dead` counts
 * once; dead rows are never picked again).
 */
export async function retryAppleRevocations(
  database: AppDb = appDb
): Promise<{ processed: number; failed: number; skipped: number }> {
  const rows = await database
    .select({
      id: appleTokenRevocations.id,
      userId: appleTokenRevocations.userId,
    })
    .from(appleTokenRevocations)
    .where(and(isPending, lte(appleTokenRevocations.nextAttemptAt, new Date())))
    .limit(100);

  const admin = createAdminClient();
  let processed = 0;
  let failed = 0;
  let skipped = 0;
  for (const candidate of rows) {
    const { data, error } = await admin.auth.admin.getUserById(
      candidate.userId
    );
    if (data.user) {
      skipped += 1;
      continue;
    }
    if (!authUserIsConfirmedAbsent(data.user, error)) {
      failed += 1;
      continue;
    }
    const claim = await claimAppleRevocation(candidate.id, database);
    if (!claim) {
      skipped += 1;
      continue;
    }
    const outcome = await processAppleRevocation(
      claim.row,
      claim.claimedAt,
      database
    );
    if (outcome === 'completed') processed += 1;
    else failed += 1;
  }
  return { processed, failed, skipped };
}
