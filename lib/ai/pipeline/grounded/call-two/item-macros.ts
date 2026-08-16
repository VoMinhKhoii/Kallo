/**
 * Every `item_macros` emission path for Call 2.
 *
 * Call 2 produces per-meal-item macros through three different transports, and
 * each has to turn a raw `GroundedMealItem` into the same client event:
 *   - SINGLE CALL — `createCall2StreamHandler`, driven by the provider's
 *     incremental accumulated-text callback.
 *   - CHUNKED / FAST PATH — `emitChunkItemMacros`, driven by whole batches of
 *     already-parsed items.
 *   - FINAL FLUSH — `flushUnstreamedItemMacros`, for the tail the streaming
 *     regex could not confirm.
 *
 * All three resolve a streamed item to its decomposition slice by IDENTITY
 * (name + occurrence) rather than by stream position (D4), because Call 2
 * streams meal items in the prompt's SORTED order, which need not equal
 * decomposition order. They share the `itemMacrosStreamed` id set so no meal
 * item is ever emitted twice.
 */

import type { IngredientV2MatchResult } from '@/lib/ai/matching/retrieve/top-k-cascade';
import type {
  GroundedEstimation,
  GroundedMealItem,
} from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import {
  buildMealItemOffsetByName,
  extractCompletedGroundedMealItems,
  type MealItemOffset,
  resolveStreamingV2MealItem,
} from '@/lib/ai/streaming/grounded-parsers';
import { computeStreamingMealItem } from '@/lib/ai/streaming/parsers';
import type { StreamEvent } from '@/lib/ai/streaming/types';
import type { UserContext } from '@/lib/ai/types/user-context';
import { capitalizeFirst } from '@/lib/text/capitalize';

// ---------------------------------------------------------------------------
// Single-call streaming.
// ---------------------------------------------------------------------------

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
  offsetByName: Map<string, MealItemOffset>;
  goal: UserContext['goal'];
  aggression: UserContext['aggression'];
  emit: (event: StreamEvent) => void;
}): void {
  const {
    matchResults,
    grounded,
    streamedMealItemIds,
    alreadyStreamed,
    offsetByName,
    goal,
    aggression,
    emit,
  } = args;
  const offsetOccCounts = new Map<string, number>();
  const nameOccCounts = new Map<string, number>();
  grounded.mealItems.forEach((rawItem, itemIdx) => {
    const offsetKey = rawItem.mealItemName.trim().toLocaleLowerCase('vi-VN');
    const offsetOcc = (offsetOccCounts.get(offsetKey) ?? 0) + 1;
    offsetOccCounts.set(offsetKey, offsetOcc);
    const offset = offsetByName.get(`${offsetKey}::${offsetOcc}`);
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

// ---------------------------------------------------------------------------
// Progressive item_macros for the fast + chunked paths.
// ---------------------------------------------------------------------------

export interface ChunkEmitContext {
  offsetByName: Map<string, MealItemOffset>;
  matchResults: IngredientV2MatchResult[];
  streamedMealItemIds: Map<string, string>;
  itemMacrosStreamed: Set<string>;
  goal: UserContext['goal'];
  aggression: UserContext['aggression'];
  emit: (event: StreamEvent) => void;
  /** Per-name occurrence counters (persist across chunk deliveries). */
  offsetOcc: Map<string, number>;
  idOcc: Map<string, number>;
  itemIndex: { value: number };
}

/** Build a fresh emit context. Occurrence counters start empty. */
export function createChunkEmitContext(args: {
  mealItems: Array<{
    name: string;
    ingredients: unknown[];
    cookingMethod: string;
  }>;
  matchResults: IngredientV2MatchResult[];
  streamedMealItemIds: Map<string, string>;
  itemMacrosStreamed: Set<string>;
  goal: UserContext['goal'];
  aggression: UserContext['aggression'];
  emit: (event: StreamEvent) => void;
}): ChunkEmitContext {
  return {
    offsetByName: buildMealItemOffsetByName(
      args.mealItems as Array<{
        name: string;
        ingredients: never[];
        cookingMethod: string;
      }>
    ),
    matchResults: args.matchResults,
    streamedMealItemIds: args.streamedMealItemIds,
    itemMacrosStreamed: args.itemMacrosStreamed,
    goal: args.goal,
    aggression: args.aggression,
    emit: args.emit,
    offsetOcc: new Map(),
    idOcc: new Map(),
    itemIndex: { value: 0 },
  };
}

/**
 * Emit `item_macros` for a batch of already-parsed grounded meal items,
 * resolving each to its decomposition slice by IDENTITY (name + occurrence) —
 * the same D4 mapping the single-call stream handler uses. De-dupes via the
 * shared `itemMacrosStreamed` set so the orchestrator's final flush never
 * double-emits.
 */
export function emitChunkItemMacros(
  ctx: ChunkEmitContext,
  items: GroundedMealItem[]
): void {
  for (const rawItem of items) {
    const offKey = rawItem.mealItemName.trim().toLocaleLowerCase('vi-VN');
    const offOcc = (ctx.offsetOcc.get(offKey) ?? 0) + 1;
    ctx.offsetOcc.set(offKey, offOcc);
    const offset = ctx.offsetByName.get(`${offKey}::${offOcc}`);
    if (!offset) continue;

    const { nutrition, totalGrams } = resolveStreamingV2MealItem(
      rawItem,
      offset.decomposedIngredients,
      offset.dishCookingMethod,
      ctx.matchResults,
      offset.flatIngredientStart
    );
    const streamItem = computeStreamingMealItem(
      nutrition,
      totalGrams,
      ctx.itemIndex.value,
      ctx.goal,
      ctx.aggression
    );
    ctx.itemIndex.value++;
    streamItem.name = capitalizeFirst(streamItem.name);

    const cap = capitalizeFirst(rawItem.mealItemName);
    const occ = (ctx.idOcc.get(cap) ?? 0) + 1;
    ctx.idOcc.set(cap, occ);
    const mealItemId =
      ctx.streamedMealItemIds.get(`${cap}::${occ}`) ??
      ctx.streamedMealItemIds.get(`${rawItem.mealItemName}::${occ}`) ??
      streamItem.id;
    if (ctx.itemMacrosStreamed.has(mealItemId)) continue;
    ctx.itemMacrosStreamed.add(mealItemId);
    ctx.emit({ type: 'item_macros', mealItemId, item: streamItem });
  }
}
