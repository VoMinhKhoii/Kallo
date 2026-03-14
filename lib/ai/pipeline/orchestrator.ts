import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { GeminiClient } from '../gemini';
import { matchIngredients } from '../matching';
import { buildDecompositionPrompt, buildNutritionPrompt } from '../prompts';
import { mealDecompositionSchema, nutritionAdjustmentSchema } from '../schemas';
import type {
  MatchedIngredient,
  MealDecomposition,
  NutritionAdjustment,
  PipelineResponse,
  UnmatchedIngredient,
  UserContext,
} from '../types';
import { assembleResult } from './assembly';
import {
  handleError,
  isNonFoodError,
  NON_FOOD_BLOCKLIST,
  NonFoodError,
  nonFoodResponse,
} from './errors';

/** D1/D8: Default model for both LLM calls, configurable per call */
const GEMINI_MODEL = 'gemini-2.5-flash';

/**
 * Full meal analysis pipeline.
 *
 * Flow: LLM decomposition → ingredient matching → LLM nutrition → goal adjustment → aggregation.
 *
 * Error handling (D4):
 * - non_food_input: returned immediately, no retry (isFood=false or blocklist)
 * - parse_error: one retry (LLMs are non-deterministic), then surface
 * - api_error: one retry, then surface
 */
export async function analyzeMeal(
  rawInput: string,
  userContext: UserContext,
  db: PostgresJsDatabase,
  gemini: GeminiClient
): Promise<PipelineResponse> {
  try {
    return await runPipeline(rawInput, userContext, db, gemini);
  } catch (error) {
    if (isNonFoodError(error)) {
      return nonFoodResponse();
    }

    // D4: Parse/API errors get one retry
    console.warn(
      '[pipeline] First attempt failed, retrying entire pipeline:',
      error
    );
    try {
      return await runPipeline(rawInput, userContext, db, gemini);
    } catch (retryError) {
      return handleError(retryError);
    }
  }
}

async function runPipeline(
  rawInput: string,
  userContext: UserContext,
  db: PostgresJsDatabase,
  gemini: GeminiClient
): Promise<PipelineResponse> {
  const t0 = Date.now();
  const decomposition = await decomposeMeal(rawInput, userContext, gemini);
  console.info(`[pipeline] decomposition: ${Date.now() - t0}ms`);

  // D6 Layer 1: Check isFood field from LLM
  if (!decomposition.isFood) {
    throw new NonFoodError('Input is not food');
  }

  // D6 Layer 2: Post-parse blocklist sanity check
  for (const mi of decomposition.mealItems) {
    for (const ing of mi.ingredients) {
      if (NON_FOOD_BLOCKLIST.has(ing.name.toLowerCase().trim())) {
        throw new NonFoodError(`Non-food ingredient detected: "${ing.name}"`);
      }
    }
  }

  const allIngredients = decomposition.mealItems.flatMap(
    (mi) => mi.ingredients
  );
  const t1 = Date.now();
  const matchResult = await matchIngredients(
    allIngredients,
    rawInput,
    db,
    gemini
  );
  console.info(
    `[pipeline] matching ${allIngredients.length} ingredients: ${Date.now() - t1}ms`
  );

  const t2 = Date.now();
  const nutritionResult = await adjustNutrition(
    decomposition.mealItems,
    matchResult.matched,
    matchResult.unmatched,
    userContext,
    gemini
  );
  console.info(`[pipeline] nutrition adjustment: ${Date.now() - t2}ms`);

  const pipelineResult = assembleResult(
    decomposition,
    nutritionResult,
    matchResult.matched,
    matchResult.unmatched,
    userContext
  );

  console.info(`[pipeline] total: ${Date.now() - t0}ms`);
  return { success: true, data: pipelineResult };
}

async function decomposeMeal(
  rawInput: string,
  userContext: UserContext,
  gemini: GeminiClient
): Promise<MealDecomposition> {
  return gemini.generateStructuredOutput({
    schema: mealDecompositionSchema,
    systemPrompt: buildDecompositionPrompt(userContext),
    userMessage: rawInput,
    model: GEMINI_MODEL,
    temperature: 0.1,
  });
}

async function adjustNutrition(
  mealItems: MealDecomposition['mealItems'],
  matched: MatchedIngredient[],
  unmatched: UnmatchedIngredient[],
  userContext: UserContext,
  gemini: GeminiClient
): Promise<NutritionAdjustment> {
  return gemini.generateStructuredOutput({
    schema: nutritionAdjustmentSchema,
    systemPrompt: buildNutritionPrompt(
      mealItems,
      matched,
      unmatched,
      userContext
    ),
    userMessage:
      'Produce bounded nutrition estimates for each ingredient in each meal item based on the reference data provided.',
    model: GEMINI_MODEL,
  });
}
