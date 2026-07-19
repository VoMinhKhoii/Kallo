import type { IngredientV2MatchResult } from '../matching/top-k-cascade';
import type { UserContext } from '../types';
import type { V2AnomalySummary } from './anomaly-v2';
import type { bridgeV2ToV1 } from './bridge';
import type { resolveModelProfile } from './config/model-profile';
import type { AnalyzeMealTraceContext } from './orchestrator';
import type { GroundedEstimation, MealDecompositionV2 } from './schemas-v2';
import {
  buildPipelineRunRow,
  writePipelineRun,
} from './telemetry/run-telemetry';

export interface V2TelemetryInput {
  decomposition: MealDecompositionV2;
  matchResults: IngredientV2MatchResult[];
  grounded: GroundedEstimation;
  verdicts: ReturnType<typeof bridgeV2ToV1>['verdicts'];
  promptCharsCall1: number;
  promptCharsCall2: number;
  /** Number of `onChunk` callbacks fired during Call 1 streaming. Tells us
   *  whether item_name events ought to have streamed progressively or
   *  arrived as one batch (single-chunk = no perceived streaming). */
  decomposeChunkCount: number;
  /** Same probe for Call 2 / item_macros. */
  nutritionChunkCount: number;
  languageRetryCount: number;
  /**
   * Phase 3 portion-resolver provenance per flat ingredient (same order as
   * `verdicts`). Summarized into per-ladder-step counts so telemetry can show
   * how many portions were server-grounded vs deferred to the LLM vs clarified.
   */
  portionProvenance?: string[];
}

export function logV2Telemetry(input: V2TelemetryInput): void {
  const totalIngredients = input.verdicts.length;
  const accepted = input.verdicts.filter(
    (v) => v.verdict === 'accepted'
  ).length;
  const rejected = input.verdicts.filter(
    (v) => v.verdict === 'rejected'
  ).length;
  const unmatched = input.verdicts.filter(
    (v) => v.verdict === 'unmatched'
  ).length;
  const missing = input.verdicts.filter((v) => v.verdict === 'missing').length;
  const overturnedTopOne = input.verdicts.filter(
    (v) =>
      v.verdict === 'accepted' &&
      v.selectedCandidateIdx !== null &&
      v.selectedCandidateIdx > 0
  ).length;
  const portionProvenanceCounts = (input.portionProvenance ?? []).reduce<
    Record<string, number>
  >((acc, p) => {
    acc[p] = (acc[p] ?? 0) + 1;
    return acc;
  }, {});
  console.info('[v2-pipeline] verdicts', {
    totalIngredients,
    accepted,
    rejected,
    unmatched,
    missing,
    overturnedTopOne,
    mealItems: input.decomposition.mealItems.length,
    promptCharsCall1: input.promptCharsCall1,
    promptCharsCall2: input.promptCharsCall2,
    decomposeChunkCount: input.decomposeChunkCount,
    nutritionChunkCount: input.nutritionChunkCount,
    languageRetryCount: input.languageRetryCount,
    portionProvenance: portionProvenanceCounts,
  });
}

/**
 * Persist a `pipeline_runs` row for an observed v2 run so admin / audit /
 * shadow-runner queries surface v2 alongside v1.
 *
 * Schema reuse: `pipeline_version` is the authoritative v1/v2 discriminator.
 * The legacy `v2_run` anomaly marker remains for existing dashboards, while
 * v2-specific verdict signals continue as `v2_*` markers. Best-effort write.
 */
export async function persistV2PipelineRun(args: {
  traceContext: AnalyzeMealTraceContext | undefined;
  userContext: UserContext;
  profile: ReturnType<typeof resolveModelProfile>;
  decomposition: MealDecompositionV2;
  matched: ReturnType<typeof bridgeV2ToV1>['matched'];
  unmatched: ReturnType<typeof bridgeV2ToV1>['unmatched'];
  verdicts: ReturnType<typeof bridgeV2ToV1>['verdicts'];
  /** Phase 4 (D2) anomaly cause/action counts. Optional so callers/tests that
   *  don't run the anomaly pass still persist a row. */
  anomalySummary?: V2AnomalySummary;
  /** Whether the gated escalation seam fired this run. */
  escalated?: boolean;
  totalMs: number;
  languageRetryCount: number;
  providerRetryCount: number;
}): Promise<void> {
  const trace = args.traceContext;
  if (!trace) return;
  try {
    const ingredientCount = args.verdicts.length;
    const matched = args.matched.length;
    const unmatched = args.unmatched.length;
    const rejected = args.verdicts.filter(
      (v) => v.verdict === 'rejected'
    ).length;
    const overturnedTopOne = args.verdicts.filter(
      (v) =>
        v.verdict === 'accepted' &&
        v.selectedCandidateIdx !== null &&
        v.selectedCandidateIdx > 0
    ).length;

    const personalizationFields: string[] = [];
    if (args.userContext.countryOfOrigin) {
      personalizationFields.push('countryOfOrigin');
    }
    if (args.userContext.countryOfResidence) {
      personalizationFields.push('countryOfResidence');
    }
    if (args.userContext.cookingHabits) {
      personalizationFields.push('cookingHabits');
    }

    const anomalyMarkers: string[] = ['v2_run'];
    if (rejected > 0) anomalyMarkers.push(`v2_rejected_${rejected}`);
    if (overturnedTopOne > 0)
      anomalyMarkers.push(`v2_overturned_${overturnedTopOne}`);
    // D2: fold per-cause anomaly markers into the existing anomaly_types text[]
    // (no schema change needed for these — the column already exists). The new
    // dedicated v2 anomaly columns below are guarded by column presence.
    if (args.anomalySummary) {
      anomalyMarkers.push(...args.anomalySummary.markers);
    }
    const macroInconsistentFires =
      args.anomalySummary?.causeCounts.macro_inconsistent ?? 0;
    const escalationFired = args.escalated ?? false;

    const row = buildPipelineRunRow({
      userId: trace.userId,
      requestId: trace.requestId,
      pipelineVersion: 'v2',
      modelCall1: args.profile.decompositionModel,
      modelCall2: args.profile.nutritionModel,
      timings: { total: args.totalMs },
      counts: { ingredient: ingredientCount, matched, unmatched },
      anomalyTypes: anomalyMarkers,
      ambiguityFlagCounts: {},
      rrf: {
        rrfSampled: false,
        rrfDisagreementCount: null,
        rrfIngredientsObserved: null,
        rrfMeasurementLatencyMs: null,
      },
      counters: {
        preMatchAliasHits: 0,
        // v2 doesn't use the cooked-to-raw factor table; the LLM emits
        // grams already scoped to the matched candidate's state.
        cookedToRawFactorFires: 0,
        densityEnvelopeFires: 0,
        macroInconsistentFires: 0,
        dbStateUnknownFires: 0,
        retryStep2Count: 0,
      },
      // v2 has no L4 cache/escalation — false means "not applicable",
      // disambiguated by pipeline_version.
      escalated: escalationFired,
      cacheHitL4: false,
      retryCount: args.providerRetryCount,
      languageGuardMisfire: args.languageRetryCount > 0,
      languageRetryCount: args.languageRetryCount,
      aliasFallbackFired: false,
      promptPersonalizationFields: personalizationFields,
    });

    // D2: `macro_inconsistent_fires` already exists in the schema, so it's safe
    // to set unconditionally.
    row.macroInconsistentFires = macroInconsistentFires;

    // D2: the per-cause breakdown lives in a NEW column `v2_anomaly_causes`
    // whose migration is intentionally UNAPPLIED this phase. writePipelineRun
    // detects the column's absence and drops it, so the rest of the row still
    // persists on a DB that hasn't run the migration yet (mirrors Phase 0's
    // pipeline_version tolerance).
    const rowWithV2 = {
      ...row,
      v2AnomalyCauses: args.anomalySummary?.causeCounts ?? null,
    };

    if (process.env.NODE_ENV === 'test') {
      await writePipelineRun(trace.db, rowWithV2);
    } else {
      writePipelineRun(trace.db, rowWithV2).catch((err) => {
        console.error(
          '[ai/pipeline] v2 failed to write pipeline_runs row',
          err
        );
      });
    }
  } catch (err) {
    console.error('[ai/pipeline] v2 failed to build pipeline_runs row', err);
  }
}

/**
 * Log + persist a completed v2 run in one call (console telemetry always;
 * pipeline_runs row when tracing is enabled — best-effort, never blocks; in
 * tests the persist is awaited so assertions aren't racy).
 */
export async function recordV2RunTelemetry(args: {
  log: Parameters<typeof logV2Telemetry>[0];
  persist: Parameters<typeof persistV2PipelineRun>[0];
}): Promise<void> {
  logV2Telemetry(args.log);
  const persistPromise = persistV2PipelineRun(args.persist);
  if (process.env.NODE_ENV === 'test') {
    await persistPromise;
  } else {
    void persistPromise;
  }
}
