/**
 * The grounded (v2) run — the entry `lib/ai/pipeline/analyze-meal.ts` dispatches
 * to. Sequences four stages, one file each, and owns nothing but the wiring
 * between them:
 *   1. `decomposition.ts` — Call 1: ingredient names + prep hints, no grams.
 *   2. `grounding.ts`     — top-K DB candidates + server-resolved portions.
 *   3. `call-two/`        — Call 2: CRAG verdicts, grams, bounded macros.
 *   4. `assembly.ts`      — bridge → reconcile → assemble the PipelineResult.
 *
 * Cross-cutting: `stage-log.ts` (admin timeline), `escalation.ts` (anomaly pass
 * + gated re-run), `run-record.ts` (console telemetry + `pipeline_runs`).
 */
import type { GeminiClient } from '@/lib/ai/gemini';
import {
  DEFAULT_K,
  DEFAULT_MATCH_CONCURRENCY,
  type IngredientV2MatchResult,
} from '@/lib/ai/matching/top-k-cascade';
import type { AnalyzeMealTraceContext } from '@/lib/ai/pipeline/analyze-meal';
import { resolveModelProfile } from '@/lib/ai/pipeline/config/model-profile';
import { isPortionVesselEnabled } from '@/lib/ai/pipeline/config/portion-vessel-flag';
import {
  handleError,
  nonFoodResponse,
} from '@/lib/ai/pipeline/contracts/failure';
import type { MealDecompositionV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type { GroundedEstimator } from '@/lib/ai/pipeline/estimator/types';
import { resolveCompletenessGate } from '@/lib/ai/pipeline/resolve/completeness-gate';
import type { bridgeV2ToV1 } from '@/lib/ai/pipeline/resolve/resolve';
import { initV2BudgetAccounting } from '@/lib/ai/pipeline/telemetry/budget';
import type { PortionResolution } from '@/lib/ai/portion/types';
import type { PromptPersonalizationContext } from '@/lib/ai/prompts/types';
import type { StreamEvent } from '@/lib/ai/streaming/types';
import type { PipelineResponse, UserContext } from '@/lib/ai/types';
import type { AppDb } from '@/lib/db';
import { runAssemblyStage } from './assembly';
import { runCallTwoStage } from './call-two/call-two';
import { flushUnstreamedItemMacros } from './call-two/item-macros';
import { runGroundedDecomposition } from './decomposition';
import { runV2AnomalyPass, shouldEscalateV2 } from './escalation';
import { prepareGrounding } from './grounding';
import { recordV2RunTelemetry } from './run-record';

export interface AnalyzeMealV2Options {
  /** Top-K candidates to pass to Call 2 per ingredient. Default 3. */
  topK?: number;
  /** Concurrency for embedding + matching fan-out. Default 4. */
  matchConcurrency?: number;
  /** Optional Call 2 temperature (default 0.4 — slightly lower than v1's 0.5 because Call 2 in v2 also owns grams). */
  call2Temperature?: number;
  /**
   * Request-level trace context (user id, request id, db handle). When
   * present, the v2 orchestrator persists a `pipeline_runs` row so the
   * admin/audit dashboards and shadow-runner infrastructure observe v2
   * runs alongside v1.
   */
  traceContext?: AnalyzeMealTraceContext;
  /** Read-only internals used by the offline eval harness. */
  onDiagnostics?: (diagnostics: V2PipelineDiagnostics) => void;
  /**
   * Call-2 provider adapter (D3 seam). Offline-eval-only override for the
   * bakeoff harness (`--estimator gemini|claude|openai`). When omitted the
   * orchestrator builds the Gemini adapter itself, so the production route —
   * which never passes this — stays Gemini-only with no behavior change.
   */
  estimator?: GroundedEstimator;
}

export interface V2PipelineDiagnostics {
  decomposition: MealDecompositionV2;
  matchResults: IngredientV2MatchResult[];
  portionResolutions: PortionResolution[];
  verdicts: ReturnType<typeof bridgeV2ToV1>['verdicts'];
  /** Per-ingredient plausibility trail — lets consumers (eval harness) tell a
   *  FLAGGED zero (genuinely_noncaloric, unresolved_estimate) from a silent one. */
  plausibility: ReturnType<typeof bridgeV2ToV1>['plausibility'];
}

/**
 * Run the v2 pipeline end-to-end. Mirrors `analyzeMeal` from v1 in signature
 * (minus `traceContext` / `options.shadow` which are v1-shadow-specific) so
 * the dispatch at v1's analyzeMeal can swap implementations behind the
 * feature flag.
 */
export async function analyzeMealV2(
  rawInput: string,
  userContext: UserContext,
  db: AppDb,
  gemini: GeminiClient,
  onEvent?: (event: StreamEvent) => void,
  options: AnalyzeMealV2Options = {}
): Promise<PipelineResponse> {
  const emit = onEvent ?? (() => {});
  const topK = options.topK ?? DEFAULT_K;
  const matchConcurrency =
    options.matchConcurrency ?? DEFAULT_MATCH_CONCURRENCY;
  const call2Temperature = options.call2Temperature ?? 0.4;
  const traceContext = options.traceContext;
  const profile = resolveModelProfile();
  const vesselEnabled = isPortionVesselEnabled();
  const promptCtx = toPromptPersonalizationContext(userContext);
  const t0 = Date.now();

  const budget = initV2BudgetAccounting({
    db,
    requestId: traceContext?.requestId ?? null,
    decompositionModel: profile.decompositionModel,
    nutritionModel: profile.nutritionModel,
  });

  let promptCharsCall2 = 0;
  let nutritionChunkCount = 0;

  try {
    // ---- Stage 1: Call 1 — pure decomposition (grounded-decomposition) --
    const stage1 = await runGroundedDecomposition({
      rawInput,
      userContext,
      db,
      gemini,
      traceContext,
      emit,
      promptCtx,
      profile,
      onAttemptComplete: budget.decompositionRecorder,
    });
    if (stage1.nonFood) {
      return nonFoodResponse();
    }
    const {
      decomposition,
      streamedMealItemIds,
      decomposeChunkCount,
      languageRetryCount,
      providerRetryCount: decompositionProviderRetryCount,
      promptCharsCall1,
    } = stage1;

    // ---- Stage 2: matching + portion resolution (prepare-grounding) -----
    const {
      matchResults,
      portionResolutions,
      vesselEnvelopes,
      mealItemsWithCandidates,
    } = await prepareGrounding({
      decomposition,
      userContext,
      db,
      gemini,
      traceContext,
      emit,
      topK,
      matchConcurrency,
      vesselEnabled,
    });

    // ---- Stage 3: Call 2 — grounded estimation with item_macros stream --
    const stage3 = await runCallTwoStage({
      traceContext,
      emit,
      gemini,
      profile,
      estimatorOverride: options.estimator,
      decomposition,
      matchResults,
      mealItemsWithCandidates,
      streamedMealItemIds,
      rawInput,
      promptCtx,
      temperature: call2Temperature,
      userContext,
      onAttemptComplete: budget.nutritionRecorder,
      onChunkTick: () => {
        nutritionChunkCount++;
      },
    });
    const { call2, grounded } = stage3;
    promptCharsCall2 = stage3.promptCharsCall2;

    // ---- Stage 4: Bridge + Reconcile + Assemble (single trace stage) ---
    const assembly = await runAssemblyStage({
      traceContext,
      emit,
      decomposition,
      matchResults,
      grounded,
      portionResolutions,
      streamedMealItemIds,
      vesselEnvelopes,
      vesselEnabled,
      rawInput,
      userContext,
    });
    const bridged = assembly.bridged;
    options.onDiagnostics?.({
      decomposition,
      matchResults,
      portionResolutions,
      verdicts: bridged.verdicts,
      plausibility: bridged.plausibility,
    });

    // Flush any meal items whose macros didn't stream (e.g., final closing
    // brace arrived without a separator marker, so the regex didn't catch
    // them). Re-emit in stream order using the resolved nutrition shape.
    flushUnstreamedItemMacros({
      matchResults,
      grounded,
      streamedMealItemIds,
      alreadyStreamed: stage3.itemMacrosStreamed,
      offsetByName: stage3.offsetByName,
      goal: userContext.goal,
      aggression: userContext.aggression,
      emit,
    });

    // v2 anomaly pass (D2): classify by CAUSE + record SAFE actions over the
    // assembled result. Gated escalation seam: when opted in, a high-confidence
    // correctness anomaly re-runs Call 2 once on the escalation model. Default
    // off (stable has no escalationModel), so no added latency until opted in.
    const anomalySummary = runV2AnomalyPass({
      result: assembly.result,
      matched: bridged.matched,
      unmatched: bridged.unmatched,
      decomposition,
    });
    const escalated = shouldEscalateV2({ profile, summary: anomalySummary });
    if (escalated) {
      console.info('[v2-pipeline] escalation fired', profile.escalationModel);
    }

    await recordV2RunTelemetry({
      log: {
        decomposition,
        matchResults,
        grounded,
        verdicts: bridged.verdicts,
        promptCharsCall1,
        promptCharsCall2,
        decomposeChunkCount,
        nutritionChunkCount,
        languageRetryCount,
        portionProvenance: portionResolutions.map((r) => r.provenance),
      },
      persist: {
        traceContext,
        userContext,
        profile,
        decomposition,
        matched: bridged.matched,
        unmatched: bridged.unmatched,
        verdicts: bridged.verdicts,
        anomalySummary,
        escalated,
        totalMs: Date.now() - t0,
        languageRetryCount,
        providerRetryCount:
          decompositionProviderRetryCount +
          Math.max(0, stage3.nutritionMaxAttempt - 1),
      },
    });

    // Transient chunk failure, or an ingredient the bridge withheld for want
    // of any macro source → retryable error (see completeness-gate). A shaky
    // portion still does not gate: it ships and the picker corrects it.
    const unresolved = resolveCompletenessGate({
      failedMealItemNames: call2.failedMealItemNames,
      carvedOut: bridged.carvedOut,
    });
    return unresolved
      ? { success: true, data: assembly.result, unresolved }
      : { success: true, data: assembly.result };
  } catch (error) {
    budget.recordCatchError(error);
    return handleError(error);
  }
}

/** Narrow a full `UserContext` to the fields the prompts are allowed to see. */
export function toPromptPersonalizationContext(
  userContext: UserContext
): PromptPersonalizationContext {
  return {
    countryOfOrigin: userContext.countryOfOrigin,
    countryOfResidence: userContext.countryOfResidence,
    cookingHabits: userContext.cookingHabits,
    inputLanguage: userContext.inputLanguage,
    outputLanguage: userContext.outputLanguage,
  };
}
