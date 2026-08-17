/**
 * Staging for a reviewed nutrition label: turn the user-confirmed values into
 * a `pending_analyses` row the normal confirm path can save.
 *
 * Lives outside `lib/actions/nutrition-ocr.ts` so both callers can share it —
 * the web Server Action and the mobile route handler
 * (`POST /api/v1/nutrition-label/log`). Mirrors `stageBarcodeMeal` in
 * `lib/barcode/service.ts`.
 */
import { NUTRITION_KEYS } from '@/lib/ai/constants';
import type {
  BoundedNutrition,
  NutritionValues as PipelineNutritionValues,
  PipelineResult,
} from '@/lib/ai/types';
import { getUtcInstantForLocalDate } from '@/lib/date/local-day';
import { db } from '@/lib/db';
import { pendingAnalyses } from '@/lib/db/schema';
import type { OcrReviewPayload } from '@/lib/nutrition/ocr-schema';

export class NutritionOcrStageError extends Error {
  readonly code = 'server_error';
}

export type StageOcrMealInput = OcrReviewPayload & {
  loggedDate: string;
  timezoneOffset: number;
};

/**
 * The label's values are exact printed figures, not an estimate, so every
 * nutrient's bounded low/mid/high collapses onto the single value.
 */
function toPipelineNutrition(
  input: StageOcrMealInput
): PipelineNutritionValues {
  return {
    caloriesKcal: input.calories,
    proteinG: input.proteinGrams,
    carbohydrateG: input.carbsGrams,
    fatG: input.fatGrams,
    fiberG: input.fiberGrams ?? null,
    sodiumMg: input.sodiumMg ?? null,
    calciumMg: input.calciumMg ?? null,
    ironMg: input.ironMg ?? null,
    magnesiumMg: input.magnesiumMg ?? null,
    phosphorusMg: input.phosphorusMg ?? null,
    potassiumMg: input.potassiumMg ?? null,
    zincMg: input.zincMg ?? null,
    copperMcg: input.copperMcg ?? null,
    manganeseMg: input.manganeseMg ?? null,
    betaCaroteneMcg: input.betaCaroteneMcg ?? null,
    vitaminAMcg: input.vitaminAMcg ?? null,
    vitaminCMg: input.vitaminCMg ?? null,
    vitaminDMcg: input.vitaminDMcg ?? null,
    vitaminEMg: input.vitaminEMg ?? null,
    vitaminKMcg: input.vitaminKMcg ?? null,
    vitaminB1Mg: input.vitaminB1Mg ?? null,
    vitaminB2Mg: input.vitaminB2Mg ?? null,
    vitaminPpMg: input.vitaminPpMg ?? null,
    vitaminB5Mg: input.vitaminB5Mg ?? null,
    vitaminB6Mg: input.vitaminB6Mg ?? null,
    vitaminB9Mcg: input.vitaminB9Mcg ?? null,
    vitaminB12Mcg: input.vitaminB12Mcg ?? null,
    vitaminHMcg: input.vitaminHMcg ?? null,
  };
}

/**
 * Insert the reviewed label as a staged analysis and return its id. Throws
 * {@link NutritionOcrStageError} when the insert returns no row.
 */
export async function stageOcrMeal(
  userId: string,
  input: StageOcrMealInput
): Promise<{ analysisId: string }> {
  const nutrition = toPipelineNutrition(input);

  const bounded: BoundedNutrition = {} as BoundedNutrition;
  for (const key of NUTRITION_KEYS) {
    const value = nutrition[key];
    bounded[key] =
      value !== null ? { low: value, mid: value, high: value } : null;
  }

  const loggedAt = getUtcInstantForLocalDate(
    input.loggedDate,
    input.timezoneOffset
  );

  const pipelineResult: PipelineResult = {
    mealSlot: null,
    confidenceOverall: input.confidence,
    unmatchedIngredients: [],
    displayedNutrition: nutrition,
    boundedNutrition: bounded,
    mealItems: [
      {
        name: input.productName,
        displayedNutrition: nutrition,
        boundedNutrition: bounded,
        ingredients: [
          {
            ingredientName: input.productName,
            foodCompositionId: null,
            estimatedGrams: input.amount,
            rawEquivalentGrams: input.amount,
            cookingMethod: null,
            userFacingUnit: input.unit,
            matchConfidence: 1,
            boundedNutrition: bounded,
            displayedNutrition: nutrition,
          },
        ],
      },
    ],
  };

  const [inserted] = await db
    .insert(pendingAnalyses)
    .values({
      userId,
      pipelineResult,
      rawInput: `${input.productName} (${input.amount}${input.unit})`,
      entryMode: 'precise',
      loggedAt,
    })
    .returning({ id: pendingAnalyses.id });

  if (!inserted) {
    throw new NutritionOcrStageError(
      'Staging the scanned label returned no row'
    );
  }

  return { analysisId: inserted.id };
}
