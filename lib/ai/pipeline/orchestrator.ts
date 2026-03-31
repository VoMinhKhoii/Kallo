import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { capitalizeFirst } from '@/lib/utils';
import { applyIngredientAliases } from '../aliases';
import type { GeminiClient } from '../gemini';
import { matchIngredients } from '../matching';
import { buildDecompositionPrompt, buildNutritionPrompt } from '../prompts';
import { mealDecompositionSchema, nutritionAdjustmentSchema } from '../schemas';
import type {
  MealDecomposition,
  NutritionAdjustment,
  PipelineResponse,
  UserContext,
} from '../types';
import { assembleResult } from './assembly';
import {
  handleError,
  isNonFoodError,
  isParseError,
  NON_FOOD_BLOCKLIST,
  NonFoodError,
  nonFoodResponse,
} from './errors';

/** D1/D8: Default model for both LLM calls, configurable per call */
const GEMINI_MODEL = 'gemini-3-flash-preview';

/**
 * Full meal analysis pipeline.
 *
 * Flow: LLM decomposition → ingredient matching → LLM nutrition → goal adjustment → aggregation.
 *
 * Error handling (D4):
 * - non_food_input: returned immediately, no retry (isFood=false or blocklist)
 * - parse_error: one retry of the full pipeline (safe — embedding cache prevents rate limit re-trigger)
 * - rate_limit (429): surfaces immediately — withRetry in gemini.ts handles per-call retries
 * - api_error: surfaces immediately
 */
export async function analyzeMeal(
  rawInput: string,
  userContext: UserContext,
  db: PostgresJsDatabase<any>,
  gemini: GeminiClient
): Promise<PipelineResponse> {
  try {
    return await runPipeline(rawInput, userContext, db, gemini);
  } catch (error) {
    if (isNonFoodError(error)) {
      return nonFoodResponse();
    }

    // Rate limit errors must NOT trigger pipeline retry — would create doom loop
    if (error instanceof Error && error.message.includes('429')) {
      console.error(
        '[pipeline] Rate limit error — not retrying pipeline:',
        error.message
      );
      return handleError(error);
    }

    // Parse errors get one retry (LLMs are non-deterministic)
    if (isParseError(error)) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[pipeline] Parse error, retrying pipeline once:', message);
      try {
        return await runPipeline(rawInput, userContext, db, gemini);
      } catch (retryError) {
        return handleError(retryError);
      }
    }

    // All other errors (API errors, network, etc.) surface immediately
    return handleError(error);
  }
}

async function runPipeline(
  rawInput: string,
  userContext: UserContext,
  db: PostgresJsDatabase<any>,
  gemini: GeminiClient
): Promise<PipelineResponse> {
  const t0 = Date.now();
  const decomposition: MealDecomposition =
    await gemini.generateStructuredOutput({
      schema: mealDecompositionSchema,
      systemPrompt: buildDecompositionPrompt(userContext),
      userMessage: rawInput,
      model: GEMINI_MODEL,
      temperature: 0.3,
      topP: 1,
      topK: 1,
    });
  console.info(`[pipeline] decomposition: ${Date.now() - t0}ms`);

  // Normalize names: capitalize first letter for consistent cache keys and UI display
  for (const mi of decomposition.mealItems) {
    mi.name = capitalizeFirst(mi.name);
    for (const ing of mi.ingredients) {
      ing.name = capitalizeFirst(ing.name);
    }
  }

  // Apply ingredient aliases: map common shorthand names to canonical DB names
  applyIngredientAliases(decomposition);

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
    `[pipeline] matching ${allIngredients.length} ingredients: ${Date.now() - t1}ms | matched=${matchResult.matched.length} unmatched=${matchResult.unmatched.length}`
  );
  for (const m of matchResult.matched) {
    console.info(
      `[pipeline]   ✓ ${m.ingredientName} → ${m.matchedName} (${m.similarity.toFixed(3)}, ${m.confidence})`
    );
  }
  for (const u of matchResult.unmatched) {
    console.info(`[pipeline]   ✗ ${u.ingredientName} → unmatched`);
  }

  const t2 = Date.now();
  const nutritionResult: NutritionAdjustment =
    await gemini.generateStructuredOutput({
      schema: nutritionAdjustmentSchema,
      systemPrompt: buildNutritionPrompt(
        decomposition.mealItems,
        matchResult.matched,
        matchResult.unmatched,
        userContext
      ),
      userMessage:
        'Produce bounded nutrition estimates for each ingredient in each meal item based on the reference data provided.',
      model: GEMINI_MODEL,
      temperature: 0.5,
      topP: 1,
      topK: 1,
    });
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
