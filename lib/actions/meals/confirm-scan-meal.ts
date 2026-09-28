'use server';

import { z } from 'zod';
import { AppError } from '@/lib/core/errors/app-error';
import { confirmStagedMeal } from '@/lib/domain/meals/confirm-staged';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';

const confirmScanMealSchema = z.object({
  analysisId: z.string().uuid(),
  mealId: z.string().uuid(),
});

/**
 * Confirm a meal the web scan dialog has just staged, under the dialog's own
 * meal id — the web twin of the one-shot `/api/v1/*\/log` routes. The dialog
 * keeps one id across the retries of one save, so a retry whose first try
 * landed (its answer lost) comes back as saved, never as a second meal
 * (`confirmStagedMeal`). A thrown action error reaches the client without its
 * code, which is why this answers with a result instead.
 */
export async function confirmScanMealAction(input: {
  analysisId: string;
  mealId: string;
}): Promise<{ success: true } | { success: false; code: 'server_error' }> {
  try {
    const parsed = confirmScanMealSchema.parse(input);
    const { user } = await requireAuthAndProfile();
    await confirmStagedMeal(user.id, parsed.analysisId, parsed.mealId);
    return { success: true };
  } catch (error) {
    if (error instanceof AppError && error.code === 'MEAL_ALREADY_SAVED') {
      return { success: true };
    }
    console.error('Error in confirmScanMealAction:', error);
    return { success: false, code: 'server_error' };
  }
}
