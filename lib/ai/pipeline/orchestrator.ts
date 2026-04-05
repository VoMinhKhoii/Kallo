import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { capitalizeFirst } from '@/lib/utils';
import type { GeminiClient } from '../gemini';
import { matchIngredients } from '../matching';
import { applyIngredientAliases } from '../matching/aliases';
import { createSpeculativeMatcher } from '../matching/speculative';
import { buildDecompositionPrompt, buildNutritionPrompt } from '../prompts';
import type { StreamEvent } from '../streaming/types';
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
import { mealDecompositionSchema, nutritionAdjustmentSchema } from './schemas';
import {
  detectAnomalies,
  type ValidationAnomaly,
  validateNutritionOutput,
} from './validation';

/** Model for LLM Call 1 (decomposition) — structured extraction, speed-optimized */
const DECOMPOSITION_MODEL = 'gemini-3.1-flash-lite-preview';

/** Model for LLM Call 2 (nutrition estimation) — needs domain accuracy */
const NUTRITION_MODEL = 'gemini-3.1-flash-lite-preview';

/** Per-call timeout for Gemini API calls (ms) */
const LLM_TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// Structured logging
// ---------------------------------------------------------------------------

export interface PipelineMetrics {
  decomposeMs: number;
  matchMs: number;
  nutritionMs: number;
  assemblyMs: number;
  totalMs: number;
  ingredientCount: number;
  matchedCount: number;
  unmatchedCount: number;
  mealItemCount: number;
  anomalies: ValidationAnomaly[];
}

function logMetrics(metrics: PipelineMetrics): void {
  console.info('[pipeline] metrics', JSON.stringify(metrics));
}

// ---------------------------------------------------------------------------
// Timeout helper
// ---------------------------------------------------------------------------

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

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
  gemini: GeminiClient,
  onEvent?: (event: StreamEvent) => void
): Promise<PipelineResponse> {
  try {
    return await runPipeline(rawInput, userContext, db, gemini, onEvent);
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
        return await runPipeline(rawInput, userContext, db, gemini, onEvent);
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
  gemini: GeminiClient,
  onEvent?: (event: StreamEvent) => void
): Promise<PipelineResponse> {
  const t0 = Date.now();
  const emit = onEvent ?? (() => {});

  // Stage 1: Streaming decomposition with speculative embedding pre-warming
  emit({ type: 'stage', stage: 'decomposing' });
  const speculativeMatcher = createSpeculativeMatcher(db, gemini);
  const decomposition: MealDecomposition = await withTimeout(
    gemini.generateStructuredOutputStream(
      {
        schema: mealDecompositionSchema,
        systemPrompt: buildDecompositionPrompt(userContext),
        userMessage: rawInput,
        model: DECOMPOSITION_MODEL,
        temperature: 0.3,
        topP: 1,
        topK: 1,
      },
      speculativeMatcher
    ),
    LLM_TIMEOUT_MS,
    'decomposition'
  );
  const decomposeMs = Date.now() - t0;

  // Normalize names: capitalize first letter for consistent cache keys and UI display
  for (const mi of decomposition.mealItems) {
    mi.name = capitalizeFirst(mi.name);
    for (const ing of mi.ingredients) {
      ing.name = capitalizeFirst(ing.name);
    }
  }

  // Apply ingredient aliases: map common shorthand names to canonical DB names
  applyIngredientAliases(decomposition);

  // Emit discovered items for progressive UI
  const itemNames = decomposition.mealItems.map((mi) => mi.name);
  emit({ type: 'items_found', items: itemNames });

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

  // Stage 2: Ingredient matching
  emit({ type: 'stage', stage: 'matching' });
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
  const matchMs = Date.now() - t1;

  // Stage 3: LLM nutrition estimation (with timeout)
  emit({ type: 'stage', stage: 'estimating' });
  const t2 = Date.now();
  let nutritionResult: NutritionAdjustment = await withTimeout(
    gemini.generateStructuredOutput({
      schema: nutritionAdjustmentSchema,
      systemPrompt: buildNutritionPrompt(
        decomposition.mealItems,
        matchResult.matched,
        matchResult.unmatched,
        userContext
      ),
      userMessage:
        'Produce bounded nutrition estimates for each ingredient in each meal item based on the reference data provided.',
      model: NUTRITION_MODEL,
      temperature: 0.5,
      topP: 1,
      topK: 1,
    }),
    LLM_TIMEOUT_MS,
    'nutrition'
  );

  // Retry once if nutrition result is implausible (0 total calories)
  const totalMidKcal = nutritionResult.mealItems.reduce(
    (sum, mi) =>
      sum +
      mi.ingredients.reduce((s, ing) => s + (ing.caloriesKcal?.mid ?? 0), 0),
    0
  );
  if (totalMidKcal === 0) {
    console.warn(
      '[pipeline] Implausible 0-calorie result from Call 2, retrying once'
    );
    nutritionResult = await withTimeout(
      gemini.generateStructuredOutput({
        schema: nutritionAdjustmentSchema,
        systemPrompt: buildNutritionPrompt(
          decomposition.mealItems,
          matchResult.matched,
          matchResult.unmatched,
          userContext
        ),
        userMessage:
          'The previous result had 0 calories. Please recalculate bounded nutrition estimates carefully.',
        model: NUTRITION_MODEL,
        temperature: 0.5,
        topP: 1,
        topK: 1,
      }),
      LLM_TIMEOUT_MS,
      'nutrition-retry'
    );
  }
  const nutritionMs = Date.now() - t2;

  // Pre-assembly validation: flag implausible LLM nutrition values
  const nutritionAnomalies = validateNutritionOutput(
    nutritionResult,
    matchResult.matched,
    decomposition.mealItems
  );

  // Stage 4: Assembly
  emit({ type: 'stage', stage: 'assembling' });
  const t3 = Date.now();
  const pipelineResult = assembleResult(
    decomposition,
    nutritionResult,
    matchResult.matched,
    matchResult.unmatched,
    userContext
  );
  const assemblyMs = Date.now() - t3;

  // Post-assembly anomaly detection
  const resultAnomalies = detectAnomalies(
    pipelineResult,
    matchResult.matched,
    matchResult.unmatched
  );

  // Emit structured metrics
  const allAnomalies = [...nutritionAnomalies, ...resultAnomalies];
  logMetrics({
    decomposeMs,
    matchMs,
    nutritionMs,
    assemblyMs,
    totalMs: Date.now() - t0,
    ingredientCount: allIngredients.length,
    matchedCount: matchResult.matched.length,
    unmatchedCount: matchResult.unmatched.length,
    mealItemCount: decomposition.mealItems.length,
    anomalies: allAnomalies,
  });

  return { success: true, data: pipelineResult };
}
