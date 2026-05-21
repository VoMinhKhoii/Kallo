/**
 * V2 orchestrator — pure-decompose Call 1 + CRAG-grounded Call 2.
 *
 * Pipeline:
 *   1. Call 1 (decomposition-v2): LLM emits ingredient names + state/prep
 *      hints. NO grams.
 *   2. Match: top-K candidates per ingredient via v2-cascade.
 *   3. Call 2 (grounded-estimation): LLM picks a candidate (CRAG verdict),
 *      emits grams scoped to the selected candidate's state, and bounded
 *      macros.
 *   4. Bridge: v2 outputs → v1-shape inputs.
 *   5. Resolve macros + assemble result via existing v1 infrastructure.
 *
 * Deliberately minimal in this chunk:
 *   - No streaming (returns full PipelineResponse; SSE preserved at the v1
 *     dispatch layer where Call 1 streaming was wired).
 *   - No L4 decomposition cache (v1 cache key includes the v1 schema hash;
 *     v2 cache lives in a follow-up).
 *   - No anomaly retry, no language guard (both can be layered on later).
 *   - No shadow runner (shadow-runner.ts compares two v1 calls; v2-shadow
 *     comparison is a separate file).
 */
import { randomUUID } from 'node:crypto';
import type { AppDb } from '@/lib/db';
import { capitalizeFirst } from '@/lib/utils';
import type { GeminiClient } from '../gemini';
import {
  buildLanguageCorrectionMessage,
  checkDecompositionLanguage,
} from '../language/guard';
import {
  type IngredientV2MatchResult,
  matchTopKPerIngredient,
} from '../matching/top-k-cascade';
import { buildDecompositionV2Prompt } from '../prompts/decomposition-v2';
import {
  buildGroundedEstimationPrompt,
  type MealItemWithCandidates,
} from '../prompts/grounded-estimation';
import type { PromptPersonalizationContext } from '../prompts/types';
import {
  buildPerMealItemOffsetMap,
  extractCompletedGroundedMealItems,
  resolveStreamingV2MealItem,
} from '../streaming/grounded-parsers';
import { computeStreamingMealItem } from '../streaming/parsers';
import type { StreamEvent } from '../streaming/types';
import type {
  MealDecomposition,
  PipelineResponse,
  UserContext,
} from '../types';
import { assembleResult } from './assembly';
import { bridgeV2ToV1 } from './bridge';
import { createDecompositionStreamController } from './decomposition-stream';
import { handleError, nonFoodResponse } from './errors';
import { resolveModelProfile } from './model-profile';
import { reconcileNutritionIds } from './nutrition';
import type { AnalyzeMealTraceContext } from './orchestrator';
import { buildPipelineRunRow, writePipelineRun } from './run-telemetry';
import {
  type GroundedEstimation,
  groundedEstimationSchema,
  type MealDecompositionV2,
  mealDecompositionV2Schema,
} from './schemas';
import { buildLlmStageTrace, logStage } from './trace';

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
  const topK = options.topK ?? 3;
  const matchConcurrency = options.matchConcurrency ?? 4;
  const call2Temperature = options.call2Temperature ?? 0.4;
  const traceContext = options.traceContext;
  const profile = resolveModelProfile();
  const promptCtx = toPromptPersonalizationContext(userContext);
  const t0 = Date.now();

  // Buffer item_name events until the language guard passes — same pattern
  // as v1 (orchestrator.ts:573-589). Without this, a language-mismatch
  // retry would leak attempt-1's names to the client, and the client's
  // useStreamAnalysis appends item_name events without dedupe → visible
  // duplicate skeleton rows and React key-collision warnings.
  const bufferedItemNameEvents: Array<
    Extract<StreamEvent, { type: 'item_name' }>
  > = [];
  const itemNameBufferingEmit = (event: StreamEvent) => {
    if (event.type === 'item_name') {
      bufferedItemNameEvents.push(event);
      return;
    }
    emit(event);
  };
  const flushBufferedItemNames = () => {
    for (const ev of bufferedItemNameEvents) emit(ev);
    bufferedItemNameEvents.length = 0;
  };
  let decompStream = createDecompositionStreamController({
    emit: itemNameBufferingEmit,
    prewarm: () => {},
  });
  const recreateDecompStream = () => {
    bufferedItemNameEvents.length = 0;
    decompStream = createDecompositionStreamController({
      emit: itemNameBufferingEmit,
      prewarm: () => {},
    });
  };

  let promptCharsCall1 = 0;
  let promptCharsCall2 = 0;
  let decomposeChunkCount = 0;
  let nutritionChunkCount = 0;
  let languageRetryCount = 0;

  try {
    // ---- Stage 1: Call 1 — pure decomposition with item_name streaming --
    const decompSystemPrompt = buildDecompositionV2Prompt(promptCtx);
    promptCharsCall1 = decompSystemPrompt.length + rawInput.length;

    const runDecompositionAttempt = async (
      userMessage: string,
      stageLogId: string
    ): Promise<MealDecompositionV2> => {
      const callTrace = buildLlmStageTrace({
        trace: traceContext,
        stageLogId,
        name: 'decomposition-grounded',
        builder: buildDecompositionV2Prompt as (...a: unknown[]) => string,
        templateSample: decompSystemPrompt,
        model: profile.decompositionModel,
      });
      return gemini.generateStructuredOutputStream(
        {
          schema: mealDecompositionV2Schema,
          systemPrompt: decompSystemPrompt,
          userMessage,
          model: profile.decompositionModel,
          temperature: 0.3,
          topP: 1,
          topK: 1,
        },
        {
          onChunk: (accumulated) => {
            decomposeChunkCount++;
            decompStream.handleChunk(accumulated);
          },
          ...(callTrace ? { trace: callTrace } : {}),
        }
      );
    };

    let decomposition: MealDecompositionV2 = await withStageLogV2(
      traceContext,
      'decomposition',
      1,
      { rawInputLength: rawInput.length, model: profile.decompositionModel },
      ({ stageLogId }) => {
        emit({ type: 'stage', stage: 'decomposing' });
        return runDecompositionAttempt(rawInput, stageLogId);
      }
    );

    // Language guard — mirrors v1 (orchestrator.ts:716-754). Retries once
    // when the LLM emits Vietnamese for an English user (or vice versa).
    // Recreate the stream controller (NOT just resetAttempt) so the failed
    // attempt's mealItemIds + buffered events are fully discarded.
    let languageGuard = checkDecompositionLanguage(
      decomposition as unknown as MealDecomposition,
      userContext
    );
    if (!languageGuard.ok) {
      console.warn('[v2-pipeline] decomposition language mismatch; retrying', {
        expected: userContext.outputLanguage,
        actual: languageGuard.reason,
      });
      languageRetryCount += 1;
      recreateDecompStream();
      // Reset the telemetry probes so "decomposeChunkCount" reflects the
      // final (post-retry) attempt only.
      decomposeChunkCount = 0;
      decomposition = await withStageLogV2(
        traceContext,
        'decomposition',
        1,
        {
          rawInputLength: rawInput.length,
          model: profile.decompositionModel,
          languageRetry: true,
        },
        ({ stageLogId }) =>
          runDecompositionAttempt(
            buildLanguageCorrectionMessage(rawInput, userContext),
            stageLogId
          )
      );
      languageGuard = checkDecompositionLanguage(
        decomposition as unknown as MealDecomposition,
        userContext
      );
      if (!languageGuard.ok) {
        console.warn(
          '[v2-pipeline] decomposition language mismatch remained after retry',
          { expected: userContext.outputLanguage, actual: languageGuard.reason }
        );
      }
    }

    if (!decomposition.isFood || decomposition.mealItems.length === 0) {
      // Discard buffered item_name events — non-food input has no UI to update.
      bufferedItemNameEvents.length = 0;
      return nonFoodResponse();
    }

    // Language guard passed — release buffered item_name events to the client.
    flushBufferedItemNames();

    // Capitalize meal-item and ingredient display names in place — same
    // pattern v1 uses (orchestrator.ts:785-788) so the UI always shows
    // titlecase regardless of how the user typed the input.
    for (const mi of decomposition.mealItems) {
      mi.name = capitalizeFirst(mi.name);
      for (const ing of mi.ingredients) {
        ing.rawName = capitalizeFirst(ing.rawName);
        ing.canonicalName = capitalizeFirst(ing.canonicalName);
      }
    }

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

    const streamedMealItemIds = decompStream.getStreamedMealItemIds();
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
        return gemini.generateStructuredOutputStream(
          {
            schema: groundedEstimationSchema,
            systemPrompt: call2SystemPrompt,
            userMessage:
              'Verify each candidate (CRAG verdict), estimate grams scoped to the selected candidate state, and emit bounded macros per the rules above.',
            model: profile.nutritionModel,
            temperature: call2Temperature,
            topP: 1,
            topK: 1,
          },
          {
            onChunk: (accumulated) => {
              nutritionChunkCount++;
              handleCall2Chunk(accumulated);
            },
            ...(callTrace ? { trace: callTrace } : {}),
          }
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
async function withStageLogV2<T>(
  trace: AnalyzeMealTraceContext | undefined,
  stage: 'decomposition' | 'matching' | 'nutrition' | 'assembly',
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

/**
 * Emit `item_macros` for any meal items the streaming parser missed. Happens
 * when the final meal item's JSON has no trailing `{"mealItemName":` marker
 * (the regex needs a NEXT marker to confirm completion). Re-uses the same
 * resolver so the late events match the streamed ones byte-for-byte.
 */
function flushUnstreamedItemMacros(args: {
  matchResults: IngredientV2MatchResult[];
  grounded: GroundedEstimation;
  streamedMealItemIds: Map<string, string>;
  alreadyStreamed: Set<string>;
  perItemOffsets: ReturnType<typeof buildPerMealItemOffsetMap>;
  goal: UserContext['goal'];
  aggression: UserContext['aggression'];
  emit: (event: StreamEvent) => void;
}): void {
  const {
    matchResults,
    grounded,
    streamedMealItemIds,
    alreadyStreamed,
    perItemOffsets,
    goal,
    aggression,
    emit,
  } = args;
  const nameOccCounts = new Map<string, number>();
  grounded.mealItems.forEach((rawItem, itemIdx) => {
    const offset = perItemOffsets[itemIdx];
    if (!offset) return;
    const cap = capitalizeFirst(rawItem.mealItemName);
    const occ = (nameOccCounts.get(cap) ?? 0) + 1;
    nameOccCounts.set(cap, occ);
    const mealItemId =
      streamedMealItemIds.get(`${cap}::${occ}`) ??
      streamedMealItemIds.get(`${rawItem.mealItemName}::${occ}`) ??
      `item-${itemIdx + 1}`;
    if (alreadyStreamed.has(mealItemId)) return;

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
      goal,
      aggression
    );
    streamItem.name = capitalizeFirst(streamItem.name);
    emit({ type: 'item_macros', mealItemId, item: streamItem });
  });
}

/** Build the per-meal-item payload for the grounded-estimation prompt.
 *
 * `matchResults` is built in flat-ingredient order by `matchTopKPerIngredient`
 * (one entry per ingredient with `ingredientIndex === position`), so direct
 * indexing is correct and avoids an O(N²) scan.
 */
function buildCallTwoPayload(
  decomposition: MealDecompositionV2,
  matchResults: IngredientV2MatchResult[]
): MealItemWithCandidates[] {
  let flatIdx = 0;
  return decomposition.mealItems.map((mi) => ({
    mealItem: mi,
    ingredients: mi.ingredients.map((ing) => {
      const matchResult = matchResults[flatIdx];
      flatIdx++;
      const candidates = (matchResult?.candidates ?? []).map((c, i) => ({
        id: `c${i + 1}`,
        similarity: c.info.similarity,
        dbName: c.info.matchedName,
        dbState: c.info.state,
        source: c.info.source ?? ('fao' as const),
        per100gKcal: c.nutrition?.caloriesKcal ?? null,
        per100gProteinG: c.nutrition?.proteinG ?? null,
        per100gCarbohydrateG: c.nutrition?.carbohydrateG ?? null,
        per100gFatG: c.nutrition?.fatG ?? null,
        inediblePct: c.inediblePct,
      }));
      return { ingredient: ing, candidates };
    }),
  }));
}

function toPromptPersonalizationContext(
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

interface V2TelemetryInput {
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

function logV2Telemetry(input: V2TelemetryInput): void {
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
async function persistV2PipelineRun(args: {
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
