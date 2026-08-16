/**
 * End-to-end-ish scenario harness for the prepNotes + weightBasis feature.
 *
 * What this tests: the *server-side* half of the pipeline. For each scenario
 * we hand-construct the decomposition output that the LLM is expected to
 * emit (based on the rules baked into the new decomposition prompt), then
 * push it through `computeMacroBaseMap` + `reconcileNutritionIds` with a
 * synthesized DB match. The LLM's nutrition-adjustment output is also
 * hand-constructed to mimic what Call 2 would produce under the new prompt
 * guidance.
 *
 * Each test prints the resulting macros so a human can eyeball the
 * variance between scenarios.
 */
import { describe, expect, it } from 'vitest';
import { NULL_NUTRITION_VALUES } from '@/lib/ai/__tests__/test-helpers';
import type { MealDecompositionWithIds } from '@/lib/ai/pipeline/contracts/decomposition-ids';
import {
  computeMacroBaseMap,
  type RawNutritionAdjustment,
  reconcileNutritionIds,
} from '@/lib/ai/pipeline/resolve/macro-resolution';
import type { BoundedEstimate, MatchedIngredient } from '@/lib/ai/types';

// ---------------------------------------------------------------------------
// Synthetic DB entries (per-100g) — sourced from FAO_VN_2007 / USDA priors.
// ---------------------------------------------------------------------------

const CHICKEN_BREAST_RAW = {
  ...NULL_NUTRITION_VALUES,
  caloriesKcal: 120,
  proteinG: 22.5,
  carbohydrateG: 0,
  fatG: 2.6,
};

const CHICKEN_THIGH_COOKED = {
  ...NULL_NUTRITION_VALUES,
  caloriesKcal: 220,
  proteinG: 24,
  carbohydrateG: 0,
  fatG: 14, // skin-on, with fat
};

const EGG_COOKED = {
  ...NULL_NUTRITION_VALUES,
  caloriesKcal: 155,
  proteinG: 13,
  carbohydrateG: 1.1,
  fatG: 11,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function triple(v: number): BoundedEstimate {
  return { low: v, mid: v, high: v };
}

function runScenario(input: {
  label: string;
  decomposition: MealDecompositionWithIds;
  matched: MatchedIngredient[];
  llmAdjustment: RawNutritionAdjustment;
}): {
  base: ReturnType<typeof computeMacroBaseMap>;
  resolved: ReturnType<typeof reconcileNutritionIds>;
} {
  const base = computeMacroBaseMap(input.decomposition, input.matched);
  const resolved = reconcileNutritionIds(
    input.llmAdjustment,
    input.decomposition,
    input.matched
  );
  const ing = resolved.mealItems[0].ingredients[0];
  console.info(
    `\n=== ${input.label} ===\n` +
      `  kcal:    ${ing.caloriesKcal.low.toFixed(1)} / ${ing.caloriesKcal.mid.toFixed(1)} / ${ing.caloriesKcal.high.toFixed(1)}\n` +
      `  protein: ${ing.proteinG.low.toFixed(1)} / ${ing.proteinG.mid.toFixed(1)} / ${ing.proteinG.high.toFixed(1)}\n` +
      `  carb:    ${ing.carbohydrateG.low.toFixed(1)} / ${ing.carbohydrateG.mid.toFixed(1)} / ${ing.carbohydrateG.high.toFixed(1)}\n` +
      `  fat:     ${ing.fatG.low.toFixed(1)} / ${ing.fatG.mid.toFixed(1)} / ${ing.fatG.high.toFixed(1)}\n`
  );
  return { base, resolved };
}

describe('scenario harness — prepNotes + weightBasis macro variance', () => {
  it('Scenario A — baseline: "150g đùi gà nướng" (no prep, no weight basis)', () => {
    const { resolved } = runScenario({
      label: 'A. 150g đùi gà nướng (baseline)',
      decomposition: {
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
                estimatedGrams: 150,
                userFacingUnit: null,
                expectedState: 'cooked',
              },
            ],
          },
        ],
      },
      matched: [
        {
          ingredientId: 'i1',
          ingredientName: 'đùi gà',
          foodCompositionId: 'fc-thigh',
          matchedName: 'Đùi gà',
          similarity: 0.92,
          confidence: 'high',
          dbState: 'cooked',
          nutritionPer100g: CHICKEN_THIGH_COOKED,
        },
      ],
      // Call 2 under no prep notes: only fat is LLM-controlled; LLM leaves
      // it near base for plain nướng (no oil added).
      llmAdjustment: {
        mealItems: [
          {
            mealItemName: 'đùi gà nướng',
            ingredients: [
              {
                ingredientName: 'đùi gà',
                caloriesKcal: triple(0),
                proteinG: triple(0),
                carbohydrateG: triple(0),
                fatG: { low: 20, mid: 21, high: 22 }, // 21/21 base = 1×
              },
            ],
          },
        ],
      },
    });
    const ing = resolved.mealItems[0].ingredients[0];
    // base.proteinG = 24 × 1.5 = 36; flat triple
    expect(ing.proteinG.mid).toBeCloseTo(36, 1);
    expect(ing.fatG.mid).toBeCloseTo(21, 1); // LLM-passed, within guard
  });

  it('Scenario B — "1 Đùi gà nướng (bỏ da bỏ mỡ)": prep-notes pulls fat down, nudges P up', () => {
    const { resolved } = runScenario({
      label: 'B. 150g đùi gà nướng (bỏ da bỏ mỡ)',
      decomposition: {
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
                estimatedGrams: 150,
                userFacingUnit: null,
                expectedState: 'cooked',
                prepNotes: ['bỏ da', 'bỏ mỡ'],
              },
            ],
          },
        ],
      },
      matched: [
        {
          ingredientId: 'i1',
          ingredientName: 'đùi gà',
          foodCompositionId: 'fc-thigh',
          matchedName: 'Đùi gà',
          similarity: 0.92,
          confidence: 'high',
          dbState: 'cooked',
          nutritionPer100g: CHICKEN_THIGH_COOKED,
        },
      ],
      // LLM under prep_notes="bỏ da | bỏ mỡ": drops fat ~50% of base
      // (skin off chicken thigh ≈ 7g fat/100g vs 14 with skin), nudges
      // protein up ~15% per gram of remaining lean tissue.
      llmAdjustment: {
        mealItems: [
          {
            mealItemName: 'đùi gà nướng',
            ingredients: [
              {
                ingredientName: 'đùi gà',
                caloriesKcal: triple(0),
                proteinG: { low: 40, mid: 41, high: 42 }, // 41/36 ≈ 1.14×
                carbohydrateG: triple(0),
                fatG: { low: 10, mid: 11, high: 13 }, // 11/21 ≈ 0.52×
              },
            ],
          },
        ],
      },
    });
    const ing = resolved.mealItems[0].ingredients[0];
    // Both P and F move within guard
    expect(ing.proteinG.mid).toBeCloseTo(41, 1);
    expect(ing.fatG.mid).toBeCloseTo(11, 1);
    // kcal derived: 4×41 + 4×0 + 9×11 = 164 + 99 = 263 (vs baseline 4×36 + 9×21 = 333)
    expect(ing.caloriesKcal.mid).toBeCloseTo(263, 1);
  });

  it('Scenario C — "300gr ức gà nấu chậm (cân sống)": grams scale 1:1 against raw row', () => {
    const { base, resolved } = runScenario({
      label: 'C. 300g ức gà nấu chậm (cân sống)',
      decomposition: {
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
                expectedState: 'raw', // forced by deriveExpectedState
              },
            ],
          },
        ],
      },
      matched: [
        {
          ingredientId: 'i1',
          ingredientName: 'ức gà',
          foodCompositionId: 'fc-breast-raw',
          matchedName: 'Ức gà raw',
          similarity: 0.9,
          confidence: 'high',
          dbState: 'raw',
          nutritionPer100g: CHICKEN_BREAST_RAW,
        },
      ],
      llmAdjustment: {
        mealItems: [
          {
            mealItemName: 'ức gà nấu chậm',
            ingredients: [
              {
                ingredientName: 'ức gà',
                caloriesKcal: triple(0),
                proteinG: triple(0),
                carbohydrateG: triple(0),
                fatG: { low: 7, mid: 8, high: 9 }, // base.fatG = 7.8; LLM near base
              },
            ],
          },
        ],
      },
    });
    // base.calories = 300 × 120/100 = 360 kcal — NOT 300 × 0.38 × 120/100 = 137
    expect(base.get('i1')!.caloriesKcal).toBeCloseTo(360, 1);
    expect(base.get('i1')!.proteinG).toBeCloseTo(67.5, 1);
    expect(base.get('i1')!.fatG).toBeCloseTo(7.8, 1);
    const ing = resolved.mealItems[0].ingredients[0];
    expect(ing.proteinG.mid).toBeCloseTo(67.5, 1); // flat at base (no prep notes)
    expect(ing.fatG.mid).toBeCloseTo(8, 1); // LLM-passed within guard
  });

  it('Scenario D — omelette with "extra oil": fat up to ~2× base', () => {
    const { resolved } = runScenario({
      label: 'D. 1 omelette 2 quả trứng (thêm dầu nhiều)',
      decomposition: {
        isFood: true,
        mealSlot: 'breakfast',
        mealItems: [
          {
            mealItemId: 'm1',
            name: 'omelette',
            cookingMethod: 'chiên',
            ingredients: [
              {
                ingredientId: 'i1',
                name: 'trứng gà',
                estimatedGrams: 100,
                userFacingUnit: null,
                expectedState: 'cooked',
                prepNotes: ['thêm dầu nhiều'],
              },
            ],
          },
        ],
      },
      matched: [
        {
          ingredientId: 'i1',
          ingredientName: 'trứng gà',
          foodCompositionId: 'fc-egg',
          matchedName: 'Trứng gà',
          similarity: 0.95,
          confidence: 'high',
          dbState: 'cooked',
          nutritionPer100g: EGG_COOKED,
        },
      ],
      // LLM under prep_notes="thêm dầu nhiều": fat near 2× base.
      // P/C don't change (oil doesn't add protein/carb).
      llmAdjustment: {
        mealItems: [
          {
            mealItemName: 'omelette',
            ingredients: [
              {
                ingredientName: 'trứng gà',
                caloriesKcal: triple(0),
                proteinG: triple(13.2), // 1.02× — basically base
                carbohydrateG: triple(1.1),
                fatG: { low: 18, mid: 21, high: 24 }, // 21/11 ≈ 1.9×
              },
            ],
          },
        ],
      },
    });
    const ing = resolved.mealItems[0].ingredients[0];
    // base kcal would be 4×13 + 4×1.1 + 9×11 = 156.4 (egg cooked baseline)
    // With prep notes: 4×13.2 + 4×1.1 + 9×21 = 52.8 + 4.4 + 189 = 246.2
    expect(ing.fatG.mid).toBeCloseTo(21, 1);
    expect(ing.caloriesKcal.mid).toBeCloseTo(246.2, 1);
    // ~1.57× baseline kcal — matches user's intuition: "may just double"
  });

  it('Scenario E — flavor-only note "ít muối": macros stay at base', () => {
    const { resolved } = runScenario({
      label: 'E. 150g đùi gà nướng (ít muối)',
      decomposition: {
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
                estimatedGrams: 150,
                userFacingUnit: null,
                expectedState: 'cooked',
                prepNotes: ['ít muối'],
              },
            ],
          },
        ],
      },
      matched: [
        {
          ingredientId: 'i1',
          ingredientName: 'đùi gà',
          foodCompositionId: 'fc-thigh',
          matchedName: 'Đùi gà',
          similarity: 0.92,
          confidence: 'high',
          dbState: 'cooked',
          nutritionPer100g: CHICKEN_THIGH_COOKED,
        },
      ],
      // LLM correctly recognizes sodium-only modifier — keeps macros at base.
      llmAdjustment: {
        mealItems: [
          {
            mealItemName: 'đùi gà nướng',
            ingredients: [
              {
                ingredientName: 'đùi gà',
                caloriesKcal: triple(0),
                proteinG: triple(36), // = base
                carbohydrateG: triple(0),
                fatG: triple(21), // = base
              },
            ],
          },
        ],
      },
    });
    const ing = resolved.mealItems[0].ingredients[0];
    // All macros at base — sodium isn't tracked in the 4-macro pipeline.
    expect(ing.proteinG.mid).toBeCloseTo(36, 1);
    expect(ing.fatG.mid).toBeCloseTo(21, 1);
  });

  it('Scenario F — combined: "200g ức gà chiên (cân sống, bỏ da, không dầu)"', () => {
    const { base, resolved } = runScenario({
      label: 'F. 200g ức gà chiên (cân sống, bỏ da, không dầu)',
      decomposition: {
        isFood: true,
        mealSlot: 'lunch',
        mealItems: [
          {
            mealItemId: 'm1',
            name: 'ức gà chiên',
            cookingMethod: 'chiên',
            ingredients: [
              {
                ingredientId: 'i1',
                name: 'ức gà',
                estimatedGrams: 200,
                userFacingUnit: null,
                weightBasis: 'raw',
                expectedState: 'raw',
                prepNotes: ['bỏ da', 'không dầu'],
              },
            ],
          },
        ],
      },
      matched: [
        {
          ingredientId: 'i1',
          ingredientName: 'ức gà',
          foodCompositionId: 'fc-breast-raw',
          matchedName: 'Ức gà raw',
          similarity: 0.9,
          confidence: 'high',
          dbState: 'raw',
          nutritionPer100g: CHICKEN_BREAST_RAW,
        },
      ],
      // base from 200g raw × CHICKEN_BREAST_RAW = 240 kcal, 45g P, 5.2g F
      // Under prep_notes="bỏ da | không dầu": ức gà is already mostly
      // skinless; "bỏ da" trims residual; "không dầu" prevents oil pickup.
      // Fat stays near base (no addition) or slightly under.
      llmAdjustment: {
        mealItems: [
          {
            mealItemName: 'ức gà chiên',
            ingredients: [
              {
                ingredientName: 'ức gà',
                caloriesKcal: triple(0),
                proteinG: { low: 47, mid: 48, high: 50 }, // 48/45 ≈ 1.07×
                carbohydrateG: triple(0),
                fatG: { low: 2.8, mid: 3.5, high: 4.5 }, // 3.5/5.2 ≈ 0.67×
              },
            ],
          },
        ],
      },
    });
    expect(base.get('i1')!.caloriesKcal).toBeCloseTo(240, 1);
    expect(base.get('i1')!.proteinG).toBeCloseTo(45, 1);
    expect(base.get('i1')!.fatG).toBeCloseTo(5.2, 1);
    const ing = resolved.mealItems[0].ingredients[0];
    // P and F move under prep-notes band; kcal derived from 4P + 9F.
    expect(ing.proteinG.mid).toBeCloseTo(48, 1);
    expect(ing.fatG.mid).toBeCloseTo(3.5, 1);
    expect(ing.caloriesKcal.mid).toBeCloseTo(4 * 48 + 9 * 3.5, 1); // 223.5
  });
});
