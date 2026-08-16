/**
 * D1 — WHEN a meal chunks its Call 2, and HOW it is partitioned.
 *
 * Pure policy, no I/O: the thresholds, the gate, and the item-atomic packing.
 * `chunked-call2.ts` owns running the resulting chunks. Splitting the two keeps
 * the trip points readable next to the math that justifies them, and lets the
 * partition be tested without a provider.
 */

import type { MealItemWithCandidates } from '@/lib/ai/prompts/grounded-estimation';

/**
 * Chunk Call 2 only when the meal has MORE than this many ingredients total.
 * Rationale: the 28-dish timeout carried well over 60 ingredients; Call-2
 * latency scales with OUTPUT tokens, which scale with ingredient count. A
 * common meal (a bowl of phở, a plate of cơm) has < 15 ingredients and stays
 * on the single-call path with zero added latency. 24 keeps the vast majority
 * of real meals single-call while catching the pathological large ones with
 * headroom below the 60s budget.
 */
export const CHUNK_INGREDIENT_THRESHOLD = 24;

/**
 * OR chunk when the meal has more than this many meal ITEMS, even if each is
 * light — many items still means a long output stream. The staging timeout was
 * a 28-dish meal, so 12 items is a conservative trip point.
 */
export const CHUNK_MEAL_ITEM_THRESHOLD = 12;

/** Target max ingredients per chunk — keeps each sub-call's output bounded. */
export const CHUNK_TARGET_INGREDIENTS = 10;

/** Bounded concurrency across chunks. Small on purpose (provider rate limits). */
export const CHUNK_CONCURRENCY = 3;

/** Per-chunk phase-level retry cap (on top of the provider client's retries). */
export const CHUNK_MAX_ATTEMPTS = 2;

/**
 * Should this meal take the chunked Call-2 path? Conservative: only large
 * meals qualify, so a 2-ingredient meal is numerically + latency-wise
 * unchanged (it takes the single-call path).
 */
export function shouldChunkCall2(mealItems: MealItemWithCandidates[]): boolean {
  const ingredientCount = mealItems.reduce(
    (sum, mi) => sum + mi.ingredients.length,
    0
  );
  return (
    mealItems.length > CHUNK_MEAL_ITEM_THRESHOLD ||
    ingredientCount > CHUNK_INGREDIENT_THRESHOLD
  );
}

/**
 * Partition meal items into chunks, keeping each item's ingredients together
 * and never splitting an item. Greedy pack up to `CHUNK_TARGET_INGREDIENTS`
 * ingredients per chunk; a single item heavier than the target is its own
 * chunk (never split).
 */
export function chunkMealItems(
  mealItems: MealItemWithCandidates[],
  targetIngredients = CHUNK_TARGET_INGREDIENTS
): MealItemWithCandidates[][] {
  const chunks: MealItemWithCandidates[][] = [];
  let current: MealItemWithCandidates[] = [];
  let currentCount = 0;
  for (const mi of mealItems) {
    const n = mi.ingredients.length;
    if (current.length > 0 && currentCount + n > targetIngredients) {
      chunks.push(current);
      current = [];
      currentCount = 0;
    }
    current.push(mi);
    currentCount += n;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}
