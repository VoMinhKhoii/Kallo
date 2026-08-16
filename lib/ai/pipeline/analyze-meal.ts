import type { GeminiClient } from '@/lib/ai/gemini';
import { matchIngredients } from '@/lib/ai/matching';
import type { RrfMeasurement } from '@/lib/ai/matching/rrf-measurement';
import { assembleResult } from '@/lib/ai/pipeline/assemble/assemble';
import { isPipelineV2Enabled } from '@/lib/ai/pipeline/config/grounded-path-flag';
import { resolveModelProfile } from '@/lib/ai/pipeline/config/model-profile';
import {
  handleError,
  isNonFoodError,
  isParseError,
  nonFoodResponse,
} from '@/lib/ai/pipeline/contracts/failure';
import { analyzeMealV2 } from '@/lib/ai/pipeline/grounded/orchestrator';
import { countCanonicalNameMisses } from '@/lib/ai/pipeline/legacy/canonical-name-validator';
import { finalizePipelineRun } from '@/lib/ai/pipeline/legacy/completion';
import { runDecompositionStage } from '@/lib/ai/pipeline/legacy/decomposition-stage';
import { runNutritionStage } from '@/lib/ai/pipeline/legacy/nutrition-stage';
import {
  type ShadowConfig,
  scheduleShadowRun,
} from '@/lib/ai/pipeline/legacy/shadow/dispatch';
import {
  detectAnomalies,
  validateNutritionOutput,
} from '@/lib/ai/pipeline/legacy/validation';
import {
  ANALYSIS_MODEL_BUDGET_ROUTE,
  ANALYSIS_MODEL_PROVIDER,
  classifyProviderError,
  type PipelineBudget,
  recordAnalysisModelBudgetEventBestEffort,
} from '@/lib/ai/pipeline/telemetry/budget';
import { withStageLog } from '@/lib/ai/pipeline/telemetry/stage-log';
import type { StreamEvent } from '@/lib/ai/streaming/types';
import type { PipelineResponse, UserContext } from '@/lib/ai/types';
import type { AppDb } from '@/lib/db';

const MODEL_PROFILE = resolveModelProfile();

/** Model for LLM Call 2 (nutrition estimation). */
const NUTRITION_MODEL = MODEL_PROFILE.nutritionModel;

export { _resetL4DecompositionCacheForTests } from '@/lib/ai/pipeline/legacy/decomposition-stage';
export type { PipelineMetrics } from '@/lib/ai/pipeline/legacy/metrics';
export type { ShadowConfig } from '@/lib/ai/pipeline/legacy/shadow/dispatch';

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

export interface AnalyzeMealOptions {
  shadow?: ShadowConfig;
  l4Cache?: { enabled?: boolean };
}

interface RunPipelineOptions {
  matchingConcurrency?: number;
  nutritionModel?: string;
  l4Cache?: AnalyzeMealOptions['l4Cache'];
  budget?: PipelineBudget;
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
  // V2 dispatch: default ON. v2 (pure-decompose + CRAG-grounded) handles
  // the request unless `PIPELINE_V2_ENABLED=false` is set for a v1
  // fallback. Both paths emit the same `stage` / `item_name` /
  // `item_macros` / `result` / `analysis_complete` SSE events so existing
  // clients need no changes.
  if (isPipelineV2Enabled()) {
    console.info('[pipeline] dispatching to v2 (default)');
    return analyzeMealV2(rawInput, userContext, db, gemini, onEvent, {
      traceContext,
    });
  }
  console.info('[pipeline] running v1 (PIPELINE_V2_ENABLED=false fallback)');

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
      db,
      traceContext,
      response,
      primaryMs: Date.now() - analyzeStart,
      shadow: options?.shadow,
      runCandidate: (candidateModel) =>
        runPipeline(rawInput, userContext, db, gemini, undefined, undefined, {
          matchingConcurrency: 1,
          nutritionModel: candidateModel,
          budget: {
            workKind: 'shadow',
            requestId: traceContext?.requestId ?? null,
          },
        }),
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
  const budget: PipelineBudget = options.budget ?? {
    workKind: 'primary',
    requestId: traceContext?.requestId ?? null,
  };

  // Stage 1: Streaming decomposition with speculative embedding pre-warming
  // + per-item name detection for progressive UI
  const decompositionStage = await runDecompositionStage({
    rawInput,
    userContext,
    db,
    gemini,
    emit,
    traceContext,
    budget,
    l4Cache: options.l4Cache,
    stageStart: t0,
  });
  const { decomposition } = decompositionStage;

  // Stage 2: Ingredient matching
  emit({ type: 'stage', stage: 'matching' });
  let preMatchAliasHits = 0;
  const rrfMeasurements: RrfMeasurement[] = [];
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

  // Stage 3: LLM nutrition estimation (streaming with per-item boundary detection)
  const nutritionStage = await runNutritionStage({
    decomposition,
    matchResult,
    allIngredients,
    userContext,
    db,
    gemini,
    emit,
    traceContext,
    budget,
    modelProfileForRun,
  });
  const { nutritionResult } = nutritionStage;

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

  const allAnomalies = [
    ...decompositionStage.decompositionAnomalies,
    ...nutritionAnomalies,
    ...resultAnomalies,
  ];
  return finalizePipelineRun({
    t0,
    userContext,
    traceContext,
    decompositionStage,
    nutritionStage,
    matchResult,
    allIngredients,
    matchMs,
    assemblyMs,
    assemblyMetrics,
    pipelineResult,
    allAnomalies,
    rrfMeasurements,
    preMatchAliasHits,
  });
}
