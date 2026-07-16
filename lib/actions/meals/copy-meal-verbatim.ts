import { randomUUID } from 'node:crypto';
import {
  buildMealItemGroupsFromRows,
  buildPersistedMeal,
  extractNutritionValues,
  nutritionValuesToRow,
} from '@/lib/actions/persisted-meal';
import type { db } from '@/lib/db';
import { mealItems, mealShares, meals } from '@/lib/db/schema';
import type { PersistedMeal } from './types';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type MealRow = typeof meals.$inferSelect;
type MealItemRow = typeof mealItems.$inferSelect;

/**
 * Materialize an existing meal as a fresh log owned by `userId`: copy the meal
 * row + its item rows verbatim (grams / composition ids / per-row nutrition),
 * share it to the actor's circle by default, and rebuild it in loadMealsByDate's
 * shape so the client reconciles its optimistic card in place (same id, no day
 * refetch). No AI re-estimation and no re-scaling — a fractional split share
 * stays fractional and its portion_factor carries through.
 *
 * The single construction point for "re-log this meal", shared by re-log
 * (duplicateMealAction) and accept-a-share (acceptMealShareInviteAction). The
 * caller owns loading `source`/`sourceItems` (each authorizes that read its own
 * way — ownership for re-log, a claimed invite for accept) and any follow-up
 * (accept points its invite at the returned mealId).
 */
export async function copyMealVerbatim(
  tx: Tx,
  args: {
    source: MealRow;
    sourceItems: MealItemRow[];
    userId: string;
    /** Client-generated id so the optimistic card shares the persisted key. */
    newMealId?: string;
    loggedAt: Date;
    mealSlot: string;
  }
): Promise<{ mealId: string; meal: PersistedMeal }> {
  const { source, sourceItems, userId, newMealId, loggedAt, mealSlot } = args;
  const mealNutrition = extractNutritionValues(source);

  const [meal] = await tx
    .insert(meals)
    .values({
      ...(newMealId ? { id: newMealId } : {}),
      userId,
      rawInput: source.rawInput,
      mealSlot,
      confidenceOverall: source.confidenceOverall,
      loggedAt,
      entryMode: 'precise',
      alcoholG: source.alcoholG,
      portionFactor: source.portionFactor,
      ...nutritionValuesToRow(mealNutrition),
    })
    .returning({ id: meals.id });

  // Share to circle by default, exactly like any freshly logged meal (the AFTER
  // INSERT trigger fans out the circle event). The new id never collides.
  const [shareRow] = await tx
    .insert(mealShares)
    .values({ mealId: meal.id, actorId: userId, visibility: 'circle' })
    .onConflictDoNothing({ target: mealShares.mealId })
    .returning({ id: mealShares.id, visibility: mealShares.visibility });
  const share = shareRow
    ? { shareId: shareRow.id, visibility: shareRow.visibility }
    : null;

  // Copy each item with a fresh id, preserving order / composition / grams and
  // the stored per-row nutrition exactly (extract → write the same values back).
  const copies = sourceItems.map((row) => ({
    id: randomUUID(),
    row,
    nutrition: extractNutritionValues(row),
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
        estimatedGrams: row.estimatedGrams,
        userFacingUnit: row.userFacingUnit,
        cookingMethod: row.cookingMethod,
        matchConfidence: row.matchConfidence,
        ...nutritionValuesToRow(nutrition),
      }))
    );
  }

  const mealItemGroups = buildMealItemGroupsFromRows(
    copies.map(({ id, row, nutrition }) => ({ ...row, id, nutrition }))
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
      alcoholG: source.alcoholG ?? null,
      cheatSliders: null,
      share,
      portionFactor: source.portionFactor,
    }),
  };
}
