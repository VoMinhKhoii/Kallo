import { and, eq } from 'drizzle-orm';
import {
  buildMealItemGroupsFromRows,
  buildPersistedMeal,
  nutritionValuesToRow,
  scaleNutritionRow,
} from '@/lib/actions/persisted-meal';
import type { db } from '@/lib/db';
import { mealItems, mealShares, meals } from '@/lib/db/schema';
import type { PersistedMeal } from '../meals/types';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type MealRow = typeof meals.$inferSelect;
type MealItemRow = typeof mealItems.$inferSelect;

/** Scale the actor's item rows, totals, and alcohol in place for a split. */
export async function scaleOwnMealInPlace(
  tx: Tx,
  source: MealRow,
  itemRows: MealItemRow[],
  factor: number
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
      portionFactor: factor,
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
    portionFactor: factor,
  });
}
