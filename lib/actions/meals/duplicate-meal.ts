'use server';

import { and, eq } from 'drizzle-orm';
import { copyMealVerbatim } from '@/lib/actions/meals/copy-meal-verbatim';
import { duplicateMealSchema } from '@/lib/api/contracts/meals';
import { getUtcInstantForLocalDate } from '@/lib/core/date/local-day';
import { Errors } from '@/lib/core/errors/catalog';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';
import { db } from '@/lib/infra/db/client';
import { mealItems, meals } from '@/lib/infra/db/schema';
import type { ConfirmMealResponse } from './types';

// ---------------------------------------------------------------------------
// C4b: Duplicate a persisted meal ("log again")
// ---------------------------------------------------------------------------

// `duplicateMealSchema` (the full input incl. `mealId`) lives in the meals
// contract so the route can derive its body schema; imported here since this
// `'use server'` module may only export async functions.

/**
 * "Log again": reproduce an existing meal exactly by copying its stored item
 * rows (composition ids, grams, per-row nutrition) into a brand-new meal
 * stamped for the chosen day. No AI pipeline runs, so the accepted numbers — and
 * any prior manual gram edits — are preserved verbatim instead of being
 * re-estimated from the raw text (which is what re-submitting the text would do).
 *
 * Tenant isolation: the source meal is loaded scoped to the authenticated user;
 * its item rows are reached only through that meal's id — mirroring
 * `updateMealAction`'s guard.
 */
export async function duplicateMealAction(input: {
  mealId: string;
  newMealId?: string;
  loggedDate: string;
  timezoneOffset: number;
}): Promise<ConfirmMealResponse> {
  const parsed = duplicateMealSchema.parse(input);
  const { user } = await requireAuthAndProfile();

  return await db.transaction(async (tx) => {
    const [source] = await tx
      .select()
      .from(meals)
      .where(and(eq(meals.id, parsed.mealId), eq(meals.userId, user.id)))
      .limit(1)
      .for('update');

    if (!source) {
      throw Errors.validationFailed(
        'Bữa ăn không tồn tại hoặc không thuộc về bạn.'
      );
    }
    // Cheat meals carry no item rows (their nutrition lives in the slider spec);
    // duplicating one as a precise meal would drop that, so refuse here.
    if (source.entryMode === 'cheat') {
      throw Errors.validationFailed('Không thể ghi lại bữa xả theo cách này.');
    }

    const sourceItems = await tx
      .select()
      .from(mealItems)
      .where(eq(mealItems.mealId, source.id));

    // A re-log is a new eating event "now" on the chosen day, so the slot is
    // inferred from the new instant rather than copied from the original.
    const loggedAt = getUtcInstantForLocalDate(
      parsed.loggedDate,
      parsed.timezoneOffset
    );
    // Copy the source verbatim into a new meal for this user (shared helper —
    // same materialization the accept-a-share path uses).
    return await copyMealVerbatim(tx, source, sourceItems, {
      factor: 1,
      userId: user.id,
      newMealId: parsed.newMealId,
      loggedAt,
    });
  });
}
