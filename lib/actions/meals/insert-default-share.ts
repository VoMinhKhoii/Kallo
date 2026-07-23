import { eq } from 'drizzle-orm';
import type { AppTransaction } from '@/lib/db';
import { mealShares, userProfiles } from '@/lib/db/schema';

/**
 * Insert the default circle share for a meal, respecting the actor's
 * autoShareToCircle preference. Returns the inserted row, or null when
 * the insert is skipped (opt-out) or produces no row (onConflictDoNothing).
 *
 * The preference is always read inside the caller's transaction so a toggle
 * flipped mid-request can't race a stale profile row into a share.
 */
export async function insertDefaultCircleShare(
  tx: AppTransaction,
  opts: { mealId: string; actorId: string }
): Promise<{ id: string; visibility: string } | null> {
  const [profile] = await tx
    .select({ autoShareToCircle: userProfiles.autoShareToCircle })
    .from(userProfiles)
    .where(eq(userProfiles.userId, opts.actorId));
  // Missing profile rows retain the existing opt-in behaviour.
  const share = profile?.autoShareToCircle ?? true;

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
