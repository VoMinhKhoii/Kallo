import { describe, expect, it, vi } from 'vitest';
import type { MealItemWithCandidates } from '../../prompts/grounded-estimation';
import {
  CHUNK_INGREDIENT_THRESHOLD,
  CHUNK_MEAL_ITEM_THRESHOLD,
  CHUNK_TARGET_INGREDIENTS,
  chunkMealItems,
  runChunkedCall2,
  shouldChunkCall2,
} from '../estimator/chunked-call2';
import type {
  GroundedEstimator,
  GroundedEstimatorInput,
  GroundedEstimatorResult,
} from '../estimator/types';

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

/** A meal item with `ingredientCount` ingredients — grams anchors filled. */
function item(name: string, ingredientCount: number): MealItemWithCandidates {
  return {
    mealItem: {
      name,
      cookingMethod: 'luộc',
      ingredients: Array.from({ length: ingredientCount }, (_, i) => ({
        rawName: `${name}-ing${i + 1}`,
        canonicalName: `${name}-ing${i + 1}`,
      })),
    },
    ingredients: Array.from({ length: ingredientCount }, (_, i) => ({
      ingredient: {
        rawName: `${name}-ing${i + 1}`,
        canonicalName: `${name}-ing${i + 1}`,
      },
      candidates: [],
      resolvedGramsAnchor: 100,
    })),
  };
}

function meal(
  itemCount: number,
  ingredientsPerItem: number
): MealItemWithCandidates[] {
  return Array.from({ length: itemCount }, (_, i) =>
    item(`dish${i + 1}`, ingredientsPerItem)
  );
}

/**
 * A fake estimator echoing a grounded meal item per input meal item. `fail`
 * lets a test force a hard chunk failure; `delayMs` simulates latency for
 * deadline tests.
 */
function fakeEstimator(opts?: {
  failFor?: (mealItemName: string) => boolean;
  delayMs?: number;
  onCall?: (input: GroundedEstimatorInput) => void;
}): GroundedEstimator {
  return {
    id: 'fake',
    model: 'fake-model',
    async estimate(
      input: GroundedEstimatorInput
    ): Promise<GroundedEstimatorResult> {
      opts?.onCall?.(input);
      if (opts?.delayMs) {
        await new Promise((r) => setTimeout(r, opts.delayMs));
      }
      if (
        opts?.failFor &&
        input.mealItems.some((mi) => opts.failFor!(mi.mealItem.name))
      ) {
        throw new Error('forced chunk failure');
      }
      return {
        estimation: {
          mealItems: input.mealItems.map((mi) => ({
            mealItemName: mi.mealItem.name,
            ingredients: mi.ingredients.map((ing) => ({
              ingredientName: ing.ingredient.rawName,
              grams: 100,
              caloriesKcal: { low: 100, mid: 110, high: 120 },
              proteinG: { low: 10, mid: 11, high: 12 },
              carbohydrateG: { low: 5, mid: 6, high: 7 },
              fatG: { low: 1, mid: 1, high: 1 },
            })),
          })),
        },
      };
    },
  };
}

const baseArgs = {
  originalPrompt: 'x',
  userContext: {
    countryOfOrigin: 'Vietnam',
    countryOfResidence: 'Vietnam',
    inputLanguage: 'vi' as const,
    outputLanguage: 'vi' as const,
    cookingHabits: {
      oilUsage: 'normal' as const,
      defaultRicePortion: 'medium' as const,
      defaultProteinPortion: 'medium' as const,
      sugarBraised: 'medium' as const,
      brothConsumption: 'some' as const,
    },
  },
  temperature: 0.4,
  phaseDeadlineMs: 40_000,
};

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

// ---------------------------------------------------------------------------
// runChunkedCall2 — merge in original order; degrade a failed chunk
// ---------------------------------------------------------------------------

describe('runChunkedCall2 — deterministic merge + failure contract', () => {
  it('splits a large meal and merges results in ORIGINAL order regardless of completion order', async () => {
    // First chunk is slow, later chunks fast → completion order != input order.
    const estimator: GroundedEstimator = {
      id: 'ordered',
      model: 'm',
      async estimate(input) {
        // Delay proportional to the (reverse) chunk position so early chunks
        // finish last — proves the merge is by input order, not completion.
        const firstName = input.mealItems[0].mealItem.name;
        const idx = Number(firstName.replace('dish', ''));
        await new Promise((r) => setTimeout(r, (30 - idx) * 2));
        return {
          estimation: {
            mealItems: input.mealItems.map((mi) => ({
              mealItemName: mi.mealItem.name,
              ingredients: [
                {
                  ingredientName: mi.ingredients[0].ingredient.rawName,
                  grams: 100,
                  caloriesKcal: { low: 100, mid: 110, high: 120 },
                  proteinG: { low: 10, mid: 11, high: 12 },
                  carbohydrateG: { low: 5, mid: 6, high: 7 },
                  fatG: { low: 1, mid: 1, high: 1 },
                },
              ],
            })),
          },
        };
      },
    };
    const result = await runChunkedCall2({
      ...baseArgs,
      estimator,
      mealItems: meal(20, 2),
    });
    expect(result.chunkCount).toBeGreaterThan(1);
    expect(result.failedChunkCount).toBe(0);
    const names = result.estimation.mealItems.map((mi) => mi.mealItemName);
    expect(names).toEqual(meal(20, 2).map((m) => m.mealItem.name));
  });

  it('degrades a failed chunk to ABSENT items without failing the whole meal', async () => {
    // 28 items × 1 ingredient → chunks of CHUNK_TARGET_INGREDIENTS (10) items:
    // [dish1..dish10], [dish11..dish20], [dish21..dish28]. Failing the SECOND
    // chunk (dish15 lives there) drops exactly that chunk's items; the other
    // two chunks still return — a partial result, not a 500.
    const items = meal(28, 1);
    const chunks = chunkMealItems(items);
    const failingChunk = chunks[1].map((c) => c.mealItem.name);
    const survivingA = chunks[0].map((c) => c.mealItem.name);
    const survivingC = chunks[2].map((c) => c.mealItem.name);

    const result = await runChunkedCall2({
      ...baseArgs,
      estimator: fakeEstimator({ failFor: (n) => failingChunk.includes(n) }),
      mealItems: items,
    });
    expect(result.failedChunkCount).toBe(1);
    expect(result.failedMealItemNames).toEqual(failingChunk);
    const returned = result.estimation.mealItems.map((mi) => mi.mealItemName);
    // The failed chunk's items are absent (→ unresolved downstream)…
    for (const name of failingChunk) expect(returned).not.toContain(name);
    // …while the other chunks survive, in original order.
    for (const name of [...survivingA, ...survivingC]) {
      expect(returned).toContain(name);
    }
    expect(returned.length).toBe(28 - failingChunk.length);
  });

  it('retries a failing chunk up to the cap, then degrades', async () => {
    let attempts = 0;
    const flaky: GroundedEstimator = {
      id: 'flaky',
      model: 'm',
      async estimate() {
        attempts++;
        throw new Error('always fails');
      },
    };
    const result = await runChunkedCall2({
      ...baseArgs,
      estimator: flaky,
      mealItems: meal(28, 1),
      maxAttempts: 2,
    });
    // Every chunk failed after 2 attempts each → all items degraded.
    expect(result.failedChunkCount).toBe(result.chunkCount);
    expect(result.estimation.mealItems).toHaveLength(0);
    // 2 attempts per chunk.
    expect(attempts).toBe(result.chunkCount * 2);
  });

  it('stops retrying once the wall-clock phase deadline is spent', async () => {
    const started = Date.now();
    const result = await runChunkedCall2({
      ...baseArgs,
      // Each call sleeps past the whole deadline → first attempt of the first
      // scheduled chunk consumes it; later chunks see remaining<=0 and degrade
      // WITHOUT making a provider call.
      estimator: fakeEstimator({ delayMs: 60, failFor: () => true }),
      mealItems: meal(28, 1),
      phaseDeadlineMs: 40,
      concurrency: 1,
      maxAttempts: 2,
    });
    // We never exceed the deadline by more than a small margin (no unbounded
    // retry storm) — the whole phase returns quickly.
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(result.failedChunkCount).toBe(result.chunkCount);
  });

  it('emits onChunkComplete progressively as chunks land', async () => {
    const onChunkComplete = vi.fn();
    await runChunkedCall2({
      ...baseArgs,
      estimator: fakeEstimator(),
      mealItems: meal(20, 2),
      onChunkComplete,
    });
    // One callback per successful chunk.
    expect(onChunkComplete.mock.calls.length).toBeGreaterThan(1);
    // Each call receives that chunk's parsed grounded meal items.
    for (const call of onChunkComplete.mock.calls) {
      expect(Array.isArray(call[0])).toBe(true);
      expect(call[0].length).toBeGreaterThan(0);
    }
  });
});
