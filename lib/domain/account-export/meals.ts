import { eq, getTableColumns } from 'drizzle-orm';
import type { AppDb } from '@/lib/infra/db/client';
import {
  bodyWeightLog,
  dayCompletionMarks,
  mealItems,
  meals,
  nutritionLabelImages,
} from '@/lib/infra/db/schema';

type MealItemRow = typeof mealItems.$inferSelect;

/**
 * The food diary: every meal with its items, the weight log, the days the
 * user marked as fully logged, and the nutrition-label scans whose photo was
 * kept — what the scanner read (or why it failed) and what the user saved.
 * A scan's photo is listed under `files` by the builder, not inlined.
 *
 * Items are read with a join on the owning meal rather than `IN (mealIds)`, so
 * the scope is the same `meals.user_id` predicate as the meals themselves and
 * the statement does not grow one bind parameter per meal for a long history.
 * `meals` and `weights` keep the full row shape the export has always had, so
 * existing readers of the file are unaffected.
 */
export async function loadMealsExport(db: AppDb, userId: string) {
  const [mealRows, itemRows, weightRows, dayMarkRows, labelScanRows] =
    await Promise.all([
      db.select().from(meals).where(eq(meals.userId, userId)),
      db
        .select(getTableColumns(mealItems))
        .from(mealItems)
        .innerJoin(meals, eq(mealItems.mealId, meals.id))
        .where(eq(meals.userId, userId)),
      db.select().from(bodyWeightLog).where(eq(bodyWeightLog.userId, userId)),
      db
        .select({
          id: dayCompletionMarks.id,
          localDate: dayCompletionMarks.localDate,
          createdAt: dayCompletionMarks.createdAt,
        })
        .from(dayCompletionMarks)
        .where(eq(dayCompletionMarks.userId, userId)),
      db
        .select({
          id: nutritionLabelImages.id,
          storagePath: nutritionLabelImages.storagePath,
          mimeType: nutritionLabelImages.mimeType,
          byteSize: nutritionLabelImages.byteSize,
          status: nutritionLabelImages.status,
          result: nutritionLabelImages.result,
          errorCode: nutritionLabelImages.errorCode,
          mealId: nutritionLabelImages.mealId,
          reviewedResult: nutritionLabelImages.reviewedResult,
          createdAt: nutritionLabelImages.createdAt,
        })
        .from(nutritionLabelImages)
        .where(eq(nutritionLabelImages.userId, userId)),
    ]);

  const itemsByMeal = new Map<string, MealItemRow[]>();
  for (const item of itemRows) {
    const bucket = itemsByMeal.get(item.mealId);
    if (bucket) {
      bucket.push(item);
    } else {
      itemsByMeal.set(item.mealId, [item]);
    }
  }

  return {
    meals: mealRows.map((meal) => ({
      ...meal,
      items: itemsByMeal.get(meal.id) ?? [],
    })),
    weights: weightRows,
    dayCompletionMarks: dayMarkRows,
    labelScans: labelScanRows,
  };
}
