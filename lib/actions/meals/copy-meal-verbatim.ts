import { randomUUID } from 'node:crypto';
import {
  buildMealItemGroupsFromRows,
  buildPersistedMeal,
  extractNutritionValues,
  inferMealSlot,
  nutritionValuesToRow,
  scaleNutritionRow,
} from '@/lib/actions/logging/persisted-meal';
import type { PersistedMeal } from '@/lib/actions/meals/types';
import type { AppTransaction } from '@/lib/infra/db/client';
import { mealItems, meals } from '@/lib/infra/db/schema';
import { guardClientMealId } from '@/lib/infra/db/unique-violation';
import { insertDefaultCircleShare } from './insert-default-share';

type MealRow = typeof meals.$inferSelect;
type MealItemDbRow = typeof mealItems.$inferSelect;

/**
 * Copy one stored meal (and its items) into a new meal for `userId`, scaling
 * every nutrition/gram value by `factor` when it isn't 1. This is the single
 * persistence seam shared by the three copy paths — accept-a-share, duplicate,
 * and recipient-initiated "log this too" / "chia đôi" — so they can never drift.
 * Kept out of persisted-meal.ts (which is synchronous client-shape builders) on
 * purpose: this is an async transaction writer.
 *
 * `factor` is any positive number. It used to be the literal union `1 | 0.5`
 * because those were the only two portions the product could produce; uneven
 * splits make it a ratio of two arbitrary part-runs (see
 * `meal_share_invites.copy_factor`). The body always multiplied generically —
 * only the type was narrow — so widening it changes no arithmetic. `factor === 1`
 * still takes the no-scale branch, which is what keeps an even split writing
 * rows byte-identical to the shipped behaviour.
 */
export async function copyMealVerbatim(
  tx: AppTransaction,
  source: MealRow,
  sourceItems: MealItemDbRow[],
  options: {
    userId: string;
    newMealId?: string;
    loggedAt: Date;
    /** Positive scale applied to grams, nutrition and alcohol. 1 = verbatim. */
    factor: number;
    /**
     * Slot to stamp on the copy. Omit — or pass null, which is what a legacy
     * row's `meal_slot` holds — to infer it from `loggedAt` instead.
     *
     * Opt-in on purpose, because the two copy families disagree about what a
     * copy *is*. A share is the SAME eating event seen from another diary, so
     * it carries the source's slot (and `loggedAt`); inferring would relabel a
     * friend's breakfast as whatever meal it happens to be when they accept.
     * A re-log (duplicate-meal.ts) is a genuinely NEW eating event happening
     * now, so it must keep inferring from the new instant.
     */
    mealSlot?: string | null;
  }
): Promise<{ mealId: string; meal: PersistedMeal }> {
  const { userId, newMealId, loggedAt, factor } = options;
  const mealSlot = options.mealSlot ?? inferMealSlot(loggedAt);
  const mealNutrition =
    factor === 1
      ? extractNutritionValues(source)
      : scaleNutritionRow(source, factor);
  const alcoholG = source.alcoholG == null ? null : source.alcoholG * factor;
  const portionFactor = source.portionFactor * factor;

  const [meal] = await guardClientMealId(() =>
    tx
      .insert(meals)
      .values({
        ...(newMealId ? { id: newMealId } : {}),
        userId,
        rawInput: source.rawInput,
        mealSlot,
        confidenceOverall: source.confidenceOverall,
        loggedAt,
        entryMode: 'precise',
        alcoholG,
        portionFactor,
        ...nutritionValuesToRow(mealNutrition),
      })
      .returning({ id: meals.id })
  );

  const share = await insertDefaultCircleShare(tx, {
    mealId: meal.id,
    actorId: userId,
  });

  const copies = sourceItems.map((row) => ({
    id: randomUUID(),
    row,
    nutrition:
      factor === 1
        ? extractNutritionValues(row)
        : scaleNutritionRow(row, factor),
  }));
  if (copies.length > 0) {
    await tx.insert(mealItems).values(
      copies.map(({ id, row, nutrition }) => ({
        id,
        mealId: meal.id,
        ingredientName: row.ingredientName,
        mealItemName: row.mealItemName,
        mealItemOrder: row.mealItemOrder,
        foodCompositionId: row.foodCompositionId,
        estimatedGrams:
          row.estimatedGrams == null ? null : row.estimatedGrams * factor,
        userFacingUnit: row.userFacingUnit,
        cookingMethod: row.cookingMethod,
        matchConfidence: row.matchConfidence,
        ...nutritionValuesToRow(nutrition),
      }))
    );
  }

  const mealItemGroups = buildMealItemGroupsFromRows(
    copies.map(({ id, row, nutrition }) => ({
      ...row,
      id,
      estimatedGrams:
        row.estimatedGrams == null ? null : row.estimatedGrams * factor,
      nutrition,
    }))
  );

  return {
    mealId: meal.id,
    meal: buildPersistedMeal({
      id: meal.id,
      rawInput: source.rawInput,
      mealSlot,
      confidenceOverall: source.confidenceOverall,
      loggedAt: loggedAt.toISOString(),
      nutrition: mealNutrition,
      mealItemGroups,
      entryMode: 'precise',
      alcoholG,
      cheatSliders: null,
      share,
      portionFactor,
    }),
  };
}
