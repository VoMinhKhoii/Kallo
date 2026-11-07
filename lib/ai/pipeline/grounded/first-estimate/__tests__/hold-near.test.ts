import { describe, expect, it } from 'vitest';
import {
  holdNearFirstEstimate as hold,
  shippedKcal,
} from '@/lib/ai/pipeline/grounded/first-estimate/hold-near';
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

/** Prices like the result for these row-less parts: 4 kcal per gram of carb. */
const byMacros = (s: RunState) =>
  s.grounded.mealItems
    .flatMap((m) => m.ingredients)
    .reduce((t, i) => t + 4 * i.carbohydrateG.mid, 0);
const holdNearFirstEstimate = (s: RunState, kcal: number) =>
  hold(s, kcal, 'meal', byMacros);

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

  it('uses the calories the user will see, not the row alone', () => {
    // The result prices this meal at 220 kcal though its row says 100: inside
    // the band of a 200 kcal read, so it must not move.
    const state = meal([['Thịt', 100, 100]]);
    const out = hold(state, 200, 'meal', () => 220);
    expect(out.scaled).toBe(false);
  });

  it('keeps the first answer when a fit lands no closer', () => {
    const state = meal([['Cơm', 200, 1000]]);
    const stuck = () => 1000;
    expect(hold(state, 500, 'meal', stuck).scaled).toBe(false);
  });

  it('reaches the edge when the price is not linear in grams', () => {
    // A fixed 100 kcal the scale cannot reach (a clamped fat band).
    const price = (s: RunState) => 100 + byMacros(s);
    const out = hold(meal([['Cơm', 200, 900]]), 500, 'meal', price);
    expect(Math.round(price(out.state))).toBe(600);
  });
});

describe('with the real pricing', () => {
  /** 100 g on a 100 kcal row whose fat Call 2 raised to 20 g. */
  const fattyMeal = () => {
    const state = meal([['Thịt', 100, 0]]);
    state.matchResults = [
      {
        ingredientIndex: 0,
        candidates: [
          {
            id: 'row-1',
            info: { matchedName: 'Pork', state: 'cooked' },
            nutrition: {
              caloriesKcal: 100,
              proteinG: 10,
              carbohydrateG: 0,
              fatG: 6.67,
            },
            inediblePct: 0,
            prompt: { name: 'Pork', nameEn: 'Pork', score: 1 },
          },
        ],
      },
    ] as unknown as RunState['matchResults'];
    const [food] = state.grounded.mealItems[0].ingredients;
    Object.assign(food, {
      selectedCandidateId: 'c1',
      refuseKind: 'none',
      proteinG: { low: 10, mid: 10, high: 10 },
      fatG: { low: 20, mid: 20, high: 20 },
    });
    return state;
  };

  it('sees what the result will show, Call 2 fat included', () => {
    expect(shippedKcal(fattyMeal(), 'meal')).toBeGreaterThan(200);
  });

  it('leaves that meal alone when the read agrees with it', () => {
    const state = fattyMeal();
    const out = hold(state, shippedKcal(state, 'meal'), 'meal');
    expect(out.scaled).toBe(false);
  });

  it('lands a far-off meal on the band edge', () => {
    const state = fattyMeal();
    const read = shippedKcal(state, 'meal') * 3;
    const out = hold(state, read, 'meal');
    expect(out.scaled).toBe(true);
    expect(shippedKcal(out.state, 'meal') / (read / 1.2)).toBeCloseTo(1, 1);
  });
});
