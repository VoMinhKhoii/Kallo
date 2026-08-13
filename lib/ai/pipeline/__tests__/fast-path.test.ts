import { describe, expect, it } from 'vitest';
import { NULL_NUTRITION_VALUES } from '../../__tests__/test-helpers';
import type { IngredientV2MatchResult } from '../../matching/top-k-cascade';
import type { PortionResolution } from '../../portion/types';
import type { NutritionPer100g, UserContext } from '../../types';
import { assembleResult } from '../assembly';
import { bridgeV2ToV1 } from '../bridge';
import { buildFastPathEstimation, isFullyGrounded } from '../fast-path';
import { reconcileNutritionIds } from '../nutrition';
import type { GroundedEstimation, MealDecompositionV2 } from '../schemas-v2';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NUTRITION: NutritionPer100g = {
  ...NULL_NUTRITION_VALUES,
  caloriesKcal: 165,
  proteinG: 31,
  carbohydrateG: 0,
  fatG: 3.6,
};

function decomposition(prepNotes?: string[]): MealDecompositionV2 {
  return {
    isFood: true,
    mealSlot: 'lunch',
    mealItems: [
      {
        name: 'ức gà luộc',
        cookingMethod: 'luộc',
        ingredients: [
          {
            rawName: 'ức gà',
            canonicalName: 'Ức gà',
            ...(prepNotes ? { prepNotes } : {}),
          },
        ],
      },
    ],
  };
}

/** An exact-match hit: exactly one candidate, similarity === 1, nutrition set. */
function exactMatch(
  state: 'raw' | 'cooked' | 'unknown'
): IngredientV2MatchResult {
  return {
    ingredientIndex: 0,
    candidates: [
      {
        info: {
          ingredientName: 'ức gà',
          foodCompositionId: 'fc-1',
          matchedName: 'Ức gà',
          similarity: 1,
          confidence: 'high',
          state,
          source: 'fao',
        },
        nutrition: NUTRITION,
        inediblePct: 0,
      },
    ],
  };
}

/** An embedding (non-exact) match: similarity < 1. */
function embeddingMatch(): IngredientV2MatchResult {
  const m = exactMatch('cooked');
  m.candidates[0].info.similarity = 0.87;
  return m;
}

function unmatched(): IngredientV2MatchResult {
  return { ingredientIndex: 0, candidates: [] };
}

function anchor(mid: number): PortionResolution {
  return {
    grams: { low: mid * 0.9, mid, high: mid * 1.1 },
    massBasis: 'edible',
    provenance: 'curated_prior',
    confidence: 'high',
    note: 'test anchor',
  };
}

function llmRange(): PortionResolution {
  return {
    grams: null,
    massBasis: null,
    provenance: 'llm_range',
    confidence: 'none',
    note: 'defer to Call 2',
  };
}

// ---------------------------------------------------------------------------
// isFullyGrounded
// ---------------------------------------------------------------------------

describe('isFullyGrounded — conservative qualification', () => {
  it('qualifies a clean exact-matched + anchored meal with no prep notes', () => {
    expect(
      isFullyGrounded({
        decomposition: decomposition(),
        matchResults: [exactMatch('cooked')],
        portionResolutions: [anchor(150)],
      })
    ).toBe(true);
  });

  it('DISQUALIFIES when the match is an embedding hit (similarity < 1)', () => {
    expect(
      isFullyGrounded({
        decomposition: decomposition(),
        matchResults: [embeddingMatch()],
        portionResolutions: [anchor(150)],
      })
    ).toBe(false);
  });

  it('DISQUALIFIES an unmatched ingredient', () => {
    expect(
      isFullyGrounded({
        decomposition: decomposition(),
        matchResults: [unmatched()],
        portionResolutions: [anchor(150)],
      })
    ).toBe(false);
  });

  it('DISQUALIFIES when the portion is an llm_range (no server anchor)', () => {
    expect(
      isFullyGrounded({
        decomposition: decomposition(),
        matchResults: [exactMatch('cooked')],
        portionResolutions: [llmRange()],
      })
    ).toBe(false);
  });

  it('DISQUALIFIES when the ingredient carries prep notes (fat nuance = LLM job)', () => {
    expect(
      isFullyGrounded({
        decomposition: decomposition(['bỏ da']),
        matchResults: [exactMatch('cooked')],
        portionResolutions: [anchor(150)],
      })
    ).toBe(false);
  });

  it('DISQUALIFIES when ANY of several ingredients fails (whole-meal gate)', () => {
    const decomp: MealDecompositionV2 = {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          name: 'cơm gà',
          cookingMethod: 'luộc',
          ingredients: [
            { rawName: 'ức gà', canonicalName: 'Ức gà' },
            { rawName: 'cơm', canonicalName: 'Cơm' },
          ],
        },
      ],
    };
    // Ingredient 1 clean, ingredient 2 unmatched → whole meal disqualified.
    expect(
      isFullyGrounded({
        decomposition: decomp,
        matchResults: [exactMatch('cooked'), unmatched()],
        portionResolutions: [anchor(150), anchor(200)],
      })
    ).toBe(false);
  });

  it('does NOT fast-path an empty (zero-ingredient) meal', () => {
    expect(
      isFullyGrounded({
        decomposition: { isFood: true, mealSlot: null, mealItems: [] },
        matchResults: [],
        portionResolutions: [],
      })
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildFastPathEstimation — synthesize the estimation the LLM would emit
// ---------------------------------------------------------------------------

describe('buildFastPathEstimation — synthesized estimation shape', () => {
  it('accepts c1, uses the anchor grams, and echoes a DB-anchored flat fat triple', () => {
    const est = buildFastPathEstimation({
      decomposition: decomposition(),
      matchResults: [exactMatch('cooked')],
      portionResolutions: [anchor(150)],
    });
    expect(est.mealItems).toHaveLength(1);
    const ing = est.mealItems[0].ingredients[0];
    expect(ing.selectedCandidateId).toBe('c1');
    expect(ing.grams).toBe(150);
    // cooked DB row → dbScalingGrams = grams; fat = 3.6 × 150 / 100 = 5.4.
    expect(ing.fatG.mid).toBeCloseTo(5.4, 3);
    // Flat triple (low = mid = high) so the guard passes it byte-identically.
    expect(ing.fatG.low).toBe(ing.fatG.mid);
    expect(ing.fatG.high).toBe(ing.fatG.mid);
    // P/C/kcal now schema-REQUIRED: flat DB-anchored triples (165 kcal / 31 P
    // / 0 C per 100g × 150/100). Overwritten downstream from the same base,
    // so redundant by construction — never a second opinion.
    expect(ing.proteinG.mid).toBeCloseTo(46.5, 3);
    expect(ing.proteinG.low).toBe(ing.proteinG.high);
    expect(ing.carbohydrateG.mid).toBe(0);
    expect(ing.caloriesKcal.mid).toBeCloseTo(247.5, 3);
  });

  it('scales a raw DB row through the cooked→raw yield (weightBasis forced raw)', () => {
    const est = buildFastPathEstimation({
      decomposition: decomposition(),
      matchResults: [exactMatch('raw')],
      portionResolutions: [anchor(150)],
    });
    // A raw/unknown row forces weightBasis='raw' → dbScalingGrams = grams
    // (1:1, no cooked→raw fudge), so fat = 3.6 × 150 / 100 = 5.4.
    expect(est.mealItems[0].ingredients[0].fatG.mid).toBeCloseTo(5.4, 3);
  });
});

// ---------------------------------------------------------------------------
// Numerical identity: fast path == full path for a fully-grounded meal
// ---------------------------------------------------------------------------

const userContext: UserContext = {
  goal: 'maintaining',
  aggression: 0,
  countryOfOrigin: 'Vietnam',
  countryOfResidence: 'Vietnam',
  inputLanguage: 'vi',
  outputLanguage: 'vi',
  cookingHabits: {
    oilUsage: 'normal',
    defaultRicePortion: 'medium',
    defaultProteinPortion: 'medium',
    sugarBraised: 'medium',
    brothConsumption: 'some',
  },
};

/** Run an estimation through the SAME downstream the orchestrator uses. */
function assembleFrom(
  decomp: MealDecompositionV2,
  matches: IngredientV2MatchResult[],
  grounded: GroundedEstimation,
  portions: PortionResolution[]
) {
  const bridged = bridgeV2ToV1({
    v2: decomp,
    matches,
    grounded,
    mealContext: 'test',
    portionResolutions: portions,
  });
  const reconciled = reconcileNutritionIds(
    bridged.rawNutrition,
    bridged.decomposition,
    bridged.matched
  );
  return assembleResult(
    bridged.decomposition,
    reconciled,
    bridged.matched,
    bridged.unmatched,
    userContext
  );
}

describe('fast path produces the SAME macros the full path would', () => {
  it('bridges to identical bounded macros vs a full Call-2 that accepts c1 with the same grams', () => {
    const decomp = decomposition();
    const matches = [exactMatch('cooked')];
    const portions = [anchor(150)];

    // FAST PATH: the synthesized estimation.
    const fast = buildFastPathEstimation({
      decomposition: decomp,
      matchResults: matches,
      portionResolutions: portions,
    });

    // FULL PATH counterpart: the LLM accepts c1, echoes the DB-anchored fat
    // (3.6 × 150/100 = 5.4), and — being a matched-no-prep ingredient — emits
    // P/C/kcal that the server OVERWRITES from the DB base anyway.
    const full: GroundedEstimation = {
      mealItems: [
        {
          mealItemName: 'ức gà luộc',
          ingredients: [
            {
              ingredientName: 'ức gà',
              selectedCandidateId: 'c1',
              grams: 150,
              // Deliberately wrong P/C to prove the server re-derives from DB.
              proteinG: { low: 999, mid: 999, high: 999 },
              carbohydrateG: { low: 999, mid: 999, high: 999 },
              caloriesKcal: { low: 999, mid: 999, high: 999 },
              fatG: { low: 5.4, mid: 5.4, high: 5.4 },
            },
          ],
        },
      ],
    };

    const fastOut = assembleFrom(decomp, matches, fast, portions);
    const fullOut = assembleFrom(decomp, matches, full, portions);

    const fastIng = fastOut.result.mealItems[0].ingredients[0].boundedNutrition;
    const fullIng = fullOut.result.mealItems[0].ingredients[0].boundedNutrition;

    // Identical server-anchored macros — the fast path changes nothing numeric.
    expect(fastIng.proteinG?.mid).toBeCloseTo(fullIng.proteinG?.mid ?? -1, 6);
    expect(fastIng.carbohydrateG?.mid).toBeCloseTo(
      fullIng.carbohydrateG?.mid ?? -1,
      6
    );
    expect(fastIng.fatG?.mid).toBeCloseTo(fullIng.fatG?.mid ?? -1, 6);
    expect(fastIng.caloriesKcal?.mid).toBeCloseTo(
      fullIng.caloriesKcal?.mid ?? -1,
      6
    );
    // And the meal totals match.
    expect(fastOut.result.boundedNutrition.caloriesKcal?.mid).toBeCloseTo(
      fullOut.result.boundedNutrition.caloriesKcal?.mid ?? -1,
      6
    );
  });
});
