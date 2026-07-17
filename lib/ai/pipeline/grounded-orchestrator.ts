import type { AppDb } from '@/lib/db';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { capitalizeFirst } from '@/lib/utils';
import type { GeminiClient } from '../gemini';
import {
  DEFAULT_K,
  DEFAULT_MATCH_CONCURRENCY,
  type IngredientV2MatchResult,
  matchTopKPerIngredient,
} from '../matching/top-k-cascade';
import {
  buildGroundedEstimationPrompt,
  type MealItemWithCandidates,
} from '../prompts/grounded-estimation';
import {
  buildPerMealItemOffsetMap,
  extractCompletedGroundedMealItems,
  resolveStreamingV2MealItem,
} from '../streaming/grounded-parsers';
import { computeStreamingMealItem } from '../streaming/parsers';
import type { StreamEvent } from '../streaming/types';
import type { PipelineResponse, UserContext } from '../types';
import { assembleResult } from './assembly';
import { bridgeV2ToV1 } from './bridge';
import { resolveModelProfile } from './config/model-profile';
import { NUTRITION_TIMEOUT_MS } from './config/stage-timeouts';
import { handleError, nonFoodResponse } from './errors';
import { runGroundedDecomposition } from './grounded-decomposition';
import {
  buildCallTwoPayload,
  flushUnstreamedItemMacros,
  toPromptPersonalizationContext,
  withStageLogV2,
} from './grounded-support';
import { logV2Telemetry, persistV2PipelineRun } from './grounded-telemetry';
import { reconcileNutritionIds } from './nutrition';
import type { AnalyzeMealTraceContext } from './orchestrator';
import {
  type GroundedEstimation,
  groundedEstimationSchema,
  type MealDecompositionV2,
} from './schemas-v2';
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
}

export interface V2PipelineDiagnostics {
  decomposition: MealDecompositionV2;
  matchResults: IngredientV2MatchResult[];
  verdicts: ReturnType<typeof bridgeV2ToV1>['verdicts'];
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
      gemini,
      traceContext,
      emit,
      promptCtx,
      profile,
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

    // ---- Stage 3: Call 2 — grounded estimation with item_macros stream --
    const mealItemsWithCandidates: MealItemWithCandidates[] =
      buildCallTwoPayload(decomposition, matchResults);
    const call2SystemPrompt = buildGroundedEstimationPrompt({
      originalPrompt: rawInput,
      mealItems: mealItemsWithCandidates,
      userContext: promptCtx,
    });
    promptCharsCall2 = call2SystemPrompt.length;

    const perItemOffsets = buildPerMealItemOffsetMap(decomposition.mealItems);
    const itemMacrosStreamed = new Set<string>();
    // Per-display-name occurrence counter shared by the chunk handler AND
    // the post-Call-2 flush so duplicate names ("Cơm trắng" × 2) resolve
    // to distinct mealItemIds (`::1`, `::2`, …) minted by Call 1's stream
    // controller. Without this, the second duplicate landed on `::1`,
    // collided in `itemMacrosStreamed`, and was silently skipped here —
    // only emerging via `flushUnstreamedItemMacros` at the end of Call 2.
    const itemMacrosNameOcc = new Map<string, number>();
    const resolveMealItemId = (rawName: string, fallbackId: string): string => {
      const cap = capitalizeFirst(rawName);
      const occ = (itemMacrosNameOcc.get(cap) ?? 0) + 1;
      itemMacrosNameOcc.set(cap, occ);
      return (
        streamedMealItemIds.get(`${cap}::${occ}`) ??
        streamedMealItemIds.get(`${rawName}::${occ}`) ??
        fallbackId
      );
    };
    let lastExtractedCount = 0;

    const handleCall2Chunk = (accumulated: string) => {
      const { items, newCount } = extractCompletedGroundedMealItems(
        accumulated,
        lastExtractedCount
      );
      if (items.length === 0) return;
      const indexBase = lastExtractedCount;
      lastExtractedCount = newCount;

      for (let i = 0; i < items.length; i++) {
        const itemIdx = indexBase + i;
        const rawItem = items[i];
        const offset = perItemOffsets[itemIdx];
        if (!offset) continue;

        const { nutrition, totalGrams } = resolveStreamingV2MealItem(
          rawItem,
          offset.decomposedIngredients,
          matchResults,
          offset.flatIngredientStart
        );
        const streamItem = computeStreamingMealItem(
          nutrition,
          totalGrams,
          itemIdx,
          userContext.goal,
          userContext.aggression
        );
        streamItem.name = capitalizeFirst(streamItem.name);
        const mealItemId = resolveMealItemId(
          rawItem.mealItemName,
          streamItem.id
        );
        if (itemMacrosStreamed.has(mealItemId)) continue;
        itemMacrosStreamed.add(mealItemId);
        emit({ type: 'item_macros', mealItemId, item: streamItem });
      }
    };

    let nutritionMaxAttempt = 0;
    const grounded: GroundedEstimation = await withStageLogV2(
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
      },
      async ({ stageLogId }) => {
        emit({ type: 'stage', stage: 'estimating' });
        const callTrace = buildLlmStageTrace({
          trace: traceContext,
          stageLogId,
          name: 'grounded-estimation',
          builder: buildGroundedEstimationPrompt as (...a: unknown[]) => string,
          templateSample: call2SystemPrompt,
          model: profile.nutritionModel,
        });
        return fetchWithTimeout(
          (signal) =>
            gemini.generateStructuredOutputStream(
              {
                schema: groundedEstimationSchema,
                systemPrompt: call2SystemPrompt,
                userMessage:
                  'Verify each candidate (CRAG verdict), estimate grams scoped to the selected candidate state, and emit bounded macros per the rules above.',
                model: profile.nutritionModel,
                temperature: call2Temperature,
                topP: 1,
                topK: 1,
                abortSignal: signal,
              },
              {
                onAttemptStart: (attempt) => {
                  nutritionMaxAttempt = Math.max(nutritionMaxAttempt, attempt);
                  if (attempt > 1) {
                    lastExtractedCount = 0;
                    itemMacrosNameOcc.clear();
                  }
                },
                onChunk: (accumulated) => {
                  nutritionChunkCount++;
                  handleCall2Chunk(accumulated);
                },
                ...(callTrace ? { trace: callTrace } : {}),
              }
            ),
          NUTRITION_TIMEOUT_MS,
          'grounded-nutrition'
        );
      }
    );

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
    });

    // Persist a pipeline_runs row when request-level tracing is enabled,
    // mirroring v1's observability surface so admin/audit dashboards and
    // the shadow-runner pick up v2 requests too. Best-effort, never blocks.
    // In tests, await persistence so assertions on pipeline_runs aren't racy.
    // In prod, fire-and-forget — pipeline_runs writes never block the
    // user-visible response. persistV2PipelineRun internally swallows errors
    // either way so the outer pipeline result is never affected.
    const persistPromise = persistV2PipelineRun({
      traceContext,
      userContext,
      profile,
      decomposition,
      matched: bridged.matched,
      unmatched: bridged.unmatched,
      verdicts: bridged.verdicts,
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
