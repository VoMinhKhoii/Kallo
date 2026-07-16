import type { IngredientV2MatchResult } from '../matching/top-k-cascade';
import type { UserContext } from '../types';
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
  });
}

/**
 * Persist a `pipeline_runs` row for an observed v2 run so admin / audit /
 * shadow-runner queries surface v2 alongside v1.
 *
 * Schema reuse: the v1 `buildPipelineRunRow` fields cover most of what we
 * want to report. v2-specific signals (verdict counts, overturnedTopOne,
 * prompt sizes) ride along in `anomalyTypes` as marker strings prefixed
 * `v2_*` until a dedicated column exists. Best-effort write.
 */
export async function persistV2PipelineRun(args: {
  traceContext: AnalyzeMealTraceContext | undefined;
  userContext: UserContext;
  profile: ReturnType<typeof resolveModelProfile>;
  decomposition: MealDecompositionV2;
  matched: ReturnType<typeof bridgeV2ToV1>['matched'];
  unmatched: ReturnType<typeof bridgeV2ToV1>['unmatched'];
  verdicts: ReturnType<typeof bridgeV2ToV1>['verdicts'];
  totalMs: number;
  languageRetryCount: number;
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

    const row = buildPipelineRunRow({
      userId: trace.userId,
      requestId: trace.requestId,
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
      escalated: false,
      cacheHitL4: false,
      retryCount: args.languageRetryCount,
      languageGuardMisfire: args.languageRetryCount > 0,
      languageRetryCount: args.languageRetryCount,
      aliasFallbackFired: false,
      promptPersonalizationFields: personalizationFields,
    });

    if (process.env.NODE_ENV === 'test') {
      await writePipelineRun(trace.db, row);
    } else {
      writePipelineRun(trace.db, row).catch((err) => {
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
