import { afterEach, describe, expect, it, vi } from 'vitest';
import { NULL_NUTRITION_VALUES } from '@/lib/ai/__fixtures__/test-helpers';
import type { MealDecompositionWithIds } from '@/lib/ai/pipeline/contracts/decomposition-ids';
import {
  type RawNutritionAdjustment,
  reconcileNutritionIds,
} from '@/lib/ai/pipeline/resolve/macro-resolution';
import type { MatchedIngredient } from '@/lib/ai/types/matching';

const noopMatched: MatchedIngredient[] = [];

afterEach(() => {
  vi.restoreAllMocks();
});

function rawNutrition(
  mealItemName: string,
  ingredientName: string
): RawNutritionAdjustment {
  return {
    mealItems: [
      {
        mealItemName,
        ingredients: [
          {
            ingredientName,
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

describe('reconcileNutritionIds — server-anchored P/C, LLM-only F, derived kcal', () => {
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

  it('matched: server-anchors P and C from base, keeps LLM fat within 3×, derives kcal', () => {
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
    // base for 150g cooked: P=13.5, C=33, F=9.75.
    // LLM tries to push P=14, C=33, F=11, kcal=320 — protein/carb/kcal are
    // discarded; fat is within 3× of base.fatG so it's kept as 11.
    const raw: RawNutritionAdjustment = {
      mealItems: [
        {
          mealItemName: 'Chả giò tôm',
          ingredients: [
            {
              ingredientName: 'Chả giò tôm',
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
    // P and C are flat triples at the DB-anchored base; LLM values ignored.
    expect(ing.proteinG.mid).toBeCloseTo(13.5, 5);
    expect(ing.proteinG.low).toBeCloseTo(13.5, 5);
    expect(ing.proteinG.high).toBeCloseTo(13.5, 5);
    expect(ing.carbohydrateG.mid).toBeCloseTo(33, 5);
    expect(ing.carbohydrateG.low).toBeCloseTo(33, 5);
    expect(ing.carbohydrateG.high).toBeCloseTo(33, 5);
    // Fat from LLM (within 3× of base.fatG=9.75) — its spread is the only
    // signal driving downstream goal-adjustment for matched ingredients.
    expect(ing.fatG.mid).toBe(11);
    expect(ing.fatG.low).toBe(9);
    expect(ing.fatG.high).toBe(14);
    // Kcal derived per bound. mid = 4×13.5 + 4×33 + 9×11 = 285.
    expect(ing.caloriesKcal.mid).toBeCloseTo(285, 5);
    // low = 4×13.5 + 4×33 + 9×9 = 54 + 132 + 81 = 267 (only fat's low varies)
    expect(ing.caloriesKcal.low).toBeCloseTo(267, 5);
    // high = 4×13.5 + 4×33 + 9×14 = 54 + 132 + 126 = 312
    expect(ing.caloriesKcal.high).toBeCloseTo(312, 5);
  });

  it('matched: discards the carb anomaly (hủ tíu C=137 → server-anchored to base)', () => {
    const decomposition: MealDecompositionWithIds = {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          mealItemId: 'meal-A',
          name: 'Hủ tíu nam vang khô',
          ingredients: [
            {
              ingredientId: 'ing-1',
              name: 'bánh hủ tíu',
              estimatedGrams: 200,
              cookingMethod: 'luộc',
              userFacingUnit: null,
            },
          ],
        },
      ],
    };
    const matched: MatchedIngredient[] = [
      makeMatch('bánh hủ tíu', {
        ingredientId: 'ing-1',
        dbState: 'cooked',
        nutritionPer100g: {
          ...NULL_NUTRITION_VALUES,
          caloriesKcal: 110,
          proteinG: 2,
          carbohydrateG: 27,
          fatG: 0.4,
        },
      }),
    ];
    // base for 200g cooked: P=4, C=54, F=0.8. LLM hallucinates C=137g.
    // Server-anchored C.mid must be 54, not 137.
    const raw: RawNutritionAdjustment = {
      mealItems: [
        {
          mealItemName: 'Hủ tíu nam vang khô',
          ingredients: [
            {
              ingredientName: 'bánh hủ tíu',
              proteinG: { low: 35, mid: 40, high: 45 },
              carbohydrateG: { low: 120, mid: 137, high: 150 },
              fatG: { low: 0.6, mid: 0.8, high: 1 },
            },
          ],
        },
      ],
    };

    const out = reconcileNutritionIds(raw, decomposition, matched);
    const ing = out.mealItems[0].ingredients[0];
    // Flat triple at DB-anchored base — no artificial spread on a known value.
    expect(ing.carbohydrateG.mid).toBeCloseTo(54, 5);
    expect(ing.carbohydrateG.low).toBeCloseTo(54, 5);
    expect(ing.carbohydrateG.high).toBeCloseTo(54, 5);
    expect(ing.proteinG.mid).toBeCloseTo(4, 5);
    expect(ing.proteinG.low).toBeCloseTo(4, 5);
    expect(ing.proteinG.high).toBeCloseTo(4, 5);
    // Fat stays from LLM (0.8 is within 3× of base 0.8).
    expect(ing.fatG.mid).toBeCloseTo(0.8, 5);
  });

  it('matched: discards the protein anomaly (ốp la P=34 → server-anchored to base)', () => {
    const decomposition: MealDecompositionWithIds = {
      isFood: true,
      mealSlot: 'breakfast',
      mealItems: [
        {
          mealItemId: 'meal-A',
          name: 'trứng ốp la',
          ingredients: [
            {
              ingredientId: 'ing-1',
              name: 'trứng gà',
              estimatedGrams: 155,
              cookingMethod: 'chiên',
              userFacingUnit: null,
            },
          ],
        },
      ],
    };
    const matched: MatchedIngredient[] = [
      makeMatch('trứng gà', {
        ingredientId: 'ing-1',
        dbState: 'cooked',
        nutritionPer100g: {
          ...NULL_NUTRITION_VALUES,
          caloriesKcal: 155,
          proteinG: 13,
          carbohydrateG: 1.1,
          fatG: 11,
        },
      }),
    ];
    // base for 155g cooked: P=20.15, C≈1.7, F=17.05. LLM hallucinates P=34g.
    const raw: RawNutritionAdjustment = {
      mealItems: [
        {
          mealItemName: 'trứng ốp la',
          ingredients: [
            {
              ingredientName: 'trứng gà',
              proteinG: { low: 30, mid: 34, high: 38 },
              carbohydrateG: { low: 0.8, mid: 1, high: 1.5 },
              fatG: { low: 30, mid: 34, high: 38 },
            },
          ],
        },
      ],
    };

    const out = reconcileNutritionIds(raw, decomposition, matched);
    const ing = out.mealItems[0].ingredients[0];
    expect(ing.proteinG.mid).toBeCloseTo(20.15, 5);
    expect(ing.carbohydrateG.mid).toBeCloseTo(1.705, 3);
    // Fat is within 3× of base 17.05 (34/17.05 ≈ 2× → kept).
    expect(ing.fatG.mid).toBe(34);
  });

  it('matched + LLM fat > 3× base.fatG: clamps to the ceiling', () => {
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
    // base for 100g cooked: P=22, C=0, F=22. LLM hallucinates fat=91 → ratio
    // 91/22 ≈ 4.1×, beyond the 3× guard → fat clamps to 66.
    const raw: RawNutritionAdjustment = {
      mealItems: [
        {
          mealItemName: 'Sườn non nướng',
          ingredients: [
            {
              ingredientName: 'Sườn non',
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
    expect(ing.fatG.mid).toBeCloseTo(66, 5);
    // Kcal derives from server-anchored P/C and clamped F:
    // 4×22 + 0 + 9×66 = 682.
    expect(ing.caloriesKcal.mid).toBeCloseTo(682, 5);
    expect(warn).toHaveBeenCalled();
    const warnCalls = warn.mock.calls.map((c) => c.join(' '));
    expect(warnCalls.some((m) => /hallucination_guard/.test(m))).toBe(true);
  });

  it('matched, dbState=raw: kcal derived from raw-scaled macros (cooking factor applied to base)', () => {
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
        nutritionPer100g: {
          ...NULL_NUTRITION_VALUES,
          caloriesKcal: 352,
          proteinG: 7,
          carbohydrateG: 78,
          fatG: 0.5,
        },
      }),
    ];
    // nấu factor = 0.38 → dbScalingGrams = 38. base: P=2.66, C=29.64, F=0.19.
    // LLM kcal=200 / P=4 / C=42 are all discarded.
    const raw: RawNutritionAdjustment = {
      mealItems: [
        {
          mealItemName: 'Cơm',
          ingredients: [
            {
              ingredientName: 'gạo tẻ',
              proteinG: { low: 3, mid: 4, high: 5 },
              carbohydrateG: { low: 38, mid: 42, high: 46 },
              fatG: { low: 0, mid: 0.5, high: 1 },
            },
          ],
        },
      ],
    };

    const out = reconcileNutritionIds(raw, decomposition, matched);
    const ing = out.mealItems[0].ingredients[0];
    expect(ing.proteinG.mid).toBeCloseTo(2.66, 2);
    expect(ing.carbohydrateG.mid).toBeCloseTo(29.64, 2);
    // base.fatG = 0.19, LLM mid=0.5 (ratio 2.6× → within 3× → kept).
    expect(ing.fatG.mid).toBe(0.5);
    // Derived kcal.mid = 4×2.66 + 4×29.64 + 9×0.5 ≈ 133.7.
    expect(ing.caloriesKcal.mid).toBeCloseTo(133.7, 1);
  });

  it('unmatched ingredient (sane density): macros pass through, kcal derived from identity', () => {
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
    // LLM kcal=200 but 4P+4C+9F=4×14+4×2.5+9×14 = 56+10+126 = 192. Server
    // derives kcal from macros, so output kcal.mid=192 (not 200).
    const raw: RawNutritionAdjustment = {
      mealItems: [
        {
          mealItemName: 'Nem lụi',
          ingredients: [
            {
              ingredientName: 'nem lụi',
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
    expect(ing.proteinG.mid).toBe(14);
    expect(ing.carbohydrateG.mid).toBe(2.5);
    expect(ing.fatG.mid).toBe(14);
    // 4P+4C+9F = 56 + 10 + 126 = 192. LLM's 200 is ignored.
    expect(ing.caloriesKcal.mid).toBeCloseTo(192, 5);
  });

  it('unmatched ingredient (hallucinated density 1200 kcal/100g): clamped to 900 ceiling', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const decomposition: MealDecompositionWithIds = {
      isFood: true,
      mealSlot: 'dinner',
      mealItems: [
        {
          mealItemId: 'meal-A',
          name: 'Bún thịt nướng nem lụi',
          ingredients: [
            {
              ingredientId: 'ing-1',
              name: 'Nem lụi',
              estimatedGrams: 280,
              cookingMethod: 'nướng',
              userFacingUnit: null,
            },
          ],
        },
      ],
    };
    // LLM hallucinates kcal density ≈ 1200/100g (the actual 2026-05-12 anomaly).
    // 280g × 1200/100 = 3360 kcal. P=170, C=50, F=300 → 4P+4C+9F = 3580.
    // Scale factor = 900 / 1200 = 0.75 → kcal/100g clamped to 900.
    const raw: RawNutritionAdjustment = {
      mealItems: [
        {
          mealItemName: 'Bún thịt nướng nem lụi',
          ingredients: [
            {
              ingredientName: 'Nem lụi',
              proteinG: { low: 150, mid: 170, high: 190 },
              carbohydrateG: { low: 40, mid: 50, high: 60 },
              fatG: { low: 280, mid: 300, high: 320 },
            },
          ],
        },
      ],
    };

    const out = reconcileNutritionIds(raw, decomposition, []);
    const ing = out.mealItems[0].ingredients[0];
    // Density after clamp: (kcal.mid / 280) × 100 ≤ 900.
    const densityAfter = (ing.caloriesKcal.mid / 280) * 100;
    expect(densityAfter).toBeLessThanOrEqual(900 + 1e-6);
    // Macros scaled proportionally; identity still holds.
    const identity =
      4 * ing.proteinG.mid + 4 * ing.carbohydrateG.mid + 9 * ing.fatG.mid;
    expect(ing.caloriesKcal.mid).toBeCloseTo(identity, 5);
    expect(warn).toHaveBeenCalled();
    const warnCalls = warn.mock.calls.map((c) => c.join(' '));
    expect(warnCalls.some((m) => /density_clamp/.test(m))).toBe(true);
  });

  it('unmatched: clamp inspects HIGH bound too, not only mid', () => {
    // LLM emits a triple where mid density is fine (~400 kcal/100g) but the
    // high bound is inflated (~1500 kcal/100g for 100g portion). Without the
    // high-bound check, kcal.high would derive to 1500 — over the ceiling.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const decomposition: MealDecompositionWithIds = {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          mealItemId: 'meal-A',
          name: 'Sốt đậu phộng',
          ingredients: [
            {
              ingredientId: 'ing-1',
              name: 'sốt đậu phộng',
              estimatedGrams: 100,
              cookingMethod: null,
              userFacingUnit: null,
            },
          ],
        },
      ],
    };
    const raw: RawNutritionAdjustment = {
      mealItems: [
        {
          mealItemName: 'Sốt đậu phộng',
          ingredients: [
            {
              ingredientName: 'sốt đậu phộng',
              proteinG: { low: 8, mid: 12, high: 40 },
              carbohydrateG: { low: 8, mid: 12, high: 40 },
              fatG: { low: 25, mid: 35, high: 135 },
            },
          ],
        },
      ],
    };
    const out = reconcileNutritionIds(raw, decomposition, []);
    const ing = out.mealItems[0].ingredients[0];
    // High-bound density must also respect the 900 ceiling.
    const densityHighAfter = (ing.caloriesKcal.high / 100) * 100;
    expect(densityHighAfter).toBeLessThanOrEqual(900 + 1e-6);
    expect(warn).toHaveBeenCalled();
  });
});

describe('reconcileNutritionIds — double-counted frying oil and pure-fat guards', () => {
  function makeMatch(
    id: string,
    name: string,
    nutrition: Partial<MatchedIngredient['nutritionPer100g']>,
    extra: Partial<MatchedIngredient> = {}
  ): MatchedIngredient {
    return {
      ingredientId: id,
      ingredientName: name,
      foodCompositionId: `fc-${id}`,
      matchedName: name,
      similarity: 0.9,
      confidence: 'high',
      dbState: 'cooked',
      nutritionPer100g: { ...NULL_NUTRITION_VALUES, ...nutrition },
      ...extra,
    };
  }

  const SOYBEAN_OIL_PER_100G = {
    caloriesKcal: 884,
    proteinG: 0,
    carbohydrateG: 0,
    fatG: 100,
  };

  const BUTTER_PER_100G = {
    caloriesKcal: 717,
    proteinG: 0.85,
    carbohydrateG: 0.06,
    fatG: 81,
  };

  it('caps fatty pork + sibling oil at <= 1.25x base fat while preserving low < mid < high bounds', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const decomposition: MealDecompositionWithIds = {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          mealItemId: 'm1',
          name: 'Sweet and sour pork ribs',
          cookingMethod: 'stir-fried',
          ingredients: [
            {
              ingredientId: 'i-pork',
              name: 'pork ribs',
              estimatedGrams: 100,
              cookingMethod: 'stir-fried',
              userFacingUnit: null,
            },
            {
              ingredientId: 'i-oil',
              name: 'cooking oil',
              estimatedGrams: 10,
              cookingMethod: 'stir-fried',
              userFacingUnit: null,
            },
          ],
        },
      ],
    };
    const matched: MatchedIngredient[] = [
      makeMatch('i-pork', 'pork ribs', {
        caloriesKcal: 310,
        proteinG: 20,
        carbohydrateG: 0,
        fatG: 25.7,
      }),
      makeMatch('i-oil', 'cooking oil', SOYBEAN_OIL_PER_100G),
    ];

    // Case 1: Call 2 inflates ribs to 45g fat (1.75× base 25.7g) beside 10g oil.
    const overshot = reconcileNutritionIds(
      {
        mealItems: [
          {
            mealItemName: 'Sweet and sour pork ribs',
            ingredients: [
              {
                ingredientName: 'pork ribs',
                proteinG: { low: 20, mid: 20, high: 20 },
                carbohydrateG: { low: 0, mid: 0, high: 0 },
                fatG: { low: 40, mid: 45, high: 50 },
              },
              {
                ingredientName: 'cooking oil',
                proteinG: { low: 0, mid: 0, high: 0 },
                carbohydrateG: { low: 0, mid: 0, high: 0 },
                fatG: { low: 6, mid: 7, high: 8 },
              },
            ],
          },
        ],
      },
      decomposition,
      matched
    );
    const porkOver = overshot.mealItems[0].ingredients[0];
    const oilOver = overshot.mealItems[0].ingredients[1];
    expect(porkOver.fatG.mid).toBeCloseTo(25.7 * 1.25, 5);
    expect(porkOver.fatG.high).toBeLessThanOrEqual(25.7 * 1.25 + 1e-6);
    expect(porkOver.fatG.low).toBeLessThan(porkOver.fatG.mid);
    expect(oilOver.fatG).toEqual({ low: 10, mid: 10, high: 10 });

    // Case 2: Call 2 mid is within 1.25× (29g) and high overshoots (36g) ->
    // strict low < mid < high is kept with high held at 1.25× base.
    const inBand = reconcileNutritionIds(
      {
        mealItems: [
          {
            mealItemName: 'Sweet and sour pork ribs',
            ingredients: [
              {
                ingredientName: 'pork ribs',
                proteinG: { low: 20, mid: 20, high: 20 },
                carbohydrateG: { low: 0, mid: 0, high: 0 },
                fatG: { low: 24, mid: 29, high: 36 },
              },
              {
                ingredientName: 'cooking oil',
                proteinG: { low: 0, mid: 0, high: 0 },
                carbohydrateG: { low: 0, mid: 0, high: 0 },
                fatG: { low: 9, mid: 10, high: 11 },
              },
            ],
          },
        ],
      },
      decomposition,
      matched
    );
    const porkInBand = inBand.mealItems[0].ingredients[0];
    expect(porkInBand.fatG.low).toBe(24);
    expect(porkInBand.fatG.mid).toBe(29);
    expect(porkInBand.fatG.high).toBeCloseTo(25.7 * 1.25, 5);
    expect(porkInBand.fatG.low).toBeLessThan(porkInBand.fatG.mid);
    expect(porkInBand.fatG.mid).toBeLessThan(porkInBand.fatG.high);
  });

  it('triggers sibling-fat cap when a sibling row is pure butter by composition (even with ambiguous name "bơ")', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const decomposition: MealDecompositionWithIds = {
      isFood: true,
      mealSlot: 'breakfast',
      mealItems: [
        {
          mealItemId: 'm1',
          name: 'Trứng áp chảo bơ',
          cookingMethod: 'áp chảo',
          ingredients: [
            {
              ingredientId: 'i-egg',
              name: 'trứng gà',
              estimatedGrams: 100,
              cookingMethod: 'áp chảo',
              userFacingUnit: null,
            },
            {
              ingredientId: 'i-butter',
              name: 'bơ',
              estimatedGrams: 10,
              cookingMethod: 'áp chảo',
              userFacingUnit: null,
            },
          ],
        },
      ],
    };
    const matched: MatchedIngredient[] = [
      makeMatch('i-egg', 'trứng gà', {
        caloriesKcal: 155,
        proteinG: 13,
        carbohydrateG: 1.1,
        fatG: 11,
      }),
      makeMatch('i-butter', 'bơ', BUTTER_PER_100G, {
        matchedName: 'Bơ mặn',
        matchedNameEn: 'Butter, salted',
      }),
    ];
    const out = reconcileNutritionIds(
      {
        mealItems: [
          {
            mealItemName: 'Trứng áp chảo bơ',
            ingredients: [
              {
                ingredientName: 'trứng gà',
                proteinG: { low: 13, mid: 13, high: 13 },
                carbohydrateG: { low: 1.1, mid: 1.1, high: 1.1 },
                fatG: { low: 18, mid: 20, high: 22 },
              },
              {
                ingredientName: 'bơ',
                proteinG: { low: 0.1, mid: 0.1, high: 0.1 },
                carbohydrateG: { low: 0, mid: 0, high: 0 },
                fatG: { low: 7.5, mid: 8, high: 8.4 },
              },
            ],
          },
        ],
      },
      decomposition,
      matched
    );
    expect(out.mealItems[0].ingredients[0].fatG.mid).toBeCloseTo(11 * 1.25, 5);
  });

  it('sibling oil + "extra butter" prepNote still unlocks 2x fat while non-extra-fat prepNotes keep 1.25x ceiling and 0.5x floor', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const makeDecomp = (prepNotes: string[]): MealDecompositionWithIds => ({
      isFood: true,
      mealSlot: 'dinner',
      mealItems: [
        {
          mealItemId: 'm1',
          name: 'Pan-seared steak',
          cookingMethod: 'pan-seared',
          ingredients: [
            {
              ingredientId: 'i-steak',
              name: 'beef steak',
              estimatedGrams: 100,
              cookingMethod: 'pan-seared',
              userFacingUnit: null,
              prepNotes,
            },
            {
              ingredientId: 'i-oil',
              name: 'oil',
              estimatedGrams: 10,
              cookingMethod: 'pan-seared',
              userFacingUnit: null,
            },
          ],
        },
      ],
    });
    const matched: MatchedIngredient[] = [
      makeMatch('i-steak', 'beef steak', {
        caloriesKcal: 200,
        proteinG: 26,
        carbohydrateG: 0,
        fatG: 10,
      }),
      makeMatch('i-oil', 'oil', SOYBEAN_OIL_PER_100G),
    ];

    const withExtraButter = reconcileNutritionIds(
      {
        mealItems: [
          {
            mealItemName: 'Pan-seared steak',
            ingredients: [
              {
                ingredientName: 'beef steak',
                proteinG: { low: 25, mid: 26, high: 27 },
                carbohydrateG: { low: 0, mid: 0, high: 0 },
                fatG: { low: 17, mid: 19, high: 20 },
              },
              {
                ingredientName: 'oil',
                proteinG: { low: 0, mid: 0, high: 0 },
                carbohydrateG: { low: 0, mid: 0, high: 0 },
                fatG: { low: 9, mid: 10, high: 11 },
              },
            ],
          },
        ],
      },
      makeDecomp(['extra butter']),
      matched
    );
    expect(withExtraButter.mealItems[0].ingredients[0].fatG.mid).toBe(19);
    expect(withExtraButter.mealItems[0].ingredients[0].fatG.high).toBe(20);

    // Trimmed prep note: floor stays 0.5× (5g passes), ceiling stays 1.25×.
    const trimmed = reconcileNutritionIds(
      {
        mealItems: [
          {
            mealItemName: 'Pan-seared steak',
            ingredients: [
              {
                ingredientName: 'beef steak',
                proteinG: { low: 25, mid: 26, high: 27 },
                carbohydrateG: { low: 0, mid: 0, high: 0 },
                fatG: { low: 5, mid: 6, high: 7 },
              },
              {
                ingredientName: 'oil',
                proteinG: { low: 0, mid: 0, high: 0 },
                carbohydrateG: { low: 0, mid: 0, high: 0 },
                fatG: { low: 9, mid: 10, high: 11 },
              },
            ],
          },
        ],
      },
      makeDecomp(['bỏ mỡ']),
      matched
    );
    expect(trimmed.mealItems[0].ingredients[0].fatG).toEqual({
      low: 5,
      mid: 6,
      high: 7,
    });
  });

  it('caps an already-fried matched row without sibling oil at <= 1.25x base fat', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const decomposition: MealDecompositionWithIds = {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          mealItemId: 'm1',
          name: 'Fish noodle soup',
          cookingMethod: 'fried',
          ingredients: [
            {
              ingredientId: 'i-fish',
              name: 'fried fish',
              estimatedGrams: 100,
              cookingMethod: 'fried',
              userFacingUnit: null,
            },
          ],
        },
      ],
    };
    const matched: MatchedIngredient[] = [
      makeMatch(
        'i-fish',
        'fried fish',
        { caloriesKcal: 150, proteinG: 20, carbohydrateG: 5, fatG: 3.0 },
        { matchedNameEn: 'Fish, cooked, fried' }
      ),
    ];
    // Call 2 tries to push 3.0g base fat to 9.0g (3×).
    const out = reconcileNutritionIds(
      {
        mealItems: [
          {
            mealItemName: 'Fish noodle soup',
            ingredients: [
              {
                ingredientName: 'fried fish',
                proteinG: { low: 20, mid: 20, high: 20 },
                carbohydrateG: { low: 5, mid: 5, high: 5 },
                fatG: { low: 7, mid: 9, high: 11 },
              },
            ],
          },
        ],
      },
      decomposition,
      matched
    );
    const fish = out.mealItems[0].ingredients[0];
    expect(fish.fatG.mid).toBeCloseTo(3.0 * 1.25, 5);
    expect(fish.fatG.high).toBeCloseTo(3.0 * 1.25, 5);
    expect(fish.fatG.low).toBeLessThan(fish.fatG.mid);
  });

  it('anchors 5g and 10g pure oil rows to exact DB fat even when Call 2 under-reports', () => {
    for (const grams of [5, 10]) {
      const decomposition: MealDecompositionWithIds = {
        isFood: true,
        mealSlot: 'dinner',
        mealItems: [
          {
            mealItemId: 'm1',
            name: 'Stir-fry',
            cookingMethod: 'stir-fried',
            ingredients: [
              {
                ingredientId: 'i-oil',
                name: 'soybean oil',
                estimatedGrams: grams,
                cookingMethod: 'stir-fried',
                userFacingUnit: null,
              },
            ],
          },
        ],
      };
      const matched = [makeMatch('i-oil', 'soybean oil', SOYBEAN_OIL_PER_100G)];
      const out = reconcileNutritionIds(
        {
          mealItems: [
            {
              mealItemName: 'Stir-fry',
              ingredients: [
                {
                  ingredientName: 'soybean oil',
                  proteinG: { low: 0, mid: 0, high: 0 },
                  carbohydrateG: { low: 0, mid: 0, high: 0 },
                  fatG: {
                    low: grams * 0.5,
                    mid: grams * 0.7,
                    high: grams * 0.8,
                  },
                },
              ],
            },
          ],
        },
        decomposition,
        matched
      );
      const oil = out.mealItems[0].ingredients[0];
      expect(oil.fatG).toEqual({ low: grams, mid: grams, high: grams });
      expect(oil.caloriesKcal).toEqual({
        low: grams * 9,
        mid: grams * 9,
        high: grams * 9,
      });
    }
  });

  it('guards butter without prepNotes to [0.9x, 1.05x] base and keeps wider band with prepNotes', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const makeDecomp = (prepNotes?: string[]): MealDecompositionWithIds => ({
      isFood: true,
      mealSlot: 'breakfast',
      mealItems: [
        {
          mealItemId: 'm1',
          name: 'Buttered toast',
          cookingMethod: 'toasted',
          ingredients: [
            {
              ingredientId: 'i-butter',
              name: 'butter',
              estimatedGrams: 10,
              cookingMethod: 'toasted',
              userFacingUnit: null,
              prepNotes,
            },
          ],
        },
      ],
    });
    const matched = [makeMatch('i-butter', 'butter', BUTTER_PER_100G)];
    const baseFat = 8.1;

    // Under-reported butter without prepNotes clamps up to 0.9× base.
    const lowButter = reconcileNutritionIds(
      {
        mealItems: [
          {
            mealItemName: 'Buttered toast',
            ingredients: [
              {
                ingredientName: 'butter',
                proteinG: { low: 0.1, mid: 0.1, high: 0.1 },
                carbohydrateG: { low: 0, mid: 0, high: 0 },
                fatG: { low: 4, mid: 5, high: 6 },
              },
            ],
          },
        ],
      },
      makeDecomp(undefined),
      matched
    );
    expect(lowButter.mealItems[0].ingredients[0].fatG.mid).toBeCloseTo(
      baseFat * 0.9,
      5
    );
    expect(
      lowButter.mealItems[0].ingredients[0].fatG.low
    ).toBeGreaterThanOrEqual(baseFat * 0.9 - 1e-6);
    expect(lowButter.mealItems[0].ingredients[0].fatG.high).toBeLessThanOrEqual(
      baseFat * 1.05 + 1e-6
    );

    // Over-reported butter without prepNotes clamps down to 1.05× base.
    const highButter = reconcileNutritionIds(
      {
        mealItems: [
          {
            mealItemName: 'Buttered toast',
            ingredients: [
              {
                ingredientName: 'butter',
                proteinG: { low: 0.1, mid: 0.1, high: 0.1 },
                carbohydrateG: { low: 0, mid: 0, high: 0 },
                fatG: { low: 10, mid: 12, high: 14 },
              },
            ],
          },
        ],
      },
      makeDecomp(undefined),
      matched
    );
    expect(highButter.mealItems[0].ingredients[0].fatG.mid).toBeCloseTo(
      baseFat * 1.05,
      5
    );
    expect(highButter.mealItems[0].ingredients[0].fatG.high).toBeCloseTo(
      baseFat * 1.05,
      5
    );

    // With prepNotes (e.g. "light"), keeps today's wider [0.5×, 2×] band.
    const lightButter = reconcileNutritionIds(
      {
        mealItems: [
          {
            mealItemName: 'Buttered toast',
            ingredients: [
              {
                ingredientName: 'butter',
                proteinG: { low: 0.1, mid: 0.1, high: 0.1 },
                carbohydrateG: { low: 0, mid: 0, high: 0 },
                fatG: { low: 4.5, mid: 5, high: 5.5 },
              },
            ],
          },
        ],
      },
      makeDecomp(['light butter']),
      matched
    );
    expect(lightButter.mealItems[0].ingredients[0].fatG).toEqual({
      low: 4.5,
      mid: 5,
      high: 5.5,
    });
  });
});
