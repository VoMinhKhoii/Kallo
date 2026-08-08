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
import type { VesselEnvelope } from '../portion/vessel-envelope';
import type { MealItemWithCandidates } from '../prompts/grounded-estimation';
import type { PromptPersonalizationContext } from '../prompts/types';
import {
  type buildPerMealItemOffsetMap,
  extractCompletedGroundedMealItems,
  type MealItemOffset,
  resolveStreamingV2MealItem,
} from '../streaming/grounded-parsers';
import { computeStreamingMealItem } from '../streaming/parsers';
import type { StreamEvent } from '../streaming/types';
import type {
  MatchedIngredient,
  PipelineResult,
  UnmatchedIngredient,
  UserContext,
} from '../types';
import {
  classifyV2Anomalies,
  summarizeV2Anomalies,
  type V2AnomalySummary,
} from './anomaly-v2';
import type { ModelProfile } from './config/model-profile';
import type { AnalyzeMealTraceContext } from './orchestrator';
import type { GroundedEstimation, MealDecompositionV2 } from './schemas-v2';
import { logStage } from './telemetry/trace';

/**
 * Env flag gating the v2 correctness-escalation re-run. Default OFF: the
 * escalation seam (re-run Call 2 on `profile.escalationModel` for a
 * high-confidence correctness anomaly) does NOT add latency until an operator
 * opts in. `stable` has `escalationModel: null` so escalation is impossible
 * there regardless of the flag; only `next` can escalate, and only when the
 * flag is on. Fire-count is always telemetered.
 */
export const V2_ESCALATION_FLAG_ENV = 'PIPELINE_V2_ESCALATION';

export function isV2EscalationEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  return env[V2_ESCALATION_FLAG_ENV] === 'on';
}

/**
 * Decide whether the gated escalation seam should fire for this run. Fires only
 * when ALL of: the flag is on, the profile carries a non-null escalationModel,
 * and the anomaly pass surfaced a high-confidence correctness anomaly. Pure so
 * the orchestrator's escalation decision is unit-testable without an LLM.
 */
export function shouldEscalateV2(args: {
  profile: Pick<ModelProfile, 'escalationModel'>;
  summary: Pick<V2AnomalySummary, 'hasEscalationCandidate'>;
  env?: Record<string, string | undefined>;
}): boolean {
  return (
    isV2EscalationEnabled(args.env) &&
    args.profile.escalationModel != null &&
    args.summary.hasEscalationCandidate
  );
}

/**
 * Run the v2 anomaly pass over the assembled result: classify each anomaly by
 * CAUSE, apply the SAFE actions' bookkeeping, and fold into telemetry counts +
 * markers. Best-effort observability — never throws into the pipeline. Returns
 * the summary the telemetry writer + escalation gate read.
 */
export function runV2AnomalyPass(args: {
  result: PipelineResult;
  matched: MatchedIngredient[];
  unmatched: UnmatchedIngredient[];
  decomposition: MealDecompositionV2;
}): V2AnomalySummary {
  const prepNoteIngredientNames = new Set<string>();
  for (const mi of args.decomposition.mealItems) {
    for (const ing of mi.ingredients) {
      const hasPrep = (ing.prepNotes ?? []).some(
        (n) => typeof n === 'string' && n.trim().length > 0
      );
      if (hasPrep) prepNoteIngredientNames.add(ing.rawName);
    }
  }
  const anomalies = classifyV2Anomalies({
    result: args.result,
    matched: args.matched,
    unmatched: args.unmatched,
    prepNoteIngredientNames,
  });
  const summary = summarizeV2Anomalies(anomalies);
  console.info('[v2-pipeline] anomalies', {
    causeCounts: summary.causeCounts,
    actionCounts: summary.actionCounts,
    escalationCandidate: summary.hasEscalationCandidate,
  });
  return summary;
}

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
 * Build the Call-2 streaming chunk handler. Extracted from the orchestrator so
 * the closure state (extraction cursor, per-name occurrence counters) and the
 * per-attempt reset live behind one testable factory.
 *
 * The handler resolves each streamed meal item to its decomposition slice by
 * IDENTITY (name + occurrence) via `offsetByName`, not by stream position (D4)
 * — Call 2 streams meal items in the prompt's SORTED order, which need not
 * equal decomposition order. `resetForRetry` clears the cursors before a
 * provider retry re-streams from scratch.
 */
export function createCall2StreamHandler(args: {
  offsetByName: Map<string, MealItemOffset>;
  matchResults: IngredientV2MatchResult[];
  streamedMealItemIds: Map<string, string>;
  itemMacrosStreamed: Set<string>;
  goal: UserContext['goal'];
  aggression: UserContext['aggression'];
  emit: (event: StreamEvent) => void;
}): { handleChunk: (accumulated: string) => void; resetForRetry: () => void } {
  const {
    offsetByName,
    matchResults,
    streamedMealItemIds,
    itemMacrosStreamed,
    goal,
    aggression,
    emit,
  } = args;
  const streamOffsetOcc = new Map<string, number>();
  const itemMacrosNameOcc = new Map<string, number>();
  let lastExtractedCount = 0;

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

  const handleChunk = (accumulated: string) => {
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
      const offKey = rawItem.mealItemName.trim().toLocaleLowerCase('vi-VN');
      const offOcc = (streamOffsetOcc.get(offKey) ?? 0) + 1;
      streamOffsetOcc.set(offKey, offOcc);
      const offset = offsetByName.get(`${offKey}::${offOcc}`);
      if (!offset) continue;

      const { nutrition, totalGrams } = resolveStreamingV2MealItem(
        rawItem,
        offset.decomposedIngredients,
        offset.dishCookingMethod,
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
      const mealItemId = resolveMealItemId(rawItem.mealItemName, streamItem.id);
      if (itemMacrosStreamed.has(mealItemId)) continue;
      itemMacrosStreamed.add(mealItemId);
      emit({ type: 'item_macros', mealItemId, item: streamItem });
    }
  };

  const resetForRetry = () => {
    lastExtractedCount = 0;
    itemMacrosNameOcc.clear();
    streamOffsetOcc.clear();
  };

  return { handleChunk, resetForRetry };
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
      offset.dishCookingMethod,
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
  matchResults: IngredientV2MatchResult[],
  /**
   * Server-resolved portion grams per flat ingredient (Phase 3). When present
   * and > 0, becomes the Call-2 ANCHOR so the LLM does not re-estimate weight.
   * Indexed in the same flat order as `matchResults`.
   */
  resolvedGramsByFlatIdx?: Array<number | null>,
  vesselEnvelopes?: Array<VesselEnvelope | null>
): MealItemWithCandidates[] {
  let flatIdx = 0;
  return decomposition.mealItems.map((mi, mealItemIndex) => ({
    mealItem: mi,
    vesselEnvelope: vesselEnvelopes?.[mealItemIndex] ?? null,
    ingredients: mi.ingredients.map((ing) => {
      const matchResult = matchResults[flatIdx];
      const anchor = resolvedGramsByFlatIdx?.[flatIdx] ?? null;
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
      return { ingredient: ing, candidates, resolvedGramsAnchor: anchor };
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
