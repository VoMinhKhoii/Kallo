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
  reviewPicks,
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
  refuseKind: 'none',
  refusePct: 0,
  proteinG: triple(0),
  carbohydrateG: triple(kcal / 4),
  fatG: triple(0),
});

/** Fixture rows that are a cooking fat ("Oil, soybean", "Butter, salted"). */
const PURE_FAT_ROW = /^(?:oil|butter|lard|ghee)\b/i;

/** One candidate row with this English name and energy density. */
const row = (
  i: number,
  nameEn: string,
  kcalPer100: number,
  /** Energy from protein, carbohydrate and fat, when the row has more (alcohol). */
  macroKcalPer100 = kcalPer100,
  /** The curated card's cooking method ("deep-fried"). */
  rowCookingMethod?: string
): IngredientV2MatchResult =>
  ({
    ingredientIndex: i,
    candidates: [
      {
        info: { matchedName: nameEn, rowCookingMethod },
        nutrition: PURE_FAT_ROW.test(nameEn)
          ? // A cooking fat is all fat (classifyPureFat reads the composition).
            {
              caloriesKcal: kcalPer100,
              proteinG: 0,
              carbohydrateG: 0,
              fatG: macroKcalPer100 / 9,
            }
          : {
              caloriesKcal: kcalPer100,
              proteinG: 0,
              carbohydrateG: macroKcalPer100 / 4,
              // A fried row carries its frying oil (isAlreadyFriedRow's fat floor).
              fatG: /\bfried\b/i.test(nameEn) || rowCookingMethod ? 12 : 0,
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
      /** The part's own method, when it differs from the dish's. */
      method?: string;
      prepNotes?: string[];
      row: [
        name: string,
        kcalPer100: number,
        macroKcalPer100?: number,
        rowCookingMethod?: string,
      ];
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
        ...(p.method ? { cookingMethod: p.method } : {}),
        ...(p.prepNotes ? { prepNotes: p.prepNotes } : {}),
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

  it('keeps the oil when a translated name says fried but the row is raw', () => {
    // USDA's raw "broilers or fryers" chicken; its Vietnamese name says "gà rán".
    const state = stateOf([
      {
        name: 'Gà kho',
        cookingMethod: 'kho',
        parts: [
          {
            name: 'gà',
            g: 150,
            kcal: 180,
            row: ['Chicken, broilers or fryers, thigh, meat only, raw', 120],
          },
          oil,
        ],
      },
    ]);
    state.matchResults[0].candidates[0].info.matchedName =
      'Thịt gà (gà công nghiệp hoặc gà rán), đùi, chỉ lấy thịt, sống';
    expect(dropOilInFriedRows(state).dropped).toBe(0);
  });

  it('keeps the oil for a plain part fried with the dish (fish and chips)', () => {
    const state = stateOf([
      {
        name: 'Fish and chips',
        cookingMethod: 'deep-fried',
        parts: [
          {
            name: 'battered fish',
            g: 150,
            kcal: 350,
            row: ['Fish, cod, battered, fried', 233],
          },
          {
            name: 'potato',
            g: 200,
            kcal: 154,
            row: ['Potatoes, flesh and skin, raw', 77],
          },
          { ...oil, name: 'oil' },
        ],
      },
    ]);
    expect(dropOilInFriedRows(state).dropped).toBe(0);
  });

  it('keeps the oil when a prep note fries the plain part', () => {
    const state = stateOf([
      {
        name: 'Đậu phụ sốt cà chua',
        cookingMethod: 'sốt',
        parts: [
          {
            name: 'chả cá',
            g: 80,
            kcal: 180,
            row: ['Fish cake, fried', 225],
          },
          {
            name: 'đậu phụ',
            g: 120,
            kcal: 90,
            method: 'sốt',
            prepNotes: ['rán vàng trước'],
            row: ['Tofu, firm, raw', 76],
          },
          oil,
        ],
      },
    ]);
    expect(dropOilInFriedRows(state).dropped).toBe(0);
  });

  it('reads dish names at word edges ("surimi chiên" is not "mì chiên")', () => {
    const state = stateOf([
      {
        // Only the dish name could say the rice is fried here.
        name: 'Cơm surimi chiên',
        cookingMethod: 'trộn',
        parts: [
          {
            name: 'cơm',
            g: 200,
            kcal: 260,
            row: ['Rice, white, cooked', 130],
          },
          {
            name: 'surimi',
            g: 80,
            kcal: 200,
            row: ['Surimi, breaded, fried', 250],
          },
          { ...oil, method: 'chiên' },
        ],
      },
    ]);
    expect(dropOilInFriedRows(state).dropped).toBe(1);
  });

  it('drops the oil when a plain part says no oil under a fried dish name', () => {
    const state = stateOf([
      {
        name: 'Cơm chiên trứng',
        cookingMethod: 'trộn',
        parts: [
          {
            name: 'trứng',
            g: 60,
            kcal: 118,
            row: ['Egg, whole, cooked, fried', 196],
          },
          {
            name: 'cơm',
            g: 200,
            kcal: 260,
            prepNotes: ['không dầu'],
            row: ['Rice, white, cooked', 130],
          },
          { ...oil, method: 'chiên' },
        ],
      },
    ]);
    expect(dropOilInFriedRows(state).dropped).toBe(1);
  });

  it('does not read "ranch" as frying the side', () => {
    const state = stateOf([
      {
        name: 'Fried chicken salad',
        cookingMethod: 'assembled',
        parts: [
          {
            name: 'fried chicken',
            g: 150,
            kcal: 390,
            row: ['Chicken, thigh, batter, fried', 260],
          },
          {
            name: 'greens',
            g: 80,
            kcal: 15,
            method: 'raw',
            prepNotes: ['with ranch'],
            row: ['Lettuce, raw', 15],
          },
          { ...oil, name: 'oil', method: 'fried' },
        ],
      },
    ]);
    expect(dropOilInFriedRows(state).dropped).toBe(1);
  });

  it('keeps a fat the dish dresses or spreads, not fries in', () => {
    const state = stateOf([
      {
        name: 'Fried chicken salad with olive oil',
        cookingMethod: 'assembled',
        parts: [
          {
            name: 'fried chicken',
            g: 150,
            kcal: 390,
            row: ['Chicken, thigh, batter, fried', 260],
          },
          {
            name: 'lettuce',
            g: 80,
            kcal: 12,
            method: 'raw',
            row: ['Lettuce, raw', 15],
          },
          { ...oil, name: 'olive oil', row: ['Oil, olive', 884] },
        ],
      },
      {
        name: 'Fried eggs with buttered toast',
        cookingMethod: 'fried',
        parts: [
          {
            name: 'fried egg',
            g: 100,
            kcal: 196,
            row: ['Egg, whole, cooked, fried', 196],
          },
          {
            name: 'toast',
            g: 60,
            kcal: 160,
            method: 'toasted',
            prepNotes: ['buttered'],
            row: ['Bread, white, toasted', 290],
          },
          // USDA butter: 81.1 g fat (its energy factor is below 9 kcal/g).
          { ...oil, name: 'butter', row: ['Butter, salted', 717, 730] },
        ],
      },
    ]);
    expect(dropOilInFriedRows(state).dropped).toBe(0);
  });

  it('never reads peanut butter as the frying fat', () => {
    const state = stateOf([
      {
        name: 'Fried eggs with toast and peanut butter',
        cookingMethod: 'fried',
        parts: [
          {
            name: 'fried egg',
            g: 100,
            kcal: 196,
            row: ['Egg, whole, cooked, fried', 196],
          },
          {
            name: 'toast',
            g: 60,
            kcal: 160,
            method: 'toasted',
            row: ['Bread, white, toasted', 290],
          },
          {
            name: 'peanut butter',
            g: 30,
            kcal: 176,
            row: ['Peanut butter, smooth style', 588],
          },
        ],
      },
    ]);
    expect(dropOilInFriedRows(state).dropped).toBe(0);
  });

  it('never drops an unmatched food named for a fat', () => {
    const state = stateOf([
      {
        name: 'Fried eggs with toast and almond butter',
        cookingMethod: 'fried',
        parts: [
          {
            name: 'fried egg',
            g: 100,
            kcal: 196,
            row: ['Egg, whole, cooked, fried', 196],
          },
          {
            name: 'toast',
            g: 60,
            kcal: 160,
            method: 'toasted',
            row: ['Bread, white, toasted', 290],
          },
          {
            name: 'almond butter',
            g: 30,
            kcal: 184,
            row: ['Almond butter, plain', 614],
          },
        ],
      },
    ]);
    // Call 2 picked no row for it.
    state.grounded.mealItems[0].ingredients[2].selectedCandidateId = 'none';
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

  it('keeps an oil amount the user stated', () => {
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
    ]);
    const parts = state.decomposition.mealItems[0].ingredients;
    parts[1] = { ...parts[1], count: 1, unitToken: 'muỗng' };
    expect(dropOilInFriedRows(state).dropped).toBe(0);
  });

  it("drops the oil of a counted dish (the count is the dish's)", () => {
    // "2 omelettes": the dish-count check leaves the count on the egg and
    // takes the oil's copy away.
    const state = stateOf([
      {
        name: 'Omelettes',
        cookingMethod: 'fried',
        parts: [
          {
            name: 'egg',
            g: 100,
            kcal: 196,
            row: ['Egg, whole, cooked, fried', 196],
          },
          oil,
        ],
      },
    ]);
    const parts = state.decomposition.mealItems[0].ingredients;
    parts[0] = { ...parts[0], count: 2, unitToken: 'omelette' };
    expect(dropOilInFriedRows(state).dropped).toBe(1);
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

  it('drops unstated oil on bún + chả giò (fried row) + rau + dầu', () => {
    const state = stateOf([
      {
        name: 'Bún chả giò',
        cookingMethod: 'chiên',
        parts: [
          {
            name: 'bún',
            g: 180,
            kcal: 198,
            method: 'luộc',
            row: ['Rice noodles, cooked', 110],
          },
          {
            name: 'chả giò',
            g: 100,
            kcal: 280,
            row: ['Chả giò chiên', 280, 280, 'deep-fried'],
          },
          {
            name: 'rau sống',
            g: 50,
            kcal: 10,
            method: 'sống',
            row: ['Lettuce, raw', 20],
          },
          oil,
        ],
      },
    ]);
    const out = dropOilInFriedRows(state);
    expect(out.dropped).toBe(1);
    expect(
      out.state.decomposition.mealItems[0].ingredients.map((i) => i.rawName)
    ).toEqual(['bún', 'chả giò', 'rau sống']);
  });

  it('drops unstated oil on rice + fried chicken + oil', () => {
    const state = stateOf([
      {
        name: 'Fried chicken and rice',
        cookingMethod: 'fried',
        parts: [
          {
            name: 'rice',
            g: 200,
            kcal: 260,
            method: 'steamed',
            row: ['Rice, white, cooked', 130],
          },
          {
            name: 'fried chicken',
            g: 150,
            kcal: 390,
            row: ['Chicken, thigh, batter, fried', 260],
          },
          {
            name: 'oil',
            g: 10,
            kcal: 88,
            row: ['Oil, vegetable', 884],
          },
        ],
      },
    ]);
    const out = dropOilInFriedRows(state);
    expect(out.dropped).toBe(1);
    expect(
      out.state.decomposition.mealItems[0].ingredients.map((i) => i.rawName)
    ).toEqual(['rice', 'fried chicken']);
  });

  it('keeps oil on stir-fried noodles + fried egg + oil (by dish or ingredient method)', () => {
    // Whole dish is stir-fried:
    const dishStirFry = stateOf([
      {
        name: 'Stir-fried noodles with fried egg',
        cookingMethod: 'stir-fried',
        parts: [
          {
            name: 'noodles',
            g: 200,
            kcal: 280,
            row: ['Egg noodles, cooked', 140],
          },
          {
            name: 'fried egg',
            g: 50,
            kcal: 98,
            row: ['Egg, whole, cooked, fried', 196],
          },
          {
            name: 'oil',
            g: 10,
            kcal: 88,
            row: ['Oil, vegetable', 884],
          },
        ],
      },
    ]);
    expect(dropOilInFriedRows(dishStirFry).dropped).toBe(0);

    // Generic dish method, ingredient carries its own stir-fried method:
    const ingStirFry = stateOf([
      {
        name: 'Noodles and egg plate',
        cookingMethod: 'mixed',
        parts: [
          {
            name: 'noodles',
            g: 200,
            kcal: 280,
            row: ['Egg noodles, cooked', 140],
          },
          {
            name: 'fried egg',
            g: 50,
            kcal: 98,
            row: ['Egg, whole, cooked, fried', 196],
          },
          {
            name: 'oil',
            g: 10,
            kcal: 88,
            row: ['Oil, vegetable', 884],
          },
        ],
      },
    ]);
    ingStirFry.decomposition.mealItems[0].ingredients[0].cookingMethod =
      'stir-fried';
    expect(dropOilInFriedRows(ingStirFry).dropped).toBe(0);
  });

  it('keeps user-stated oil even alongside fried chicken + plain rice', () => {
    const state = stateOf([
      {
        name: 'Fried chicken and rice',
        cookingMethod: 'fried',
        parts: [
          {
            name: 'rice',
            g: 200,
            kcal: 260,
            method: 'steamed',
            row: ['Rice, white, cooked', 130],
          },
          {
            name: 'fried chicken',
            g: 150,
            kcal: 390,
            row: ['Chicken, thigh, batter, fried', 260],
          },
          oil,
        ],
      },
    ]);
    const parts = state.decomposition.mealItems[0].ingredients;
    parts[2] = { ...parts[2], count: 1, unitToken: 'muỗng' };
    expect(dropOilInFriedRows(state).dropped).toBe(0);
  });
});

describe('reviewPicks', () => {
  const misoAndEgg = () =>
    stateOf([
      {
        name: 'Soup miso',
        cookingMethod: 'nấu',
        parts: [{ name: 'soup miso', g: 330, kcal: 182, row: ['Miso', 198] }],
      },
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
          { name: 'dầu ăn', g: 8, kcal: 71, row: ['Oil, soybean', 884] },
        ],
      },
    ]);

  it('hands the rescue the reviewed state, then drops the fried dish oil', async () => {
    let seen: string[] = [];
    const out = await reviewPicks(misoAndEgg(), {
      async apply(state) {
        seen = picks(state.grounded);
        return null;
      },
    });
    expect(seen).toEqual(['soup miso:none', 'trứng:c1', 'dầu ăn:c1']);
    expect(picks(out.state.grounded)).toEqual(['soup miso:none', 'trứng:c1']);
    expect(out.changed).toBe(true);
    expect(out.rescued).toBe(0);
    expect(out.summary).toBe(
      '1 wrong-form rows, 0 ingredients rescued, 1 oil rows dropped, 0 weighed dishes scaled'
    );
  });

  it('reports no change when nothing was reviewed away', async () => {
    const state = stateOf([
      {
        name: 'Cơm',
        cookingMethod: 'nấu',
        parts: [
          { name: 'cơm', g: 200, kcal: 260, row: ['Rice, white, cooked', 130] },
        ],
      },
    ]);
    const out = await reviewPicks(state, null);
    expect(out.changed).toBe(false);
    expect(out.state).toEqual(state);
  });
});
