import { describe, expect, it } from 'vitest';
import { NULL_NUTRITION_VALUES } from '@/lib/ai/__tests__/test-helpers';
import type { IngredientV2MatchResult } from '@/lib/ai/matching/top-k-cascade';
import type { MealDecompositionV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type { GroundedEstimation } from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import { resolveCompletenessGate } from '@/lib/ai/pipeline/resolve/completeness-gate';
import { bridgeV2ToV1 } from '@/lib/ai/pipeline/resolve/resolve';
import {
  groundedAccepted,
  matchResultWithCandidate,
  v2Decomp,
} from './bridge-fixtures';

describe('completeness gate — per-ingredient, not per-meal', () => {
  // The route's `empty_nutrition` check is `meal.items.some(item =>
  // item.macros.calories !== 0 || item.macros.protein !== 0)`. One healthy
  // item satisfies it for the WHOLE meal, so a fully-withheld sibling rode
  // along invisibly: "1 tô mì gói + sữa" persisted a 0g / 0 kcal "Mì gói"
  // row next to a 152 kcal "Sữa tươi" row and booked the day at 152 kcal.
  function twoItemMeal(): MealDecompositionV2 {
    return {
      isFood: true,
      mealSlot: 'breakfast',
      mealItems: [
        {
          name: 'Mì gói',
          cookingMethod: 'nấu',
          ingredients: [{ rawName: 'mì gói', canonicalName: 'Mì gói' }],
        },
        {
          name: 'Sữa tươi',
          cookingMethod: 'không',
          ingredients: [{ rawName: 'sữa tươi', canonicalName: 'Sữa bò tươi' }],
        },
      ],
    };
  }

  const milkMatch: IngredientV2MatchResult = {
    ingredientIndex: 1,
    candidates: [
      {
        info: {
          ingredientName: 'sữa tươi',
          foodCompositionId: 'fc-milk',
          matchedName: 'Sữa bò tươi',
          similarity: 0.95,
          confidence: 'high',
          state: 'raw',
          source: 'fao',
          matchType: 'vector',
        },
        nutrition: {
          ...NULL_NUTRITION_VALUES,
          caloriesKcal: 74,
          proteinG: 3.9,
          carbohydrateG: 4.8,
          fatG: 4.4,
        },
        inediblePct: null,
      },
    ],
  };

  const milkGrounded = {
    mealItemName: 'Sữa tươi',
    ingredients: [
      {
        ingredientName: 'sữa tươi',
        selectedCandidateId: 'c1',
        grossG: 200,
        refusePct: 0,
        caloriesKcal: { low: 140, mid: 150, high: 160 },
        proteinG: { low: 7, mid: 7.8, high: 8.5 },
        carbohydrateG: { low: 9, mid: 9.6, high: 10.5 },
        fatG: { low: 8, mid: 8.8, high: 9.5 },
      },
    ],
  };

  function groundedFor(includeNoodles: boolean): GroundedEstimation {
    return {
      mealItems: [
        // When Call 2 DROPS the noodle item entirely (a failed emission),
        // there are no grams from anywhere → macroSource 'no_portion' →
        // carve-out. Omission of a FIELD can no longer happen (schema), so a
        // dropped INGREDIENT is the withhold trigger this gate now guards.
        ...(includeNoodles
          ? [
              {
                mealItemName: 'Mì gói',
                ingredients: [
                  {
                    ingredientName: 'mì gói',
                    grossG: 350,
                    refusePct: 0,
                    caloriesKcal: { low: 380, mid: 410, high: 440 },
                    proteinG: { low: 18, mid: 20, high: 22 },
                    carbohydrateG: { low: 50, mid: 55, high: 60 },
                    fatG: { low: 34, mid: 37, high: 40 },
                  },
                ],
              },
            ]
          : []),
        milkGrounded,
      ],
    };
  }

  it('gates when ONE item is withheld and a healthy sibling remains', () => {
    const out = bridgeV2ToV1({
      v2: twoItemMeal(),
      matches: [{ ingredientIndex: 0, candidates: [] }, milkMatch],
      grounded: groundedFor(false),
      mealContext: '1 tô mì gói sứa',
    });

    // The milk survives — which is exactly why the meal-level predicate was
    // no help. Only the per-ingredient signal can catch this.
    expect(out.rawNutrition.mealItems).toHaveLength(1);
    expect(out.rawNutrition.mealItems[0].ingredients[0].ingredientName).toBe(
      'sữa tươi'
    );

    expect(out.carvedOut).toHaveLength(1);
    expect(out.carvedOut[0]).toMatchObject({
      mealItemName: 'Mì gói',
      ingredientName: 'mì gói',
      reason: 'no_portion',
      mealItemIdx: 0,
      activeIngredientCount: 1,
    });

    const gate = resolveCompletenessGate({
      failedMealItemNames: [],
      carvedOut: out.carvedOut,
    });
    expect(gate?.reason).toBe('no_macro_data');
    expect(gate?.ingredientName).toBe('mì gói');
    expect(gate?.unresolvedCount).toBe(1);
  });

  it('does not gate once every ingredient ships', () => {
    const out = bridgeV2ToV1({
      v2: twoItemMeal(),
      matches: [{ ingredientIndex: 0, candidates: [] }, milkMatch],
      grounded: groundedFor(true),
      mealContext: '1 tô mì gói sứa',
    });

    expect(out.carvedOut).toEqual([]);
    expect(out.rawNutrition.mealItems).toHaveLength(2);
    expect(
      resolveCompletenessGate({
        failedMealItemNames: [],
        carvedOut: out.carvedOut,
      })
    ).toBeUndefined();
  });

  it('does NOT gate on an explicit zero — the user meant that row to be absent', () => {
    // "0 fried chicken" is a correct description, not a coverage gap.
    const out = bridgeV2ToV1({
      v2: v2Decomp(),
      matches: matchResultWithCandidate(),
      grounded: groundedAccepted(),
      mealContext: 'm',
      portionResolutions: [
        {
          grams: null,
          massBasis: null,
          provenance: 'unresolved',
          confidence: 'none',
          unresolvedReason: 'explicit_zero',
          note: 'user typed an explicit zero',
        },
      ],
    });

    expect(out.carvedOut).toEqual([]);
    expect(
      resolveCompletenessGate({
        failedMealItemNames: [],
        carvedOut: out.carvedOut,
      })
    ).toBeUndefined();
  });

  it('gates when every ACTIVE ingredient is withheld beside an explicit zero', () => {
    // "1 đĩa salad, 0 gà rán": the fried chicken is SUPPOSED to be absent, so
    // it never enters `carvedOut`. If it still counted toward the item's
    // ingredient total, the withheld lettuce (1) would never reach the
    // denominator (2) and the whole 0 kcal item would persist unflagged.
    // Neither ingredient is a carb staple, so only the whole-item rule can
    // gate here.
    const out = bridgeV2ToV1({
      v2: {
        isFood: true,
        mealSlot: 'lunch',
        mealItems: [
          {
            name: 'Salad gà',
            cookingMethod: 'không',
            ingredients: [
              { rawName: 'xà lách', canonicalName: 'Xà lách' },
              { rawName: 'gà rán', canonicalName: 'Gà rán' },
            ],
          },
        ],
      },
      matches: [
        { ingredientIndex: 0, candidates: [] },
        { ingredientIndex: 1, candidates: [] },
      ],
      grounded: { mealItems: [] },
      mealContext: '1 đĩa salad, 0 gà rán',
      portionResolutions: [
        {
          grams: null,
          massBasis: null,
          provenance: 'unresolved',
          confidence: 'none',
          unresolvedReason: 'unresolved_portion',
          note: 'no portion signal',
        },
        {
          grams: null,
          massBasis: null,
          provenance: 'unresolved',
          confidence: 'none',
          unresolvedReason: 'explicit_zero',
          note: 'user typed an explicit zero',
        },
      ],
    });

    expect(out.carvedOut).toHaveLength(1);
    expect(out.carvedOut[0]).toMatchObject({
      ingredientName: 'xà lách',
      mealItemIdx: 0,
      // 2 ingredients - 1 explicit zero.
      activeIngredientCount: 1,
    });

    const gate = resolveCompletenessGate({
      failedMealItemNames: [],
      carvedOut: out.carvedOut,
    });
    expect(gate?.reason).toBe('no_macro_data');
    expect(gate?.ingredientName).toBe('xà lách');
  });

  it('ranks a transient chunk failure ahead of a carve-out', () => {
    // Chunk failure is genuinely worth retrying verbatim; a carve-out usually
    // needs the input reworded. Reporting the retryable one first is kinder.
    const gate = resolveCompletenessGate({
      failedMealItemNames: ['Mì gói'],
      carvedOut: [
        {
          mealItemName: 'Mì gói',
          ingredientName: 'mì gói',
          reason: 'no_estimate',
          mealItemIdx: 0,
          activeIngredientCount: 1,
        },
      ],
    });
    expect(gate?.reason).toBe('processing_incomplete');
  });
});

describe('completeness gate — only MATERIAL carve-outs fail the meal', () => {
  it('ships a dropped garnish that has surviving siblings', () => {
    // Throwing away a 99%-correct meal because the LLM forgot to estimate the
    // scallions is worse for the user than shipping them at zero.
    expect(
      resolveCompletenessGate({
        failedMealItemNames: [],
        carvedOut: [
          {
            mealItemName: 'Bún chả',
            ingredientName: 'hành lá',
            reason: 'no_estimate',
            mealItemIdx: 0,
            activeIngredientCount: 4,
          },
        ],
      })
    ).toBeUndefined();
  });

  it('gates when a meal item loses EVERY one of its ingredients', () => {
    const gate = resolveCompletenessGate({
      failedMealItemNames: [],
      carvedOut: [
        {
          mealItemName: 'Salad',
          ingredientName: 'xà lách',
          reason: 'no_estimate',
          mealItemIdx: 1,
          activeIngredientCount: 2,
        },
        {
          mealItemName: 'Salad',
          ingredientName: 'cà chua',
          reason: 'no_portion',
          mealItemIdx: 1,
          activeIngredientCount: 2,
        },
      ],
    });
    expect(gate?.reason).toBe('no_macro_data');
    expect(gate?.mealItemName).toBe('Salad');
    expect(gate?.unresolvedCount).toBe(2);
  });

  it('gates on a carved-out carb staple even with surviving siblings', () => {
    // Rice carries the bulk of the calories — dropping it halves the meal.
    const gate = resolveCompletenessGate({
      failedMealItemNames: [],
      carvedOut: [
        {
          mealItemName: 'Cơm tấm',
          ingredientName: 'cơm trắng',
          reason: 'no_portion',
          mealItemIdx: 0,
          activeIngredientCount: 3,
        },
      ],
    });
    expect(gate?.reason).toBe('no_macro_data');
    expect(gate?.ingredientName).toBe('cơm trắng');
    expect(gate?.unresolvedCount).toBe(1);
  });

  it('reports only the material carve-outs, not the immaterial siblings', () => {
    const gate = resolveCompletenessGate({
      failedMealItemNames: [],
      carvedOut: [
        {
          mealItemName: 'Cơm tấm',
          ingredientName: 'rau thơm',
          reason: 'no_estimate',
          mealItemIdx: 0,
          activeIngredientCount: 3,
        },
        {
          mealItemName: 'Cơm tấm',
          ingredientName: 'cơm trắng',
          reason: 'no_portion',
          mealItemIdx: 0,
          activeIngredientCount: 3,
        },
      ],
    });
    expect(gate?.unresolvedCount).toBe(1);
    expect(gate?.carvedOutNames).toEqual(['cơm trắng']);
  });
});
