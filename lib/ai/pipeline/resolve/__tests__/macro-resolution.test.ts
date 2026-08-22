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
              caloriesKcal: { low: 800, mid: 822, high: 850 },
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
              caloriesKcal: { low: 420, mid: 447, high: 480 },
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
              caloriesKcal: { low: 3200, mid: 3360, high: 3500 },
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
              caloriesKcal: { low: 300, mid: 400, high: 1500 },
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
