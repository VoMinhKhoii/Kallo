import { describe, expect, it } from 'vitest';
import { NULL_NUTRITION_VALUES } from '@/lib/ai/__fixtures__/test-helpers';
import type { IngredientV2MatchResult } from '@/lib/ai/matching/retrieve/top-k-cascade';
import type { MealDecompositionV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type { GroundedEstimation } from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import {
  createCall2StreamHandler,
  flushUnstreamedItemMacros,
} from '@/lib/ai/pipeline/grounded/call-two/item-macros';
import { buildMealItemOffsetByName } from '@/lib/ai/streaming/grounded-parsers';
import type { StreamEvent } from '@/lib/ai/streaming/types';

// ---------------------------------------------------------------------------
// D4: streamed item_macros events must map back to meal items by IDENTITY
// (mealItemName + occurrence), not by array position — because Call 2 streams
// meal items in the prompt's SORTED order, which need not equal decomposition
// order.
// ---------------------------------------------------------------------------

// Decomposition order: [Cá kho (fatty), Rau luộc (lean)]. Distinct candidates
// with very different densities so a mis-mapped slice produces the WRONG macros.
function decomposition(): MealDecompositionV2 {
  return {
    isFood: true,
    mealSlot: 'lunch',
    mealItems: [
      {
        name: 'Cá kho',
        cookingMethod: 'kho',
        ingredients: [{ rawName: 'cá', canonicalName: 'Cá' }],
      },
      {
        name: 'Rau luộc',
        cookingMethod: 'luộc',
        ingredients: [{ rawName: 'rau', canonicalName: 'Rau' }],
      },
    ],
  };
}

// matchResults in FLAT decomposition order: idx0 = cá (200 kcal/100g row),
// idx1 = rau (20 kcal/100g row).
function matchResults(): IngredientV2MatchResult[] {
  return [
    {
      ingredientIndex: 0,
      candidates: [
        {
          info: {
            ingredientName: 'cá',
            foodCompositionId: 'fc-fish',
            matchedName: 'Cá',
            similarity: 0.9,
            confidence: 'high',
            state: 'cooked',
            source: 'fao',
            matchType: 'vector',
          },
          nutrition: {
            ...NULL_NUTRITION_VALUES,
            caloriesKcal: 200,
            proteinG: 20,
            carbohydrateG: 0,
            fatG: 12,
          },
          inediblePct: null,
        },
      ],
    },
    {
      ingredientIndex: 1,
      candidates: [
        {
          info: {
            ingredientName: 'rau',
            foodCompositionId: 'fc-veg',
            matchedName: 'Rau',
            similarity: 0.9,
            confidence: 'high',
            state: 'cooked',
            source: 'fao',
            matchType: 'vector',
          },
          nutrition: {
            ...NULL_NUTRITION_VALUES,
            caloriesKcal: 20,
            proteinG: 2,
            carbohydrateG: 3,
            fatG: 0.2,
          },
          inediblePct: null,
        },
      ],
    },
  ];
}

/** A single meal item with only the fields Call 2 emits (D3 slim). */
function groundedItem(
  name: string,
  ingName: string
): GroundedEstimation['mealItems'][number] {
  return {
    mealItemName: name,
    ingredients: [
      {
        ingredientName: ingName,
        selectedCandidateId: 'c1',
        grossG: 100,
        refusePct: 0,
        proteinG: { low: 1, mid: 2, high: 3 },
        carbohydrateG: { low: 1, mid: 2, high: 3 },
        fatG: { low: 10, mid: 12, high: 14 },
      },
    ],
  };
}

function streamedItem(name: string, ingName: string): string {
  return JSON.stringify(groundedItem(name, ingName));
}

function collect(): {
  emit: (e: StreamEvent) => void;
  events: Array<{ mealItemId: string; name: string; calories: number }>;
} {
  const events: Array<{ mealItemId: string; name: string; calories: number }> =
    [];
  const emit = (e: StreamEvent) => {
    if (e.type === 'item_macros') {
      events.push({
        mealItemId: e.mealItemId,
        name: e.item.name,
        calories: e.item.macros.calories,
      });
    }
  };
  return { emit, events };
}

describe('createCall2StreamHandler — identity-based mapping (D4)', () => {
  it('attributes macros to the correct meal item when Call 2 streams in SORTED (reversed) order', () => {
    const { emit, events } = collect();
    const offsetByName = buildMealItemOffsetByName(decomposition().mealItems);
    const handler = createCall2StreamHandler({
      offsetByName,
      matchResults: matchResults(),
      streamedMealItemIds: new Map(),
      itemMacrosStreamed: new Set(),
      goal: 'maintaining',
      aggression: 0,
      emit,
    });

    // Call 2 emits meal items in SORTED order: "Rau luộc" (R < C in vi collation
    // is not guaranteed, but the point is stream order ≠ decomp order) BEFORE
    // "Cá kho" — the reverse of the decomposition order. The parser needs a
    // NEXT `{"mealItemName":` marker to consider a preceding item "complete",
    // so we feed both items then a trailing sentinel.
    const rau = streamedItem('Rau luộc', 'rau');
    const ca = streamedItem('Cá kho', 'cá');
    const accumulated = `{"mealItems":[${rau},${ca},{"mealItemName":"__end__","ingredients":[]}]}`;
    handler.handleChunk(accumulated);

    // Both real items streamed.
    const byName = new Map(events.map((e) => [e.name, e]));
    expect(byName.has('Rau luộc')).toBe(true);
    expect(byName.has('Cá kho')).toBe(true);

    // The CORE assertion: "Cá kho" carries the FISH macros (kcal ≈ derived from
    // 20P/0C/12F ~ 188), and "Rau luộc" carries the LEAN VEG macros (~29), NOT
    // swapped. Positional mapping (the old bug) would attach the fish slice to
    // stream position 0 = "Rau luộc" and vice-versa.
    expect(byName.get('Cá kho')!.calories).toBeGreaterThan(120);
    expect(byName.get('Rau luộc')!.calories).toBeLessThan(80);
  });

  it('handles duplicate meal-item names by occurrence order', () => {
    const decomp: MealDecompositionV2 = {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          name: 'Cơm trắng',
          cookingMethod: 'nấu',
          ingredients: [{ rawName: 'gạo', canonicalName: 'Gạo' }],
        },
        {
          name: 'Cơm trắng',
          cookingMethod: 'nấu',
          ingredients: [{ rawName: 'gạo', canonicalName: 'Gạo' }],
        },
      ],
    };
    const offsetByName = buildMealItemOffsetByName(decomp.mealItems);
    // ::1 and ::2 keys are distinct.
    expect(offsetByName.get('cơm trắng::1')?.flatIngredientStart).toBe(0);
    expect(offsetByName.get('cơm trắng::2')?.flatIngredientStart).toBe(1);
  });

  it('resetForRetry clears the occurrence cursors so a re-streamed attempt re-attributes cleanly', () => {
    const { emit, events } = collect();
    const offsetByName = buildMealItemOffsetByName(decomposition().mealItems);
    const itemMacrosStreamed = new Set<string>();
    const handler = createCall2StreamHandler({
      offsetByName,
      matchResults: matchResults(),
      streamedMealItemIds: new Map(),
      itemMacrosStreamed,
      goal: 'maintaining',
      aggression: 0,
      emit,
    });

    const rau = streamedItem('Rau luộc', 'rau');
    const ca = streamedItem('Cá kho', 'cá');
    const accumulated = `{"mealItems":[${rau},${ca},{"mealItemName":"__end__","ingredients":[]}]}`;
    handler.handleChunk(accumulated);
    const firstPass = events.length;
    expect(firstPass).toBeGreaterThan(0);

    // Simulate a provider retry: clear the dedupe set + reset cursors, re-stream.
    itemMacrosStreamed.clear();
    events.length = 0;
    handler.resetForRetry();
    handler.handleChunk(accumulated);

    // After reset, the same items re-attribute correctly (offset occurrence
    // counter restarted — not stuck at ::2/::3 which would miss the offset).
    const byName = new Map(events.map((e) => [e.name, e]));
    expect(byName.get('Cá kho')!.calories).toBeGreaterThan(120);
    expect(byName.get('Rau luộc')!.calories).toBeLessThan(80);
  });
});

describe('flushUnstreamedItemMacros — identity-based mapping', () => {
  it('resolves a reordered final item against its own decomposition slice', () => {
    const decomp = decomposition();
    const { emit, events } = collect();

    flushUnstreamedItemMacros({
      matchResults: matchResults(),
      grounded: {
        mealItems: [
          groundedItem('Rau luộc', 'rau'),
          groundedItem('Cá kho', 'cá'),
        ],
      },
      streamedMealItemIds: new Map([
        ['Rau luộc::1', 'rau-id'],
        ['Cá kho::1', 'ca-id'],
      ]),
      alreadyStreamed: new Set(['rau-id']),
      offsetByName: buildMealItemOffsetByName(decomp.mealItems),
      goal: 'maintaining',
      aggression: 0,
      emit,
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      mealItemId: 'ca-id',
      name: 'Cá kho',
    });
    expect(events[0].calories).toBeGreaterThan(120);
  });
});

// One dish ("Cá rau": cá then rau, flat slots 0 and 1) that Call 2 may split
// into same-name items, one ingredient each.
function oneDish(): MealDecompositionV2 {
  return {
    isFood: true,
    mealSlot: 'lunch',
    mealItems: [
      {
        name: 'Cá rau',
        cookingMethod: 'kho',
        ingredients: [
          { rawName: 'cá', canonicalName: 'Cá' },
          { rawName: 'rau', canonicalName: 'Rau' },
        ],
      },
    ],
  };
}

const END = '{"mealItemName":"__end__","ingredients":[]}';

describe('item_macros for a dish Call 2 split into same-name items', () => {
  it('re-emits the dish with a growing total as each fragment completes', () => {
    const { emit, events } = collect();
    const handler = createCall2StreamHandler({
      offsetByName: buildMealItemOffsetByName(oneDish().mealItems),
      matchResults: matchResults(),
      streamedMealItemIds: new Map([['Cá rau::1', 'dish-id']]),
      itemMacrosStreamed: new Set(),
      goal: 'maintaining',
      aggression: 0,
      emit,
    });

    const fish = streamedItem('Cá rau', 'cá');
    const veg = streamedItem('Cá rau', 'rau');
    handler.handleChunk(`{"mealItems":[${fish},${veg}`);
    handler.handleChunk(`{"mealItems":[${fish},${veg},${END}]}`);

    expect(events.map((e) => e.mealItemId)).toEqual(['dish-id', 'dish-id']);
    expect(events[1].calories).toBeGreaterThan(events[0].calories);
  });

  it('flushes the whole dish when the stream never confirmed its last fragment', () => {
    const { emit, events } = collect();
    const offsetByName = buildMealItemOffsetByName(oneDish().mealItems);
    const streamedMealItemIds = new Map([['Cá rau::1', 'dish-id']]);
    const itemMacrosStreamed = new Set<string>();
    const handler = createCall2StreamHandler({
      offsetByName,
      matchResults: matchResults(),
      streamedMealItemIds,
      itemMacrosStreamed,
      goal: 'maintaining',
      aggression: 0,
      emit,
    });
    // Only the fish fragment is confirmed (no marker after the veg one).
    handler.handleChunk(
      `{"mealItems":[${streamedItem('Cá rau', 'cá')},${streamedItem('Cá rau', 'rau')}]}`
    );
    const fishOnly = events[0].calories;

    flushUnstreamedItemMacros({
      matchResults: matchResults(),
      grounded: {
        mealItems: [
          groundedItem('Cá rau', 'cá'),
          groundedItem('Cá rau', 'rau'),
        ],
      },
      streamedMealItemIds,
      alreadyStreamed: itemMacrosStreamed,
      offsetByName,
      goal: 'maintaining',
      aggression: 0,
      emit,
    });

    expect(events.at(-1)?.mealItemId).toBe('dish-id');
    expect(events.at(-1)?.calories).toBeGreaterThan(fishOnly);
  });
});

describe('streamed ingredient names that differ only in Unicode normalization', () => {
  it('maps a decomposed (NFD) name to its own decomposition slot', () => {
    const { emit, events } = collect();
    const handler = createCall2StreamHandler({
      offsetByName: buildMealItemOffsetByName(oneDish().mealItems),
      matchResults: matchResults(),
      streamedMealItemIds: new Map(),
      itemMacrosStreamed: new Set(),
      goal: 'maintaining',
      aggression: 0,
      emit,
    });
    // Sorted output: rau first, then cá spelled as c + a + combining acute.
    const ingredient = (name: string) =>
      groundedItem('Cá rau', name).ingredients[0];
    const item = JSON.stringify({
      mealItemName: 'Cá rau',
      ingredients: [ingredient('rau'), ingredient('cá')],
    });
    handler.handleChunk(`{"mealItems":[${item},${END}]}`);

    // Fish (~188 kcal) + veg (~29): a missed lookup falls back to the stream
    // index and prices the fish with the veg row (~60 in total).
    expect(events[0].calories).toBeGreaterThan(150);
  });
});

describe('item_macros ids announced under another Unicode form', () => {
  it('reuses the announced id for every fragment of a split dish', () => {
    const nfdDish = 'Cá rau'; // Call 1 wrote "Cá rau" decomposed
    const decomp: MealDecompositionV2 = {
      ...oneDish(),
      mealItems: [{ ...oneDish().mealItems[0], name: nfdDish }],
    };
    const { emit, events } = collect();
    const handler = createCall2StreamHandler({
      offsetByName: buildMealItemOffsetByName(decomp.mealItems),
      matchResults: matchResults(),
      streamedMealItemIds: new Map([[`${nfdDish}::1`, 'dish-id']]),
      itemMacrosStreamed: new Set(),
      goal: 'maintaining',
      aggression: 0,
      emit,
    });
    // Call 2 echoes the composed spelling and splits the dish.
    const fish = streamedItem('Cá rau', 'cá');
    const veg = streamedItem('Cá rau', 'rau');
    handler.handleChunk(`{"mealItems":[${fish},${veg},${END}]}`);

    expect(events.map((e) => e.mealItemId)).toEqual(['dish-id', 'dish-id']);
  });
});
