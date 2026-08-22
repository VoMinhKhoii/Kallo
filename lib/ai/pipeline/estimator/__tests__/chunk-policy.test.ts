import { describe, expect, it } from 'vitest';
import {
  CHUNK_INGREDIENT_THRESHOLD,
  CHUNK_MEAL_ITEM_THRESHOLD,
  CHUNK_TARGET_INGREDIENTS,
  chunkMealItems,
  shouldChunkCall2,
} from '../chunk-policy';
import { item, meal } from './fixtures/chunk-meals';

// ---------------------------------------------------------------------------
// shouldChunkCall2 — the gate (small meals must NOT chunk)
// ---------------------------------------------------------------------------

describe('shouldChunkCall2 — gate keeps small meals on the single-call path', () => {
  it('does NOT chunk a small common meal (2 items, 2 ingredients)', () => {
    expect(shouldChunkCall2(meal(2, 2))).toBe(false);
  });

  it('does NOT chunk right at both thresholds (boundary is exclusive)', () => {
    // Exactly CHUNK_MEAL_ITEM_THRESHOLD items, each 1 ingredient → below the
    // ingredient trip too.
    expect(shouldChunkCall2(meal(CHUNK_MEAL_ITEM_THRESHOLD, 1))).toBe(false);
    // Exactly CHUNK_INGREDIENT_THRESHOLD ingredients across few items.
    expect(shouldChunkCall2([item('big', CHUNK_INGREDIENT_THRESHOLD)])).toBe(
      false
    );
  });

  it('chunks when meal-item count exceeds the threshold (28-dish case)', () => {
    expect(shouldChunkCall2(meal(28, 1))).toBe(true);
    expect(shouldChunkCall2(meal(CHUNK_MEAL_ITEM_THRESHOLD + 1, 1))).toBe(true);
  });

  it('chunks when total ingredient count exceeds the threshold', () => {
    expect(
      shouldChunkCall2([item('big', CHUNK_INGREDIENT_THRESHOLD + 1)])
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// chunkMealItems — split by meal item, never split an item across chunks
// ---------------------------------------------------------------------------

describe('chunkMealItems — bounded chunks, item-atomic', () => {
  it('packs items greedily up to the target ingredient count', () => {
    const chunks = chunkMealItems(meal(10, 2), CHUNK_TARGET_INGREDIENTS);
    // 10 items × 2 ingredients = 20 ingredients; target 10 → 2 chunks of 5 items.
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(5);
    expect(chunks[1]).toHaveLength(5);
  });

  it('never splits an item heavier than the target across chunks', () => {
    const chunks = chunkMealItems(
      [item('huge', CHUNK_TARGET_INGREDIENTS + 5), item('small', 2)],
      CHUNK_TARGET_INGREDIENTS
    );
    // The oversized item is its own chunk; the small one follows separately.
    expect(chunks).toHaveLength(2);
    expect(chunks[0].map((c) => c.mealItem.name)).toEqual(['huge']);
    expect(chunks[1].map((c) => c.mealItem.name)).toEqual(['small']);
  });

  it('preserves original meal-item order across the partition', () => {
    const chunks = chunkMealItems(meal(9, 4), CHUNK_TARGET_INGREDIENTS);
    const flat = chunks.flat().map((c) => c.mealItem.name);
    expect(flat).toEqual(meal(9, 4).map((m) => m.mealItem.name));
  });
});
