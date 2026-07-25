'use server';

import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import {
  buildMealItemGroupsFromRows,
  buildPersistedMeal,
  extractNutritionValues,
  nutritionValuesToRow,
  scaleNutritionRow,
} from '@/lib/actions/persisted-meal';
import { sumDisplayedNutrition } from '@/lib/ai/pipeline/goal-adjustment';
import type { NutritionValues } from '@/lib/ai/types';
import { updateMealSchema } from '@/lib/api/contracts/meals';
import { requireAuthAndProfile } from '@/lib/auth';
import { db } from '@/lib/db';
import { mealItems, mealShares, meals } from '@/lib/db/schema';
import { Errors } from '@/lib/errors';
import type { ConfirmMealResponse } from './types';

const deleteMealSchema = z.object({
  mealId: z.string().uuid('mealId phải là UUID hợp lệ.'),
});

// `updateMealSchema` (the full input incl. `mealId`) lives in the meals
// contract so the route can derive its body schema and the mobile client can
// share it; imported here since this `'use server'` module may only export
// async functions.

// ---------------------------------------------------------------------------
// C3: Delete Meal
// ---------------------------------------------------------------------------

export async function deleteMealAction(input: { mealId: string }) {
  const parsed = deleteMealSchema.parse(input);
  const { user } = await requireAuthAndProfile();

  // Defense in depth: WHERE user_id check beyond RLS
  const [deleted] = await db
    .delete(meals)
    .where(and(eq(meals.id, parsed.mealId), eq(meals.userId, user.id)))
    .returning({ id: meals.id });

  if (!deleted) {
    throw Errors.validationFailed(
      'Bữa ăn không tồn tại hoặc không thuộc về bạn.'
    );
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// C4: Edit a persisted meal (gram overrides + per-row removal)
// ---------------------------------------------------------------------------

/**
 * Edit a persisted (precise) meal: override the cooked grams of stored items
 * and/or remove some of them, then recompute the meal totals from what remains.
 *
 * Tenant isolation: Drizzle bypasses Supabase RLS, so the `WHERE userId` filter
 * is the ONLY thing keeping one user out of another's meals. Every query here is
 * re-scoped to the authenticated `user.id` (the meal lookup) or constrained to
 * that meal's own item rows — mirroring `deleteMealAction`'s guard exactly. A
 * user can therefore never edit or drop a row belonging to someone else.
 */
export async function updateMealAction(input: {
  mealId: string;
  edits?: { id: string; newGrams: number }[];
  removeIds?: string[];
}): Promise<ConfirmMealResponse> {
  const parsed = updateMealSchema.parse(input);
  const { user } = await requireAuthAndProfile();

  return await db.transaction(async (tx) => {
    // Ownership gate: load the meal scoped to the authenticated user. A meal
    // belonging to anyone else simply isn't returned, so the edit can't proceed.
    const [meal] = await tx
      .select()
      .from(meals)
      .where(and(eq(meals.id, parsed.mealId), eq(meals.userId, user.id)))
      .limit(1)
      .for('update');

    if (!meal) {
      throw Errors.validationFailed(
        'Bữa ăn không tồn tại hoặc không thuộc về bạn.'
      );
    }
    if (meal.entryMode === 'cheat') {
      throw Errors.validationFailed(
        'Không thể chỉnh sửa bữa xả theo cách này.'
      );
    }

    // Item rows are reached only through this meal id, which we just proved the
    // caller owns — so they inherit the same tenant scope.
    const itemRows = await tx
      .select()
      .from(mealItems)
      .where(eq(mealItems.mealId, meal.id));

    const editById = new Map(
      (parsed.edits ?? []).map((edit) => [edit.id, edit.newGrams])
    );
    const removeIds = new Set(parsed.removeIds ?? []);

    const keptRows = itemRows.filter((row) => !removeIds.has(row.id));
    if (keptRows.length === 0) {
      throw Errors.validationFailed(
        'Bữa ăn phải còn ít nhất một món. Hãy xóa cả bữa thay vào đó.'
      );
    }

    // Compute each kept row's new nutrition (scaled when a gram override applies)
    // and the new meal totals as their sum.
    const updates: {
      id: string;
      estimatedGrams: number;
      nutrition: NutritionValues;
    }[] = [];
    const keptNutrition: NutritionValues[] = [];

    for (const row of keptRows) {
      const newGrams = editById.get(row.id);
      const currentGrams = row.estimatedGrams;
      if (
        newGrams !== undefined &&
        currentGrams != null &&
        currentGrams > 0 &&
        newGrams !== currentGrams
      ) {
        const ratio = newGrams / currentGrams;
        const scaled = scaleNutritionRow(row, ratio);
        updates.push({
          id: row.id,
          estimatedGrams: newGrams,
          nutrition: scaled,
        });
        keptNutrition.push(scaled);
      } else {
        keptNutrition.push(extractNutritionValues(row));
      }
    }

    const mealTotals = sumDisplayedNutrition(keptNutrition);

    // Alcohol is tracked on the meal, not per item, so it can't be recomputed
    // from rows the way the macros are. Approximate it by the change in total
    // mass: shrinking or dropping items scales the alcohol down proportionally,
    // mirroring how the displayed macros fall. (Exact per-ingredient alcohol
    // would need a schema change; this keeps the number from going stale.)
    const oldTotalGrams = itemRows.reduce(
      (sum, row) => sum + (row.estimatedGrams ?? 0),
      0
    );
    const newKeptGrams = keptRows.reduce(
      (sum, row) => sum + (editById.get(row.id) ?? row.estimatedGrams ?? 0),
      0
    );
    const massRatio = oldTotalGrams > 0 ? newKeptGrams / oldTotalGrams : 0;
    const newAlcoholG =
      meal.alcoholG != null ? meal.alcoholG * massRatio : null;

    // Apply: scale the edited item rows, drop the removed ones, write the new
    // meal totals — all scoped to this meal's ids.
    for (const update of updates) {
      await tx
        .update(mealItems)
        .set({
          estimatedGrams: update.estimatedGrams,
          ...nutritionValuesToRow(update.nutrition),
        })
        .where(and(eq(mealItems.id, update.id), eq(mealItems.mealId, meal.id)));
    }

    if (removeIds.size > 0) {
      await tx
        .delete(mealItems)
        .where(
          and(
            eq(mealItems.mealId, meal.id),
            inArray(mealItems.id, Array.from(removeIds))
          )
        );
    }

    await tx
      .update(meals)
      .set({ ...nutritionValuesToRow(mealTotals), alcoholG: newAlcoholG })
      .where(and(eq(meals.id, meal.id), eq(meals.userId, user.id)));

    // Rebuild the saved meal in the exact shape loadMealsByDate returns so the
    // client reconciles its card in place — same id, no day refetch.
    const nutritionByRowId = new Map(
      updates.map((update) => [update.id, update.nutrition])
    );
    const mealItemGroups = buildMealItemGroupsFromRows(
      keptRows.map((row) => ({
        ...row,
        estimatedGrams: editById.get(row.id) ?? row.estimatedGrams ?? null,
        nutrition: nutritionByRowId.get(row.id) ?? extractNutritionValues(row),
      }))
    );

    // Editing amounts must NOT change share state: carry the meal's existing
    // share row through so the reconciled card keeps its "shared" badge instead
    // of silently resetting to private until the next day refetch.
    const [shareRow] = await tx
      .select({ id: mealShares.id, visibility: mealShares.visibility })
      .from(mealShares)
      .where(eq(mealShares.mealId, meal.id))
      .limit(1);

    const savedMeal = buildPersistedMeal({
      id: meal.id,
      rawInput: meal.rawInput,
      mealSlot: meal.mealSlot,
      confidenceOverall: meal.confidenceOverall,
      loggedAt: meal.loggedAt.toISOString(),
      nutrition: mealTotals,
      mealItemGroups,
      entryMode: 'precise',
      alcoholG: newAlcoholG,
      cheatSliders: null,
      portionFactor: meal.portionFactor,
      share: shareRow
        ? { shareId: shareRow.id, visibility: shareRow.visibility }
        : null,
    });

    return { mealId: meal.id, meal: savedMeal };
  });
}
