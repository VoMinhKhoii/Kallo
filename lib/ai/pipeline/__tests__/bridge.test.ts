import { describe, expect, it } from 'vitest';
import { NULL_NUTRITION_VALUES } from '../../__tests__/test-helpers';
import type { IngredientV2MatchResult } from '../../matching/top-k-cascade';
import { bridgeV2ToV1 } from '../bridge';
import type { GroundedEstimation, MealDecompositionV2 } from '../schemas-v2';

function v2Decomp(): MealDecompositionV2 {
  return {
    isFood: true,
    mealSlot: 'lunch',
    mealItems: [
      {
        name: 'đùi gà nướng',
        cookingMethod: 'nướng',
        ingredients: [
          {
            rawName: 'đùi gà',
            canonicalName: 'Đùi gà',
            prepNotes: ['bỏ da', 'bỏ mỡ'],
          },
        ],
      },
    ],
  };
}

function matchResultWithCandidate(): IngredientV2MatchResult[] {
  return [
    {
      ingredientIndex: 0,
      candidates: [
        {
          info: {
            ingredientName: 'đùi gà',
            foodCompositionId: 'fc-thigh',
            matchedName: 'Đùi gà',
            similarity: 0.92,
            confidence: 'high',
            state: 'cooked',
            source: 'fao',
            matchType: 'vector',
          },
          nutrition: {
            ...NULL_NUTRITION_VALUES,
            caloriesKcal: 220,
            proteinG: 24,
            carbohydrateG: 0,
            fatG: 14,
          },
          inediblePct: null,
        },
      ],
    },
  ];
}

function groundedAccepted(): GroundedEstimation {
  return {
    mealItems: [
      {
        mealItemName: 'đùi gà nướng',
        ingredients: [
          {
            ingredientName: 'đùi gà',
            selectedCandidateId: 'c1',
            grams: 150,
            caloriesKcal: { low: 270, mid: 290, high: 310 },
            proteinG: { low: 38, mid: 40, high: 42 },
            carbohydrateG: { low: 0, mid: 0, high: 0 },
            fatG: { low: 10, mid: 12, high: 14 },
          },
        ],
      },
    ],
  };
}

describe('bridgeV2ToV1 — accepted verdict', () => {
  it('produces a v1 decomposition with grams from Call 2 and weightBasis omitted for cooked candidates', () => {
    const out = bridgeV2ToV1({
      v2: v2Decomp(),
      matches: matchResultWithCandidate(),
      grounded: groundedAccepted(),
      mealContext: 'đùi gà nướng (bỏ da bỏ mỡ)',
    });
    expect(out.decomposition.mealItems[0].ingredients[0].grams).toBe(150);
    // cooked DB candidate → weightBasis is undefined (cooked-state path in
    // computeDbScalingGrams returns grams unchanged regardless).
    expect(
      out.decomposition.mealItems[0].ingredients[0].weightBasis
    ).toBeUndefined();
    // prepNotes carried over from v2.
    expect(out.decomposition.mealItems[0].ingredients[0].prepNotes).toEqual([
      'bỏ da',
      'bỏ mỡ',
    ]);
  });

  it('builds a MatchedIngredient with run-scoped ingredientId from the accepted candidate', () => {
    const out = bridgeV2ToV1({
      v2: v2Decomp(),
      matches: matchResultWithCandidate(),
      grounded: groundedAccepted(),
      mealContext: 'm',
    });
    expect(out.matched).toHaveLength(1);
    expect(out.matched[0].foodCompositionId).toBe('fc-thigh');
    expect(out.matched[0].similarity).toBe(0.92);
    expect(out.matched[0].ingredientId).toBe(
      out.decomposition.mealItems[0].ingredients[0].ingredientId
    );
  });

  it('emits exactly one verdict per ingredient and no unmatched entries', () => {
    const out = bridgeV2ToV1({
      v2: v2Decomp(),
      matches: matchResultWithCandidate(),
      grounded: groundedAccepted(),
      mealContext: 'm',
    });
    expect(out.verdicts).toHaveLength(1);
    expect(out.verdicts[0].verdict).toBe('accepted');
    expect(out.verdicts[0].selectedCandidateIdx).toBe(0);
    expect(out.unmatched).toHaveLength(0);
  });

  it('forces weightBasis="raw" when accepted candidate has dbState="raw"', () => {
    const matches = matchResultWithCandidate();
    matches[0].candidates[0].info.state = 'raw';
    const out = bridgeV2ToV1({
      v2: v2Decomp(),
      matches,
      grounded: groundedAccepted(),
      mealContext: 'm',
    });
    expect(out.decomposition.mealItems[0].ingredients[0].weightBasis).toBe(
      'raw'
    );
  });
});

describe('bridgeV2ToV1 — rejected verdict ("none")', () => {
  it('treats the ingredient as unmatched and records rejectReason', () => {
    const grounded: GroundedEstimation = {
      mealItems: [
        {
          mealItemName: 'đùi gà nướng',
          ingredients: [
            {
              ingredientName: 'đùi gà',
              selectedCandidateId: 'none',
              rejectReason: 'category mismatch — thigh ≠ whole-bird aggregate',
              grams: 150,
              caloriesKcal: { low: 250, mid: 280, high: 310 },
              proteinG: { low: 25, mid: 28, high: 30 },
              carbohydrateG: { low: 0, mid: 0, high: 0 },
              fatG: { low: 10, mid: 12, high: 14 },
            },
          ],
        },
      ],
    };
    const out = bridgeV2ToV1({
      v2: v2Decomp(),
      matches: matchResultWithCandidate(),
      grounded,
      mealContext: 'meal',
    });
    expect(out.matched).toHaveLength(0);
    expect(out.unmatched).toHaveLength(1);
    expect(out.unmatched[0].ingredientName).toBe('đùi gà');
    expect(out.unmatched[0].mealContext).toMatch(/rejected: category mismatch/);
    expect(out.verdicts[0].verdict).toBe('rejected');
    expect(out.verdicts[0].rejectReason).toMatch(/category mismatch/);
  });
});

describe('bridgeV2ToV1 — unmatched (no candidates emitted)', () => {
  it('routes Call 2 macros verbatim via the unmatched path', () => {
    const matchesNoCands: IngredientV2MatchResult[] = [
      { ingredientIndex: 0, candidates: [] },
    ];
    const grounded: GroundedEstimation = {
      mealItems: [
        {
          mealItemName: 'đùi gà nướng',
          ingredients: [
            {
              ingredientName: 'đùi gà',
              grams: 150,
              caloriesKcal: { low: 270, mid: 290, high: 310 },
              proteinG: { low: 38, mid: 40, high: 42 },
              carbohydrateG: { low: 0, mid: 0, high: 0 },
              fatG: { low: 10, mid: 12, high: 14 },
            },
          ],
        },
      ],
    };
    const out = bridgeV2ToV1({
      v2: v2Decomp(),
      matches: matchesNoCands,
      grounded,
      mealContext: 'm',
    });
    expect(out.matched).toHaveLength(0);
    expect(out.unmatched).toHaveLength(1);
    expect(out.verdicts[0].verdict).toBe('unmatched');
    // Macros in rawNutrition flow through verbatim.
    expect(out.rawNutrition.mealItems[0].ingredients[0].fatG.mid).toBe(12);
  });
});

describe('bridgeV2ToV1 — Call 2 macros into v1 nutrition shape', () => {
  it('synthesizes a v1 RawNutritionAdjustment with the same names + macros', () => {
    const out = bridgeV2ToV1({
      v2: v2Decomp(),
      matches: matchResultWithCandidate(),
      grounded: groundedAccepted(),
      mealContext: 'm',
    });
    expect(out.rawNutrition.mealItems).toHaveLength(1);
    expect(out.rawNutrition.mealItems[0].mealItemName).toBe('đùi gà nướng');
    expect(out.rawNutrition.mealItems[0].ingredients[0].fatG.mid).toBe(12);
  });
});

describe('bridgeV2ToV1 — selectedCandidateId out of range', () => {
  it('treats invalid candidate ids as rejected with reason for telemetry', () => {
    const grounded: GroundedEstimation = {
      mealItems: [
        {
          mealItemName: 'đùi gà nướng',
          ingredients: [
            {
              ingredientName: 'đùi gà',
              selectedCandidateId: 'c9',
              grams: 150,
              caloriesKcal: { low: 0, mid: 0, high: 0 },
              proteinG: { low: 0, mid: 0, high: 0 },
              carbohydrateG: { low: 0, mid: 0, high: 0 },
              fatG: { low: 0, mid: 0, high: 0 },
            },
          ],
        },
      ],
    };
    const out = bridgeV2ToV1({
      v2: v2Decomp(),
      matches: matchResultWithCandidate(),
      grounded,
      mealContext: 'm',
    });
    expect(out.verdicts[0].verdict).toBe('rejected');
    expect(out.verdicts[0].rejectReason).toMatch(/out of range/);
    expect(out.unmatched).toHaveLength(1);
  });
});

describe('bridgeV2ToV1 — unresolved (Call 2 dropped the ingredient)', () => {
  it('emits no 1g placeholder row and marks the ingredient unresolved_estimate', () => {
    // Call 2 returned NO grounded estimate for this ingredient (verdict=missing).
    const grounded: GroundedEstimation = { mealItems: [] };
    const out = bridgeV2ToV1({
      v2: v2Decomp(),
      matches: matchResultWithCandidate(),
      grounded,
      mealContext: 'm',
    });

    // No silent grams=1 row: the decomposition ingredient carries grams=0, and
    // NO matched / unmatched / rawNutrition row is synthesized for it.
    expect(out.decomposition.mealItems[0].ingredients[0].grams).toBe(0);
    expect(out.matched).toHaveLength(0);
    expect(out.unmatched).toHaveLength(0);
    expect(out.rawNutrition.mealItems).toHaveLength(0);

    // Plausibility trail exposes the unresolved state for the completeness gate.
    expect(out.plausibility).toHaveLength(1);
    expect(out.plausibility[0].state).toBe('unresolved_estimate');
    expect(out.plausibility[0].ingredientName).toBe('đùi gà');
    expect(out.plausibility[0].ingredientId).toBe(
      out.decomposition.mealItems[0].ingredients[0].ingredientId
    );
  });

  it('classifies a resolved matched ingredient as ok', () => {
    const out = bridgeV2ToV1({
      v2: v2Decomp(),
      matches: matchResultWithCandidate(),
      grounded: groundedAccepted(),
      mealContext: 'm',
    });
    expect(out.plausibility).toHaveLength(1);
    expect(out.plausibility[0].state).toBe('ok');
  });
});

describe('bridgeV2ToV1 — case-insensitive name matching', () => {
  it('pairs v2 decomp (capitalized) with grounded output (lowercase) correctly', () => {
    // Mimics what happens in production: the orchestrator capitalizes
    // decomposition names before sending to Call 2, but the LLM may echo
    // back lowercase. The bridge must still find each grounded ingredient.
    const v2: MealDecompositionV2 = {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          name: 'Đùi gà nướng', // capitalized in v2 decomp
          cookingMethod: 'nướng',
          ingredients: [
            { rawName: 'Đùi gà', canonicalName: 'Đùi gà' }, // capitalized
          ],
        },
      ],
    };
    const grounded: GroundedEstimation = {
      mealItems: [
        {
          mealItemName: 'đùi gà nướng', // LLM echoed back lowercase
          ingredients: [
            {
              ingredientName: 'đùi gà', // lowercase
              selectedCandidateId: 'c1',
              grams: 150,
              caloriesKcal: { low: 270, mid: 290, high: 310 },
              proteinG: { low: 38, mid: 40, high: 42 },
              carbohydrateG: { low: 0, mid: 0, high: 0 },
              fatG: { low: 10, mid: 12, high: 14 },
            },
          ],
        },
      ],
    };
    const out = bridgeV2ToV1({
      v2,
      matches: matchResultWithCandidate(),
      grounded,
      mealContext: 'm',
    });
    expect(out.verdicts[0].verdict).toBe('accepted');
    expect(out.matched).toHaveLength(1);
    expect(out.matched[0].foodCompositionId).toBe('fc-thigh');
  });
});

describe('bridgeV2ToV1 — Phase 3 portion-resolution anchor', () => {
  it('OVERRIDES the LLM grams with the resolver anchor (steps 1–4)', () => {
    const out = bridgeV2ToV1({
      v2: v2Decomp(),
      matches: matchResultWithCandidate(),
      grounded: groundedAccepted(), // Call 2 said 150g
      mealContext: 'm',
      portionResolutions: [
        {
          grams: { low: 300, mid: 330, high: 360 },
          provenance: 'retrieved_prior',
          confidence: 'high',
          note: 'prior',
        },
      ],
    });
    // The server anchor (330) wins over the LLM's 150.
    expect(out.decomposition.mealItems[0].ingredients[0].grams).toBe(330);
  });

  it('keeps the LLM grams when the resolver deferred (llm_range)', () => {
    const out = bridgeV2ToV1({
      v2: v2Decomp(),
      matches: matchResultWithCandidate(),
      grounded: groundedAccepted(),
      mealContext: 'm',
      portionResolutions: [
        { grams: null, provenance: 'llm_range', confidence: 'none', note: '' },
      ],
    });
    expect(out.decomposition.mealItems[0].ingredients[0].grams).toBe(150);
  });

  it('forces unresolved_estimate + ambiguous_food reason when the resolver clarifies', () => {
    const out = bridgeV2ToV1({
      v2: v2Decomp(),
      matches: matchResultWithCandidate(),
      grounded: groundedAccepted(),
      mealContext: 'm',
      portionResolutions: [
        {
          grams: null,
          provenance: 'unresolved',
          confidence: 'none',
          unresolvedReason: 'ambiguous_food',
          note: 'ambiguous',
        },
      ],
    });
    expect(out.plausibility[0].state).toBe('unresolved_estimate');
    expect(out.plausibility[0].unresolvedReason).toBe('ambiguous_food');
    // Unresolved ingredients contribute no matched row.
    expect(out.matched).toHaveLength(0);
  });
});
