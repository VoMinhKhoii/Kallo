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
import type { AppDb } from '@/lib/db';
import { capitalizeFirst } from '@/lib/utils';
import type { GeminiClient } from '../gemini';
import {
  type IngredientV2MatchResult,
  matchTopKPerIngredient,
} from '../matching/v2-cascade';
import { buildDecompositionV2Prompt } from '../prompts/decomposition-v2';
import {
  buildGroundedEstimationPrompt,
  type MealItemWithCandidates,
} from '../prompts/grounded-estimation';
import type { PromptPersonalizationContext } from '../prompts/types';
import { computeStreamingMealItem } from '../streaming/parsers';
import {
  buildPerMealItemOffsetMap,
  extractCompletedGroundedMealItems,
  resolveStreamingV2MealItem,
} from '../streaming/parsers-v2';
import type { StreamEvent } from '../streaming/types';
import type { PipelineResponse, UserContext } from '../types';
import { assembleResult } from './assembly';
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
import { bridgeV2ToV1 } from './v2-bridge';

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

  // v2 streams item_name events directly as the LLM emits meal item names
  // in partial JSON — no buffering. The decomposition v2 schema rejects
  // mealItems for non-food input, so the regex never matches anything to
  // leak (no buffer needed for that case). v1's buffer existed for the
  // language-guard retry path, which v2 doesn't have yet.
  const decompStream = createDecompositionStreamController({
    emit,
    prewarm: () => {},
  });

  let promptCharsCall1 = 0;
  let promptCharsCall2 = 0;

  try {
    // ---- Stage 1: Call 1 — pure decomposition with item_name streaming --
    emit({ type: 'stage', stage: 'decomposing' });
    const decompSystemPrompt = buildDecompositionV2Prompt(promptCtx);
    promptCharsCall1 = decompSystemPrompt.length + rawInput.length;
    const decomposition: MealDecompositionV2 =
      await gemini.generateStructuredOutputStream(
        {
          schema: mealDecompositionV2Schema,
          systemPrompt: decompSystemPrompt,
          userMessage: rawInput,
          model: profile.decompositionModel,
          temperature: 0.3,
          topP: 1,
          topK: 1,
        },
        { onChunk: (accumulated) => decompStream.handleChunk(accumulated) }
      );

    if (!decomposition.isFood || decomposition.mealItems.length === 0) {
      return nonFoodResponse();
    }

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
    emit({ type: 'stage', stage: 'matching' });
    const flatIngredients = decomposition.mealItems.flatMap((mi) =>
      mi.ingredients.map((ing) => ({
        ingredient: ing,
        dishCookingMethod: mi.cookingMethod,
      }))
    );
    const matchResults: IngredientV2MatchResult[] =
      await matchTopKPerIngredient(
        flatIngredients.map((f) => f.ingredient),
        flatIngredients.map((f) => f.dishCookingMethod),
        db,
        gemini,
        { k: topK, concurrency: matchConcurrency }
      );

    // ---- Stage 3: Call 2 — grounded estimation with item_macros stream --
    emit({ type: 'stage', stage: 'estimating' });
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
        const mealItemId =
          streamedMealItemIds.get(
            `${capitalizeFirst(rawItem.mealItemName)}::1`
          ) ??
          streamedMealItemIds.get(`${rawItem.mealItemName}::1`) ??
          streamItem.id;
        if (itemMacrosStreamed.has(mealItemId)) continue;
        itemMacrosStreamed.add(mealItemId);
        emit({ type: 'item_macros', mealItemId, item: streamItem });
      }
    };

    const grounded: GroundedEstimation =
      await gemini.generateStructuredOutputStream(
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
        { onChunk: handleCall2Chunk }
      );

    // ---- Stage 4: Bridge v2 → v1 shapes ---------------------------------
    emit({ type: 'stage', stage: 'assembling' });
    const bridged = bridgeV2ToV1({
      v2: decomposition,
      matches: matchResults,
      grounded,
      mealContext: rawInput,
      preMintedMealItemIds: streamedMealItemIds,
    });

    // ---- Stage 5: Reconcile macros + assemble ---------------------------
    const reconciled = reconcileNutritionIds(
      bridged.rawNutrition,
      bridged.decomposition,
      bridged.matched
    );
    const assembly = assembleResult(
      bridged.decomposition,
      reconciled,
      bridged.matched,
      bridged.unmatched,
      userContext
    );

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
    });

    // Persist a pipeline_runs row when request-level tracing is enabled,
    // mirroring v1's observability surface so admin/audit dashboards and
    // the shadow-runner pick up v2 requests too. Best-effort, never blocks.
    void persistV2PipelineRun({
      traceContext,
      userContext,
      profile,
      decomposition,
      matched: bridged.matched,
      unmatched: bridged.unmatched,
      verdicts: bridged.verdicts,
      totalMs: Date.now() - t0,
    });

    return { success: true, data: assembly.result };
  } catch (error) {
    return handleError(error);
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

/** Build the per-meal-item payload for the grounded-estimation prompt. */
function buildCallTwoPayload(
  decomposition: MealDecompositionV2,
  matchResults: IngredientV2MatchResult[]
): MealItemWithCandidates[] {
  let flatIdx = 0;
  return decomposition.mealItems.map((mi) => ({
    mealItem: mi,
    ingredients: mi.ingredients.map((ing) => {
      const matchResult = matchResults.find(
        (m) => m.ingredientIndex === flatIdx
      );
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
      retryCount: 0,
      languageGuardMisfire: false,
      languageRetryCount: 0,
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
