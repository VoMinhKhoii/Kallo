import { randomUUID } from 'node:crypto';
import { toJSONSchema } from 'zod';
import type { AppDb } from '@/lib/db';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import {
  type AnalysisModelBudgetWorkKind,
  type AnalysisModelProviderErrorCategory,
  checkNonessentialAnalysisGuards,
  type RecordAnalysisModelBudgetEventInput,
  recordAnalysisModelBudgetEvent,
} from '@/lib/rate-limit/analysis-guards';
import { capitalizeFirst } from '@/lib/utils';
import type { GeminiClient, StreamOptions } from '../gemini';
import { matchIngredients } from '../matching';
import type { RrfMeasurement } from '../matching/rrf-measurement';
import { createSpeculativeMatcher } from '../matching/speculative';
import { buildDecompositionPrompt, buildNutritionPrompt } from '../prompts';
import {
  computeStreamingMealItem,
  extractCompletedMealItemNutrition,
} from '../streaming/parsers';
import type { StreamEvent } from '../streaming/types';
import type {
  AmbiguityFlag,
  MealDecomposition,
  NutritionAdjustment,
  PipelineResponse,
  UserContext,
} from '../types';
import { assembleResult } from './assembly';
import { countCanonicalNameMisses } from './canonical-name-validator';
import {
  MEAL_FACTS_KEYS,
  type MealFactsForComputePolicy,
  pickComputePolicy,
  summarizeCandidateConfidence,
} from './compute-policy';
import { deriveExpectedState } from './cooking-method-state';
import {
  buildDecompositionCacheKey,
  createL4Cache,
  sha256Hex,
  stableStringify,
} from './decomposition-cache';
import { createDecompositionStreamController } from './decomposition-stream';
import {
  handleError,
  isNonFoodError,
  isParseError,
  NON_FOOD_BLOCKLIST,
  NonFoodError,
  nonFoodResponse,
} from './errors';
import { createCompactIdSequence } from './id-sequence';
import { ensureIdsOnDecomposition, type MealDecompositionWithIds } from './ids';
import { resolveModelProfile } from './model-profile';
import {
  type RawNutritionAdjustment,
  reconcileNutritionIds,
} from './nutrition';
import { aggregateRrfMeasurements } from './rrf-aggregation';
import { buildPipelineRunRow, writePipelineRun } from './run-telemetry';
import { mealDecompositionSchema, nutritionAdjustmentSchema } from './schemas';
import {
  createShadowGuard,
  getPrimaryP95Ms,
  isEmbeddingRateLimited,
} from './shadow-guards';
import {
  runShadowAsync,
  type ShadowGuard,
  type ShadowRunnerDeps,
  type ShadowRunPersistRow,
} from './shadow-runner';
import { isShadowSampled } from './shadow-sampling';
import { buildLlmStageTrace, logStage } from './trace';
import {
  classifyAnomalies,
  detectAnomalies,
  THRESHOLDS,
  type ValidationAnomaly,
  validateDecompositionOutput,
  validateNutritionOutput,
} from './validation';

const MODEL_PROFILE = resolveModelProfile();

/** Model for LLM Call 1 (decomposition). */
const DECOMPOSITION_MODEL = MODEL_PROFILE.decompositionModel;

/** Model for LLM Call 2 (nutrition estimation). */
const NUTRITION_MODEL = MODEL_PROFILE.nutritionModel;

export const ESCALATION_MODEL = MODEL_PROFILE.escalationModel;

const NUTRITION_PROMPT_LABEL_CANDIDATE =
  process.env.SHADOW_CANDIDATE_PROMPT_LABEL ?? 'production';
const NUTRITION_MODEL_CANDIDATE =
  process.env.SHADOW_CANDIDATE_MODEL ?? NUTRITION_MODEL;
const ANALYSIS_MODEL_BUDGET_ROUTE = '/api/analyze-meal';
const ANALYSIS_MODEL_PROVIDER = 'gemini';
const SHADOW_PRIMARY_P95_THRESHOLD_MS = 4000;
const SHADOW_DB_POOL_WAIT_THRESHOLD_MS = 1000;

/** Per-call timeout for Gemini API calls (ms) */
const LLM_TIMEOUT_MS = 25_000;
const L4_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DECOMPOSITION_SCHEMA_HASH = sha256Hex(
  stableStringify(toJSONSchema(mealDecompositionSchema))
);
const L4_DECOMPOSITION_CACHE = createL4Cache<MealDecomposition>({
  maxEntries: 1000,
  ttlMs: L4_CACHE_TTL_MS,
});

export function _resetL4DecompositionCacheForTests(): void {
  L4_DECOMPOSITION_CACHE.clear();
}

const RETRYABLE_NUTRITION_ANOMALIES = new Set<ValidationAnomaly['type']>([
  'db_deviation',
  'density_envelope',
  'macro_inconsistent',
]);

const decompositionIngredientName = (
  ing: MealDecomposition['mealItems'][number]['ingredients'][number]
): string => ing.rawName ?? ing.name ?? ing.canonicalName ?? '';

const decompositionIngredientCanonicalName = (
  ing: MealDecomposition['mealItems'][number]['ingredients'][number]
): string => ing.canonicalName ?? ing.rawName ?? ing.name ?? '';

const decompositionIngredientGrams = (
  ing: MealDecomposition['mealItems'][number]['ingredients'][number]
): number => ing.grams ?? ing.estimatedGrams ?? 0;

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

export interface ShadowConfig {
  enabled: boolean;
  /** Optional override of the locked 5% sampling rate for tests. */
  rate?: number;
  persistShadowRun?: ShadowRunnerDeps['persistShadowRun'];
  guard?: ShadowGuard;
  candidatePromptLabel?: string;
  candidateModel?: string;
}

export interface AnalyzeMealOptions {
  shadow?: ShadowConfig;
  l4Cache?: { enabled?: boolean };
}

interface RunPipelineOptions {
  matchingConcurrency?: number;
  nutritionModel?: string;
  l4Cache?: AnalyzeMealOptions['l4Cache'];
  budget?: {
    workKind: AnalysisModelBudgetWorkKind;
    requestId?: string | null;
    providerErrorState?: { recorded: boolean };
  };
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

function recordAnalysisModelBudgetEventBestEffort(
  input: RecordAnalysisModelBudgetEventInput
): void {
  void recordAnalysisModelBudgetEvent(input).catch((error) => {
    console.error('[ai/pipeline] failed to write model budget event', error);
  });
}

function createBudgetAttemptRecorder(args: {
  db: AppDb;
  requestId: string | null;
  workKind: AnalysisModelBudgetWorkKind;
  model: string;
  providerErrorState?: { recorded: boolean };
}): NonNullable<StreamOptions['onAttemptComplete']> {
  return ({ error, inputTokens, model, outputTokens }) => {
    const errorCategory = error == null ? null : classifyProviderError(error);

    if (inputTokens == null && outputTokens == null && errorCategory == null) {
      return;
    }

    if (errorCategory) {
      if (args.providerErrorState) {
        args.providerErrorState.recorded = true;
      }
    }

    recordAnalysisModelBudgetEventBestEffort({
      db: args.db,
      requestId: args.requestId,
      route: ANALYSIS_MODEL_BUDGET_ROUTE,
      workKind: args.workKind,
      provider: ANALYSIS_MODEL_PROVIDER,
      model: model || args.model,
      requestCount: 0,
      inputTokens,
      outputTokens,
      errorCategory,
    });
  };
}

function getErrorStatus(error: unknown): number | null {
  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    typeof (error as { status?: unknown }).status === 'number'
  ) {
    return (error as { status: number }).status;
  }

  if (!(error instanceof Error)) {
    return null;
  }

  const statusMatch = error.message.match(/\b(408|429|500|502|503|504)\b/);
  return statusMatch ? Number.parseInt(statusMatch[1], 10) : null;
}

function classifyProviderError(
  error: unknown
): AnalysisModelProviderErrorCategory | null {
  const message = error instanceof Error ? error.message : String(error);
  const status = getErrorStatus(error);

  if (/quota/i.test(message)) {
    return 'quota';
  }

  if (status === 429) {
    return 'rate_limit';
  }

  if (
    status === 408 ||
    status === 504 ||
    /timeout|timed out|AbortError/i.test(message)
  ) {
    return 'timeout';
  }

  if (status != null && status >= 500) {
    return 'server_error';
  }

  if (/UNAVAILABLE/i.test(message)) {
    return 'server_error';
  }

  if (
    /fetch failed|network error|socket hang up|ECONNRESET|EAI_AGAIN/i.test(
      message
    )
  ) {
    return 'network';
  }

  return null;
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
  traceContext?: AnalyzeMealTraceContext,
  options?: AnalyzeMealOptions
): Promise<PipelineResponse> {
  const analyzeStart = Date.now();
  const providerErrorState = { recorded: false };
  recordAnalysisModelBudgetEventBestEffort({
    db,
    requestId: traceContext?.requestId ?? null,
    route: ANALYSIS_MODEL_BUDGET_ROUTE,
    workKind: 'primary',
    provider: ANALYSIS_MODEL_PROVIDER,
    model: NUTRITION_MODEL,
    requestCount: 1,
  });

  try {
    const response = await runPipeline(
      rawInput,
      userContext,
      db,
      gemini,
      onEvent,
      traceContext,
      {
        ...options,
        budget: {
          workKind: 'primary',
          requestId: traceContext?.requestId ?? null,
          providerErrorState,
        },
      }
    );
    scheduleShadowRun({
      rawInput,
      userContext,
      db,
      gemini,
      traceContext,
      response,
      primaryMs: Date.now() - analyzeStart,
      shadow: options?.shadow,
    });
    return response;
  } catch (error) {
    const providerErrorCategory = classifyProviderError(error);
    if (providerErrorCategory && !providerErrorState.recorded) {
      recordAnalysisModelBudgetEventBestEffort({
        db,
        requestId: traceContext?.requestId ?? null,
        route: ANALYSIS_MODEL_BUDGET_ROUTE,
        workKind: 'primary',
        provider: ANALYSIS_MODEL_PROVIDER,
        model: NUTRITION_MODEL,
        requestCount: 0,
        errorCategory: providerErrorCategory,
      });
    }

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
          traceContext,
          options
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
  traceContext?: AnalyzeMealTraceContext,
  options: RunPipelineOptions = {}
): Promise<PipelineResponse> {
  const t0 = Date.now();
  const emit = onEvent ?? (() => {});
  const budget = options.budget ?? {
    workKind: 'primary' as const,
    requestId: traceContext?.requestId ?? null,
  };

  // Stage 1: Streaming decomposition with speculative embedding pre-warming
  // + per-item name detection for progressive UI
  emit({ type: 'stage', stage: 'decomposing' });
  const speculativeMatcher = createSpeculativeMatcher(db, gemini);
  const decompositionStream = createDecompositionStreamController({
    emit,
    prewarm: speculativeMatcher,
  });
  let cacheHitL4 = false;
  let dbStateUnknownFires = 0;
  let preMatchAliasHits = 0;
  const rrfMeasurements: RrfMeasurement[] = [];

  // Streaming policy (spec §4.4): item_name + item_macros stream incrementally.
  // On retry_step2, the second Call 2 re-emits item_macros; the client
  // overwrites by stable ids (§0.1). If retry_step2_count > 0 exceeds 10%
  // over a 7-day window (KPI block 8), revisit buffer-vs-stream.
  const renderedDecompositionPrompt = buildDecompositionPrompt(userContext);
  const l4CacheEnabled =
    options.l4Cache?.enabled ?? process.env.NODE_ENV !== 'test';
  const decompositionCacheKey = buildDecompositionCacheKey({
    rawInput,
    ctx: userContext,
    decompositionPromptHash: sha256Hex(renderedDecompositionPrompt),
    decompositionSchemaHash: DECOMPOSITION_SCHEMA_HASH,
    decompositionModel: DECOMPOSITION_MODEL,
  });

  const rawDecomposition: MealDecomposition = await withStageLog(
    traceContext,
    'decomposition',
    1,
    { rawInput },
    async ({ stageLogId }) => {
      if (l4CacheEnabled) {
        const cached = L4_DECOMPOSITION_CACHE.get(decompositionCacheKey);
        if (cached) {
          cacheHitL4 = true;
          return structuredClone(cached);
        }
      }

      const systemPrompt = renderedDecompositionPrompt;
      const callTrace = await buildLlmStageTrace({
        trace: traceContext,
        stageLogId,
        name: 'decomposition',
        builder: buildDecompositionPrompt as (...a: unknown[]) => string,
        templateSample: systemPrompt,
        model: DECOMPOSITION_MODEL,
      });
      const decomposed = await fetchWithTimeout(
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
            {
              onAttemptStart: decompositionStream.resetAttempt,
              onAttemptComplete: createBudgetAttemptRecorder({
                db,
                requestId: budget.requestId ?? null,
                workKind: budget.workKind,
                model: DECOMPOSITION_MODEL,
                providerErrorState: budget.providerErrorState,
              }),
              onChunk: decompositionStream.handleChunk,
              trace: callTrace,
            }
          ),
        LLM_TIMEOUT_MS,
        'decomposition'
      );
      if (l4CacheEnabled) {
        L4_DECOMPOSITION_CACHE.set(
          decompositionCacheKey,
          structuredClone(decomposed)
        );
      }
      return decomposed;
    }
  );
  // Thread streamed mealItemIds into the parsed decomposition before
  // `ensureIdsOnDecomposition` runs. This guarantees streamed `item_name`
  // ids match `item_macros` ids for the same logical slot (§0.1, §4.4).
  // Items that didn't appear in the stream (LLM held the whole tail until
  // close) get fresh compact ids minted by `ensureIdsOnDecomposition`.
  decompositionStream.applyParsedIds(rawDecomposition);
  const decomposition: MealDecompositionWithIds =
    ensureIdsOnDecomposition(rawDecomposition);
  const decomposeMs = Date.now() - t0;

  // Normalize names: capitalize first letter for consistent cache keys and UI display
  for (const mi of decomposition.mealItems) {
    mi.name = capitalizeFirst(mi.name);
    for (const ing of mi.ingredients) {
      ing.rawName = capitalizeFirst(decompositionIngredientName(ing));
      ing.canonicalName = capitalizeFirst(
        decompositionIngredientCanonicalName(ing)
      );
      const derived = deriveExpectedState({
        explicit: ing.expectedState,
        dishMethod: mi.cookingMethod ?? ing.cookingMethod,
      });
      ing.expectedState = derived.state;
      ing._stateSource = derived.source;
      if (derived.source === 'unknown') {
        dbStateUnknownFires += 1;
      }
    }
  }

  // Note: alias resolution is now handled inside the matching cascade as a fallback
  // (try original name first, alias-expanded name second). No pre-match rewrite needed.

  // Flush: emit `item_name` for any meal items not already announced by the
  // streaming extractor. Iterating over `decomposition.mealItems` (post
  // `ensureIdsOnDecomposition`) guarantees each emit carries a stable
  // `mealItemId`.
  decompositionStream.emitUnstreamed(decomposition);

  // D6 Layer 1: Check isFood field from LLM
  if (!decomposition.isFood) {
    throw new NonFoodError('Input is not food');
  }

  // D6 Layer 2: Post-parse blocklist sanity check
  for (const mi of decomposition.mealItems) {
    for (const ing of mi.ingredients) {
      const ingredientName = decompositionIngredientName(ing);
      if (NON_FOOD_BLOCKLIST.has(ingredientName.toLowerCase().trim())) {
        throw new NonFoodError(
          `Non-food ingredient detected: "${ingredientName}"`
        );
      }
    }
  }

  const decompositionAnomalies = validateDecompositionOutput(
    decomposition.mealItems
  );

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
    async () => {
      if (traceContext) {
        preMatchAliasHits = await countCanonicalNameMisses(
          allIngredients.map((ing) => ing.canonicalName ?? ''),
          db
        );
      }

      return matchIngredients(allIngredients, rawInput, db, gemini, {
        concurrency: options.matchingConcurrency,
        measurementContext: {
          requestId: traceContext?.requestId,
          rrfMeasurements,
        },
      });
    }
  );
  const matchMs = Date.now() - t1;

  const modelProfileForRun =
    options.nutritionModel === undefined
      ? MODEL_PROFILE
      : { ...MODEL_PROFILE, nutritionModel: options.nutritionModel };
  const baseComputeFacts: MealFactsForComputePolicy = {
    ingredientCount: allIngredients.length,
    matchedCount: matchResult.matched.length,
    unmatchedCount: matchResult.unmatched.length,
    anomalyTypes: [],
    parseRetryCount: 0,
    candidateConfidenceSummary: summarizeCandidateConfidence(
      matchResult.matched.map((m) => ({ matchConfidence: m.similarity }))
    ),
  };
  assertMealFactsShape(baseComputeFacts);
  let computePolicy = pickComputePolicy(baseComputeFacts, modelProfileForRun);
  let selectedNutritionModel = computePolicy.call2Model;

  // Stage 3: LLM nutrition estimation (streaming with per-item boundary detection)
  emit({ type: 'stage', stage: 'estimating' });
  const t2 = Date.now();
  let lastExtractedCount = 0;
  let retryStep2Count = 0;

  // Build a lookup from meal item name → total grams for computeStreamingMealItem
  const mealItemGrams = new Map<string, number>();
  for (const mi of decomposition.mealItems) {
    const totalGrams = mi.ingredients.reduce(
      (sum, ing) => sum + decompositionIngredientGrams(ing),
      0
    );
    mealItemGrams.set(mi.name, totalGrams);
  }

  // Per-name ordered queue of mealItemIds (§0.1). Two `cơm trắng` dishes
  // have distinct ids; the nutrition stream encounters them in the same
  // order as decomposition, so a FIFO peel-off correctly attributes each
  // streaming macros event to the right logical slot.
  const mealItemIdQueueByName = new Map<string, string[]>();
  const nutritionFallbackIds = createCompactIdSequence();
  const allMealItemIds = new Set<string>();
  for (const mi of decomposition.mealItems) {
    const list = mealItemIdQueueByName.get(mi.name) ?? [];
    list.push(mi.mealItemId);
    mealItemIdQueueByName.set(mi.name, list);
    allMealItemIds.add(mi.mealItemId);
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
    return (
      ids[idx % Math.max(ids.length, 1)] ??
      nutritionFallbackIds.nextMealItemId(allMealItemIds)
    );
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
        model: selectedNutritionModel,
      });

      let rawNutrition: RawNutritionAdjustment = await fetchWithTimeout(
        (signal) =>
          gemini.generateStructuredOutputStream(
            {
              schema: nutritionAdjustmentSchema,
              systemPrompt,
              userMessage:
                'Produce bounded nutrition estimates for each ingredient in each meal item based on the reference data provided.',
              model: selectedNutritionModel,
              temperature: 0.5,
              topP: 1,
              topK: 1,
              abortSignal: signal,
            },
            {
              onAttemptStart: () => {
                lastExtractedCount = 0;
              },
              onAttemptComplete: createBudgetAttemptRecorder({
                db,
                requestId: budget.requestId ?? null,
                workKind: budget.workKind,
                model: selectedNutritionModel,
                providerErrorState: budget.providerErrorState,
              }),
              onChunk: nutritionOnChunk,
              trace: callTrace,
            }
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
        computePolicy = pickComputePolicy(
          {
            ...baseComputeFacts,
            anomalyTypes: earlyAnomalies.map((a) => a.type),
            parseRetryCount: retryStep2Count,
          },
          modelProfileForRun
        );
        selectedNutritionModel =
          computePolicy.escalateOnRetry &&
          modelProfileForRun.escalationModel !== null
            ? modelProfileForRun.escalationModel
            : computePolicy.call2Model;
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
                model: selectedNutritionModel,
                temperature: 0.5,
                topP: 1,
                topK: 1,
                abortSignal: signal,
              },
              {
                onAttemptStart: () => {
                  lastExtractedCount = 0;
                },
                onAttemptComplete: createBudgetAttemptRecorder({
                  db,
                  requestId: budget.requestId ?? null,
                  workKind: budget.workKind,
                  model: selectedNutritionModel,
                  providerErrorState: budget.providerErrorState,
                }),
                onChunk: nutritionOnChunk,
                trace: callTrace,
              }
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
        computePolicy = pickComputePolicy(
          {
            ...baseComputeFacts,
            anomalyTypes: retryableValidationAnomalies.map((a) => a.type),
            parseRetryCount: retryStep2Count,
          },
          modelProfileForRun
        );
        selectedNutritionModel =
          computePolicy.escalateOnRetry &&
          modelProfileForRun.escalationModel !== null
            ? modelProfileForRun.escalationModel
            : computePolicy.call2Model;
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
                model: selectedNutritionModel,
                temperature: 0.5,
                topP: 1,
                topK: 1,
                abortSignal: signal,
              },
              {
                onAttemptComplete: createBudgetAttemptRecorder({
                  db,
                  requestId: budget.requestId ?? null,
                  workKind: budget.workKind,
                  model: selectedNutritionModel,
                  providerErrorState: budget.providerErrorState,
                }),
                onChunk: nutritionOnChunk,
                trace: callTrace,
              }
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
  const allAnomalies = [
    ...decompositionAnomalies,
    ...nutritionAnomalies,
    ...resultAnomalies,
  ];
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

  const ambiguityFlagCounts = countAmbiguityFlags(allIngredients);
  const rrf = aggregateRrfMeasurements(rrfMeasurements);
  let pipelineRunRow: ReturnType<typeof buildPipelineRunRow> | undefined;
  let pipelineRunId: string | undefined;

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
        modelCall2: selectedNutritionModel,
        timings: { total: Date.now() - t0 },
        counts: {
          ingredient: allIngredients.length,
          matched: matchResult.matched.length,
          unmatched: matchResult.unmatched.length,
        },
        anomalyTypes: allAnomalies.map((a) => a.type),
        ambiguityFlagCounts,
        rrf,
        counters: {
          preMatchAliasHits,
          cookedToRawFactorFires: assemblyMetrics.cookedToRawFactorFires,
          densityEnvelopeFires: allAnomalies.filter(
            (a) => a.type === 'density_envelope'
          ).length,
          macroInconsistentFires: allAnomalies.filter(
            (a) => a.type === 'macro_inconsistent'
          ).length,
          dbStateUnknownFires,
          retryStep2Count,
        },
        escalated:
          modelProfileForRun.escalationModel !== null &&
          selectedNutritionModel === modelProfileForRun.escalationModel,
        cacheHitL4,
        retryCount: retryStep2Count,
        promptPersonalizationFields: personalizationFields,
      });
      pipelineRunRow = row;
      pipelineRunId = row.id;
      await writePipelineRun(traceContext.db, row);
    } catch (err) {
      console.error('[ai/pipeline] failed to write pipeline_runs row', err);
    }
  }

  const response: PipelineResponse = {
    success: true,
    data: pipelineResult,
    __telemetryRunId: pipelineRunId,
  };
  if (process.env.NODE_ENV === 'test' && pipelineRunRow) {
    return { ...response, __telemetry: pipelineRunRow };
  }
  return response;
}

function countAmbiguityFlags(
  ingredients: { ambiguityFlags?: AmbiguityFlag[] }[]
): Partial<Record<AmbiguityFlag, number>> {
  const counts: Partial<Record<AmbiguityFlag, number>> = {};
  for (const ingredient of ingredients) {
    for (const flag of ingredient.ambiguityFlags ?? []) {
      counts[flag] = (counts[flag] ?? 0) + 1;
    }
  }
  return counts;
}

function assertMealFactsShape(facts: MealFactsForComputePolicy): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  const actual = Object.keys(facts).sort();
  const expected = [...MEAL_FACTS_KEYS].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `[principle-b] MealFactsForComputePolicy shape drift: ${actual.join(',')}`
    );
  }
}

function scheduleShadowRun(args: {
  rawInput: string;
  userContext: UserContext;
  db: AppDb;
  gemini: GeminiClient;
  traceContext?: AnalyzeMealTraceContext;
  response: PipelineResponse;
  primaryMs: number;
  shadow?: ShadowConfig;
}): void {
  if (!args.traceContext) {
    return;
  }

  const shadowCfg = args.shadow ?? defaultShadowConfigFromEnv(args.db);
  const candidateModel = shadowCfg.candidateModel ?? NUTRITION_MODEL_CANDIDATE;
  const guard =
    shadowCfg.guard ??
    defaultShadowGuard({
      db: args.db,
      requestId: args.traceContext.requestId,
      candidateModel,
    });
  guard.onPrimaryComplete(args.primaryMs);

  if (
    !shadowCfg.enabled ||
    !isShadowSampled(args.traceContext.requestId, {
      enabled: true,
      rate: shadowCfg.rate,
    })
  ) {
    return;
  }

  queueMicrotask(() => {
    void runShadowAsync(
      {
        requestId: args.traceContext?.requestId ?? '',
        primary: args.response,
        primaryRunId: args.response.__telemetryRunId,
        candidatePromptLabel:
          shadowCfg.candidatePromptLabel ?? NUTRITION_PROMPT_LABEL_CANDIDATE,
        candidateModel,
      },
      {
        runCandidate: () =>
          runPipeline(
            args.rawInput,
            args.userContext,
            args.db,
            args.gemini,
            undefined,
            undefined,
            {
              matchingConcurrency: 1,
              nutritionModel: candidateModel,
              budget: {
                workKind: 'shadow',
                requestId: args.traceContext?.requestId ?? null,
              },
            }
          ),
        persistShadowRun:
          shadowCfg.persistShadowRun ?? persistShadowRunDefault(args.db),
        now: () => Date.now(),
      },
      guard
    );
  });
}

function defaultShadowConfigFromEnv(db: AppDb): ShadowConfig {
  return {
    enabled: process.env.SHADOW_RUNNER_ENABLED === 'true',
    persistShadowRun: persistShadowRunDefault(db),
  };
}

function defaultShadowGuard(args: {
  db: AppDb;
  requestId: string;
  candidateModel: string;
}): ShadowGuard {
  return createShadowGuard({
    primaryP95Ms: getPrimaryP95Ms,
    primaryP95ThresholdMs: SHADOW_PRIMARY_P95_THRESHOLD_MS,
    dbPoolWaitMs: () => 0,
    dbPoolWaitThresholdMs: SHADOW_DB_POOL_WAIT_THRESHOLD_MS,
    embeddingRateLimited: isEmbeddingRateLimited,
    nonessentialGuard: () =>
      checkNonessentialAnalysisGuards({
        db: args.db,
        requestId: args.requestId,
        route: ANALYSIS_MODEL_BUDGET_ROUTE,
        workKind: 'shadow',
        provider: ANALYSIS_MODEL_PROVIDER,
        model: args.candidateModel,
        reserve: true,
      }),
  });
}

function persistShadowRunDefault(
  db: AppDb
): ShadowRunnerDeps['persistShadowRun'] {
  return async (row: ShadowRunPersistRow) => {
    const { pipelineShadowRuns } = await import('@/lib/db/schema');
    await db.insert(pipelineShadowRuns).values({
      requestId: row.requestId,
      primaryRunId: row.primaryRunId,
      candidatePromptLabel: row.candidatePromptLabel,
      candidateModel: row.candidateModel,
      primaryOutput: row.primaryOutput,
      candidateOutput: row.candidateOutput,
      divergence: row.divergence,
      outcome: row.outcome,
      candidateMs: row.candidateMs,
    });
  };
}
