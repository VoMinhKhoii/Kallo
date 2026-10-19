import { describe, expect, it } from 'vitest';
import type { IngredientV2MatchResult } from '@/lib/ai/matching/candidate';
import type { MealDecompositionV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type { GroundedEstimation } from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import { RESCUE_PART_PORTION } from '@/lib/ai/pipeline/grounded/rescue/splice';
import type { RunState } from '@/lib/ai/pipeline/grounded/run-state';
import type { PortionResolution } from '@/lib/ai/portion/types';
import { scaleToServedMass } from '../served-mass';

const triple = (mid: number) => ({ low: mid, mid, high: mid });

const defer: PortionResolution = {
  grams: null,
  massBasis: null,
  provenance: 'llm_range',
  confidence: 'none',
  note: '',
};

const typed = (g: number): PortionResolution => ({
  grams: triple(g),
  massBasis: 'edible',
  provenance: 'explicit_user_mass',
  confidence: 'high',
  note: '',
});

type Part = {
  name: string;
  g: number;
  refusePct?: number;
  /** Priced on a raw/dry row, with Call 2's plate grams. */
  raw?: { servedG?: number };
  /** The review turned the pick into a rejection (no row selected). */
  rejected?: boolean;
  portion?: PortionResolution;
};

/** One dish; every part matched one row (c1) and Call 2 gave it `g` grams and g/4 g carbohydrate. */
function stateOf(
  dish: { name: string; cookingMethod?: string; servedMassG?: number },
  parts: Part[]
): RunState {
  const decomposition: MealDecompositionV2 = {
    isFood: true,
    mealSlot: 'lunch',
    mealItems: [
      {
        name: dish.name,
        cookingMethod: dish.cookingMethod ?? 'cooked',
        servedMassG: dish.servedMassG,
        ingredients: parts.map((p) => ({
          rawName: p.name,
          canonicalName: p.name,
        })),
      },
    ],
  };
  const grounded: GroundedEstimation = {
    mealItems: [
      {
        mealItemName: dish.name,
        ingredients: parts.map((p) => ({
          ingredientName: p.name,
          selectedCandidateId: p.rejected ? 'none' : 'c1',
          grossG: p.g,
          refuseKind: p.refusePct ? ('mixed' as const) : ('none' as const),
          refusePct: p.refusePct ?? 0,
          ...(p.raw?.servedG ? { servedG: p.raw.servedG } : {}),
          proteinG: triple(0),
          carbohydrateG: triple(p.g / 4),
          fatG: triple(0),
        })),
      },
    ],
  };
  return {
    decomposition,
    matchResults: parts.map(
      (p, i) =>
        ({
          ingredientIndex: i,
          candidates: [
            {
              info: {
                matchedName: p.name,
                state: p.raw ? 'raw' : 'cooked',
              },
              nutrition: {
                caloriesKcal: 100,
                proteinG: 0,
                carbohydrateG: 25,
                fatG: 0,
              },
              inediblePct: 0,
              prompt: { name: p.name, nameEn: p.name, score: 1 },
            },
          ],
        }) as unknown as IngredientV2MatchResult
    ),
    portionResolutions: parts.map((p) => p.portion ?? defer),
    grounded,
  };
}

const grams = (s: RunState) =>
  s.grounded.mealItems[0].ingredients.map((i) => Math.round(i.grossG));

describe('scaleToServedMass', () => {
  it('shrinks the parts of a weighed dish to the typed weight, macros with them', () => {
    const state = stateOf(
      { name: 'Chicken tikka masala with rice', servedMassG: 350 },
      [
        { name: 'chicken', g: 200 },
        { name: 'rice', g: 250 },
        { name: 'cream', g: 50 },
      ]
    );
    const out = scaleToServedMass(state);
    expect(out.scaled).toBe(1);
    expect(grams(out.state)).toEqual([140, 175, 35]);
    expect(
      out.state.grounded.mealItems[0].ingredients[1].carbohydrateG.mid
    ).toBeCloseTo(175 / 4);
    // The input is not mutated.
    expect(grams(state)).toEqual([200, 250, 50]);
  });

  it('grows the parts when Call 2 sized them below the typed weight', () => {
    const out = scaleToServedMass(
      stateOf({ name: 'Spaghetti marinara', servedMassG: 300 }, [
        { name: 'spaghetti', g: 120 },
        { name: 'marinara sauce', g: 30 },
      ])
    );
    expect(grams(out.state)).toEqual([240, 60]);
  });

  it('keeps a part pinned by its own typed weight, and counts it toward the total', () => {
    const out = scaleToServedMass(
      stateOf({ name: 'Rice bowl', servedMassG: 400 }, [
        { name: 'chicken', g: 150, portion: typed(150) },
        { name: 'rice', g: 300 },
        { name: 'sauce', g: 50 },
      ])
    );
    // 400 − 150 pinned = 250 for the free parts, from 350.
    expect(grams(out.state)).toEqual([150, 214, 36]);
  });

  it('leaves dishes without a typed weight, and a single food pinned by it, alone', () => {
    const none = scaleToServedMass(
      stateOf({ name: 'Fried rice' }, [
        { name: 'rice', g: 300 },
        { name: 'egg', g: 50 },
      ])
    );
    const single = scaleToServedMass(
      stateOf({ name: 'Rice', servedMassG: 100 }, [
        { name: 'rice', g: 200, portion: typed(100) },
      ])
    );
    expect(none.scaled + single.scaled).toBe(0);
    expect(grams(single.state)).toEqual([200]);
  });

  it('moves rescued parts past the 3× limit to the typed weight', () => {
    const out = scaleToServedMass(
      stateOf({ name: 'Seafood platter', servedMassG: 350 }, [
        {
          name: 'whole crab',
          g: 1400,
          refusePct: 75,
          portion: RESCUE_PART_PORTION,
        },
      ])
    );
    expect(grams(out.state)).toEqual([350]);
  });

  it('scales a one-part dish the rescue replaced with one free food', () => {
    const out = scaleToServedMass(
      stateOf({ name: 'Seafood boil', servedMassG: 350 }, [
        { name: 'shell-on shrimp', g: 175, refusePct: 40 },
      ])
    );
    expect(grams(out.state)).toEqual([350]);
  });

  it('never grows a soup whose broth is not one of its parts, but may shrink it', () => {
    const grow = scaleToServedMass(
      stateOf({ name: 'Canh chua cá lóc', servedMassG: 500 }, [
        { name: 'cá lóc', g: 150 },
        { name: 'cà chua', g: 60 },
      ])
    );
    expect(grow.scaled).toBe(0);
    expect(grams(grow.state)).toEqual([150, 60]);

    const shrink = scaleToServedMass(
      stateOf({ name: 'Beef stew', servedMassG: 300 }, [
        { name: 'beef', g: 300 },
        { name: 'potato', g: 100 },
      ])
    );
    expect(grams(shrink.state)).toEqual([225, 75]);
  });

  it('grows a soup whose broth is listed', () => {
    const out = scaleToServedMass(
      stateOf({ name: 'Phở bò', servedMassG: 600 }, [
        { name: 'bánh phở', g: 150 },
        { name: 'nước dùng bò', g: 150 },
      ])
    );
    expect(grams(out.state)).toEqual([300, 300]);
  });

  it('does not take a food named after a liquid for the broth', () => {
    const lau = scaleToServedMass(
      stateOf({ name: 'Lẩu bò', servedMassG: 800 }, [
        { name: 'water spinach', g: 100 },
        { name: 'beef', g: 150 },
      ])
    );
    expect(lau.scaled).toBe(0);

    const chili = scaleToServedMass(
      stateOf({ name: 'Cream cheese chicken chili', servedMassG: 600 }, [
        { name: 'cream cheese', g: 50 },
        { name: 'chicken', g: 150 },
      ])
    );
    expect(chili.scaled).toBe(0);
  });

  it('keeps a liquid dish weighed with a solid side, or named in Vietnamese, from growing', () => {
    for (const name of [
      'Beef stew with bread',
      'Curry with a roll',
      'Súp cua',
    ]) {
      const out = scaleToServedMass(
        stateOf({ name, servedMassG: 600 }, [
          { name: 'beef', g: 150 },
          { name: 'bread', g: 60 },
        ])
      );
      expect(out.scaled).toBe(0);
    }
  });

  it('grows a solid or dry dish named after a liquid one', () => {
    for (const name of [
      'Curry puff',
      'Chili dog',
      'Miến xào cua',
      'Miến trộn',
    ]) {
      const out = scaleToServedMass(
        stateOf({ name, servedMassG: 300 }, [
          { name: 'filling', g: 100 },
          { name: 'wrapper', g: 50 },
        ])
      );
      expect(grams(out.state)).toEqual([200, 100]);
    }
  });

  it('sizes a dish weighed with its shells on by as-served grams', () => {
    const out = scaleToServedMass(
      stateOf({ name: 'Seafood boil', servedMassG: 500 }, [
        { name: 'shell-on shrimp', g: 150, refusePct: 40 },
        { name: 'corn on the cob', g: 100, refusePct: 30 },
      ])
    );
    expect(grams(out.state)).toEqual([300, 200]);
  });

  it('counts a part on a dry row by its plate grams, not its dry grams', () => {
    const fits = scaleToServedMass(
      stateOf({ name: 'Mac and cheese', servedMassG: 300 }, [
        { name: 'dry macaroni', g: 80, raw: { servedG: 200 } },
        { name: 'cheese sauce', g: 100 },
      ])
    );
    expect(fits.scaled).toBe(0);

    const grows = scaleToServedMass(
      stateOf({ name: 'Mac and cheese', servedMassG: 450 }, [
        { name: 'dry macaroni', g: 80, raw: { servedG: 200 } },
        { name: 'cheese sauce', g: 100 },
      ])
    );
    expect(grams(grows.state)).toEqual([120, 150]);
    expect(grows.state.grounded.mealItems[0].ingredients[0].servedG).toBe(300);
  });

  it("keeps a typed weight on a raw row as the plate's grams", () => {
    const out = scaleToServedMass(
      stateOf({ name: 'Chicken and rice', servedMassG: 400 }, [
        {
          name: 'chicken breast',
          g: 200,
          raw: { servedG: 150 },
          portion: typed(150),
        },
        { name: 'white rice', g: 100 },
      ])
    );
    expect(grams(out.state)).toEqual([200, 250]);
  });

  it('keeps plate grams for a dry-row pick the review rejected', () => {
    const out = scaleToServedMass(
      stateOf({ name: 'Mac and cheese', servedMassG: 300 }, [
        { name: 'dry macaroni', g: 80, raw: { servedG: 200 }, rejected: true },
        { name: 'cheese sauce', g: 100 },
      ])
    );
    expect(out.scaled).toBe(0);
  });

  it('falls back to row grams when Call 2 gave no plate grams for a dry row', () => {
    const out = scaleToServedMass(
      stateOf({ name: 'Mac and cheese', servedMassG: 360 }, [
        { name: 'dry macaroni', g: 80, raw: {} },
        { name: 'cheese sauce', g: 100 },
      ])
    );
    expect(grams(out.state)).toEqual([160, 200]);
  });

  it('moves the parts by at most 3× either way', () => {
    const out = scaleToServedMass(
      stateOf({ name: 'Salad', servedMassG: 1000 }, [
        { name: 'lettuce', g: 50 },
        { name: 'dressing', g: 50 },
      ])
    );
    expect(grams(out.state)).toEqual([150, 150]);
  });

  it('skips a part the resolver withheld', () => {
    const out = scaleToServedMass(
      stateOf({ name: 'Plate', servedMassG: 200 }, [
        { name: 'rice', g: 100 },
        {
          name: 'mystery',
          g: 100,
          portion: { ...defer, provenance: 'unresolved' },
        },
      ])
    );
    expect(grams(out.state)).toEqual([200, 100]);
  });
});
