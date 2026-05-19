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
import {
  buildLanguageCorrectionMessage,
  checkDecompositionLanguage,
  type LanguageGuardResult,
} from '../language/guard';
import { matchIngredients } from '../matching';
import type { RrfMeasurement } from '../matching/rrf-measurement';
import { createSpeculativeMatcher } from '../matching/speculative';
import {
  getDecompositionPromptBuilder,
  getNutritionPromptBuilder,
} from '../prompts';
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
  assertMealFactsShape,
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
import { readBooleanEnv } from './feature-flags';
import { createCompactIdSequence } from './id-sequence';
import { ensureIdsOnDecomposition, type MealDecompositionWithIds } from './ids';
import {
  ingredientCanonicalName as decompositionIngredientCanonicalName,
  ingredientGrams as decompositionIngredientGrams,
  ingredientDisplayName as decompositionIngredientName,
} from './ingredient-accessors';
import { resolveModelProfile } from './model-profile';
import {
  computeMacroBaseMap,
  type RawNutritionAdjustment,
  reconcileNutritionIds,
  resolveStreamingMealItem,
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
import { isPipelineV2Enabled } from './v2-feature-flag';
import { analyzeMealV2 } from './v2-orchestrator';
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

const NUTRITION_PROMPT_LABEL_CANDIDATE =
  process.env.SHADOW_CANDIDATE_PROMPT_LABEL ?? 'production';
const NUTRITION_MODEL_CANDIDATE =
  process.env.SHADOW_CANDIDATE_MODEL ?? NUTRITION_MODEL;
const ANALYSIS_MODEL_BUDGET_ROUTE = '/api/analyze-meal';
const ANALYSIS_MODEL_PROVIDER = 'gemini';
const SHADOW_PRIMARY_P95_THRESHOLD_MS = 4000;
const SHADOW_DB_POOL_WAIT_THRESHOLD_MS = 1000;

/**
 * Per-stage Gemini timeout (ms).
 *
 * Phase B baseline (2026-05-08) showed:
 *   - decomposition cold p95: 10707 ms (lightweight prompt, smaller output)
 *   - nutrition cold p95:     24377 ms (full-meal output, more variance)
 *
 * A single ceiling either aborts legitimate slow nutrition runs (too tight)
 * or wastes ~10 s of recovery time when decomposition genuinely hangs (too
 * loose). Splitting the budget gives each stage a value derived from its
 * own observed p95 + headroom.
 *
 * Defaults:
 *   - decomposition: 20 s  (≈ p95 × 1.9, leaves room for transient 5xx)
 *   - nutrition:     30 s  (≈ p95 × 1.25, the realistic worst case)
 *
 * `LLM_TIMEOUT_MS` is honoured as a global fallback for both when set; the
 * stage-specific envs override it when present.
 */
function readStageTimeoutMs(envKey: string, fallbackMs: number): number {
  const raw = process.env[envKey] ?? process.env.LLM_TIMEOUT_MS;
  if (!raw) return fallbackMs;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallbackMs;
}
const DECOMPOSITION_TIMEOUT_MS = readStageTimeoutMs(
  'PIPELINE_DECOMPOSITION_TIMEOUT_MS',
  20_000
);
const NUTRITION_TIMEOUT_MS = readStageTimeoutMs(
  'PIPELINE_NUTRITION_TIMEOUT_MS',
  30_000
);
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

type DecompositionLanguageMetadata = {
  inputLanguage: UserContext['inputLanguage'] | null;
  outputLanguage: UserContext['outputLanguage'] | null;
  guardReason: LanguageGuardResult['reason'];
  guardSeverity: LanguageGuardResult['severity'];
  guardPassed: boolean;
  retryCount: number;
};

function attachLanguageMetadata(
  decomposition: MealDecomposition,
  metadata: DecompositionLanguageMetadata
): MealDecomposition & { languageMetadata: DecompositionLanguageMetadata } {
  return { ...decomposition, languageMetadata: metadata };
}

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
  /** Phase A substage fire-rate signals (Phase A.4). */
  cacheHitL4: boolean;
  languageRetryCount: number;
  nutritionAnomalyRetry: boolean;
  nutritionEscalated: boolean;
  aliasFallbackFired: boolean;
  /**
   * Per-chunk extractor cost (Phase A.7 / C8). Sums sync regex+JSON-parse
   * time across every stream chunk per stage. Lets us decide whether
   * deferring extraction off the chunk-loop is worth doing.
   */
  decomposeChunkExtractMs: number;
  decomposeChunkCount: number;
  nutritionChunkExtractMs: number;
  nutritionChunkCount: number;
}

function logMetrics(metrics: PipelineMetrics): void {
  console.info('[pipeline] metrics', JSON.stringify(metrics));
}

function recordAnalysisModelBudgetEventBestEffort(
  input: RecordAnalysisModelBudgetEventInput
): void {
  // ANALYSIS_BUDGET_EVENTS_ENABLED=false silences the always-on telemetry
  // table writes (3/request) when chasing pool contention or DB cost spikes.
  if (!readBooleanEnv('ANALYSIS_BUDGET_EVENTS_ENABLED', true)) return;
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
  // V2 dispatch: when PIPELINE_V2_ENABLED=true, route to the v2 orchestrator
  // (pure-decompose + CRAG-grounded). v1 stays intact behind the flag. The
  // v2 path emits the same `stage`/`result`/`analysis_complete` SSE events
  // so existing clients don't need changes, just `item_name` and
  // `item_macros` incremental streams aren't wired yet (follow-up).
  if (isPipelineV2Enabled()) {
    console.info('[pipeline] dispatching to v2 (PIPELINE_V2_ENABLED=true)');
    return analyzeMealV2(rawInput, userContext, db, gemini, onEvent);
  }

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
  const speculativePrewarmEnabled = readBooleanEnv(
    'PIPELINE_SPECULATIVE_PREWARM_ENABLED',
    true
  );
  const itemNameBufferEnabled = readBooleanEnv(
    'PIPELINE_ITEM_NAME_BUFFER_ENABLED',
    true
  );
  const speculativeMatcher = speculativePrewarmEnabled
    ? createSpeculativeMatcher(db, gemini)
    : () => undefined;
  const bufferedItemNameEvents: Extract<StreamEvent, { type: 'item_name' }>[] =
    [];
  // When buffering is disabled, item_name events stream directly. When
  // enabled, they are held until the language guard passes (or a retry
  // resets the buffer).
  const streamItemNames = (event: StreamEvent) => {
    if (itemNameBufferEnabled && event.type === 'item_name') {
      bufferedItemNameEvents.push(event);
      return;
    }

    emit(event);
  };
  let decompositionStream = createDecompositionStreamController({
    emit: streamItemNames,
    prewarm: speculativeMatcher,
  });
  const resetBufferedDecompositionStream = () => {
    bufferedItemNameEvents.length = 0;
    decompositionStream = createDecompositionStreamController({
      emit: streamItemNames,
      prewarm: speculativeMatcher,
    });
  };
  const flushBufferedItemNames = () => {
    for (const event of bufferedItemNameEvents) {
      emit(event);
    }
    bufferedItemNameEvents.length = 0;
  };
  let cacheHitL4 = false;
  let dbStateUnknownFires = 0;
  let preMatchAliasHits = 0;
  const rrfMeasurements: RrfMeasurement[] = [];

  // Streaming policy (spec §4.4): item_name + item_macros stream incrementally.
  // On retry_step2, the second Call 2 re-emits item_macros; the client
  // overwrites by stable ids (§0.1). If retry_step2_count > 0 exceeds 10%
  // over a 7-day window (KPI block 8), revisit buffer-vs-stream.
  const decompositionPromptBuilder = getDecompositionPromptBuilder();
  const renderedDecompositionPrompt = decompositionPromptBuilder(userContext);
  // Default ON outside tests; PIPELINE_L4_DECOMPOSITION_CACHE_ENABLED=false
  // forces a cold-path decomposition without redeploying.
  const l4CacheEnabled =
    options.l4Cache?.enabled ??
    (process.env.NODE_ENV === 'test'
      ? false
      : readBooleanEnv('PIPELINE_L4_DECOMPOSITION_CACHE_ENABLED', true));
  const decompositionCacheKey = buildDecompositionCacheKey({
    rawInput,
    ctx: userContext,
    decompositionPromptHash: sha256Hex(renderedDecompositionPrompt),
    decompositionSchemaHash: DECOMPOSITION_SCHEMA_HASH,
    decompositionModel: DECOMPOSITION_MODEL,
  });
  let languageRetryCount = 0;

  const runDecompositionAttempt = async (
    userMessage: string,
    stageLogId: string
  ): Promise<MealDecomposition> => {
    const systemPrompt = renderedDecompositionPrompt;
    const callTrace = buildLlmStageTrace({
      trace: traceContext,
      stageLogId,
      name: 'decomposition',
      builder: decompositionPromptBuilder as (...a: unknown[]) => string,
      templateSample: systemPrompt,
      model: DECOMPOSITION_MODEL,
    });

    return fetchWithTimeout(
      (signal) =>
        gemini.generateStructuredOutputStream(
          {
            schema: mealDecompositionSchema,
            systemPrompt,
            userMessage,
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
      DECOMPOSITION_TIMEOUT_MS,
      'decomposition'
    );
  };

  const rawDecomposition: MealDecomposition = await withStageLog(
    traceContext,
    'decomposition',
    1,
    { rawInput },
    async ({ stageLogId }) => {
      const l4LogKey = decompositionCacheKey.slice(0, 12);
      if (l4CacheEnabled) {
        const cached = L4_DECOMPOSITION_CACHE.get(decompositionCacheKey);
        if (cached) {
          const cachedDecomposition = structuredClone(cached);
          const cachedLanguageGuard = checkDecompositionLanguage(
            cachedDecomposition,
            userContext
          );
          if (cachedLanguageGuard.ok) {
            cacheHitL4 = true;
            console.info(`[pipeline] L4 HIT (key=${l4LogKey}…)`);
            return attachLanguageMetadata(cachedDecomposition, {
              inputLanguage: userContext.inputLanguage ?? null,
              outputLanguage: userContext.outputLanguage ?? null,
              guardReason: cachedLanguageGuard.reason,
              guardSeverity: cachedLanguageGuard.severity,
              guardPassed: cachedLanguageGuard.ok,
              retryCount: 0,
            });
          }
          // Cache poisoned with wrong-language output — drop and refetch.
          console.warn(
            `[pipeline] L4 HIT but language guard failed; treating as MISS (key=${l4LogKey}…)`,
            {
              expected: userContext.outputLanguage,
              actual: cachedLanguageGuard.reason,
            }
          );
        } else {
          console.info(`[pipeline] L4 MISS (key=${l4LogKey}…)`);
        }
      }

      let decomposed = await runDecompositionAttempt(rawInput, stageLogId);
      let languageGuard = checkDecompositionLanguage(decomposed, userContext);
      if (!languageGuard.ok) {
        const retryEnabled = readBooleanEnv(
          'PIPELINE_LANGUAGE_GUARD_RETRY_ENABLED',
          true
        );
        if (retryEnabled) {
          console.warn('[pipeline] decomposition language mismatch; retrying', {
            expected: userContext.outputLanguage,
            actual: languageGuard.reason,
          });
          languageRetryCount += 1;
          resetBufferedDecompositionStream();
          decomposed = await runDecompositionAttempt(
            buildLanguageCorrectionMessage(rawInput, userContext),
            stageLogId
          );
          languageGuard = checkDecompositionLanguage(decomposed, userContext);
          if (!languageGuard.ok) {
            console.warn(
              '[pipeline] decomposition language mismatch remained after retry',
              {
                expected: userContext.outputLanguage,
                actual: languageGuard.reason,
              }
            );
          }
        } else {
          console.warn(
            '[pipeline] decomposition language mismatch; retry disabled by flag',
            {
              expected: userContext.outputLanguage,
              actual: languageGuard.reason,
            }
          );
        }
      }
      if (l4CacheEnabled && languageGuard.ok) {
        L4_DECOMPOSITION_CACHE.set(
          decompositionCacheKey,
          structuredClone(decomposed)
        );
        console.info(`[pipeline] L4 STORE (key=${l4LogKey}…)`);
      } else if (l4CacheEnabled) {
        console.info(
          `[pipeline] L4 SKIP STORE (language guard failed) (key=${l4LogKey}…)`
        );
      }
      return attachLanguageMetadata(decomposed, {
        inputLanguage: userContext.inputLanguage ?? null,
        outputLanguage: userContext.outputLanguage ?? null,
        guardReason: languageGuard.reason,
        guardSeverity: languageGuard.severity,
        guardPassed: languageGuard.ok,
        retryCount: languageRetryCount,
      });
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
        weightBasis: ing.weightBasis,
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
  flushBufferedItemNames();

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

  // Server-side macro base map (per ingredientId). Passed to the nutrition
  // prompt builder so the LLM sees `<base ... />` per matched ingredient,
  // and to the streaming/reconcile path so `mid = base` and
  // `low/high = base × factor`. LLM never multiplies — this is what closes
  // the per-100g-echo loophole that produced 5511 kcal sườn non etc.
  const macroBaseMap = computeMacroBaseMap(decomposition, matchResult.matched);
  const decomposedItemByName = new Map<
    string,
    (typeof decomposition.mealItems)[number]
  >();
  for (const mi of decomposition.mealItems) {
    if (!decomposedItemByName.has(mi.name)) {
      decomposedItemByName.set(mi.name, mi);
    }
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

  let nutritionExtractAccumMs = 0;
  let nutritionChunkCount = 0;
  const nutritionOnChunk = (accumulated: string) => {
    const t0 = performance.now();
    const { items, newCount } = extractCompletedMealItemNutrition(
      accumulated,
      lastExtractedCount
    );
    nutritionExtractAccumMs += performance.now() - t0;
    nutritionChunkCount += 1;
    lastExtractedCount = newCount;

    for (const rawItemNutrition of items) {
      const quantity =
        mealItemGrams.get(rawItemNutrition.mealItemName) ??
        mealItemGrams.get(capitalizeFirst(rawItemNutrition.mealItemName)) ??
        0;
      // Streaming preview: resolve raw triples against the server-computed
      // base map so the SSE event matches the final shape. The authoritative
      // reconcile pass runs after the full stream completes (below).
      const decomposedMi =
        decomposedItemByName.get(rawItemNutrition.mealItemName) ??
        decomposedItemByName.get(
          capitalizeFirst(rawItemNutrition.mealItemName)
        );
      const itemNutrition = resolveStreamingMealItem(
        rawItemNutrition,
        decomposedMi,
        macroBaseMap
      );
      const streamItem = computeStreamingMealItem(
        itemNutrition,
        quantity,
        lastExtractedCount - items.length + items.indexOf(rawItemNutrition),
        userContext.goal,
        userContext.aggression
      );
      const mealItemId = resolveMealItemId(rawItemNutrition.mealItemName);
      emit({ type: 'item_macros', mealItemId, item: streamItem });
    }
  };

  const nutritionResult: NutritionAdjustment = await withStageLog(
    traceContext,
    'nutrition',
    3,
    { mealItemCount: decomposition.mealItems.length },
    async ({ stageLogId }) => {
      const nutritionPromptBuilder = getNutritionPromptBuilder();
      const systemPrompt = nutritionPromptBuilder(
        decomposition.mealItems,
        matchResult.matched,
        matchResult.unmatched,
        userContext,
        macroBaseMap
      );
      const callTrace = buildLlmStageTrace({
        trace: traceContext,
        stageLogId,
        name: 'nutrition',
        builder: nutritionPromptBuilder as (...a: unknown[]) => string,
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
        NUTRITION_TIMEOUT_MS,
        'nutrition'
      );

      // Reconcile raw LLM triples → server-anchored bounded estimates that
      // every downstream consumer (validation, assembly, streaming flush)
      // expects.
      let reconciledNutrition = reconcileNutritionIds(
        rawNutrition,
        decomposition,
        matchResult.matched
      );

      // Early anomaly check on the resolved bounded triple. 0-kcal is
      // essentially impossible for matched ingredients (P/C are server-anchored
      // and kcal is derived from the macro identity). It can still happen if
      // every ingredient is unmatched AND the LLM emits all-zero macros —
      // that's the only genuine error path we want to retry on.
      const totalMidKcal = reconciledNutrition.mealItems.reduce(
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
          NUTRITION_TIMEOUT_MS,
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
    cacheHitL4,
    languageRetryCount,
    nutritionAnomalyRetry: retryStep2Count > 0,
    nutritionEscalated:
      modelProfileForRun.escalationModel !== null &&
      selectedNutritionModel === modelProfileForRun.escalationModel,
    aliasFallbackFired: matchResult.aliasFallbackFired ?? false,
    decomposeChunkExtractMs: Math.round(
      decompositionStream.getStreamTimings().extractAccumMs
    ),
    decomposeChunkCount: decompositionStream.getStreamTimings().chunkCount,
    nutritionChunkExtractMs: Math.round(nutritionExtractAccumMs),
    nutritionChunkCount: nutritionChunkCount,
  });

  const ambiguityFlagCounts = countAmbiguityFlags(allIngredients);
  const rrf = aggregateRrfMeasurements(rrfMeasurements);
  let pipelineRunRow: ReturnType<typeof buildPipelineRunRow> | undefined;
  let pipelineRunId: string | undefined;
  let pipelineRunPersisted: Promise<void> | undefined;

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
        retryCount: languageRetryCount + retryStep2Count,
        languageGuardMisfire: languageRetryCount > 0,
        languageRetryCount,
        aliasFallbackFired: matchResult.aliasFallbackFired ?? false,
        promptPersonalizationFields: personalizationFields,
      });
      pipelineRunRow = row;
      pipelineRunId = row.id;
      // Production: fire-and-forget. Telemetry writes must not block the
      // user-visible response — the row id is generated locally so callers
      // that need it (SSE complete event, harness) get it immediately.
      // (Phase C3: was a 5-100 ms blocker per latency audit.)
      // Tests: stay awaited so the mocked insert is observed by assertions.
      // We expose the persist promise on the response so the shadow runner
      // can await it before referencing pipelineRunId via FK and avoid
      // racing the parent insert.
      if (process.env.NODE_ENV === 'test') {
        await writePipelineRun(traceContext.db, row);
        pipelineRunPersisted = Promise.resolve();
      } else {
        pipelineRunPersisted = writePipelineRun(traceContext.db, row).catch(
          (err) => {
            console.error(
              '[ai/pipeline] failed to write pipeline_runs row',
              err
            );
          }
        );
      }
    } catch (err) {
      console.error('[ai/pipeline] failed to build pipeline_runs row', err);
    }
  }

  const response: PipelineResponse = {
    success: true,
    data: pipelineResult,
    __telemetryRunId: pipelineRunId,
    __telemetryRunPersisted: pipelineRunPersisted,
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

  // Defer to a microtask so the response can stream to the client first.
  // We also wait for the parent pipeline_runs row to persist before kicking
  // off the shadow path: pipeline_shadow_runs.primary_run_id is an FK to
  // pipeline_runs.id, and the parent insert is fire-and-forget. Without this
  // await the shadow row could race the parent and either drop its FK link
  // (set null) or fail the insert outright.
  queueMicrotask(async () => {
    if (args.response.__telemetryRunPersisted) {
      try {
        await args.response.__telemetryRunPersisted;
      } catch {
        // The parent write already logged its own error. Continue: the
        // shadow row will simply land with primary_run_id=null and the
        // outcome captured below, which still gives us divergence data.
      }
    }
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
    enabled: readBooleanEnv('SHADOW_RUNNER_ENABLED', false),
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
