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
 * rather than by stream position (D4), because Call 2 streams meal items in the
 * prompt's SORTED order, which need not equal decomposition order. Identity is
 * the dish slot the final pairing uses (`createDishSlots`): a dish Call 2 split
 * into several same-name items gathers every fragment, and its event is
 * re-emitted with the running total (clients upsert `item_macros` by id); any
 * other meal item is emitted once, de-duplicated through `itemMacrosStreamed`.
 */

import type { IngredientV2MatchResult } from '@/lib/ai/matching/candidate';
import type {
  GroundedEstimation,
  GroundedMealItem,
} from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import {
  createDishSlots,
  type DishSlot,
} from '@/lib/ai/pipeline/resolve/dish-slots';
import {
  buildMealItemOffsetByName,
  extractCompletedGroundedMealItems,
  type MealItemOffset,
  type MealItemRange,
  resolveStreamingV2MealItem,
} from '@/lib/ai/streaming/grounded-parsers';
import { computeStreamingMealItem } from '@/lib/ai/streaming/parsers';
import type { StreamEvent } from '@/lib/ai/streaming/types';
import type { UserContext } from '@/lib/ai/types/user-context';
import { capitalizeFirst } from '@/lib/core/text/capitalize';

// ---------------------------------------------------------------------------
// Shared: dish identity and one emission.
// ---------------------------------------------------------------------------

interface DishMatch {
  slot: DishSlot;
  offset: MealItemOffset;
  /** The streamed item, or every fragment so far for a split (pooled) dish. */
  item: GroundedMealItem;
  /** How many Call 2 items `item` merges; above 1 only for a split dish. */
  fragments: number;
  /** Stream index of the dish's first item, so a split dish keeps one fallback id. */
  index: number;
}

/**
 * Resolve Call 2 meal items to decomposition dishes, merging the fragments of
 * a dish Call 2 split into same-name items. One matcher per pass over Call 2's
 * output; `reset` starts a new pass (a provider retry re-streams).
 */
function createDishMatcher(offsetByName: Map<string, MealItemOffset>) {
  const dishNames = [...offsetByName.keys()].map((k) =>
    k.slice(0, k.lastIndexOf('::'))
  );
  let slotOf = createDishSlots(dishNames);
  const fragments = new Map<
    string,
    { item: GroundedMealItem; count: number; index: number }
  >();
  return {
    match(rawItem: GroundedMealItem, index: number): DishMatch | null {
      const slot = slotOf(rawItem.mealItemName);
      const offset = offsetByName.get(`${slot.key}::${slot.occ}`);
      if (!offset) return null;
      if (!slot.pooled)
        return { slot, offset, item: rawItem, fragments: 1, index };
      const prev = fragments.get(slot.key);
      const merged = prev
        ? {
            item: {
              ...rawItem,
              ingredients: [...prev.item.ingredients, ...rawItem.ingredients],
            },
            count: prev.count + 1,
            index: prev.index,
          }
        : { item: rawItem, count: 1, index };
      fragments.set(slot.key, merged);
      return {
        slot,
        offset,
        item: merged.item,
        fragments: merged.count,
        index: merged.index,
      };
    },
    reset() {
      slotOf = createDishSlots(dishNames);
      fragments.clear();
    },
  };
}

interface EmitTarget {
  matchResults: IngredientV2MatchResult[];
  streamedMealItemIds: Map<string, string>;
  itemMacrosStreamed: Set<string>;
  goal: UserContext['goal'];
  aggression: UserContext['aggression'];
  emit: (event: StreamEvent) => void;
}

/**
 * Resolve one matched dish and emit its `item_macros`: once per dish, except
 * that a split dish is re-emitted as each fragment grows its total.
 */
function emitDish(target: EmitTarget, match: DishMatch): void {
  const { nutrition, totalGrams } = resolveStreamingV2MealItem(
    match.item,
    match.offset.decomposedIngredients,
    match.offset.dishCookingMethod,
    target.matchResults,
    match.offset.flatIngredientStart
  );
  const streamItem = computeStreamingMealItem(
    nutrition,
    totalGrams,
    match.index,
    target.goal,
    target.aggression
  );
  streamItem.name = capitalizeFirst(streamItem.name);
  const mealItemId =
    target.streamedMealItemIds.get(match.offset.announcedKey) ?? streamItem.id;
  if (match.fragments === 1 && target.itemMacrosStreamed.has(mealItemId))
    return;
  target.itemMacrosStreamed.add(mealItemId);
  target.emit({ type: 'item_macros', mealItemId, item: streamItem });
}

// ---------------------------------------------------------------------------
// Single-call streaming.
// ---------------------------------------------------------------------------

/**
 * Build the Call-2 streaming chunk handler. Extracted from the orchestrator so
 * the closure state (extraction cursor, dish matcher) and the per-attempt reset
 * live behind one testable factory. `resetForRetry` clears the state before a
 * provider retry re-streams from scratch.
 */
export function createCall2StreamHandler(
  args: EmitTarget & { offsetByName: Map<string, MealItemOffset> }
): { handleChunk: (accumulated: string) => void; resetForRetry: () => void } {
  const dishes = createDishMatcher(args.offsetByName);
  let lastExtractedCount = 0;

  const handleChunk = (accumulated: string) => {
    const { items, newCount } = extractCompletedGroundedMealItems(
      accumulated,
      lastExtractedCount
    );
    if (items.length === 0) return;
    const indexBase = lastExtractedCount;
    lastExtractedCount = newCount;
    items.forEach((rawItem, i) => {
      const match = dishes.match(rawItem, indexBase + i);
      if (match) emitDish(args, match);
    });
  };

  const resetForRetry = () => {
    lastExtractedCount = 0;
    dishes.reset();
  };

  return { handleChunk, resetForRetry };
}

/**
 * Emit `item_macros` for any meal items the streaming parser missed. Happens
 * when the final meal item's JSON has no trailing `{"mealItemName":` marker
 * (the regex needs a NEXT marker to confirm completion). Re-uses the same
 * resolver so the late events match the streamed ones byte-for-byte. A split
 * dish is emitted once more with all its fragments, so its last fragment is
 * never lost to the regex.
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
  const target: EmitTarget = {
    ...args,
    itemMacrosStreamed: args.alreadyStreamed,
  };
  const dishes = createDishMatcher(args.offsetByName);
  const pooled = new Map<string, DishMatch>();
  args.grounded.mealItems.forEach((rawItem, itemIdx) => {
    const match = dishes.match(rawItem, itemIdx);
    if (!match) return;
    if (match.slot.pooled) pooled.set(match.slot.key, match);
    else emitDish(target, match);
  });
  // A pooled dish emits after the walk, with every fragment merged.
  for (const match of pooled.values()) emitDish(target, match);
}

// ---------------------------------------------------------------------------
// Progressive item_macros for the fast + chunked paths.
// ---------------------------------------------------------------------------

type OffsetMealItems = Parameters<typeof buildMealItemOffsetByName>[0];

export interface ChunkEmitContext extends EmitTarget {
  /** The decomposition's dishes; each delivery matches against its own range. */
  mealItems: OffsetMealItems;
  itemIndex: { value: number };
}

/** Build a fresh emit context. */
export function createChunkEmitContext(
  args: EmitTarget & {
    mealItems: Array<{
      name: string;
      ingredients: unknown[];
      cookingMethod: string;
    }>;
  }
): ChunkEmitContext {
  return {
    ...args,
    mealItems: args.mealItems as OffsetMealItems,
    itemIndex: { value: 0 },
  };
}

/**
 * Emit `item_macros` for a batch of already-parsed grounded meal items through
 * the same dish identity the single-call stream handler uses. A Call 2 chunk
 * passes its dish range: chunks finish in any order, so its items are matched
 * only against its own dishes, never by a count shared across chunks. De-dupes
 * via the shared `itemMacrosStreamed` set so the orchestrator's final flush
 * never double-emits a whole dish.
 */
export function emitChunkItemMacros(
  ctx: ChunkEmitContext,
  items: GroundedMealItem[],
  range?: MealItemRange
): void {
  const dishes = createDishMatcher(
    buildMealItemOffsetByName(ctx.mealItems, range)
  );
  for (const rawItem of items) {
    const match = dishes.match(rawItem, ctx.itemIndex.value);
    if (!match) continue;
    emitDish(ctx, match);
    ctx.itemIndex.value++;
  }
}
