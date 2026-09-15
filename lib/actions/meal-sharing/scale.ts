import { and, eq } from 'drizzle-orm';
import {
  buildMealItemGroupsFromRows,
  buildPersistedMeal,
  nutritionValuesToRow,
  scaleNutritionRow,
} from '@/lib/actions/logging/persisted-meal';
import type { PersistedMeal } from '@/lib/actions/meals/types';
import type { db } from '@/lib/infra/db/client';
import { mealItems, mealShares, meals } from '@/lib/infra/db/schema';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type MealRow = typeof meals.$inferSelect;
type MealItemRow = typeof mealItems.$inferSelect;

/**
 * Scale the actor's item rows, totals, and alcohol in place for a split.
 *
 * [portionFactorAfter] defaults to [factor], which is right for a split: you
 * scale a full meal to 0.65 and it now IS a 0.65 portion. Undo is the case
 * where they differ — it scales by 1/0.65 to restore the values, but the meal
 * ends up a full portion again, not a 1.54 one.
 */
export async function scaleOwnMealInPlace(
  tx: Tx,
  source: MealRow,
  itemRows: MealItemRow[],
  factor: number,
  portionFactorAfter: number = factor
): Promise<PersistedMeal> {
  const scaled = itemRows.map((row) => ({
    row,
    grams: row.estimatedGrams != null ? row.estimatedGrams * factor : null,
    nutrition: scaleNutritionRow(row, factor),
  }));

  for (const { row, grams, nutrition } of scaled) {
    await tx
      .update(mealItems)
      .set({ estimatedGrams: grams, ...nutritionValuesToRow(nutrition) })
      .where(and(eq(mealItems.id, row.id), eq(mealItems.mealId, source.id)));
  }

  const mealNutrition = scaleNutritionRow(source, factor);
  const newAlcoholG = source.alcoholG != null ? source.alcoholG * factor : null;

  await tx
    .update(meals)
    .set({
      ...nutritionValuesToRow(mealNutrition),
      alcoholG: newAlcoholG,
      portionFactor: portionFactorAfter,
    })
    .where(and(eq(meals.id, source.id), eq(meals.userId, source.userId)));

  const mealItemGroups = buildMealItemGroupsFromRows(
    scaled.map(({ row, grams, nutrition }) => ({
      ...row,
      estimatedGrams: grams,
      nutrition,
    }))
  );

  const [shareRow] = await tx
    .select({ id: mealShares.id, visibility: mealShares.visibility })
    .from(mealShares)
    .where(eq(mealShares.mealId, source.id))
    .limit(1);

  return buildPersistedMeal({
    id: source.id,
    rawInput: source.rawInput,
    mealSlot: source.mealSlot,
    confidenceOverall: source.confidenceOverall,
    loggedAt: source.loggedAt.toISOString(),
    nutrition: mealNutrition,
    mealItemGroups,
    entryMode: 'precise',
    alcoholG: newAlcoholG,
    cheatSliders: null,
    share: shareRow
      ? { shareId: shareRow.id, visibility: shareRow.visibility }
      : null,
    portionFactor: portionFactorAfter,
  });
}
