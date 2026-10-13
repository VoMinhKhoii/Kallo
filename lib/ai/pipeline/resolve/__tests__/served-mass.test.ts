import { describe, expect, it } from 'vitest';
import type { IngredientV2MatchResult } from '@/lib/ai/matching/candidate';
import type { MealDecompositionV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type { GroundedEstimation } from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import type { RunState } from '@/lib/ai/pipeline/grounded/run-state';
import type { PortionResolution } from '@/lib/ai/portion/types';
import { scaleToServedMass, withDishWeight } from '../served-mass';

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

type Part = { name: string; g: number; portion?: PortionResolution };

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
          selectedCandidateId: 'c1',
          grossG: p.g,
          refusePct: 0,
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
              info: { matchedName: p.name },
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

  it('leaves dishes without a typed weight, and single-food dishes, alone', () => {
    const none = scaleToServedMass(
      stateOf({ name: 'Fried rice' }, [
        { name: 'rice', g: 300 },
        { name: 'egg', g: 50 },
      ])
    );
    const single = scaleToServedMass(
      stateOf({ name: 'Rice', servedMassG: 100 }, [{ name: 'rice', g: 200 }])
    );
    expect(none.scaled + single.scaled).toBe(0);
    expect(grams(single.state)).toEqual([200]);
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

describe('withDishWeight', () => {
  const dish = (servedMassG: number | undefined, names: string[]) => ({
    name: names.join(' '),
    cookingMethod: 'raw',
    servedMassG,
    ingredients: names.map((n) => ({ rawName: n, canonicalName: n })),
  });

  it("gives a one-part dish's typed weight to its food", () => {
    const d = dish(100, ['almonds']);
    expect(withDishWeight(d, d.ingredients[0]).explicitMass).toEqual({
      grams: 100,
      basis: 'unknown',
    });
  });

  it("keeps a food's own typed weight, and leaves several-part dishes to scaling", () => {
    const own = dish(100, ['almonds']);
    const pinned = {
      ...own.ingredients[0],
      explicitMass: { grams: 80, basis: 'edible' as const },
    };
    expect(withDishWeight(own, pinned).explicitMass?.grams).toBe(80);
    const many = dish(300, ['rice', 'egg']);
    expect(
      withDishWeight(many, many.ingredients[0]).explicitMass
    ).toBeUndefined();
    const unweighed = dish(undefined, ['almonds']);
    expect(
      withDishWeight(unweighed, unweighed.ingredients[0]).explicitMass
    ).toBeUndefined();
  });
});
