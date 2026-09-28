import { and, eq } from 'drizzle-orm';
import { confirmAndSaveMealAction } from '@/lib/actions/meals/confirm-and-save';
import { AppError } from '@/lib/core/errors/app-error';
import { Errors } from '@/lib/core/errors/catalog';
import { db } from '@/lib/infra/db/client';
import { meals, pendingAnalyses } from '@/lib/infra/db/schema';

/**
 * Confirm the meal a one-shot log (`/api/v1/barcode/log`,
 * `/api/v1/nutrition-label/log`) has just staged.
 *
 * The apps reuse one meal id across the retries of one save, so the retry of a
 * save that landed but whose answer was lost meets a conflict on that id. Then:
 *
 * - the card this attempt staged on the way is thrown away, or it would sit in
 *   the feed as a second, pending copy;
 * - only a meal the CALLER owns turns the conflict into `MEAL_ALREADY_SAVED`,
 *   which the app closes on as saved. An id held by any other account keeps
 *   the plain `CONFLICT` it always had, so the answer says nothing more about
 *   other accounts than it did before.
 */
export async function confirmStagedMeal(
  userId: string,
  analysisId: string,
  mealId: string | undefined
) {
  try {
    return await confirmAndSaveMealAction({ analysisId, mealId });
  } catch (error) {
    if (!(error instanceof AppError && error.code === 'CONFLICT') || !mealId) {
      throw error;
    }
    await discardStaged(userId, analysisId);
    if (await ownsMeal(userId, mealId)) throw Errors.mealAlreadySaved();
    throw error;
  }
}

/** Best-effort: the row expires on its own, and must never mask the answer. */
async function discardStaged(userId: string, analysisId: string) {
  try {
    await db
      .delete(pendingAnalyses)
      .where(
        and(
          eq(pendingAnalyses.id, analysisId),
          eq(pendingAnalyses.userId, userId)
        )
      );
  } catch (cleanup) {
    console.error('Discarding a retried staged meal failed:', cleanup);
  }
}

/** Unknown reads as "not yours": never claim a save that cannot be shown. */
async function ownsMeal(userId: string, mealId: string) {
  try {
    const [own] = await db
      .select({ id: meals.id })
      .from(meals)
      .where(and(eq(meals.id, mealId), eq(meals.userId, userId)))
      .limit(1);
    return own !== undefined;
  } catch (lookup) {
    console.error('Checking a retried meal id failed:', lookup);
    return false;
  }
}
