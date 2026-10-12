/**
 * D1 — WHEN a meal chunks its Call 2, and HOW it is partitioned.
 *
 * Pure policy, no I/O: the thresholds, the gate, and the item-atomic packing.
 * `chunked-call2.ts` owns running the resulting chunks. Splitting the two keeps
 * the trip points readable next to the math that justifies them, and lets the
 * partition be tested without a provider.
 */

import type { MealItemWithCandidates } from '@/lib/ai/prompts/build/grounded-candidates';

/**
 * Call 2's time is mostly output, on Gemini and Claude alike, so a meal over
 * 10 ingredients (or 12 meal items) is split into calls of up to 8 that run
 * side by side: a 26-ingredient meal measured ~10.5 s → ~5.5 s on Haiku; a
 * single 2,100-token Gemini Call 2 took 16 s. Six at once keeps an
 * 18-ingredient meal in one wave. A common meal under the thresholds stays on
 * the single-call path with zero added latency.
 *
 * Chunk Call 2 when the meal has MORE than this many ingredients total...
 */
export const CHUNK_INGREDIENT_THRESHOLD = 10;

/** ...or more than this many meal ITEMS, even if each is light. */
export const CHUNK_MEAL_ITEM_THRESHOLD = 12;

/** Target max ingredients per chunk — keeps each sub-call's output bounded. */
export const CHUNK_TARGET_INGREDIENTS = 8;

/** Chunks in flight at once. */
export const CHUNK_CONCURRENCY = 6;

/** Per-chunk phase-level retry cap (on top of the provider client's retries). */
export const CHUNK_MAX_ATTEMPTS = 2;

/**
 * Should this meal take the chunked Call-2 path? A meal under both thresholds
 * (a 2-ingredient meal) is numerically + latency-wise unchanged: it takes the
 * single-call path.
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
