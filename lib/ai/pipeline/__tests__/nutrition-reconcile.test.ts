import { afterEach, describe, expect, it, vi } from 'vitest';
import { NULL_NUTRITION_VALUES } from '../../__tests__/test-helpers';
import type { MatchedIngredient } from '../../types';
import type { MealDecompositionWithIds } from '../ids';
import {
  __testing,
  computeMacroBaseMap,
  type RawNutritionAdjustment,
  reconcileNutritionIds,
} from '../nutrition';

const noopMatched = [] as never;

afterEach(() => {
  vi.restoreAllMocks();
});

function rawNutrition(
  mealItemName: string,
  ingredientName: string,
  caloriesMid = 100
): RawNutritionAdjustment {
  return {
    mealItems: [
      {
        mealItemName,
        ingredients: [
          {
            ingredientName,
            caloriesKcal: {
              low: caloriesMid - 10,
              mid: caloriesMid,
              high: caloriesMid + 10,
            },
            proteinG: { low: 1, mid: 2, high: 3 },
            carbohydrateG: { low: 1, mid: 2, high: 3 },
            fatG: { low: 0.5, mid: 1, high: 1.5 },
          },
        ],
      },
    ],
  };
}

describe('reconcileNutritionIds', () => {
  it('happy path — copies ids onto the reconciled output', () => {
    const decomposition: MealDecompositionWithIds = {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          mealItemId: 'meal-A',
          name: 'phở bò',
          ingredients: [
            {
              ingredientId: 'ing-1',
              name: 'nước dùng',
              estimatedGrams: 300,
              cookingMethod: 'luộc',
              userFacingUnit: '1 tô',
            },
          ],
        },
      ],
    };

    const out = reconcileNutritionIds(
      rawNutrition('phở bò', 'nước dùng'),
      decomposition,
      noopMatched
    );

    expect(out.mealItems[0].mealItemId).toBe('meal-A');
    expect(out.mealItems[0].ingredients[0].ingredientId).toBe('ing-1');
  });

  it('collision path — FIFO peel maps each nutrition entry to a distinct decomposition slot', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const decomposition: MealDecompositionWithIds = {
      isFood: true,
      mealSlot: 'dinner',
      mealItems: [
        {
          mealItemId: 'meal-A',
          name: 'phở bò',
          ingredients: [
            {
              ingredientId: 'ing-1',
              name: 'nước dùng',
              estimatedGrams: 300,
              cookingMethod: 'luộc',
              userFacingUnit: '1 tô',
            },
          ],
        },
        {
          mealItemId: 'meal-B',
          name: 'phở bò',
          ingredients: [
            {
              ingredientId: 'ing-2',
              name: 'nước dùng',
              estimatedGrams: 200,
              cookingMethod: 'luộc',
              userFacingUnit: '1 tô',
            },
          ],
        },
      ],
    };

    const out = reconcileNutritionIds(
      {
        mealItems: [
          {
            mealItemName: 'phở bò',
            ingredients: [
              {
                ingredientName: 'nước dùng',
                caloriesKcal: { low: 80, mid: 80, high: 80 },
                proteinG: { low: 8, mid: 8, high: 8 },
                carbohydrateG: { low: 6, mid: 6, high: 6 },
                fatG: { low: 2, mid: 2, high: 2 },
              },
            ],
          },
          {
            mealItemName: 'phở bò',
            ingredients: [
              {
                ingredientName: 'nước dùng',
                caloriesKcal: { low: 60, mid: 60, high: 60 },
                proteinG: { low: 6, mid: 6, high: 6 },
                carbohydrateG: { low: 4, mid: 4, high: 4 },
                fatG: { low: 1, mid: 1, high: 1 },
              },
            ],
          },
        ],
      },
      decomposition,
      noopMatched
    );

    expect(out.mealItems[0].mealItemId).toBe('meal-A');
    expect(out.mealItems[1].mealItemId).toBe('meal-B');
    expect(out.mealItems[0].ingredients[0].ingredientId).toBe('ing-1');
    expect(out.mealItems[1].ingredients[0].ingredientId).toBe('ing-2');
    expect(warn).not.toHaveBeenCalled();
  });

  it('no-match path — throws when raw name not in decomposition', () => {
    const decomposition: MealDecompositionWithIds = {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          mealItemId: 'meal-A',
          name: 'phở bò',
          ingredients: [
            {
              ingredientId: 'ing-1',
              name: 'nước dùng',
              estimatedGrams: 300,
              cookingMethod: 'luộc',
              userFacingUnit: '1 tô',
            },
          ],
        },
      ],
    };

    expect(() =>
      reconcileNutritionIds(
        rawNutrition('bún bò Huế', 'nước dùng'),
        decomposition,
        noopMatched
      )
    ).toThrow(/not present in decomposition/);
  });
});

describe('reconcileNutritionIds — hallucination guard (the load-bearing fix)', () => {
  function makeMatch(
    name: string,
    overrides: Partial<MatchedIngredient> = {}
  ): MatchedIngredient {
    return {
      ingredientId: `id-${name}`,
      ingredientName: name,
      foodCompositionId: `fc-${name}`,
      matchedName: name,
      similarity: 0.9,
      confidence: 'high',
      nutritionPer100g: NULL_NUTRITION_VALUES,
      dbState: 'cooked',
      ...overrides,
    };
  }

  it('matched + LLM mid within 3× of base: trusts LLM mid (cooking adjustment survives)', () => {
    const decomposition: MealDecompositionWithIds = {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          mealItemId: 'meal-A',
          name: 'Chả giò tôm',
          ingredients: [
            {
              ingredientId: 'ing-1',
              name: 'Chả giò tôm',
              estimatedGrams: 150,
              cookingMethod: 'chiên',
              userFacingUnit: null,
            },
          ],
        },
      ],
    };
    const matched: MatchedIngredient[] = [
      makeMatch('Chả giò tôm', {
        ingredientId: 'ing-1',
        dbState: 'cooked',
        nutritionPer100g: {
          ...NULL_NUTRITION_VALUES,
          caloriesKcal: 180,
          proteinG: 9,
          carbohydrateG: 22,
          fatG: 6.5,
        },
      }),
    ];
    // base.caloriesKcal = 180 × 150 / 100 = 270. LLM picks mid=320 reflecting
    // a ~19% cooking-adjustment upward (frying-in-oil). 320 / 270 ≈ 1.19× —
    // within the 3× guard threshold; should be kept as-is.
    const raw: RawNutritionAdjustment = {
      mealItems: [
        {
          mealItemName: 'Chả giò tôm',
          ingredients: [
            {
              ingredientName: 'Chả giò tôm',
              caloriesKcal: { low: 290, mid: 320, high: 380 },
              proteinG: { low: 12, mid: 14, high: 17 },
              carbohydrateG: { low: 30, mid: 33, high: 38 },
              fatG: { low: 9, mid: 11, high: 14 },
            },
          ],
        },
      ],
    };

    const out = reconcileNutritionIds(raw, decomposition, matched);
    const ing = out.mealItems[0].ingredients[0];
    // LLM's cooking-adjusted mid survives untouched.
    expect(ing.caloriesKcal.mid).toBe(320);
    expect(ing.caloriesKcal.low).toBe(290);
    expect(ing.caloriesKcal.high).toBe(380);
  });

  it('matched + LLM mid > 3× base: snaps to base (the 5511 kcal regression class)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const decomposition: MealDecompositionWithIds = {
      isFood: true,
      mealSlot: 'dinner',
      mealItems: [
        {
          mealItemId: 'meal-A',
          name: 'Sườn non nướng',
          ingredients: [
            {
              ingredientId: 'ing-1',
              name: 'Sườn non',
              estimatedGrams: 100,
              cookingMethod: 'nướng',
              userFacingUnit: null,
            },
          ],
        },
      ],
    };
    const matched: MatchedIngredient[] = [
      makeMatch('Sườn non', {
        ingredientId: 'ing-1',
        dbState: 'cooked',
        nutritionPer100g: {
          ...NULL_NUTRITION_VALUES,
          caloriesKcal: 290,
          proteinG: 22,
          carbohydrateG: 0,
          fatG: 22,
        },
      }),
    ];
    // base.caloriesKcal = 290. LLM hallucinates 5511 (the 2026-05-12 pattern).
    // 5511 / 290 ≈ 19× — well beyond the 3× guard threshold.
    const raw: RawNutritionAdjustment = {
      mealItems: [
        {
          mealItemName: 'Sườn non nướng',
          ingredients: [
            {
              ingredientName: 'Sườn non',
              caloriesKcal: { low: 5500, mid: 5511, high: 5520 },
              proteinG: { low: 22, mid: 22, high: 22 },
              carbohydrateG: { low: 0, mid: 0, high: 0 },
              fatG: { low: 90, mid: 91, high: 92 },
            },
          ],
        },
      ],
    };

    const out = reconcileNutritionIds(raw, decomposition, matched);
    const ing = out.mealItems[0].ingredients[0];
    expect(ing.caloriesKcal.mid).toBeCloseTo(290, 5);
    expect(warn).toHaveBeenCalled();
    const warnCalls = warn.mock.calls.map((c) => c.join(' '));
    expect(warnCalls.some((m) => /hallucination_guard/.test(m))).toBe(true);
    // Fat similarly snaps: base.fatG = 22 × 100 / 100 = 22; LLM said mid=91.
    // 91 / 22 ≈ 4.1× → above 3× guard.
    expect(ing.fatG.mid).toBeCloseTo(22, 5);
  });

  it('matched, dbState=raw: LLM cooking-adjusted mid kept when within 3× of raw-scaled base', () => {
    const decomposition: MealDecompositionWithIds = {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          mealItemId: 'meal-A',
          name: 'Cơm',
          ingredients: [
            {
              ingredientId: 'ing-1',
              name: 'gạo tẻ',
              estimatedGrams: 100,
              cookingMethod: 'nấu',
              userFacingUnit: null,
            },
          ],
        },
      ],
    };
    const matched: MatchedIngredient[] = [
      makeMatch('gạo tẻ', {
        ingredientId: 'ing-1',
        dbState: 'raw',
        nutritionPer100g: { ...NULL_NUTRITION_VALUES, caloriesKcal: 352 },
      }),
    ];
    // LLM mid=200 — well below 3× raw-scaled base; trusted as-is.
    const raw: RawNutritionAdjustment = {
      mealItems: [
        {
          mealItemName: 'Cơm',
          ingredients: [
            {
              ingredientName: 'gạo tẻ',
              caloriesKcal: { low: 180, mid: 200, high: 220 },
              proteinG: { low: 3, mid: 4, high: 5 },
              carbohydrateG: { low: 38, mid: 42, high: 46 },
              fatG: { low: 0, mid: 0.5, high: 1 },
            },
          ],
        },
      ],
    };

    const out = reconcileNutritionIds(raw, decomposition, matched);
    expect(out.mealItems[0].ingredients[0].caloriesKcal.mid).toBe(200);
  });

  it('unmatched ingredient: no base anchor, LLM triple passes through verbatim', () => {
    const decomposition: MealDecompositionWithIds = {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          mealItemId: 'meal-A',
          name: 'Nem lụi',
          ingredients: [
            {
              ingredientId: 'ing-1',
              name: 'nem lụi',
              estimatedGrams: 80,
              cookingMethod: 'nướng',
              userFacingUnit: null,
            },
          ],
        },
      ],
    };
    const raw: RawNutritionAdjustment = {
      mealItems: [
        {
          mealItemName: 'Nem lụi',
          ingredients: [
            {
              ingredientName: 'nem lụi',
              caloriesKcal: { low: 170, mid: 200, high: 240 },
              proteinG: { low: 13, mid: 14, high: 16 },
              carbohydrateG: { low: 2, mid: 2.5, high: 3 },
              fatG: { low: 12, mid: 14, high: 17 },
            },
          ],
        },
      ],
    };

    const out = reconcileNutritionIds(raw, decomposition, []);
    const ing = out.mealItems[0].ingredients[0];
    expect(ing.caloriesKcal.mid).toBe(200);
    expect(ing.proteinG.mid).toBe(14);
  });
});

describe('computeMacroBaseMap', () => {
  it('builds a base map keyed by ingredientId for matched ingredients only', () => {
    const decomposition: MealDecompositionWithIds = {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          mealItemId: 'meal-A',
          name: 'Phở bò',
          ingredients: [
            {
              ingredientId: 'ing-1',
              name: 'thịt bò',
              estimatedGrams: 100,
              cookingMethod: 'luộc',
              userFacingUnit: null,
            },
            {
              ingredientId: 'ing-2',
              name: 'không-DB',
              estimatedGrams: 50,
              cookingMethod: null,
              userFacingUnit: null,
            },
          ],
        },
      ],
    };
    const matched: MatchedIngredient[] = [
      {
        ingredientId: 'ing-1',
        ingredientName: 'thịt bò',
        foodCompositionId: 'fc-bo',
        matchedName: 'thịt bò',
        similarity: 0.95,
        confidence: 'high',
        dbState: 'cooked',
        nutritionPer100g: {
          ...NULL_NUTRITION_VALUES,
          caloriesKcal: 250,
          proteinG: 26,
        },
      },
    ];

    const baseMap = computeMacroBaseMap(decomposition, matched);

    expect(baseMap.has('ing-1')).toBe(true);
    expect(baseMap.has('ing-2')).toBe(false); // unmatched → no entry
    const base = baseMap.get('ing-1')!;
    expect(base.caloriesKcal).toBeCloseTo(250, 5); // 250 × 100 / 100
    expect(base.proteinG).toBeCloseTo(26, 5);
  });
});

describe('__testing.guardMacro', () => {
  it('returns input verbatim when mid is within 3× of base', () => {
    const out = __testing.guardMacro(
      { low: 200, mid: 270, high: 350 },
      270, // base
      'test ingredient',
      'caloriesKcal'
    );
    expect(out).toEqual({ low: 200, mid: 270, high: 350 });
  });

  it('snaps mid to base when LLM mid exceeds 3× base', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = __testing.guardMacro(
      { low: 5400, mid: 5511, high: 5600 },
      270, // base; ratio is 5511/270 ≈ 20×, way above 3× guard
      'Sườn non',
      'caloriesKcal'
    );
    expect(out.mid).toBe(270);
    expect(out.low).toBeLessThanOrEqual(out.mid);
    expect(out.high).toBeGreaterThanOrEqual(out.mid);
    expect(warn).toHaveBeenCalled();
  });

  it('snaps mid to base when LLM mid is below 1/3 of base', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = __testing.guardMacro(
      { low: 1, mid: 5, high: 10 },
      100, // base; ratio is 5/100 = 0.05× → below 1/3 guard
      'test',
      'caloriesKcal'
    );
    expect(out.mid).toBe(100);
    expect(warn).toHaveBeenCalled();
  });

  it('trusts LLM when base is 0 (e.g., pepper has no kcal entry)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = __testing.guardMacro(
      { low: 0, mid: 0.3, high: 0.5 },
      0, // base undefined for this nutrient
      'tiêu',
      'caloriesKcal'
    );
    expect(out).toEqual({ low: 0, mid: 0.3, high: 0.5 });
    expect(warn).not.toHaveBeenCalled();
  });
});
