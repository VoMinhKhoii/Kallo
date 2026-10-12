import { describe, expect, it } from 'vitest';
import type { IngredientV2MatchResult } from '@/lib/ai/matching/candidate';
import type { MealDecompositionV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type {
  GroundedEstimation,
  GroundedIngredientEstimate,
} from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import type { PortionResolution } from '@/lib/ai/portion/types';
import {
  dropOilInFriedRows,
  rejectWrongFormRows,
  swapFriedRowsWhenNoOil,
} from '../review';

const triple = (mid: number) => ({ low: mid, mid, high: mid });

/** A Call 2 estimate whose own energy is `kcal` (all of it as carbohydrate). */
const estimate = (
  ingredientName: string,
  grossG: number,
  kcal: number,
  selectedCandidateId = 'c1'
): GroundedIngredientEstimate => ({
  ingredientName,
  selectedCandidateId,
  grossG,
  refusePct: 0,
  proteinG: triple(0),
  carbohydrateG: triple(kcal / 4),
  fatG: triple(0),
});

/** One candidate row with this English name and energy density. */
const row = (
  i: number,
  nameEn: string,
  kcalPer100: number,
  /** Energy from protein, carbohydrate and fat, when the row has more (alcohol). */
  macroKcalPer100 = kcalPer100
): IngredientV2MatchResult =>
  ({
    ingredientIndex: i,
    candidates: [
      {
        info: { matchedName: nameEn },
        nutrition: {
          caloriesKcal: kcalPer100,
          proteinG: 0,
          carbohydrateG: macroKcalPer100 / 4,
          fatG: 0,
        },
        inediblePct: 0,
        prompt: { name: nameEn, nameEn, score: 1 },
      },
    ],
  }) as unknown as IngredientV2MatchResult;

const defer: PortionResolution = {
  grams: null,
  massBasis: null,
  provenance: 'llm_range',
  confidence: 'none',
  note: '',
};

function stateOf(
  dishes: Array<{
    name: string;
    cookingMethod: string;
    parts: Array<{
      name: string;
      g: number;
      kcal: number;
      row: [name: string, kcalPer100: number, macroKcalPer100?: number];
    }>;
  }>
) {
  const decomposition: MealDecompositionV2 = {
    isFood: true,
    mealSlot: 'lunch',
    mealItems: dishes.map((d) => ({
      name: d.name,
      cookingMethod: d.cookingMethod,
      ingredients: d.parts.map((p) => ({
        rawName: p.name,
        canonicalName: p.name,
      })),
    })),
  };
  const grounded: GroundedEstimation = {
    mealItems: dishes.map((d) => ({
      mealItemName: d.name,
      ingredients: d.parts.map((p) => estimate(p.name, p.g, p.kcal)),
    })),
  };
  const flat = dishes.flatMap((d) => d.parts);
  return {
    decomposition,
    matchResults: flat.map((p, i) => row(i, ...p.row)),
    portionResolutions: flat.map(() => defer),
    grounded,
  };
}

const picks = (g: GroundedEstimation) =>
  g.mealItems.flatMap((mi) =>
    mi.ingredients.map((i) => `${i.ingredientName}:${i.selectedCandidateId}`)
  );

describe('rejectWrongFormRows', () => {
  it('rejects miso paste picked for a bowl of miso soup', () => {
    // 330 g × 198 kcal/100 g = 653 kcal from the row; Call 2 estimated 182.
    const state = stateOf([
      {
        name: 'Soup miso',
        cookingMethod: 'nấu',
        parts: [{ name: 'soup miso', g: 330, kcal: 182, row: ['Miso', 198] }],
      },
    ]);
    const out = rejectWrongFormRows(state);
    expect(out.rejected).toBe(1);
    expect(picks(out.state.grounded)).toEqual(['soup miso:none']);
    expect(out.state.grounded.mealItems[0].ingredients[0].rejectReason).toMatch(
      /row form/
    );
    // The input is not mutated.
    expect(picks(state.grounded)).toEqual(['soup miso:c1']);
  });

  it('keeps a row that agrees with the estimate', () => {
    const state = stateOf([
      {
        name: 'Cơm',
        cookingMethod: 'nấu',
        parts: [
          { name: 'cơm', g: 200, kcal: 250, row: ['Rice, white, cooked', 130] },
        ],
      },
    ]);
    expect(rejectWrongFormRows(state).rejected).toBe(0);
  });

  it('ignores a small food whose gap is under 100 kcal', () => {
    // 15 g of curry powder: 49 kcal from the row against 15 estimated.
    const state = stateOf([
      {
        name: 'Cà ri',
        cookingMethod: 'nấu',
        parts: [
          {
            name: 'bột cà ri',
            g: 15,
            kcal: 15,
            row: ['Spices, curry powder', 325],
          },
        ],
      },
    ]);
    expect(rejectWrongFormRows(state).rejected).toBe(0);
  });

  it('leaves a rejection as it was', () => {
    const state = stateOf([
      {
        name: 'Cà ri',
        cookingMethod: 'nấu',
        parts: [
          {
            name: 'cà ri',
            g: 150,
            kcal: 165,
            row: ['Spices, curry powder', 325],
          },
        ],
      },
    ]);
    state.grounded.mealItems[0].ingredients[0].selectedCandidateId = 'none';
    expect(rejectWrongFormRows(state).rejected).toBe(0);
  });

  it("never counts a drink's alcohol against Call 2's macros", () => {
    // 660 g beer: 284 kcal in the row, but only 106 from its macros.
    const state = stateOf([
      {
        name: 'Bia Tiger',
        cookingMethod: 'raw',
        parts: [
          {
            name: 'bia',
            g: 660,
            kcal: 104,
            row: ['Alcoholic beverage, beer, regular', 43, 16],
          },
        ],
      },
    ]);
    expect(rejectWrongFormRows(state).rejected).toBe(0);
  });

  it('keeps the row when Call 2 did not really estimate the food', () => {
    // A soda Call 2 put at 1 kcal: the row is the better number.
    const state = stateOf([
      {
        name: 'Ginger beer',
        cookingMethod: 'raw',
        parts: [
          {
            name: 'ginger beer',
            g: 440,
            kcal: 1,
            row: ['Beverages, carbonated, ginger ale', 34],
          },
        ],
      },
    ]);
    expect(rejectWrongFormRows(state).rejected).toBe(0);
  });

  it('keeps a row less than three times the estimate', () => {
    // 90 g pork belly: 466 kcal from the row against 231 estimated.
    const state = stateOf([
      {
        name: 'Bún chả',
        cookingMethod: 'nướng',
        parts: [
          {
            name: 'chả miếng',
            g: 90,
            kcal: 231,
            row: ['Pork, fresh, belly, raw', 518],
          },
        ],
      },
    ]);
    expect(rejectWrongFormRows(state).rejected).toBe(0);
  });
});

describe('dropOilInFriedRows', () => {
  const oil = {
    name: 'dầu ăn',
    g: 8,
    kcal: 71,
    row: ['Oil, soybean', 884] as [string, number],
  };

  it('drops the oil row when the food matched a fried row', () => {
    const state = stateOf([
      {
        name: 'Trứng chiên',
        cookingMethod: 'chiên',
        parts: [
          {
            name: 'trứng',
            g: 100,
            kcal: 196,
            row: ['Egg, whole, cooked, fried', 196],
          },
          oil,
        ],
      },
      {
        name: 'Cơm',
        cookingMethod: 'nấu',
        parts: [
          { name: 'cơm', g: 200, kcal: 260, row: ['Rice, white, cooked', 130] },
        ],
      },
    ]);
    const out = dropOilInFriedRows(state);
    expect(out.dropped).toBe(1);
    expect(
      out.state.decomposition.mealItems[0].ingredients.map((i) => i.rawName)
    ).toEqual(['trứng']);
    expect(picks(out.state.grounded)).toEqual(['trứng:c1', 'cơm:c1']);
    expect(out.state.matchResults.map((m) => m.ingredientIndex)).toEqual([
      0, 1,
    ]);
    expect(out.state.portionResolutions).toHaveLength(2);
  });

  it('keeps the oil when the food matched a plain row', () => {
    const state = stateOf([
      {
        name: 'Trứng chiên',
        cookingMethod: 'chiên',
        parts: [
          {
            name: 'trứng',
            g: 100,
            kcal: 143,
            row: ['Egg, whole, raw, fresh', 143],
          },
          oil,
        ],
      },
    ]);
    expect(dropOilInFriedRows(state).dropped).toBe(0);
  });

  it('keeps the oil when another food in the dish still needs it', () => {
    const state = stateOf([
      {
        name: 'Cơm chiên trứng',
        cookingMethod: 'chiên',
        parts: [
          {
            name: 'trứng',
            g: 50,
            kcal: 98,
            row: ['Egg, whole, cooked, fried', 196],
          },
          { name: 'cơm', g: 200, kcal: 260, row: ['Rice, white, cooked', 130] },
          oil,
        ],
      },
    ]);
    expect(dropOilInFriedRows(state).dropped).toBe(0);
  });

  it('ignores seasonings and fats pan-fried without oil', () => {
    const fried = stateOf([
      {
        name: 'Tôm chiên xù',
        cookingMethod: 'chiên',
        parts: [
          {
            name: 'tôm',
            g: 80,
            kcal: 194,
            row: ['Crustaceans, shrimp, cooked, breaded and fried', 242],
          },
          { name: 'muối', g: 2, kcal: 0, row: ['Salt, table', 0] },
          oil,
        ],
      },
    ]);
    expect(dropOilInFriedRows(fried).dropped).toBe(1);
    const panFried = stateOf([
      {
        name: 'Bê áp chảo',
        cookingMethod: 'áp chảo',
        parts: [
          {
            name: 'bê',
            g: 100,
            kcal: 211,
            row: ['Veal, leg, cooked, pan-fried, not breaded', 211],
          },
          oil,
        ],
      },
    ]);
    expect(dropOilInFriedRows(panFried).dropped).toBe(0);
  });
});

describe('swapFriedRowsWhenNoOil', () => {
  /** "2 fried eggs, cooked without any oil": Call 2 picked the fried-egg row (c1). */
  function eggs(prepNotes: string[] | undefined) {
    const state = stateOf([
      {
        name: 'Fried eggs',
        cookingMethod: 'fried',
        parts: [
          {
            name: 'eggs',
            g: 100,
            kcal: 196,
            row: ['Egg, whole, cooked, fried', 196],
          },
        ],
      },
    ]);
    state.decomposition.mealItems[0].ingredients[0].prepNotes = prepNotes;
    const fried = state.matchResults[0].candidates[0];
    const plain = {
      ...fried,
      info: { matchedName: 'Egg, whole, raw, fresh' },
      prompt: {
        name: 'Egg, whole, raw, fresh',
        nameEn: 'Egg, whole, raw, fresh',
        score: 1,
      },
      nutrition: {
        caloriesKcal: 143,
        proteinG: 12.6,
        carbohydrateG: 0.7,
        fatG: 9.5,
      },
    };
    fried.nutrition = {
      caloriesKcal: 196,
      proteinG: 13.6,
      carbohydrateG: 0.8,
      fatG: 14.8,
    } as never;
    state.matchResults[0].candidates.push(plain as never);
    const g = state.grounded.mealItems[0].ingredients[0];
    g.proteinG = triple(13.6);
    g.carbohydrateG = triple(0.8);
    g.fatG = triple(14.8);
    return state;
  }

  it("moves a fried row to the same food's plain row when the user said no oil", () => {
    const out = swapFriedRowsWhenNoOil(eggs(['without any oil']));
    expect(out.swapped).toBe(1);
    const g = out.state.grounded.mealItems[0].ingredients[0];
    expect(g.selectedCandidateId).toBe('c2');
    expect(g.fatG.mid).toBeCloseTo(9.5);
    expect(g.proteinG.mid).toBeCloseTo(12.6);
  });

  it('keeps the fried row when the user said nothing about oil', () => {
    expect(swapFriedRowsWhenNoOil(eggs(undefined)).swapped).toBe(0);
  });
});
