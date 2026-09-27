import { eq } from 'drizzle-orm';
import { isShareableMealText } from '@/lib/domain/social/shares/shareable-meal';
import type { AppTransaction } from '@/lib/infra/db/client';
import { mealShares, userProfiles } from '@/lib/infra/db/schema';

/**
 * Insert the default circle share for a meal when the actor has opted in via
 * autoShareToCircle (off by default). Returns the response `share` shape, or null
 * when the insert is skipped (opt-out, or text the objectionable-content filter
 * refuses) or produces no row (onConflictDoNothing).
 *
 * A flagged `rawInput` never fails the log: the meal is saved and stays
 * private, exactly as with auto-share off — the person can still edit it and
 * share it by hand, where the filter answers with a 422 they can act on.
 *
 * The preference is read inside the caller's transaction WITH a row lock —
 * setAutoShareToCircle commits outside this transaction, so without FOR UPDATE
 * an opt-out could land between this read and the insert below.
 */
export async function insertDefaultCircleShare(
  tx: AppTransaction,
  opts: { mealId: string; actorId: string; rawInput: string | null }
): Promise<{ shareId: string; visibility: string } | null> {
  const [profile] = await tx
    .select({ autoShareToCircle: userProfiles.autoShareToCircle })
    .from(userProfiles)
    .where(eq(userProfiles.userId, opts.actorId))
    .for('update');
  // Private by default: only an explicit opt-in shares. A missing profile row
  // never counts as consent (KALLO-03).
  const share = profile?.autoShareToCircle ?? false;

  if (!share) {
    // No row means private; the per-meal toggle can create one from scratch.
    return null;
  }
  if (!isShareableMealText(opts.rawInput)) {
    console.debug(
      `[share] auto-share skipped for meal ${opts.mealId}: text is not shareable; the meal stays private`
    );
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

  return row ? { shareId: row.id, visibility: row.visibility } : null;
}
