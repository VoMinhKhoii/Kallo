import { eq } from 'drizzle-orm';
import type { AppTransaction } from '@/lib/db';
import { mealShares, userProfiles } from '@/lib/db/schema';

/**
 * Insert the default circle share for a meal, respecting the actor's
 * autoShareToCircle preference. Returns the inserted row, or null when
 * the insert is skipped (opt-out) or produces no row (onConflictDoNothing).
 *
 * Pass opts.autoShare when the caller already holds the profile row to
 * avoid a redundant query inside the transaction.
 */
export async function insertDefaultCircleShare(
  tx: AppTransaction,
  opts: { mealId: string; actorId: string; autoShare?: boolean }
): Promise<{ id: string; visibility: string } | null> {
  let share = opts.autoShare;

  if (share === undefined) {
    // Keep the preference read in the caller's transaction so it sees any
    // in-flight profile writes.
    const [profile] = await tx
      .select({ autoShareToCircle: userProfiles.autoShareToCircle })
      .from(userProfiles)
      .where(eq(userProfiles.userId, opts.actorId));
    // Missing profile rows retain the existing opt-in behaviour.
    share = profile?.autoShareToCircle ?? true;
  }

  if (!share) {
    // No row means private; the per-meal toggle can create one from scratch.
    return null;
  }

  const [row] = await tx
    .insert(mealShares)
    .values({
      mealId: opts.mealId,
      actorId: opts.actorId,
      visibility: 'circle',
    })
    .onConflictDoNothing({ target: mealShares.mealId })
    .returning({ id: mealShares.id, visibility: mealShares.visibility });

  return row ?? null;
}
