import type { matchIngredients } from '../matching';
import type { RrfMeasurement } from '../matching/rrf-measurement';
import type {
  AmbiguityFlag,
  PipelineResponse,
  PipelineResult,
  UserContext,
} from '../types';
import {
  DECOMPOSITION_MODEL,
  type DecompositionStageResult,
} from './decomposition-stage';
import { logMetrics } from './metrics';
import type { NutritionStageResult } from './nutrition-stage';
import type { AnalyzeMealTraceContext } from './orchestrator';
import { aggregateRrfMeasurements } from './rrf-aggregation';
import {
  buildPipelineRunRow,
  writePipelineRun,
} from './telemetry/run-telemetry';
import type { ValidationAnomaly } from './validation';

type MatchIngredientsResult = Awaited<ReturnType<typeof matchIngredients>>;

/**
 * Post-assembly finalization: emit the structured `[pipeline] metrics` line
 * (consumed by the latency-budget harness — shape is load-bearing), persist
 * the best-effort `pipeline_runs` telemetry row (§0.4), and shape the
 * response. Telemetry writes never block the response or throw.
 */
export async function finalizePipelineRun(args: {
  t0: number;
  userContext: UserContext;
  traceContext: AnalyzeMealTraceContext | undefined;
  decompositionStage: DecompositionStageResult;
  nutritionStage: NutritionStageResult;
  matchResult: MatchIngredientsResult;
  allIngredients: { ambiguityFlags?: AmbiguityFlag[] }[];
  matchMs: number;
  assemblyMs: number;
  assemblyMetrics: { cookedToRawFactorFires: number };
  pipelineResult: PipelineResult;
  allAnomalies: ValidationAnomaly[];
  rrfMeasurements: RrfMeasurement[];
  preMatchAliasHits: number;
}): Promise<PipelineResponse> {
  const {
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
  } = args;
  const { retryStep2Count, selectedNutritionModel, nutritionEscalated } =
    nutritionStage;
  const mealItemCount = decompositionStage.decomposition.mealItems.length;

  logMetrics({
    decomposeMs: decompositionStage.decomposeMs,
    matchMs,
    nutritionMs: nutritionStage.nutritionMs,
    assemblyMs,
    totalMs: Date.now() - t0,
    ingredientCount: allIngredients.length,
    matchedCount: matchResult.matched.length,
    unmatchedCount: matchResult.unmatched.length,
    mealItemCount,
    anomalies: allAnomalies,
    cacheHitL4: decompositionStage.cacheHitL4,
    languageRetryCount: decompositionStage.languageRetryCount,
    nutritionAnomalyRetry: retryStep2Count > 0,
    nutritionEscalated,
    aliasFallbackFired: matchResult.aliasFallbackFired ?? false,
    decomposeChunkExtractMs: Math.round(
      decompositionStage.streamTimings.extractAccumMs
    ),
    decomposeChunkCount: decompositionStage.streamTimings.chunkCount,
    nutritionChunkExtractMs: Math.round(nutritionStage.nutritionExtractAccumMs),
    nutritionChunkCount: nutritionStage.nutritionChunkCount,
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
          dbStateUnknownFires: decompositionStage.dbStateUnknownFires,
          retryStep2Count,
        },
        escalated: nutritionEscalated,
        cacheHitL4: decompositionStage.cacheHitL4,
        retryCount: decompositionStage.languageRetryCount + retryStep2Count,
        languageGuardMisfire: decompositionStage.languageRetryCount > 0,
        languageRetryCount: decompositionStage.languageRetryCount,
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
