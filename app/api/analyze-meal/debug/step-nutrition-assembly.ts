import type { GeminiClient } from '@/lib/ai/gemini';
import type { buildUserContext } from '@/lib/ai/mappers';
import { assembleResult } from '@/lib/ai/pipeline/assemble/assemble';
import type { resolveModelProfile } from '@/lib/ai/pipeline/config/model-profile';
import type { ensureIdsOnDecomposition } from '@/lib/ai/pipeline/contracts/decomposition-ids';
import { nutritionAdjustmentSchema } from '@/lib/ai/pipeline/contracts/schemas/nutrition-adjustment';
import { reconcileNutritionIds } from '@/lib/ai/pipeline/resolve/macro-resolution';
import { getNutritionPromptBuilder } from '@/lib/ai/prompts';
import type {
  MatchedIngredient,
  NutritionAdjustment,
  UnmatchedIngredient,
} from '@/lib/ai/types';
import { fetchWithTimeout } from '@/lib/async/fetch-with-timeout';

import {
  DEBUG_LLM_TIMEOUT_MS,
  pickMacros,
  serializeAttempt,
} from './debug-shared';

/** Step 3: nutrition LLM call + reconcile. */
export async function runNutritionDebugStep({
  gemini,
  modelProfile,
  userContext,
  decomposition,
  matched,
  unmatched,
}: {
  gemini: GeminiClient;
  modelProfile: ReturnType<typeof resolveModelProfile>;
  userContext: ReturnType<typeof buildUserContext>;
  decomposition: ReturnType<typeof ensureIdsOnDecomposition> | null;
  matched: MatchedIngredient[];
  unmatched: UnmatchedIngredient[];
}) {
  let nutritionAdj: NutritionAdjustment | null = null;
  const s3Start = Date.now();
  const step3: Record<string, any> = {
    prompt: null,
    rawResponse: null,
    parsed: null,
    attempts: [],
    durationMs: 0,
    error: null,
  };

  try {
    if (!decomposition || !decomposition.isFood) {
      step3.error = 'Skipped: no valid decomposition from step 1';
    } else {
      const nutritionPromptBuilder = getNutritionPromptBuilder();
      const systemPrompt = nutritionPromptBuilder(
        decomposition.mealItems,
        matched,
        unmatched,
        userContext
      );
      step3.prompt = systemPrompt;

      let rawResponse = '';
      const parsed = await fetchWithTimeout(
        (signal) =>
          gemini.generateStructuredOutputStream(
            {
              schema: nutritionAdjustmentSchema,
              systemPrompt,
              userMessage:
                'Produce bounded nutrition estimates for each ingredient in each meal item based on the reference data provided.',
              model: modelProfile.nutritionModel,
              temperature: 0.5,
              topP: 1,
              topK: 1,
              abortSignal: signal,
            },
            {
              onChunk: (accumulated) => {
                rawResponse = accumulated;
              },
              onAttemptComplete: (metadata) => {
                step3.attempts.push(serializeAttempt(metadata));
              },
            }
          ),
        DEBUG_LLM_TIMEOUT_MS,
        'debug-nutrition'
      );

      step3.rawResponse = rawResponse;
      nutritionAdj = reconcileNutritionIds(parsed, decomposition, matched);
      step3.parsed = nutritionAdj;
    }
  } catch (err) {
    step3.error = err instanceof Error ? err.message : String(err);
  }

  step3.durationMs = Date.now() - s3Start;
  return { step3, nutritionAdj };
}

/** Step 4: assembly with macros trimmed to the big 4 for readability. */
export function runAssemblyDebugStep({
  decomposition,
  nutritionAdj,
  matched,
  unmatched,
  userContext,
}: {
  decomposition: ReturnType<typeof ensureIdsOnDecomposition> | null;
  nutritionAdj: NutritionAdjustment | null;
  matched: MatchedIngredient[];
  unmatched: UnmatchedIngredient[];
  userContext: ReturnType<typeof buildUserContext>;
}) {
  const s4Start = Date.now();
  const step4: Record<string, any> = {
    result: null,
    confidenceOverall: null,
    displayedNutrition: null,
    durationMs: 0,
    error: null,
  };

  try {
    if (!decomposition || !nutritionAdj) {
      step4.error = 'Skipped: missing decomposition or nutrition';
    } else {
      const { result } = assembleResult(
        decomposition,
        nutritionAdj,
        matched,
        unmatched,
        userContext
      );
      // Trim nutrition to big 4 for debug readability
      step4.result = {
        ...result,
        boundedNutrition: pickMacros(result.boundedNutrition),
        displayedNutrition: pickMacros(result.displayedNutrition),
        mealItems: result.mealItems.map((mi) => ({
          ...mi,
          boundedNutrition: pickMacros(mi.boundedNutrition),
          displayedNutrition: pickMacros(mi.displayedNutrition),
          ingredients: mi.ingredients.map((ing) => ({
            ...ing,
            boundedNutrition: pickMacros(ing.boundedNutrition),
            displayedNutrition: pickMacros(ing.displayedNutrition),
          })),
        })),
      };
      step4.confidenceOverall = result.confidenceOverall;
      step4.displayedNutrition = pickMacros(result.displayedNutrition);
    }
  } catch (err) {
    step4.error = err instanceof Error ? err.message : String(err);
  }

  step4.durationMs = Date.now() - s4Start;
  return step4;
}
