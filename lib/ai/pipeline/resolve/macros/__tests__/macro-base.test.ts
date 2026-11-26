import { describe, expect, it } from 'vitest';
import { NULL_NUTRITION_VALUES } from '@/lib/ai/__fixtures__/test-helpers';
import type { MealDecompositionWithIds } from '@/lib/ai/pipeline/contracts/decomposition-ids';
import {
  classifyPureFat,
  computeDbScalingGrams,
  computeMacroBaseMap,
  scalePer100g,
} from '@/lib/ai/pipeline/resolve/macros/macro-base';
import type { MatchedIngredient } from '@/lib/ai/types/matching';

const noNutrition = NULL_NUTRITION_VALUES;

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

describe('classifyPureFat and MacroBase metadata', () => {
  it('classifies pure oils (fat >= 95, P <= 1, C <= 1) and butter (80 <= fat < 95, P <= 2, C <= 2)', () => {
    expect(
      classifyPureFat({
        ...noNutrition,
        caloriesKcal: 884,
        proteinG: 0,
        carbohydrateG: 0,
        fatG: 100,
      })
    ).toBe('oil');
    expect(
      classifyPureFat({
        ...noNutrition,
        caloriesKcal: 876,
        proteinG: 0.3,
        carbohydrateG: 0,
        fatG: 99.5,
      })
    ).toBe('oil');
    expect(
      classifyPureFat({
        ...noNutrition,
        caloriesKcal: 717,
        proteinG: 0.85,
        carbohydrateG: 0.06,
        fatG: 81.1,
      })
    ).toBe('butter');
    expect(
      classifyPureFat({
        ...noNutrition,
        caloriesKcal: 717,
        proteinG: 0.2,
        carbohydrateG: 0.7,
        fatG: 80,
      })
    ).toBe('butter');
  });

  it('does not classify peanut butter, mayonnaise, or avocado as pure fat', () => {
    // Peanut butter: ~50g fat, ~25g protein, ~20g carb
    expect(
      classifyPureFat({
        ...noNutrition,
        caloriesKcal: 588,
        proteinG: 25,
        carbohydrateG: 20,
        fatG: 50,
      })
    ).toBeNull();
    // Mayonnaise: ~75g fat, ~1g protein, ~0.6g carb
    expect(
      classifyPureFat({
        ...noNutrition,
        caloriesKcal: 680,
        proteinG: 1,
        carbohydrateG: 0.6,
        fatG: 75,
      })
    ).toBeNull();
    // Avocado: ~15g fat, ~2g protein, ~8.5g carb
    expect(
      classifyPureFat({
        ...noNutrition,
        caloriesKcal: 160,
        proteinG: 2,
        carbohydrateG: 8.5,
        fatG: 15,
      })
    ).toBeNull();
  });

  it('flags matchedRowIsFried when row name or card cookingMethod indicates a fried row', () => {
    const base = scalePer100g(
      { ...noNutrition, caloriesKcal: 196, proteinG: 13.6, fatG: 14.8 },
      100,
      undefined,
      { matchedNameEn: 'Egg, whole, cooked, fried' }
    );
    expect(base.matchedRowIsFried).toBe(true);
    expect(base.pureFatKind).toBeNull();

    const byMethod = scalePer100g(
      { ...noNutrition, caloriesKcal: 260, proteinG: 9, fatG: 12 },
      100,
      undefined,
      {
        matchedNameEn: 'Spring roll',
        rowCookingMethod: 'deep-fried',
      }
    );
    expect(byMethod.matchedRowIsFried).toBe(true);

    const plain = scalePer100g(
      { ...noNutrition, caloriesKcal: 290, proteinG: 22, fatG: 22 },
      100,
      undefined,
      { matchedNameEn: 'Pork spareribs, raw' }
    );
    expect(plain.matchedRowIsFried).toBeUndefined();
  });
});
