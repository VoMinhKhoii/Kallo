import { randomUUID } from 'node:crypto';
import type { AppDb } from '@/lib/db';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { capitalizeFirst } from '@/lib/utils';
import type { GeminiClient } from '../gemini';
import { matchIngredients } from '../matching';
import { createSpeculativeMatcher } from '../matching/speculative';
import { buildDecompositionPrompt, buildNutritionPrompt } from '../prompts';
import {
  computeStreamingMealItem,
  extractCompletedMealItemNutrition,
  extractMealItemNames,
} from '../streaming/parsers';
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
import { ensureIdsOnDecomposition, type MealDecompositionWithIds } from './ids';
import {
  type RawNutritionAdjustment,
  reconcileNutritionIds,
} from './nutrition';
import { mealDecompositionSchema, nutritionAdjustmentSchema } from './schemas';
import { buildLlmStageTrace, logStage } from './trace';
import {
  classifyAnomalies,
  detectAnomalies,
  THRESHOLDS,
  type ValidationAnomaly,
  validateNutritionOutput,
} from './validation';

/** Model for LLM Call 1 (decomposition) — stable low-latency/high-volume tier */
const DECOMPOSITION_MODEL = 'gemini-2.5-flash-lite';

/** Model for LLM Call 2 (nutrition estimation) — stable low-latency/high-volume tier */
const NUTRITION_MODEL = 'gemini-2.5-flash-lite';

/** Per-call timeout for Gemini API calls (ms) */
const LLM_TIMEOUT_MS = 25_000;

// ---------------------------------------------------------------------------
// Trace context
// ---------------------------------------------------------------------------

/** Passed in from the API route when request-level pipeline tracing is enabled. */
export interface AnalyzeMealTraceContext {
  requestId: string;
  db: AppDb;
  /** Mutable holder; populated by each LLM stage as its prompt version resolves. */
  promptVersionsUsed: Map<string, string>;
}

type StageName = 'decomposition' | 'matching' | 'nutrition' | 'assembly';

/**
 * Wraps a pipeline stage with logStage instrumentation. No-op when trace is undefined.
 */
async function withStageLog<T>(
  trace: AnalyzeMealTraceContext | undefined,
  stage: StageName,
  stageIndex: number,
  inputJson: unknown,
  fn: (ctx: { stageLogId: string }) => Promise<T>
): Promise<T> {
  if (!trace) return fn({ stageLogId: '' });
  const stageLogId = randomUUID();
  const t0 = Date.now();
  try {
    const result = await fn({ stageLogId });
    logStage({
      db: trace.db,
      requestId: trace.requestId,
      stageLogId,
      stage,
      stageIndex,
      inputJson,
      outputJson: result,
      status: 'success',
      durationMs: Date.now() - t0,
    });
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logStage({
      db: trace.db,
      requestId: trace.requestId,
      stageLogId,
      stage,
      stageIndex,
      inputJson,
      outputJson: null,
      status: 'error',
      error: message,
      durationMs: Date.now() - t0,
    });
    throw e;
  }
}

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
  db: AppDb,
  gemini: GeminiClient,
  onEvent?: (event: StreamEvent) => void,
  traceContext?: AnalyzeMealTraceContext
): Promise<PipelineResponse> {
  try {
    return await runPipeline(
      rawInput,
      userContext,
      db,
      gemini,
      onEvent,
      traceContext
    );
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
        return await runPipeline(
          rawInput,
          userContext,
          db,
          gemini,
          onEvent,
          traceContext
        );
      } catch (retryError) {
        const retryMsg =
          retryError instanceof Error ? retryError.message : String(retryError);
        console.error('[pipeline] Retry also failed:', retryMsg);
        return handleError(retryError);
      }
    }

    // All other errors (API errors, network, etc.) surface immediately
    const message = error instanceof Error ? error.message : String(error);
    const cause =
      error instanceof Error && error.cause
        ? ` [cause: ${error.cause instanceof Error ? error.cause.message : String(error.cause)}]`
        : '';
    console.error(`[pipeline] Unhandled error: ${message}${cause}`);
    return handleError(error);
  }
}

async function runPipeline(
  rawInput: string,
  userContext: UserContext,
  db: AppDb,
  gemini: GeminiClient,
  onEvent?: (event: StreamEvent) => void,
  traceContext?: AnalyzeMealTraceContext
): Promise<PipelineResponse> {
  const t0 = Date.now();
  const emit = onEvent ?? (() => {});

  // Stage 1: Streaming decomposition with speculative embedding pre-warming
  // + per-item name detection for progressive UI
  emit({ type: 'stage', stage: 'decomposing' });
  const speculativeMatcher = createSpeculativeMatcher(db, gemini);
  const mealItemNamesSeen = new Set<string>();
  let mealItemIndex = 0;

  const composedOnChunk = (accumulated: string) => {
    // Existing: pre-warm embedding cache for ingredient names
    speculativeMatcher(accumulated);

    // New: detect meal item names and emit individually for progressive UI
    const newNames = extractMealItemNames(accumulated, mealItemNamesSeen);
    for (const name of newNames) {
      emit({
        type: 'item_name',
        name: capitalizeFirst(name),
        index: mealItemIndex++,
      });
    }
  };

  const rawDecomposition: MealDecomposition = await withStageLog(
    traceContext,
    'decomposition',
    1,
    { rawInput },
    async ({ stageLogId }) => {
      const systemPrompt = buildDecompositionPrompt(userContext);
      const callTrace = await buildLlmStageTrace({
        trace: traceContext,
        stageLogId,
        name: 'decomposition',
        builder: buildDecompositionPrompt as (...a: unknown[]) => string,
        templateSample: systemPrompt,
        model: DECOMPOSITION_MODEL,
      });
      return fetchWithTimeout(
        (signal) =>
          gemini.generateStructuredOutputStream(
            {
              schema: mealDecompositionSchema,
              systemPrompt,
              userMessage: rawInput,
              model: DECOMPOSITION_MODEL,
              temperature: 0.3,
              topP: 1,
              topK: 1,
              abortSignal: signal,
            },
            { onChunk: composedOnChunk, trace: callTrace }
          ),
        LLM_TIMEOUT_MS,
        'decomposition'
      );
    }
  );
  const decomposition: MealDecompositionWithIds =
    ensureIdsOnDecomposition(rawDecomposition);
  const decomposeMs = Date.now() - t0;

  // Normalize names: capitalize first letter for consistent cache keys and UI display
  for (const mi of decomposition.mealItems) {
    mi.name = capitalizeFirst(mi.name);
    for (const ing of mi.ingredients) {
      ing.name = capitalizeFirst(ing.name);
    }
  }

  // Note: alias resolution is now handled inside the matching cascade as a fallback
  // (try original name first, alias-expanded name second). No pre-match rewrite needed.

  // Flush: emit any meal item names that weren't detected during streaming
  for (const mi of decomposition.mealItems) {
    if (
      !mealItemNamesSeen.has(mi.name) &&
      !mealItemNamesSeen.has(mi.name.toLowerCase())
    ) {
      emit({ type: 'item_name', name: mi.name, index: mealItemIndex++ });
    }
  }

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
  const matchResult = await withStageLog(
    traceContext,
    'matching',
    2,
    { ingredientCount: allIngredients.length },
    async () => matchIngredients(allIngredients, rawInput, db, gemini)
  );
  const matchMs = Date.now() - t1;

  // Stage 3: LLM nutrition estimation (streaming with per-item boundary detection)
  emit({ type: 'stage', stage: 'estimating' });
  const t2 = Date.now();
  let lastExtractedCount = 0;

  // Build a lookup from meal item name → total grams for computeStreamingMealItem
  const mealItemGrams = new Map<string, number>();
  for (const mi of decomposition.mealItems) {
    const totalGrams = mi.ingredients.reduce(
      (sum, ing) => sum + ing.estimatedGrams,
      0
    );
    mealItemGrams.set(mi.name, totalGrams);
  }

  const nutritionOnChunk = (accumulated: string) => {
    const { items, newCount } = extractCompletedMealItemNutrition(
      accumulated,
      lastExtractedCount
    );
    lastExtractedCount = newCount;

    for (const itemNutrition of items) {
      const quantity =
        mealItemGrams.get(itemNutrition.mealItemName) ??
        mealItemGrams.get(capitalizeFirst(itemNutrition.mealItemName)) ??
        0;
      const streamItem = computeStreamingMealItem(
        itemNutrition,
        quantity,
        lastExtractedCount - items.length + items.indexOf(itemNutrition),
        userContext.goal,
        userContext.aggression
      );
      emit({ type: 'item_macros', item: streamItem });
    }
  };

  const nutritionResult: NutritionAdjustment = await withStageLog(
    traceContext,
    'nutrition',
    3,
    { mealItemCount: decomposition.mealItems.length },
    async ({ stageLogId }) => {
      const systemPrompt = buildNutritionPrompt(
        decomposition.mealItems,
        matchResult.matched,
        matchResult.unmatched,
        userContext
      );
      const callTrace = await buildLlmStageTrace({
        trace: traceContext,
        stageLogId,
        name: 'nutrition',
        builder: buildNutritionPrompt as (...a: unknown[]) => string,
        templateSample: systemPrompt,
        model: NUTRITION_MODEL,
      });

      let rawNutrition: RawNutritionAdjustment = await fetchWithTimeout(
        (signal) =>
          gemini.generateStructuredOutputStream(
            {
              schema: nutritionAdjustmentSchema,
              systemPrompt,
              userMessage:
                'Produce bounded nutrition estimates for each ingredient in each meal item based on the reference data provided.',
              model: NUTRITION_MODEL,
              temperature: 0.5,
              topP: 1,
              topK: 1,
              abortSignal: signal,
            },
            { onChunk: nutritionOnChunk, trace: callTrace }
          ),
        LLM_TIMEOUT_MS,
        'nutrition'
      );

      // Early anomaly check: classify total calories before flush
      const totalMidKcal = rawNutrition.mealItems.reduce(
        (sum, mi) =>
          sum +
          mi.ingredients.reduce(
            (s, ing) => s + (ing.caloriesKcal?.mid ?? 0),
            0
          ),
        0
      );
      const earlyAnomalies: ValidationAnomaly[] = [];
      if (totalMidKcal < THRESHOLDS.MIN_TOTAL_KCAL) {
        earlyAnomalies.push({
          type: 'total_calories',
          message:
            totalMidKcal === 0
              ? 'Total 0 kcal — likely LLM failure'
              : `Total ${totalMidKcal.toFixed(0)} kcal < ${THRESHOLDS.MIN_TOTAL_KCAL} — suspiciously low`,
          severity: totalMidKcal === 0 ? 'error' : 'warning',
        });
      }

      const decision = classifyAnomalies(earlyAnomalies);
      if (decision === 'retry_step2') {
        console.warn(
          '[pipeline] classifyAnomalies → retry_step2, retrying Call 2'
        );
        // Reset streaming state so retry re-emits from scratch
        lastExtractedCount = 0;
        rawNutrition = await fetchWithTimeout(
          (signal) =>
            gemini.generateStructuredOutputStream(
              {
                schema: nutritionAdjustmentSchema,
                systemPrompt,
                userMessage:
                  'The previous result had 0 calories. Please recalculate bounded nutrition estimates carefully.',
                model: NUTRITION_MODEL,
                temperature: 0.5,
                topP: 1,
                topK: 1,
                abortSignal: signal,
              },
              { onChunk: nutritionOnChunk, trace: callTrace }
            ),
          LLM_TIMEOUT_MS,
          'nutrition-retry'
        );
      }

      return reconcileNutritionIds(
        rawNutrition,
        decomposition,
        matchResult.matched
      );
    }
  );

  // Flush remaining meal items not emitted during streaming (always includes the last item)
  if (nutritionResult.mealItems.length > lastExtractedCount) {
    for (
      let i = lastExtractedCount;
      i < nutritionResult.mealItems.length;
      i++
    ) {
      const itemNutrition = nutritionResult.mealItems[i];
      const quantity =
        mealItemGrams.get(itemNutrition.mealItemName) ??
        mealItemGrams.get(capitalizeFirst(itemNutrition.mealItemName)) ??
        0;
      const streamItem = computeStreamingMealItem(
        itemNutrition,
        quantity,
        i,
        userContext.goal,
        userContext.aggression
      );
      emit({ type: 'item_macros', item: streamItem });
    }
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
  const pipelineResult = await withStageLog(
    traceContext,
    'assembly',
    4,
    { mealItemCount: decomposition.mealItems.length },
    async () =>
      assembleResult(
        decomposition,
        nutritionResult,
        matchResult.matched,
        matchResult.unmatched,
        userContext
      )
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
