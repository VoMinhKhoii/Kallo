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
  extractMealItemNameOccurrences,
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
import {
  ensureIdsOnDecomposition,
  generateMealItemId,
  type MealDecompositionWithIds,
} from './ids';
import {
  type RawNutritionAdjustment,
  reconcileNutritionIds,
} from './nutrition';
import { buildPipelineRunRow, writePipelineRun } from './run-telemetry';
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

const RETRYABLE_NUTRITION_ANOMALIES = new Set<ValidationAnomaly['type']>([
  'db_deviation',
  'density_envelope',
  'macro_inconsistent',
]);

function shouldRetryNutrition(anomalies: ValidationAnomaly[]): boolean {
  return anomalies.some(
    (a) => a.severity === 'warning' && RETRYABLE_NUTRITION_ANOMALIES.has(a.type)
  );
}

// ---------------------------------------------------------------------------
// Trace context
// ---------------------------------------------------------------------------

/** Passed in from the API route when request-level pipeline tracing is enabled. */
export interface AnalyzeMealTraceContext {
  requestId: string;
  db: AppDb;
  /** User id of the request initiator; hashed before persistence. */
  userId: string;
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
  // Per-name running counts of meal-item-name occurrences emitted during
  // streaming; supports duplicate-name dishes (e.g., two `cơm trắng`).
  const streamEmittedCounts = new Map<string, number>();
  // Composite key `${name}::${occurrence}` → minted mealItemId. Used after
  // Call 1 parses to thread streamed UUIDs into the decomposition so
  // streamed `item_name` ids match post-parse `item_macros` ids (§0.1).
  const streamMealItemIds = new Map<string, string>();
  let mealItemIndex = 0;

  const composedOnChunk = (accumulated: string) => {
    // Existing: pre-warm embedding cache for ingredient names
    speculativeMatcher(accumulated);

    // New: detect meal item name occurrences, mint UUIDs, emit progressively.
    const newOccurrences = extractMealItemNameOccurrences(
      accumulated,
      streamEmittedCounts
    );
    for (const { name, occurrence } of newOccurrences) {
      const displayName = capitalizeFirst(name);
      const key = `${displayName}::${occurrence}`;
      const mealItemId = generateMealItemId();
      streamMealItemIds.set(key, mealItemId);
      emit({
        type: 'item_name',
        name: displayName,
        index: mealItemIndex++,
        mealItemId,
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
  // Thread streamed mealItemIds into the parsed decomposition before
  // `ensureIdsOnDecomposition` runs. This guarantees streamed `item_name`
  // ids match `item_macros` ids for the same logical slot (§0.1, §4.4).
  // Items that didn't appear in the stream (LLM held the whole tail until
  // close) get fresh UUIDs minted by `ensureIdsOnDecomposition`.
  const parseCounts = new Map<string, number>();
  for (const mi of rawDecomposition.mealItems) {
    const displayName = capitalizeFirst(mi.name);
    const occ = (parseCounts.get(displayName) ?? 0) + 1;
    parseCounts.set(displayName, occ);
    const streamedId = streamMealItemIds.get(`${displayName}::${occ}`);
    if (streamedId) {
      mi.mealItemId = streamedId;
    }
  }
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

  // Flush: emit `item_name` for any meal items not already announced by the
  // streaming extractor. Iterating over `decomposition.mealItems` (post
  // `ensureIdsOnDecomposition`) guarantees each emit carries a stable
  // `mealItemId`.
  const streamedIds = new Set(streamMealItemIds.values());
  for (const mi of decomposition.mealItems) {
    if (!streamedIds.has(mi.mealItemId)) {
      emit({
        type: 'item_name',
        name: mi.name,
        index: mealItemIndex++,
        mealItemId: mi.mealItemId,
      });
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
  let retryStep2Count = 0;

  // Build a lookup from meal item name → total grams for computeStreamingMealItem
  const mealItemGrams = new Map<string, number>();
  for (const mi of decomposition.mealItems) {
    const totalGrams = mi.ingredients.reduce(
      (sum, ing) => sum + ing.estimatedGrams,
      0
    );
    mealItemGrams.set(mi.name, totalGrams);
  }

  // Per-name ordered queue of mealItemIds (§0.1). Two `cơm trắng` dishes
  // have distinct ids; the nutrition stream encounters them in the same
  // order as decomposition, so a FIFO peel-off correctly attributes each
  // streaming macros event to the right logical slot.
  const mealItemIdQueueByName = new Map<string, string[]>();
  for (const mi of decomposition.mealItems) {
    const list = mealItemIdQueueByName.get(mi.name) ?? [];
    list.push(mi.mealItemId);
    mealItemIdQueueByName.set(mi.name, list);
  }
  const macroEmittedCounts = new Map<string, number>();
  const resolveMealItemId = (name: string): string => {
    const ids =
      mealItemIdQueueByName.get(name) ??
      mealItemIdQueueByName.get(capitalizeFirst(name)) ??
      [];
    const idx = macroEmittedCounts.get(name) ?? 0;
    macroEmittedCounts.set(name, idx + 1);
    // Wrap on retry: nutrition retry re-emits the same items, so cycle
    // through the per-name queue rather than running off the end.
    return ids[idx % Math.max(ids.length, 1)] ?? generateMealItemId();
  };

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
      const mealItemId = resolveMealItemId(itemNutrition.mealItemName);
      emit({ type: 'item_macros', mealItemId, item: streamItem });
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
        retryStep2Count += 1;
        // Reset streaming state so retry re-emits from scratch
        lastExtractedCount = 0;
        macroEmittedCounts.clear();
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

      let reconciledNutrition = reconcileNutritionIds(
        rawNutrition,
        decomposition,
        matchResult.matched
      );

      const retryableValidationAnomalies = validateNutritionOutput(
        reconciledNutrition,
        matchResult.matched,
        decomposition.mealItems
      );
      if (shouldRetryNutrition(retryableValidationAnomalies)) {
        console.warn(
          '[pipeline] validation anomaly → retrying Call 2',
          retryableValidationAnomalies.map((a) => a.type)
        );
        retryStep2Count += 1;
        lastExtractedCount = 0;
        macroEmittedCounts.clear();
        rawNutrition = await fetchWithTimeout(
          (signal) =>
            gemini.generateStructuredOutputStream(
              {
                schema: nutritionAdjustmentSchema,
                systemPrompt,
                userMessage:
                  'The previous result had physically implausible nutrition bounds. Recalculate bounded nutrition estimates carefully and keep calories consistent with protein/carbs/fat.',
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
        reconciledNutrition = reconcileNutritionIds(
          rawNutrition,
          decomposition,
          matchResult.matched
        );
      }

      return reconciledNutrition;
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
      const mealItemId =
        itemNutrition.mealItemId ??
        resolveMealItemId(itemNutrition.mealItemName);
      emit({ type: 'item_macros', mealItemId, item: streamItem });
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
  const assemblyOutput = await withStageLog(
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
  const pipelineResult = assemblyOutput.result;
  const assemblyMetrics = assemblyOutput.metrics;
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

  // Persist a pipeline_runs row when request-level tracing is enabled (§0.4).
  // Telemetry writes are best-effort and never block the response or throw.
  if (traceContext) {
    try {
      const personalizationFields: string[] = [];
      if (userContext.countryOfOrigin) {
        personalizationFields.push('countryOfOrigin');
      }
      if (userContext.countryOfResidence) {
        personalizationFields.push('countryOfResidence');
      }
      if (userContext.cookingHabits) {
        personalizationFields.push('cookingHabits');
      }
      const row = buildPipelineRunRow({
        userId: traceContext.userId,
        requestId: traceContext.requestId,
        modelCall1: DECOMPOSITION_MODEL,
        modelCall2: NUTRITION_MODEL,
        timings: { total: Date.now() - t0 },
        counts: {
          ingredient: allIngredients.length,
          matched: matchResult.matched.length,
          unmatched: matchResult.unmatched.length,
        },
        anomalyTypes: allAnomalies.map((a) => a.type),
        counters: {
          preMatchAliasHits: 0,
          cookedToRawFactorFires: assemblyMetrics.cookedToRawFactorFires,
          densityEnvelopeFires: allAnomalies.filter(
            (a) => a.type === 'density_envelope'
          ).length,
          macroInconsistentFires: allAnomalies.filter(
            (a) => a.type === 'macro_inconsistent'
          ).length,
          dbStateUnknownFires: 0,
          retryStep2Count,
        },
        escalated: false,
        cacheHitL4: false,
        retryCount: 0,
        promptPersonalizationFields: personalizationFields,
      });
      await writePipelineRun(traceContext.db, row);
    } catch (err) {
      console.error('[ai/pipeline] failed to write pipeline_runs row', err);
    }
  }

  return { success: true, data: pipelineResult };
}
