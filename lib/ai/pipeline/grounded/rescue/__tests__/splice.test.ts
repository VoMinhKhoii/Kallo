import { describe, expect, it } from 'vitest';
import type { IngredientV2MatchResult } from '@/lib/ai/matching/candidate';
import type { MealDecompositionV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type {
  GroundedEstimation,
  GroundedIngredientEstimate,
} from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import { resolveGroundedMass } from '@/lib/ai/pipeline/resolve/refuse-mass';
import { pairIngredientsWithGrounded } from '@/lib/ai/pipeline/resolve/verdicts';
import type { PortionResolution } from '@/lib/ai/portion/types';
import { type RescuePart, spliceRescue } from '../splice';

const triple = (mid: number) => ({ low: mid, mid, high: mid });

const estimate = (
  ingredientName: string,
  grossG: number,
  selectedCandidateId?: string
): GroundedIngredientEstimate => ({
  ingredientName,
  ...(selectedCandidateId ? { selectedCandidateId } : {}),
  grossG,
  refusePct: 0,
  proteinG: triple(grossG / 10),
  carbohydrateG: triple(grossG / 5),
  fatG: triple(grossG / 20),
});

const match = (i: number, n: number): IngredientV2MatchResult =>
  ({
    ingredientIndex: i,
    candidates: Array.from({ length: n }, () => ({})),
  }) as unknown as IngredientV2MatchResult;

const defer: PortionResolution = {
  grams: null,
  massBasis: null,
  provenance: 'llm_range',
  confidence: 'none',
  note: '',
};

// "3 bánh flan + cơm": the flan has no row (Call 2 rejected it, 300 g).
const decomposition: MealDecompositionV2 = {
  isFood: true,
  mealSlot: 'snack',
  mealItems: [
    {
      name: 'Bánh flan',
      cookingMethod: 'hấp',
      ingredients: [{ rawName: 'bánh flan', canonicalName: 'Flan' }],
    },
    {
      name: 'Cơm',
      cookingMethod: 'nấu',
      ingredients: [{ rawName: 'cơm', canonicalName: 'Cơm' }],
    },
  ],
};
const grounded: GroundedEstimation = {
  mealItems: [
    { mealItemName: 'Bánh flan', ingredients: [estimate('bánh flan', 300)] },
    { mealItemName: 'Cơm', ingredients: [estimate('cơm', 200, 'c1')] },
  ],
};
const state = {
  decomposition,
  matchResults: [match(0, 0), match(1, 3)],
  portionResolutions: [defer, defer],
  grounded,
};

// The mini-meal ("1 phần bánh flan") found 50 g egg + 50 g milk + 20 g sugar.
const part = (name: string, g: number, rows: number): RescuePart => ({
  ingredient: { rawName: name, canonicalName: name },
  match: match(9, rows),
  estimate: estimate(name, g, 'c1'),
});
const flanParts = [
  part('trứng', 50, 2),
  part('sữa', 50, 2),
  part('đường', 20, 1),
];

describe('spliceRescue', () => {
  it('replaces the rejected ingredient by its parts, scaled to the main grams', () => {
    const { state: out, rescued } = spliceRescue(
      state,
      new Map([[0, flanParts]])
    );

    expect(rescued).toBe(1);
    expect(
      out.decomposition.mealItems[0].ingredients.map((i) => i.rawName)
    ).toEqual(['trứng', 'sữa', 'đường']);
    const flan = out.grounded.mealItems[0].ingredients;
    // 120 g of parts scaled to the 300 g the main run estimated: ×2.5.
    expect(flan.map((e) => e.grossG)).toEqual([125, 125, 50]);
    expect(flan[0].fatG.mid).toBeCloseTo(6.25);
    expect(flan.map((e) => e.selectedCandidateId)).toEqual(['c1', 'c1', 'c1']);
    // Flat arrays stay aligned and renumbered; the parts defer to Call 2's grams.
    expect(out.matchResults.map((m) => m.ingredientIndex)).toEqual([
      0, 1, 2, 3,
    ]);
    expect(out.matchResults.map((m) => m.candidates.length)).toEqual([
      2, 2, 1, 3,
    ]);
    expect(out.portionResolutions.slice(0, 3).map((r) => r.provenance)).toEqual(
      ['llm_range', 'llm_range', 'llm_range']
    );
    // The other dish and the input are untouched.
    expect(out.grounded.mealItems[1]).toEqual(grounded.mealItems[1]);
    expect(grounded.mealItems[0].ingredients).toHaveLength(1);
  });

  it('scales to a server portion anchor when the main run had one', () => {
    const anchored: PortionResolution = {
      grams: { low: 200, mid: 240, high: 280 },
      massBasis: 'edible',
      provenance: 'curated_prior',
      confidence: 'medium',
      note: '',
    };
    const { state: out } = spliceRescue(
      { ...state, portionResolutions: [anchored, defer] },
      new Map([[0, flanParts]])
    );
    const total = out.grounded.mealItems[0].ingredients.reduce(
      (s, e) => s + e.grossG,
      0
    );
    expect(total).toBeCloseTo(240);
  });

  it('leaves an ingredient whose parts carry no mass as it was', () => {
    const { state: out, rescued } = spliceRescue(
      state,
      new Map([[0, [part('trứng', 0, 2)]]])
    );
    expect(rescued).toBe(0);
    expect(out.decomposition).toEqual(decomposition);
    expect(out.grounded).toEqual(grounded);
  });

  it('never rescues an ingredient the portion resolver withheld (a typed zero)', () => {
    const zero: PortionResolution = {
      ...defer,
      provenance: 'unresolved',
      unresolvedReason: 'explicit_zero',
    };
    const { rescued } = spliceRescue(
      { ...state, portionResolutions: [zero, defer] },
      new Map([[0, flanParts]])
    );
    expect(rescued).toBe(0);
  });

  it('ships the parts at exactly the mass the bridge would ship for the dish', () => {
    // A part whose model refuse differs from the parent's: scaling goes
    // through the bridge's own mass rules, so the shipped total still matches.
    const boned = {
      ...part('cá thu', 100, 2),
      estimate: { ...estimate('cá thu', 100, 'c1'), refusePct: 40 },
    };
    const { state: out } = spliceRescue(state, new Map([[0, [boned]]]));
    const [fish] = out.grounded.mealItems[0].ingredients;
    const shipped = resolveGroundedMass({
      ground: fish,
      candidateInediblePct: null,
      canonicalName: 'cá thu',
      rawName: 'cá thu',
    }).edibleG;
    expect(shipped).toBeCloseTo(300);
  });

  it('keeps a part and a same-named ingredient of the dish paired to their own estimates', () => {
    const plate: MealDecompositionV2 = {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          name: 'Cơm gà',
          cookingMethod: 'nấu',
          ingredients: [
            { rawName: 'cơm', canonicalName: 'cơm' },
            { rawName: 'gà xối mỡ', canonicalName: 'gà xối mỡ' },
          ],
        },
      ],
    };
    const call2: GroundedEstimation = {
      mealItems: [
        {
          mealItemName: 'Cơm gà',
          // Call 2 wrote the rejected dish first; plain rice second.
          ingredients: [estimate('gà xối mỡ', 300), estimate('cơm', 100, 'c1')],
        },
      ],
    };
    const { state: out } = spliceRescue(
      {
        decomposition: plate,
        matchResults: [match(0, 3), match(1, 0)],
        portionResolutions: [defer, defer],
        grounded: call2,
      },
      new Map([[1, [part('gà', 100, 2), part('cơm', 50, 2)]]])
    );
    const paired = pairIngredientsWithGrounded(
      out.decomposition,
      out.grounded
    ).map((p) => [p.ingredient.rawName, p.ground?.grossG]);
    expect(paired).toEqual([
      ['cơm', 100],
      ['gà', 200],
      ['cơm', 100],
    ]);
  });
});
