import { describe, expect, it } from 'vitest';
import { holdNearFirstEstimate } from '@/lib/ai/pipeline/grounded/first-estimate/hold-near';
import type { RunState } from '@/lib/ai/pipeline/grounded/run-state';

const part = (ingredientName: string, grossG: number, kcal: number) => ({
  ingredientName,
  grossG,
  refusePct: 0,
  proteinG: { low: 0, mid: 0, high: 0 },
  carbohydrateG: { low: kcal / 4, mid: kcal / 4, high: kcal / 4 },
  fatG: { low: 0, mid: 0, high: 0 },
});

/** One dish of `foods` [name, grams, kcal]; none has a row, so macros price it. */
function meal(
  foods: Array<[string, number, number]>,
  opts: { pinned?: string; servedMassG?: number } = {}
) {
  return {
    decomposition: {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          name: 'Cơm',
          cookingMethod: 'nấu',
          servedMassG: opts.servedMassG,
          ingredients: foods.map(([rawName]) => ({
            rawName,
            canonicalName: rawName,
          })),
        },
      ],
    },
    matchResults: foods.map(() => ({ candidates: [] })),
    portionResolutions: foods.map(([name, g]) =>
      name === opts.pinned
        ? {
            grams: { low: g, mid: g, high: g },
            massBasis: 'edible',
            provenance: 'explicit_user_mass',
          }
        : { grams: null, provenance: 'llm_range' }
    ),
    grounded: {
      mealItems: [
        {
          mealItemName: 'Cơm',
          ingredients: foods.map(([n, g, k]) => part(n, g, k)),
        },
      ],
    },
  } as unknown as RunState;
}

const grams = (s: RunState) =>
  s.grounded.mealItems[0].ingredients.map((i) => Math.round(i.grossG));

describe('holdNearFirstEstimate', () => {
  it('leaves a meal inside the band alone', () => {
    const state = meal([['Cơm', 200, 300]]);
    const out = holdNearFirstEstimate(state, 280);
    expect(out.scaled).toBe(false);
    expect(out.state).toBe(state);
  });

  it('brings an overshoot down to the band edge, parts together', () => {
    const out = holdNearFirstEstimate(
      meal([
        ['Cơm', 200, 600],
        ['Gà', 100, 400],
      ]),
      500
    );
    // 1000 kcal against a plain 500: the edge is 600, so × 0.6.
    expect(out.scaled).toBe(true);
    expect(grams(out.state)).toEqual([120, 60]);
  });

  it('brings an undershoot up to the band edge', () => {
    const out = holdNearFirstEstimate(meal([['Xôi', 100, 100]]), 360);
    // The edge is 300 kcal, so × 3.
    expect(grams(out.state)).toEqual([300]);
  });

  it('never moves a typed weight', () => {
    const out = holdNearFirstEstimate(
      meal(
        [
          ['Cơm', 150, 200],
          ['Gà', 100, 800],
        ],
        { pinned: 'Cơm' }
      ),
      500
    );
    // 200 kcal pinned of a 600 kcal target: chicken carries 400 of its 800.
    expect(grams(out.state)).toEqual([150, 50]);
  });

  it('never moves a dish the user weighed', () => {
    const out = holdNearFirstEstimate(
      meal([['Cơm', 200, 1000]], { servedMassG: 200 }),
      300
    );
    expect(out.scaled).toBe(false);
  });

  it('stays out when pinned food alone passes the band', () => {
    const out = holdNearFirstEstimate(
      meal(
        [
          ['Cơm', 150, 900],
          ['Gà', 100, 100],
        ],
        { pinned: 'Cơm' }
      ),
      500
    );
    expect(out.scaled).toBe(false);
  });

  it('counts a food with no answer as nothing, not as zero grams to scale', () => {
    const state = meal([['Cơm', 200, 300]]);
    state.grounded.mealItems[0].ingredients = [];
    expect(holdNearFirstEstimate(state, 300).scaled).toBe(false);
  });
});
