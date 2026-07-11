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
import { capitalizeFirst } from '@/lib/utils';
import type { IngredientV2MatchResult } from '../matching/top-k-cascade';
import type { MealItemWithCandidates } from '../prompts/grounded-estimation';
import type { PromptPersonalizationContext } from '../prompts/types';
import {
  type buildPerMealItemOffsetMap,
  resolveStreamingV2MealItem,
} from '../streaming/grounded-parsers';
import { computeStreamingMealItem } from '../streaming/parsers';
import type { StreamEvent } from '../streaming/types';
import type { UserContext } from '../types';
import type { AnalyzeMealTraceContext } from './orchestrator';
import type { GroundedEstimation, MealDecompositionV2 } from './schemas';
import { logStage } from './telemetry/trace';

export async function withStageLogV2<T>(
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
export function flushUnstreamedItemMacros(args: {
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
export function buildCallTwoPayload(
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
