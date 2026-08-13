import { describe, expect, it } from 'vitest';
import { NULL_NUTRITION_VALUES } from '../../__tests__/test-helpers';
import type { IngredientV2MatchResult } from '../../matching/top-k-cascade';
import { bridgeV2ToV1 } from '../bridge';
import { ZERO_TRIPLE } from '../bridge-verdicts';
import { resolveCompletenessGate } from '../completeness-gate';
import { __testing as nutritionTesting } from '../nutrition';
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

function nullNutritionMatch(): IngredientV2MatchResult[] {
  // Accepted candidate whose Phase-5 batch nutrition fetch missed.
  return [
    {
      ingredientIndex: 0,
      candidates: [
        {
          info: {
            state: 'raw',
            source: 'fao',
            matchType: 'fuzzy',
            confidence: 'high',
            similarity: 1,
            foodGroupEn: 'Cereals',
            matchedName: 'Bún tươi',
            ingredientName: 'Bún tươi',
            foodCompositionId: 'fao_x_raw',
          },
          nutrition: null,
          inediblePct: null,
        },
      ],
    },
  ] as unknown as IngredientV2MatchResult[];
}

describe('bridgeV2ToV1 — accepted verdict', () => {
  it('derives edible resolvedGrams from grossG and refusePct', () => {
    const v2: MealDecompositionV2 = {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          name: 'đậu hũ',
          cookingMethod: 'hấp',
          ingredients: [{ rawName: 'đậu hũ', canonicalName: 'Đậu hũ' }],
        },
      ],
    };
    const grounded: GroundedEstimation = {
      mealItems: [
        {
          mealItemName: 'đậu hũ',
          ingredients: [
            {
              ingredientName: 'đậu hũ',
              grossG: 100,
              refusePct: 50,
              caloriesKcal: { low: 70, mid: 80, high: 90 },
              proteinG: { low: 7, mid: 8, high: 9 },
              carbohydrateG: { low: 1, mid: 2, high: 3 },
              fatG: { low: 3, mid: 4, high: 5 },
            },
          ],
        },
      ],
    };
    const out = bridgeV2ToV1({
      v2,
      matches: [{ ingredientIndex: 0, candidates: [] }],
      grounded,
      mealContext: 'đậu hũ',
    });
    expect(out.decomposition.mealItems[0].ingredients[0].grams).toBe(50);
    expect(out.verdicts[0].refuse).toMatchObject({
      modelRefusePct: 50,
      appliedRefusePct: 50,
    });
  });

  it('converts an explicit gross rib anchor to edible mass end to end', () => {
    const v2: MealDecompositionV2 = {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          name: 'sườn heo',
          cookingMethod: 'nướng',
          ingredients: [
            {
              rawName: '1 miếng sườn heo',
              canonicalName: 'Sườn heo',
              explicitMass: { grams: 200, basis: 'gross_as_served' },
            },
          ],
        },
      ],
    };
    const grounded: GroundedEstimation = {
      mealItems: [
        {
          mealItemName: 'sườn heo',
          ingredients: [
            {
              ingredientName: '1 miếng sườn heo',
              grossG: 220,
              refusePct: 50,
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
      v2,
      matches: [{ ingredientIndex: 0, candidates: [] }],
      grounded,
      mealContext: '1 miếng sườn heo 200g',
      portionResolutions: [
        {
          grams: { low: 200, mid: 200, high: 200 },
          massBasis: 'gross_as_served',
          provenance: 'explicit_user_mass',
          confidence: 'high',
          note: 'explicit gross mass',
        },
      ],
    });

    expect(out.decomposition.mealItems[0].ingredients[0].grams).toBe(100);
    expect(out.verdicts[0].refuse).toMatchObject({
      grossG: 200,
      modelRefusePct: 50,
      appliedRefusePct: 50,
      appliedRefuseSource: 'model_cut_band',
      edibleG: 100,
      massBasis: 'gross_as_served',
    });
  });

  it('does not let an unknown-basis ingredient bypass modeled refuse', () => {
    const v2: MealDecompositionV2 = {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          name: 'cá kho',
          cookingMethod: 'kho',
          ingredients: [
            {
              rawName: 'unknown-basis ingredient',
              canonicalName: 'Cá kho',
              explicitMass: { grams: 300, basis: 'unknown' },
            },
          ],
        },
      ],
    };
    const grounded: GroundedEstimation = {
      mealItems: [
        {
          mealItemName: 'cá kho',
          ingredients: [
            {
              ingredientName: 'unknown-basis ingredient',
              grossG: 200,
              refusePct: 25,
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
      v2,
      matches: [{ ingredientIndex: 0, candidates: [] }],
      grounded,
      mealContext: 'unknown-basis ingredient 300g',
      portionResolutions: [
        {
          grams: { low: 300, mid: 300, high: 300 },
          massBasis: 'unknown',
          provenance: 'explicit_user_mass',
          confidence: 'high',
          note: 'basis unresolved',
        },
      ],
    });

    expect(out.decomposition.mealItems[0].ingredients[0].grams).toBe(150);
    expect(out.verdicts[0].refuse).toMatchObject({
      grossG: 200,
      appliedRefusePct: 25,
      appliedRefuseSource: 'model_unknown_form',
      edibleG: 150,
      massBasis: 'gross_as_served',
    });
  });

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

describe('bridgeV2ToV1 — matched P/C/kcal are DB-anchored regardless of LLM values', () => {
  // Every triple is now schema-REQUIRED (the D3 optionality is reverted). For
  // a matched-without-prep-notes ingredient the model emits cheap placeholder
  // triples; the server anchors P/C/kcal from the DB row, so the resolved
  // numbers must be IDENTICAL to a run where the model emitted full quads.
  function groundedPlaceholders(): GroundedEstimation {
    return {
      mealItems: [
        {
          mealItemName: 'đùi gà nướng',
          ingredients: [
            {
              ingredientName: 'đùi gà',
              selectedCandidateId: 'c1',
              grams: 150,
              // Cheap flat placeholders — discarded for matched ingredients.
              caloriesKcal: ZERO_TRIPLE,
              proteinG: ZERO_TRIPLE,
              carbohydrateG: ZERO_TRIPLE,
              fatG: { low: 10, mid: 12, high: 14 },
            },
          ],
        },
      ],
    };
  }

  it('bridges a placeholder-triple matched ingredient; grams + fat preserved', () => {
    const out = bridgeV2ToV1({
      v2: v2Decomp(),
      matches: matchResultWithCandidate(),
      grounded: groundedPlaceholders(),
      mealContext: 'm',
    });
    expect(out.matched).toHaveLength(1);
    expect(out.decomposition.mealItems[0].ingredients[0].grams).toBe(150);
    // fatG (the one triple the server still needs from Call 2) flows through.
    expect(out.rawNutrition.mealItems[0].ingredients[0].fatG.mid).toBe(12);
    // Placeholder P/kcal pass through raw — harmless because
    // resolveIngredientMacros overwrites P/C/kcal from the DB base for matched.
    expect(out.rawNutrition.mealItems[0].ingredients[0].proteinG).toEqual({
      low: 0,
      mid: 0,
      high: 0,
    });
    expect(out.rawNutrition.mealItems[0].ingredients[0].caloriesKcal).toEqual({
      low: 0,
      mid: 0,
      high: 0,
    });
  });

  it('produces IDENTICAL resolved matched numbers for placeholder vs full LLM triples', () => {
    // The candidate DB row: 220 kcal / 24 P / 0 C / 14 F per 100g, grams=150.
    // base = per_100g × 150/100. For matched-no-prep, resolveIngredientMacros
    // returns flatTriple(base.P), flatTriple(base.C), guarded fat, kcal=4P+4C+9F.
    const base = {
      caloriesKcal: 220 * 1.5,
      proteinG: 24 * 1.5,
      carbohydrateG: 0 * 1.5,
      fatG: 14 * 1.5,
    };
    const slim = { fatG: { low: 10, mid: 12, high: 14 } };
    const full = {
      caloriesKcal: { low: 270, mid: 290, high: 310 },
      proteinG: { low: 38, mid: 40, high: 42 },
      carbohydrateG: { low: 0, mid: 0, high: 0 },
      fatG: { low: 10, mid: 12, high: 14 },
    };
    const resolveSlim = nutritionTesting.resolveIngredientMacros(
      {
        ingredientName: 'đùi gà',
        caloriesKcal: ZERO_TRIPLE,
        proteinG: ZERO_TRIPLE,
        carbohydrateG: ZERO_TRIPLE,
        fatG: slim.fatG,
      },
      base,
      150,
      false
    );
    const resolveFull = nutritionTesting.resolveIngredientMacros(
      { ingredientName: 'đùi gà', ...full },
      base,
      150,
      false
    );
    // Matched P/C are DB-anchored (flat at base) regardless of LLM input, so the
    // slimmed and full inputs resolve to the SAME protein / carb / kcal.
    expect(resolveSlim.proteinG).toEqual(resolveFull.proteinG);
    expect(resolveSlim.carbohydrateG).toEqual(resolveFull.carbohydrateG);
    expect(resolveSlim.caloriesKcal).toEqual(resolveFull.caloriesKcal);
    expect(resolveSlim.fatG).toEqual(resolveFull.fatG);
    // And P is exactly the DB anchor, not the (dropped) LLM value.
    expect(resolveSlim.proteinG.mid).toBe(base.proteinG);
  });
});

describe('bridgeV2ToV1 — unmatched macro plausibility (all triples required)', () => {
  const matchesNoCands: IngredientV2MatchResult[] = [
    { ingredientIndex: 0, candidates: [] },
  ];

  // v2 decomp with a single unmatched ingredient of the given name (no
  // prepNotes, so nothing forces the LLM to re-emit the caloric triple).
  function v2SingleIngredient(name: string): MealDecompositionV2 {
    return {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          name,
          cookingMethod: 'luộc',
          ingredients: [{ rawName: name, canonicalName: name }],
        },
      ],
    };
  }

  it('unmatched water with explicit zero macros → genuinely_noncaloric (not spuriously unresolved)', () => {
    const grounded: GroundedEstimation = {
      mealItems: [
        {
          mealItemName: 'nước lọc',
          ingredients: [
            {
              ingredientName: 'nước lọc',
              grams: 300,
              caloriesKcal: ZERO_TRIPLE,
              proteinG: ZERO_TRIPLE,
              carbohydrateG: ZERO_TRIPLE,
              fatG: { low: 0, mid: 0, high: 0 },
            },
          ],
        },
      ],
    };
    const out = bridgeV2ToV1({
      v2: v2SingleIngredient('nước lọc'),
      matches: matchesNoCands,
      grounded,
      mealContext: 'm',
    });
    expect(out.verdicts[0].verdict).toBe('unmatched');
    expect(out.plausibility[0].state).toBe('genuinely_noncaloric');
    // Non-caloric drinks still flow through as an unmatched macro row.
    expect(out.unmatched).toHaveLength(1);
    expect(out.rawNutrition.mealItems).toHaveLength(1);
  });

  it('unmatched ingredient WITH full LLM caloric macros → ok (unchanged)', () => {
    const grounded: GroundedEstimation = {
      mealItems: [
        {
          mealItemName: 'ức gà',
          ingredients: [
            {
              ingredientName: 'ức gà',
              grams: 150,
              caloriesKcal: { low: 240, mid: 250, high: 260 },
              proteinG: { low: 44, mid: 46, high: 48 },
              carbohydrateG: { low: 0, mid: 0, high: 0 },
              fatG: { low: 3, mid: 4, high: 5 },
            },
          ],
        },
      ],
    };
    const out = bridgeV2ToV1({
      v2: v2SingleIngredient('ức gà'),
      matches: matchesNoCands,
      grounded,
      mealContext: 'm',
    });
    expect(out.verdicts[0].verdict).toBe('unmatched');
    expect(out.plausibility[0].state).toBe('ok');
    expect(out.unmatched).toHaveLength(1);
    expect(out.rawNutrition.mealItems[0].ingredients[0].proteinG.mid).toBe(46);
  });

  it('matched ingredient with placeholder P/C/kcal → still ok, real anchored numbers (regression guard)', () => {
    // Matched-without-prep-notes: the model emits cheap placeholder triples.
    // The server anchors P/C/kcal from the DB row, so this MUST stay 'ok'.
    const groundedSlimMatched: GroundedEstimation = {
      mealItems: [
        {
          mealItemName: 'đùi gà nướng',
          ingredients: [
            {
              ingredientName: 'đùi gà',
              selectedCandidateId: 'c1',
              grams: 150,
              caloriesKcal: ZERO_TRIPLE,
              proteinG: ZERO_TRIPLE,
              carbohydrateG: ZERO_TRIPLE,
              fatG: { low: 10, mid: 12, high: 14 },
            },
          ],
        },
      ],
    };
    const out = bridgeV2ToV1({
      v2: v2Decomp(),
      matches: matchResultWithCandidate(),
      grounded: groundedSlimMatched,
      mealContext: 'm',
    });
    expect(out.verdicts[0].verdict).toBe('accepted');
    expect(out.plausibility[0].state).toBe('ok');
    expect(out.matched).toHaveLength(1);
    // Matched row's DB-anchored nutrition is preserved (real numbers, not zeros).
    expect(out.matched[0].nutritionPer100g.caloriesKcal).toBe(220);
    expect(out.matched[0].nutritionPer100g.proteinG).toBe(24);
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
          massBasis: 'edible',
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
        {
          grams: null,
          massBasis: null,
          provenance: 'llm_range',
          confidence: 'none',
          note: '',
        },
      ],
    });
    expect(out.decomposition.mealItems[0].ingredients[0].grams).toBe(150);
  });

  it('labels unresolved_estimate + ambiguous_food but still ships on the LLM grams', () => {
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
          unresolvedReason: 'ambiguous_food',
          note: 'ambiguous',
        },
      ],
    });
    // The state is a telemetry label now, not a gate: the ingredient still
    // ships on Call 2's grams so the visual portion picker can correct it.
    expect(out.plausibility[0].state).toBe('unresolved_estimate');
    expect(out.plausibility[0].unresolvedReason).toBe('ambiguous_food');
    expect(out.matched).toHaveLength(1);
    expect(out.rawNutrition.mealItems).toHaveLength(1);
    expect(out.decomposition.mealItems[0].ingredients[0].grams).toBe(150);
  });

  it('rescales Call-2 macros when a server anchor overrides the LLM mass', () => {
    // Call 2's triples are ABSOLUTE at its own `grams`. Anchoring 150g → 330g
    // without rescaling displayed 330g carrying ~150g of macros (2.2x under).
    const matches: IngredientV2MatchResult[] = [
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
              caloriesKcal: { low: 90, mid: 100, high: 110 },
              proteinG: { low: 4, mid: 5, high: 6 },
              carbohydrateG: { low: 18, mid: 20, high: 22 },
              fatG: { low: 1, mid: 2, high: 3 },
            },
          ],
        },
      ],
    };
    const out = bridgeV2ToV1({
      v2: v2Decomp(),
      matches,
      grounded,
      mealContext: 'm',
      portionResolutions: [
        {
          grams: { low: 300, mid: 330, high: 360 },
          massBasis: 'edible',
          provenance: 'retrieved_prior',
          confidence: 'high',
          note: 'prior',
        },
      ],
    });
    expect(out.decomposition.mealItems[0].ingredients[0].grams).toBe(330);
    const ing = out.rawNutrition.mealItems[0].ingredients[0];
    // 330/150 = 2.2x
    expect(ing.caloriesKcal.mid).toBeCloseTo(220, 5);
    expect(ing.proteinG.mid).toBeCloseTo(11, 5);
    expect(ing.carbohydrateG.mid).toBeCloseTo(44, 5);
    expect(ing.fatG.mid).toBeCloseTo(4.4, 5);
  });

  it('leaves macros untouched when the LLM grams stand', () => {
    const out = bridgeV2ToV1({
      v2: v2Decomp(),
      matches: [{ ingredientIndex: 0, candidates: [] }],
      grounded: groundedAccepted(),
      mealContext: 'm',
    });
    const ing = out.rawNutrition.mealItems[0].ingredients[0];
    const src = groundedAccepted().mealItems[0].ingredients[0];
    expect(ing.fatG).toEqual(src.fatG);
  });

  it('falls back to Call 2 when the DB nutrition never loaded', () => {
    // top-k-cascade Phase 5 sets `nutrition: null` on a batch-fetch miss. The
    // candidate is still ACCEPTED, so the matched path would build an all-zero
    // per-100g row and persist 0g protein / 0g carbs (measured: 200g bún →
    // 4.5 kcal, 0P, 0C). Call 2 supplied a complete triple here, so the row
    // must ship via the LLM path rather than be dropped.
    const matches = nullNutritionMatch();
    const out = bridgeV2ToV1({
      v2: v2Decomp(),
      matches,
      grounded: groundedAccepted(),
      mealContext: 'm',
    });
    expect(out.matched).toHaveLength(0); // no DB anchor
    expect(out.unmatched).toHaveLength(1); // routed to the LLM path
    expect(out.rawNutrition.mealItems).toHaveLength(1);
    expect(out.decomposition.mealItems[0].ingredients[0].grams).toBe(150);
  });

  it('ships an accepted candidate whose nutrition never loaded (LLM path, explicit zeros allowed)', () => {
    // Schema requires every triple, so "Call 2 was incomplete" no longer
    // exists as a state — the provider decoder cannot omit a field. A row of
    // explicit zeros SHIPS (plausibility telemetry judges it); only a missing
    // portion/estimate or a user-typed zero withholds.
    const grounded = groundedAccepted();
    grounded.mealItems[0].ingredients[0].proteinG = { low: 0, mid: 0, high: 0 };
    grounded.mealItems[0].ingredients[0].carbohydrateG = ZERO_TRIPLE;
    grounded.mealItems[0].ingredients[0].fatG = { low: 0, mid: 0, high: 0 };
    const out = bridgeV2ToV1({
      v2: v2Decomp(),
      matches: nullNutritionMatch(),
      grounded,
      mealContext: 'm',
    });
    expect(out.matched).toHaveLength(0); // no DB anchor
    expect(out.rawNutrition.mealItems).toHaveLength(1); // ships regardless
    expect(out.decomposition.mealItems[0].ingredients[0].grams).toBe(150);
  });

  it('ships a pure-fat food with explicit zero P and C', () => {
    // Butter/oil have ~0 protein and ~0 carb; the model now says so with
    // explicit zeros instead of omitting the fields.
    const grounded = groundedAccepted();
    const ing = grounded.mealItems[0].ingredients[0];
    ing.proteinG = ZERO_TRIPLE;
    ing.carbohydrateG = ZERO_TRIPLE;
    ing.grams = 14; // a pat of butter: fat is ~80% of the mass
    ing.fatG = { low: 10, mid: 11, high: 12 };
    const out = bridgeV2ToV1({
      v2: v2Decomp(),
      matches: [{ ingredientIndex: 0, candidates: [] }],
      grounded,
      mealContext: 'm',
    });
    expect(out.rawNutrition.mealItems).toHaveLength(1);
    expect(out.rawNutrition.mealItems[0].ingredients[0].fatG.mid).toBe(11);
  });

  it('withholds an explicit zero count so it never yields calories', () => {
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
          note: 'explicit zero',
        },
      ],
    });
    expect(out.matched).toHaveLength(0);
    expect(out.rawNutrition.mealItems).toHaveLength(0);
    expect(out.decomposition.mealItems[0].ingredients[0].grams).toBe(0);
  });

  it('withholds a row only when there is nothing to scale', () => {
    // Call 2 dropped the ingredient entirely (verdict='missing'): no grams and
    // no macros, so neither a matched nor a nutrition row can be synthesized.
    const out = bridgeV2ToV1({
      v2: v2Decomp(),
      matches: matchResultWithCandidate(),
      grounded: { mealItems: [{ mealItemName: 'phở bò', ingredients: [] }] },
      mealContext: 'm',
    });
    expect(out.plausibility[0].state).toBe('unresolved_estimate');
    expect(out.matched).toHaveLength(0);
    expect(out.rawNutrition.mealItems).toHaveLength(0);
    expect(out.decomposition.mealItems[0].ingredients[0].grams).toBe(0);
  });
});

describe('bridgeV2ToV1 — carb-staple floor (bánh ướt chả bò)', () => {
  it('still labels an unmatched staple with C≈0, but ships it instead of clarifying', () => {
    const v2: MealDecompositionV2 = {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          name: 'Bánh ướt chả bò',
          cookingMethod: 'hấp',
          ingredients: [
            { rawName: 'bánh ướt', canonicalName: 'Bánh ướt' },
            { rawName: 'chả bò', canonicalName: 'Chả bò' },
          ],
        },
      ],
    };
    // No candidates for either ingredient ⇒ acceptedCandidate null (unmatched).
    const matches: IngredientV2MatchResult[] = [
      { ingredientIndex: 0, candidates: [] },
      { ingredientIndex: 1, candidates: [] },
    ];
    const grounded: GroundedEstimation = {
      mealItems: [
        {
          mealItemName: 'Bánh ướt chả bò',
          ingredients: [
            {
              ingredientName: 'bánh ướt',
              grams: 250,
              // The bug: the LLM assigned P/F but C≈0 to a starch base.
              caloriesKcal: { low: 120, mid: 135, high: 150 },
              proteinG: { low: 14, mid: 15, high: 16 },
              carbohydrateG: { low: 0, mid: 0, high: 1 },
              fatG: { low: 11, mid: 12, high: 13 },
            },
            {
              ingredientName: 'chả bò',
              grams: 60,
              caloriesKcal: { low: 130, mid: 140, high: 150 },
              proteinG: { low: 12, mid: 13, high: 14 },
              carbohydrateG: { low: 1, mid: 2, high: 3 },
              fatG: { low: 8, mid: 9, high: 10 },
            },
          ],
        },
      ],
    };
    const out = bridgeV2ToV1({ v2, matches, grounded, mealContext: 'm' });

    const banhUot = out.plausibility.find(
      (p) => p.ingredientName === 'bánh ướt'
    );
    expect(banhUot?.state).toBe('unresolved_estimate');

    // The signal survives as telemetry, but the meal is no longer gated: Call 2
    // emitted the full caloric triple, so the row ships on its 250g estimate.
    expect(out.rawNutrition.mealItems[0].ingredients).toHaveLength(2);
    expect(out.decomposition.mealItems[0].ingredients[0].grams).toBe(250);
    expect(
      resolveCompletenessGate({ failedMealItemNames: [] })
    ).toBeUndefined();
  });

  it('still gates on a transient Call-2 chunk failure', () => {
    const unresolved = resolveCompletenessGate({
      failedMealItemNames: ['Bánh ướt chả bò'],
    });
    expect(unresolved?.reason).toBe('processing_incomplete');
    expect(unresolved?.unresolvedCount).toBe(1);
  });
});

describe('bridgeV2ToV1 — unmatched staple with an explicit zero carb (mì gói)', () => {
  // Prod incident "mì gói sứa": retrieval found nothing for the noodles, and
  // Call 2 OMITTED `carbohydrateG` (then optional) — the absence became a
  // persisted C:0g / 412 kcal. The schema now REQUIRES every triple, so the
  // omission state no longer exists: the provider decoder cannot skip a
  // field, and a parse-level test guards that in schemas-grounded.test.ts.
  // What remains bridge-side: an EXPLICIT zero ships (user decision — the
  // model may genuinely mean 0) and plausibility telemetry flags the staple.
  function miGoiDecomp(rawName = 'mì gói'): MealDecompositionV2 {
    return {
      isFood: true,
      mealSlot: 'breakfast',
      mealItems: [
        {
          name: 'Mì gói sứa',
          cookingMethod: 'nấu',
          ingredients: [{ rawName, canonicalName: rawName }],
        },
      ],
    };
  }

  function miGoiGrounded(
    ingredientName: string,
    carbohydrateG: { low: number; mid: number; high: number }
  ): GroundedEstimation {
    return {
      mealItems: [
        {
          mealItemName: 'Mì gói sứa',
          ingredients: [
            {
              ingredientName,
              grams: 350,
              caloriesKcal: { low: 380, mid: 410, high: 440 },
              proteinG: { low: 18, mid: 20, high: 22 },
              carbohydrateG,
              fatG: { low: 34, mid: 37, high: 40 },
            },
          ],
        },
      ],
    };
  }

  it('ships an explicit C:0 staple and flags it in plausibility telemetry', () => {
    const out = bridgeV2ToV1({
      v2: miGoiDecomp(),
      matches: [{ ingredientIndex: 0, candidates: [] }],
      grounded: miGoiGrounded('mì gói', ZERO_TRIPLE),
      mealContext: '1 tô mì gói sứa',
    });

    // Ships on real grams — the picker can correct a portion, telemetry
    // records the implausible staple density (0 < STAPLE_MIN_CARBS_PER_100G).
    expect(out.rawNutrition.mealItems).toHaveLength(1);
    expect(out.decomposition.mealItems[0].ingredients[0].grams).toBe(350);
    expect(out.plausibility[0].state).toBe('unresolved_estimate');
  });

  it('ships a staple with real carbs as plain ok', () => {
    const out = bridgeV2ToV1({
      v2: miGoiDecomp(),
      matches: [{ ingredientIndex: 0, candidates: [] }],
      grounded: miGoiGrounded('mì gói', { low: 50, mid: 55, high: 60 }),
      mealContext: '1 tô mì gói sứa',
    });

    expect(out.rawNutrition.mealItems).toHaveLength(1);
    expect(out.rawNutrition.mealItems[0].ingredients[0].carbohydrateG.mid).toBe(
      55
    );
    expect(out.plausibility[0].state).toBe('ok');
  });

  it('does not flag an EXEMPT `mì` word with zero carbs (mì chính = MSG)', () => {
    // `viWord('mì')` matches "mì chính", but the exempt list rescues it —
    // MSG genuinely has no carbs.
    const out = bridgeV2ToV1({
      v2: miGoiDecomp('mì chính'),
      matches: [{ ingredientIndex: 0, candidates: [] }],
      grounded: {
        mealItems: [
          {
            mealItemName: 'Mì gói sứa',
            ingredients: [
              {
                ingredientName: 'mì chính',
                grams: 3,
                caloriesKcal: ZERO_TRIPLE,
                proteinG: ZERO_TRIPLE,
                carbohydrateG: ZERO_TRIPLE,
                fatG: ZERO_TRIPLE,
              },
            ],
          },
        ],
      },
      mealContext: 'm',
    });

    expect(out.rawNutrition.mealItems).toHaveLength(1);
    expect(out.plausibility[0].state).not.toBe('unresolved_estimate');
  });
});

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
        grams: 200,
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
                    grams: 350,
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
