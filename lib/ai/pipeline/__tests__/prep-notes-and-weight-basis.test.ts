import { afterEach, describe, expect, it, vi } from 'vitest';
import { NULL_NUTRITION_VALUES } from '../../__tests__/test-helpers';
import type { MatchedIngredient } from '../../types';
import type { MealDecompositionWithIds } from '../ids';
import {
  __testing,
  computeDbScalingGrams,
  computeMacroBaseMap,
  type RawNutritionAdjustment,
  reconcileNutritionIds,
} from '../nutrition';

afterEach(() => {
  vi.restoreAllMocks();
});

const noNutrition = NULL_NUTRITION_VALUES;

describe('computeDbScalingGrams — weight basis routing', () => {
  it('weightBasis="raw" scales 1:1 regardless of DB state or cooking method', () => {
    // The matcher should have already steered to a raw row, but even if it
    // somehow landed on a cooked row, weighing raw means "no conversion".
    expect(
      computeDbScalingGrams({
        grams: 300,
        dbState: 'raw',
        cookingMethod: 'nấu',
        weightBasis: 'raw',
      })
    ).toBe(300);
    expect(
      computeDbScalingGrams({
        grams: 300,
        dbState: 'cooked',
        cookingMethod: 'nấu',
        weightBasis: 'raw',
      })
    ).toBe(300);
  });

  it('cooked DB row + as-eaten weight: no conversion', () => {
    expect(
      computeDbScalingGrams({
        grams: 150,
        dbState: 'cooked',
        cookingMethod: 'nướng',
        weightBasis: undefined,
      })
    ).toBe(150);
  });

  it('raw DB row + as-eaten weight: converts cooked→raw via cooking factor', () => {
    // nướng (grilled) yield factor is 0.75 in COOKED_TO_RAW_FACTOR
    expect(
      computeDbScalingGrams({
        grams: 100,
        dbState: 'raw',
        cookingMethod: 'nướng',
        weightBasis: undefined,
      })
    ).toBe(75);
  });

  it('unknown DB row + as-eaten weight: converts (legacy fallback path)', () => {
    expect(
      computeDbScalingGrams({
        grams: 100,
        dbState: 'unknown',
        cookingMethod: 'luộc', // 0.75
        weightBasis: undefined,
      })
    ).toBe(75);
  });

  it('weightBasis="as_eaten" is equivalent to undefined', () => {
    const a = computeDbScalingGrams({
      grams: 100,
      dbState: 'raw',
      cookingMethod: 'nướng',
      weightBasis: 'as_eaten',
    });
    const b = computeDbScalingGrams({
      grams: 100,
      dbState: 'raw',
      cookingMethod: 'nướng',
      weightBasis: undefined,
    });
    expect(a).toBe(b);
  });
});

describe('computeMacroBaseMap — weightBasis="raw" flow', () => {
  it('uses grams directly when the user weighed raw (no convertCookedToRaw)', () => {
    const decomposition: MealDecompositionWithIds = {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          mealItemId: 'm1',
          name: 'ức gà nấu chậm',
          cookingMethod: 'nấu',
          ingredients: [
            {
              ingredientId: 'i1',
              name: 'ức gà',
              estimatedGrams: 300,
              userFacingUnit: null,
              weightBasis: 'raw',
              expectedState: 'raw',
            },
          ],
        },
      ],
    };
    const matched: MatchedIngredient[] = [
      {
        ingredientId: 'i1',
        ingredientName: 'ức gà',
        foodCompositionId: 'fc-chicken-raw',
        matchedName: 'Thịt gà ta',
        similarity: 0.9,
        confidence: 'high',
        dbState: 'raw',
        nutritionPer100g: {
          ...noNutrition,
          caloriesKcal: 199,
          proteinG: 20.3,
          fatG: 13.1,
        },
      },
    ];

    const base = computeMacroBaseMap(decomposition, matched).get('i1')!;
    // 300g raw × 199 kcal/100g = 597 kcal — NOT 300 × 0.something
    expect(base.caloriesKcal).toBeCloseTo(597, 5);
    expect(base.proteinG).toBeCloseTo(60.9, 1);
    expect(base.fatG).toBeCloseTo(39.3, 1);
  });

  it('without weightBasis: a raw DB row + cooking method still converts', () => {
    const decomposition: MealDecompositionWithIds = {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          mealItemId: 'm1',
          name: 'ức gà nướng',
          cookingMethod: 'nướng',
          ingredients: [
            {
              ingredientId: 'i1',
              name: 'ức gà',
              estimatedGrams: 100,
              userFacingUnit: null,
              // no weightBasis — default as-eaten
            },
          ],
        },
      ],
    };
    const matched: MatchedIngredient[] = [
      {
        ingredientId: 'i1',
        ingredientName: 'ức gà',
        foodCompositionId: 'fc-chicken-raw',
        matchedName: 'Thịt gà ta',
        similarity: 0.9,
        confidence: 'high',
        dbState: 'raw',
        nutritionPer100g: {
          ...noNutrition,
          caloriesKcal: 199,
        },
      },
    ];
    const base = computeMacroBaseMap(decomposition, matched).get('i1')!;
    // 100g cooked × 0.75 (nướng) = 75g raw → 75 × 199/100 = 149.25 kcal
    expect(base.caloriesKcal).toBeCloseTo(149.25, 2);
  });
});

describe('__testing.guardMacro — tighter prep-notes ratios', () => {
  it('accepts a 2× fat overshoot under prep-notes ratio (extra oil case)', () => {
    const out = __testing.guardMacro(
      { low: 9, mid: 10, high: 11 },
      5, // base
      'omelette',
      'fatG',
      2 // PREP_NOTES_FAT_MAX_RATIO
    );
    expect(out.mid).toBe(10);
  });

  // The displayed number is not always `mid`. Goal adjustment computes
  // `mid + aggression × (goal_bound − mid)`, so a cutting user at full
  // aggression is shown `high` outright. A guard that bounds only `mid` leaves
  // the number the user actually reads unbounded.
  it('holds every bound inside the envelope, not just mid', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // mid sits comfortably inside 5×3 + 15 = 30, but high is far outside it.
    const out = __testing.guardMacro(
      { low: 4, mid: 5, high: 50 },
      5,
      'cá chiên',
      'fatG',
      3,
      15 // shallow-fry absorbed-oil allowance
    );
    expect(out.mid).toBe(5);
    expect(out.high).toBe(30);
    expect(out.low).toBeGreaterThanOrEqual(5 / 3);
    expect(out.low).toBeLessThanOrEqual(out.mid);
    expect(out.mid).toBeLessThanOrEqual(out.high);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('leaves a fully in-envelope triple untouched', () => {
    const raw = { low: 4, mid: 6, high: 9 };
    expect(__testing.guardMacro(raw, 5, 'cá', 'fatG', 3, 0)).toBe(raw);
  });

  it('keeps high inside the ceiling after an overshooting mid is scaled', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Scaling alone would map high 200 → 60, still double the 30 ceiling.
    const out = __testing.guardMacro(
      { low: 50, mid: 100, high: 200 },
      5,
      'cá chiên',
      'fatG',
      3,
      15
    );
    expect(out.high).toBeLessThanOrEqual(30);
    expect(out.mid).toBeLessThanOrEqual(out.high);
    warn.mockRestore();
  });

  it('clamps fat to the prep-notes ceiling when it exceeds 2×', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = __testing.guardMacro(
      { low: 14, mid: 15, high: 16 }, // 3× base
      5,
      'omelette',
      'fatG',
      2
    );
    expect(out.mid).toBe(10);
    expect(warn).toHaveBeenCalled();
  });

  it('clamps fat to the prep-notes floor when it drops below 0.5× base', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = __testing.guardMacro(
      { low: 0.5, mid: 1, high: 1.5 }, // 0.2× base
      5,
      'omelette',
      'fatG',
      2
    );
    expect(out.mid).toBe(2.5);
    expect(warn).toHaveBeenCalled();
  });

  it('protein at 1.3× base passes the 1.4× prep-notes guard', () => {
    const out = __testing.guardMacro(
      { low: 12, mid: 13, high: 14 },
      10,
      'chicken skinless',
      'proteinG',
      1.4
    );
    expect(out.mid).toBe(13);
  });

  it('protein at 1.5× base is clamped (overshoot)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = __testing.guardMacro(
      { low: 14, mid: 15, high: 16 },
      10,
      'chicken skinless',
      'proteinG',
      1.4
    );
    expect(out.mid).toBe(14);
    expect(warn).toHaveBeenCalled();
  });
});

describe('resolveIngredientMacros — prepNotesPresent unlocks P/C', () => {
  function rawAdj(p: number, c: number, f: number): RawNutritionAdjustment {
    return {
      mealItems: [
        {
          mealItemName: 'đùi gà nướng',
          ingredients: [
            {
              ingredientName: 'đùi gà',
              caloriesKcal: { low: 0, mid: 0, high: 0 },
              proteinG: { low: p, mid: p, high: p },
              carbohydrateG: { low: c, mid: c, high: c },
              fatG: { low: f, mid: f, high: f },
            },
          ],
        },
      ],
    };
  }

  const decompositionFactory = (
    prepNotes?: string[]
  ): MealDecompositionWithIds => ({
    isFood: true,
    mealSlot: 'lunch',
    mealItems: [
      {
        mealItemId: 'm1',
        name: 'đùi gà nướng',
        cookingMethod: 'nướng',
        ingredients: [
          {
            ingredientId: 'i1',
            name: 'đùi gà',
            estimatedGrams: 100,
            userFacingUnit: null,
            prepNotes,
          },
        ],
      },
    ],
  });

  const matched: MatchedIngredient[] = [
    {
      ingredientId: 'i1',
      ingredientName: 'đùi gà',
      foodCompositionId: 'fc-thigh',
      matchedName: 'Đùi gà',
      similarity: 0.9,
      confidence: 'high',
      dbState: 'cooked',
      nutritionPer100g: {
        ...noNutrition,
        caloriesKcal: 220,
        proteinG: 18,
        carbohydrateG: 0,
        fatG: 14,
      },
    },
  ];

  it('without prepNotes: P/C are flat at base (LLM ignored)', () => {
    const out = reconcileNutritionIds(
      rawAdj(99, 99, 7), // LLM tries to spike protein
      decompositionFactory(undefined),
      matched
    );
    const ing = out.mealItems[0].ingredients[0];
    // base.proteinG = 18 × 100/100 = 18 → flat triple
    expect(ing.proteinG.low).toBeCloseTo(18, 3);
    expect(ing.proteinG.mid).toBeCloseTo(18, 3);
    expect(ing.proteinG.high).toBeCloseTo(18, 3);
  });

  it('with prepNotes: P moves under the 1.4× cap', () => {
    const out = reconcileNutritionIds(
      rawAdj(22, 0, 7), // 22/18 ≈ 1.22× — within band
      decompositionFactory(['bỏ da', 'bỏ mỡ']),
      matched
    );
    const ing = out.mealItems[0].ingredients[0];
    expect(ing.proteinG.mid).toBeCloseTo(22, 3);
    // fat 7/14 = 0.5× — at lower bound (allowed)
    expect(ing.fatG.mid).toBeCloseTo(7, 3);
  });

  it('with prepNotes: P clamps when beyond 1.4× cap (overshoot)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = reconcileNutritionIds(
      rawAdj(30, 0, 7), // 30/18 ≈ 1.67× — beyond cap
      decompositionFactory(['bỏ da', 'bỏ mỡ']),
      matched
    );
    const ing = out.mealItems[0].ingredients[0];
    expect(ing.proteinG.mid).toBeCloseTo(25.2, 3); // clamped to 1.4× base
  });

  it('empty prepNotes array is equivalent to no prep notes', () => {
    const out = reconcileNutritionIds(
      rawAdj(99, 99, 7),
      decompositionFactory([]),
      matched
    );
    const ing = out.mealItems[0].ingredients[0];
    expect(ing.proteinG.mid).toBeCloseTo(18, 3); // still flat at base
  });

  it('prepNotes with only whitespace is treated as empty', () => {
    const out = reconcileNutritionIds(
      rawAdj(99, 99, 7),
      decompositionFactory(['   ', '']),
      matched
    );
    const ing = out.mealItems[0].ingredients[0];
    expect(ing.proteinG.mid).toBeCloseTo(18, 3);
  });
});
