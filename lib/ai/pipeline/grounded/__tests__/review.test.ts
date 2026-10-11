import { describe, expect, it } from 'vitest';
import type { IngredientV2MatchResult } from '@/lib/ai/matching/candidate';
import type { MealDecompositionV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type {
  GroundedEstimation,
  GroundedIngredientEstimate,
} from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import type { PortionResolution } from '@/lib/ai/portion/types';
import { dropOilInFriedRows, rejectWrongFormRows } from '../review';

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
  kcalPer100: number
): IngredientV2MatchResult =>
  ({
    ingredientIndex: i,
    candidates: [
      {
        info: { matchedName: nameEn },
        nutrition: { caloriesKcal: kcalPer100 },
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
      row: [string, number];
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
    matchResults: flat.map((p, i) => row(i, p.row[0], p.row[1])),
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
