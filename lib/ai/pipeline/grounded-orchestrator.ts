import type { AppDb } from '@/lib/db';
import type { GeminiClient } from '../gemini';
import {
  DEFAULT_K,
  DEFAULT_MATCH_CONCURRENCY,
  type IngredientV2MatchResult,
  matchTopKPerIngredient,
} from '../matching/top-k-cascade';
import { resolvePortionsForCallTwo } from '../portion/ingredient-portion';
import type { MealItemWithCandidates } from '../prompts/grounded-estimation';
import {
  buildMealItemOffsetByName,
  buildPerMealItemOffsetMap,
} from '../streaming/grounded-parsers';
import type { StreamEvent } from '../streaming/types';
import type { PipelineResponse, UserContext } from '../types';
import { assembleResult } from './assembly';
import { bridgeV2ToV1 } from './bridge';
import { createChunkEmitContext, runCallTwo } from './call-two';
import { resolveModelProfile } from './config/model-profile';
import { handleError, nonFoodResponse } from './errors';
import {
  createGeminiEstimator,
  renderGeminiEstimatorPrompt,
} from './estimator/gemini-estimator';
import type { GroundedEstimator } from './estimator/types';
import { buildFastPathEstimation, isFullyGrounded } from './fast-path';
import { runGroundedDecomposition } from './grounded-decomposition';
import {
  buildCallTwoPayload,
  buildUnresolvedFromPlausibility,
  createCall2StreamHandler,
  flushUnstreamedItemMacros,
  runV2AnomalyPass,
  shouldEscalateV2,
  toPromptPersonalizationContext,
  withStageLogV2,
} from './grounded-support';
import { logV2Telemetry, persistV2PipelineRun } from './grounded-telemetry';
import { reconcileNutritionIds } from './nutrition';
import type { AnalyzeMealTraceContext } from './orchestrator';
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
  /**
   * Precise-mode clarify reply, threaded into the Call-1 decomposition user
   * message on a re-analysis (mirrors cheat mode's `clarifyAnswer`).
   */
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

    // ---- Stage 2: Match top-K per ingredient ----------------------------
    const flatIngredients = decomposition.mealItems.flatMap((mi) =>
      mi.ingredients.map((ing) => ({
        ingredient: ing,
        dishCookingMethod: mi.cookingMethod,
      }))
    );
    const matchResults: IngredientV2MatchResult[] = await withStageLogV2(
      traceContext,
      'matching',
      2,
      { ingredientCount: flatIngredients.length, topK },
      async (_ctx) => {
        emit({ type: 'stage', stage: 'matching' });
        return matchTopKPerIngredient(
          flatIngredients.map((f) => f.ingredient),
          flatIngredients.map((f) => f.dishCookingMethod),
          db,
          gemini,
          { k: topK, concurrency: matchConcurrency }
        );
      }
    );

    // Portion resolver (Phase 3): a grounded weight becomes a Call-2 ANCHOR;
    // null → LLM estimates; unresolved → Phase-1 clarify. See `resolver.ts`.
    const { resolutions: portionResolutions, anchors: resolvedGramsAnchors } =
      resolvePortionsForCallTwo(flatIngredients, userContext.inputLanguage);

    // ---- Stage 3: Call 2 — grounded estimation with item_macros stream --
    const mealItemsWithCandidates: MealItemWithCandidates[] =
      buildCallTwoPayload(decomposition, matchResults, resolvedGramsAnchors);
    // D2 fast path: when EVERY ingredient is fully grounded (exact-match +
    // server anchor, no prep notes), skip Call 2 and synthesize the estimation
    // server-side (numerically identical to the full path). Otherwise Call 2
    // runs against the Gemini estimator (D3 seam) — chunked for large meals.
    const fullyGrounded = isFullyGrounded({
      decomposition,
      matchResults,
      portionResolutions,
    });
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
    // Identity-based offset lookup (D4): Call 2 streams meal items in the
    // prompt's SORTED order, not decomposition order. `createCall2StreamHandler`
    // attributes each streamed item to its slice by name+occurrence.
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
      { ingredientCount: flatIngredients.length },
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
        return {
          bridged,
          ...assembleResult(
            bridged.decomposition,
            reconciled,
            bridged.matched,
            bridged.unmatched,
            userContext
          ),
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
      console.info('[v2-pipeline] escalation fired', {
        model: profile.escalationModel,
      });
    }

    logV2Telemetry({
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
    });

    // Persist a pipeline_runs row when tracing is enabled (best-effort, never
    // blocks; errors swallowed). Await in tests so assertions aren't racy.
    const persistPromise = persistV2PipelineRun({
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
        decompositionProviderRetryCount + Math.max(0, nutritionMaxAttempt - 1),
    });
    if (process.env.NODE_ENV === 'test') {
      await persistPromise;
    } else {
      void persistPromise;
    }

    // Completeness gate: if any ingredient's portion/match couldn't be
    // resolved, surface the most-impactful one so the route emits a precise
    // clarify event INSTEAD of persisting an under-weighted meal (Phase 1).
    const unresolved = buildUnresolvedFromPlausibility(bridged.plausibility);
    if (unresolved) {
      return { success: true, data: assembly.result, unresolved };
    }

    return { success: true, data: assembly.result };
  } catch (error) {
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
