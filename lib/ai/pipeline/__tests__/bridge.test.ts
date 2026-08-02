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

describe('bridgeV2ToV1 — D3 slimmed matched output (omitted macro triples)', () => {
  // A matched-without-prep-notes ingredient that OMITS caloriesKcal / proteinG
  // / carbohydrateG (only fatG + grams + verdict emitted). The server anchors
  // P/C/kcal from the DB row, so the resolved matched numbers must be IDENTICAL
  // to the case where the LLM emitted (now-discarded) full quads.
  function groundedSlim(): GroundedEstimation {
    return {
      mealItems: [
        {
          mealItemName: 'đùi gà nướng',
          ingredients: [
            {
              ingredientName: 'đùi gà',
              selectedCandidateId: 'c1',
              grams: 150,
              // caloriesKcal / proteinG / carbohydrateG intentionally OMITTED.
              fatG: { low: 10, mid: 12, high: 14 },
            },
          ],
        },
      ],
    };
  }

  it('bridges a slimmed matched ingredient without throwing; grams + fat preserved', () => {
    const out = bridgeV2ToV1({
      v2: v2Decomp(),
      matches: matchResultWithCandidate(),
      grounded: groundedSlim(),
      mealContext: 'm',
    });
    expect(out.matched).toHaveLength(1);
    expect(out.decomposition.mealItems[0].ingredients[0].grams).toBe(150);
    // fatG (the one triple the server still needs from Call 2) flows through.
    expect(out.rawNutrition.mealItems[0].ingredients[0].fatG.mid).toBe(12);
    // Omitted triples default to ZERO_TRIPLE in the raw shape — harmless because
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

  it('produces IDENTICAL resolved matched numbers whether or not the LLM emitted P/C/kcal', () => {
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

describe('bridgeV2ToV1 — Phase 4/D3 unmatched-missing-macros guard', () => {
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

  it('unmatched ingredient with grams but omitted caloric macros → unresolved_estimate (not persisted, not ZERO_TRIPLE ok)', () => {
    const grounded: GroundedEstimation = {
      mealItems: [
        {
          mealItemName: 'ức gà',
          ingredients: [
            {
              ingredientName: 'ức gà',
              // grams present; caloriesKcal/proteinG/carbohydrateG OMITTED.
              grams: 150,
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
    expect(out.plausibility[0].state).toBe('unresolved_estimate');
    // Not persisted: no matched, no unmatched, no rawNutrition (silent-zero killed).
    expect(out.matched).toHaveLength(0);
    expect(out.unmatched).toHaveLength(0);
    expect(out.rawNutrition.mealItems).toHaveLength(0);
    // Decomposition ingredient carries grams=0 (no 1g/ZERO_TRIPLE placeholder).
    expect(out.decomposition.mealItems[0].ingredients[0].grams).toBe(0);
  });

  it('unmatched water name with omitted macros → still genuinely_noncaloric (not spuriously unresolved)', () => {
    const grounded: GroundedEstimation = {
      mealItems: [
        {
          mealItemName: 'nước lọc',
          ingredients: [
            {
              ingredientName: 'nước lọc',
              grams: 300,
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

  it('matched ingredient with omitted P/C/kcal (D3 normal case) → still ok, real anchored numbers (regression guard)', () => {
    // Matched-without-prep-notes: caloriesKcal/proteinG/carbohydrateG omitted.
    // The server anchors P/C/kcal from the DB row, so this MUST stay 'ok' — the
    // D3 guard is unmatched-only and must not fire here.
    const groundedSlimMatched: GroundedEstimation = {
      mealItems: [
        {
          mealItemName: 'đùi gà nướng',
          ingredients: [
            {
              ingredientName: 'đùi gà',
              selectedCandidateId: 'c1',
              grams: 150,
              // caloriesKcal / proteinG / carbohydrateG OMITTED (D3).
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

  it('labels unresolved_estimate + ambiguous_food but still ships on the LLM grams', () => {
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

  it('withholds when the DB nutrition is absent AND Call 2 is incomplete', () => {
    const grounded = groundedAccepted();
    // P and C omitted AND fat is not the food (zero) → nothing to ship.
    grounded.mealItems[0].ingredients[0].proteinG = undefined;
    grounded.mealItems[0].ingredients[0].carbohydrateG = undefined;
    grounded.mealItems[0].ingredients[0].fatG = { low: 0, mid: 0, high: 0 };
    const out = bridgeV2ToV1({
      v2: v2Decomp(),
      matches: nullNutritionMatch(),
      grounded,
      mealContext: 'm',
    });
    expect(out.matched).toHaveLength(0);
    expect(out.rawNutrition.mealItems).toHaveLength(0);
    expect(out.decomposition.mealItems[0].ingredients[0].grams).toBe(0);
  });

  it('ships a pure-fat food whose P and C are legitimately omitted', () => {
    // Butter/oil have ~0 protein and ~0 carb; Call 2 drops both. Withholding
    // deleted a real ~700 kcal/100g ingredient from the meal.
    const grounded = groundedAccepted();
    const ing = grounded.mealItems[0].ingredients[0];
    ing.proteinG = undefined;
    ing.carbohydrateG = undefined;
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

  it('keeps a row when only ONE of protein/carb is omitted', () => {
    // Butter and milk tea legitimately have a ~0 macro Call 2 drops; requiring
    // both present deleted a real ~100-200 kcal ingredient from the meal.
    const grounded = groundedAccepted();
    grounded.mealItems[0].ingredients[0].carbohydrateG = undefined;
    const out = bridgeV2ToV1({
      v2: v2Decomp(),
      matches: [{ ingredientIndex: 0, candidates: [] }],
      grounded,
      mealContext: 'm',
    });
    expect(out.rawNutrition.mealItems).toHaveLength(1);
    expect(out.rawNutrition.mealItems[0].ingredients[0].fatG.mid).toBe(12);
  });

  it('keeps an unmatched row when only caloriesKcal is omitted', () => {
    // kcal is DERIVED from 4P+4C+9F downstream, so its absence costs nothing.
    const grounded = groundedAccepted();
    grounded.mealItems[0].ingredients[0].caloriesKcal = undefined;
    const out = bridgeV2ToV1({
      v2: v2Decomp(),
      matches: [{ ingredientIndex: 0, candidates: [] }],
      grounded,
      mealContext: 'm',
    });
    expect(out.rawNutrition.mealItems).toHaveLength(1);
    expect(out.rawNutrition.mealItems[0].ingredients[0].proteinG.mid).toBe(40);
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
