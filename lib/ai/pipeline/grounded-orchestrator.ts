import type { AppDb } from '@/lib/db';
import type { GeminiClient } from '../gemini';
import {
  DEFAULT_K,
  DEFAULT_MATCH_CONCURRENCY,
  type IngredientV2MatchResult,
} from '../matching/top-k-cascade';
import { attachVesselToResult } from '../portion/vessel-envelope';
import {
  buildMealItemOffsetByName,
  buildPerMealItemOffsetMap,
} from '../streaming/grounded-parsers';
import type { StreamEvent } from '../streaming/types';
import type { PipelineResponse, UserContext } from '../types';
import { assembleResult } from './assembly';
import { bridgeV2ToV1 } from './bridge';
import { initV2BudgetAccounting } from './budget-telemetry';
import { createChunkEmitContext, runCallTwo } from './call-two';
import { resolveCompletenessGate } from './completeness-gate';
import { resolveModelProfile } from './config/model-profile';
import { handleError, nonFoodResponse } from './errors';
import {
  createGeminiEstimator,
  renderGeminiEstimatorPrompt,
} from './estimator/gemini-estimator';
import type { GroundedEstimator } from './estimator/types';
import { buildFastPathEstimation } from './fast-path';
import { runGroundedDecomposition } from './grounded-decomposition';
import {
  createCall2StreamHandler,
  flushUnstreamedItemMacros,
  runV2AnomalyPass,
  shouldEscalateV2,
  toPromptPersonalizationContext,
  withStageLogV2,
} from './grounded-support';
import { recordV2RunTelemetry } from './grounded-telemetry';
import { reconcileNutritionIds } from './nutrition';
import type { AnalyzeMealTraceContext } from './orchestrator';
import { prepareGrounding } from './prepare-grounding';
import type { GroundedEstimation, MealDecompositionV2 } from './schemas-v2';
import { buildLlmStageTrace } from './telemetry/trace';

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
  /** Precise-mode clarify reply, threaded into the Call-1 user message on re-analysis. */
  clarifyAnswer?: string;
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
      clarifyAnswer: options.clarifyAnswer,
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
      fullyGrounded,
    } = await prepareGrounding({
      decomposition,
      userContext,
      db,
      gemini,
      traceContext,
      emit,
      topK,
      matchConcurrency,
    });

    // ---- Stage 3: Call 2 — grounded estimation with item_macros stream --
    const estimator =
      options.estimator ??
      createGeminiEstimator(gemini, profile.nutritionModel);
    const call2SystemPrompt = renderGeminiEstimatorPrompt({
      originalPrompt: rawInput,
      mealItems: mealItemsWithCandidates,
      userContext: promptCtx,
      temperature: call2Temperature,
    });
    promptCharsCall2 = call2SystemPrompt.length;

    const perItemOffsets = buildPerMealItemOffsetMap(decomposition.mealItems);
    // D4: Call 2 streams meal items in the prompt's SORTED order; the stream
    // handler attributes each item to its slice by name+occurrence.
    const offsetByName = buildMealItemOffsetByName(decomposition.mealItems);
    const itemMacrosStreamed = new Set<string>();
    const call2Stream = createCall2StreamHandler({
      offsetByName,
      matchResults,
      streamedMealItemIds,
      itemMacrosStreamed,
      goal: userContext.goal,
      aggression: userContext.aggression,
      emit,
    });
    const chunkEmit = createChunkEmitContext({
      mealItems: decomposition.mealItems,
      matchResults,
      streamedMealItemIds,
      itemMacrosStreamed,
      goal: userContext.goal,
      aggression: userContext.aggression,
      emit,
    });

    let nutritionMaxAttempt = 0;
    const call2 = await withStageLogV2(
      traceContext,
      'nutrition',
      3,
      {
        mealItemCount: decomposition.mealItems.length,
        matchedCount: matchResults.filter((m) => m.candidates.length > 0)
          .length,
        unmatchedCount: matchResults.filter((m) => m.candidates.length === 0)
          .length,
        model: profile.nutritionModel,
        fastPath: fullyGrounded,
      },
      async ({ stageLogId }) => {
        emit({ type: 'stage', stage: 'estimating' });
        const callTrace = buildLlmStageTrace({
          trace: traceContext,
          stageLogId,
          name: 'grounded-estimation',
          builder: renderGeminiEstimatorPrompt as (...a: unknown[]) => string,
          templateSample: call2SystemPrompt,
          model: profile.nutritionModel,
        });
        return runCallTwo({
          estimator,
          mealItems: mealItemsWithCandidates,
          originalPrompt: rawInput,
          promptCtx,
          temperature: call2Temperature,
          stream: {
            handleChunk: call2Stream.handleChunk,
            resetForRetry: call2Stream.resetForRetry,
            onAttemptStart: (attempt) => {
              nutritionMaxAttempt = Math.max(nutritionMaxAttempt, attempt);
              if (attempt > 1) call2Stream.resetForRetry();
            },
            onChunkTick: () => {
              nutritionChunkCount++;
            },
          },
          chunkEmit,
          onAttemptComplete: budget.nutritionRecorder,
          ...(fullyGrounded
            ? {
                fastPath: buildFastPathEstimation({
                  decomposition,
                  matchResults,
                  portionResolutions,
                }),
              }
            : {}),
          ...(callTrace ? { trace: callTrace } : {}),
        });
      }
    );
    const grounded: GroundedEstimation = call2.grounded;

    // ---- Stage 4: Bridge + Reconcile + Assemble (single trace stage) ---
    const assembly = await withStageLogV2(
      traceContext,
      'assembly',
      4,
      { ingredientCount: matchResults.length },
      async (_ctx) => {
        emit({ type: 'stage', stage: 'assembling' });
        const bridged = bridgeV2ToV1({
          v2: decomposition,
          matches: matchResults,
          grounded,
          mealContext: rawInput,
          preMintedMealItemIds: streamedMealItemIds,
          portionResolutions,
        });
        const reconciled = reconcileNutritionIds(
          bridged.rawNutrition,
          bridged.decomposition,
          bridged.matched
        );
        const assembled = assembleResult(
          bridged.decomposition,
          reconciled,
          bridged.matched,
          bridged.unmatched,
          userContext
        );
        attachVesselToResult(
          assembled.result,
          decomposition.mealItems,
          vesselEnvelopes
        );
        return {
          bridged,
          ...assembled,
        };
      }
    );
    const bridged = assembly.bridged;
    options.onDiagnostics?.({
      decomposition,
      matchResults,
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
      alreadyStreamed: itemMacrosStreamed,
      perItemOffsets,
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
          Math.max(0, nutritionMaxAttempt - 1),
      },
    });

    // Chunk-failure → plausibility → anomaly clarify (see completeness-gate).
    const unresolved = resolveCompletenessGate({
      failedMealItemNames: call2.failedMealItemNames,
      plausibility: bridged.plausibility,
      anomalySummary,
    });
    return unresolved
      ? { success: true, data: assembly.result, unresolved }
      : { success: true, data: assembly.result };
  } catch (error) {
    budget.recordCatchError(error);
    return handleError(error);
  }
}

/**
 * Wrap a v2 stage with optional `pipeline_stage_logs` persistence. When
 * `traceContext` is present, mirrors v1's `withStageLog` semantics so the
 * admin requests/[id] timeline populates for v2 runs. When absent, the fn
 * runs without any DB overhead.
 *
 * Errors are logged with status='error' before re-throwing so the parent
 * handler can map to a non-food / parse_error response.
 */
