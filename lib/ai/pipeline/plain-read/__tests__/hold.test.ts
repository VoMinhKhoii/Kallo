import { describe, expect, it } from 'vitest';
import {
  goalAdjustNutrition,
  sumBoundedNutrition,
} from '@/lib/ai/pipeline/assemble/goal-adjustment';
import type {
  BoundedNutrition,
  NutritionValues,
} from '@/lib/ai/types/nutrition-values';
import { NUTRITION_KEYS } from '@/lib/ai/types/nutrition-values';
import type {
  PipelineResult,
  ProcessedIngredient,
} from '@/lib/ai/types/result';
import {
  HOLD_BAND,
  holdFactor,
  holdToPlainRead,
  MAX_HOLD_FACTOR,
} from '../hold';

function bounded(kcal: number, protein: number): BoundedNutrition {
  const out = {} as Record<string, unknown>;
  for (const k of NUTRITION_KEYS) out[k] = null;
  out.caloriesKcal = { low: kcal * 0.9, mid: kcal, high: kcal * 1.1 };
  out.proteinG = { low: protein * 0.9, mid: protein, high: protein * 1.1 };
  return out as BoundedNutrition;
}

function ingredient(
  name: string,
  grams: number,
  kcal: number
): ProcessedIngredient {
  const b = bounded(kcal, kcal / 20);
  return {
    ingredientName: name,
    foodCompositionId: null,
    estimatedGrams: grams,
    rawEquivalentGrams: grams,
    cookingMethod: null,
    userFacingUnit: null,
    matchConfidence: null,
    boundedNutrition: b,
    displayedNutrition: goalAdjustNutrition(b, 'cutting', 0.5),
  };
}

function meal(parts: ProcessedIngredient[]): PipelineResult {
  const b = sumBoundedNutrition(parts.map((p) => p.boundedNutrition));
  return {
    mealItems: [
      {
        name: 'dish',
        ingredients: parts,
        boundedNutrition: b,
        displayedNutrition: goalAdjustNutrition(b, 'cutting', 0.5),
      },
    ],
    mealSlot: null,
    confidenceOverall: 'medium',
    boundedNutrition: b,
    displayedNutrition: goalAdjustNutrition(b, 'cutting', 0.5),
    unmatchedIngredients: [],
  };
}

const kcalOf = (v: NutritionValues) => v.caloriesKcal ?? 0;
/**
 * A read of `total` kcal; `foods` are [grams, kcal] pairs. By default one food
 * with no grams, so grams follow the calorie factor.
 */
const read = (total: number, foods: [number, number][] = [[0, total]]) => ({
  totalKcal: total,
  foods: foods.map(([grams, kcal], i) => ({
    name: `food ${i}`,
    pieces: 1,
    gramsEach: grams,
    grams,
    kcal,
  })),
});

describe('holdFactor', () => {
  it('leaves a meal inside the band alone', () => {
    expect(holdFactor(500, 500)).toBe(1);
    expect(holdFactor(549, 500)).toBe(1);
    expect(holdFactor(455, 500)).toBe(1);
  });

  it('moves a meal to the nearest band edge', () => {
    expect(800 * holdFactor(800, 500)).toBeCloseTo(500 * (1 + HOLD_BAND));
    expect(200 * holdFactor(200, 500)).toBeCloseTo(500 / (1 + HOLD_BAND));
  });

  it('caps the factor both ways', () => {
    expect(holdFactor(10, 1000)).toBe(MAX_HOLD_FACTOR);
    expect(holdFactor(10_000, 100)).toBe(1 / MAX_HOLD_FACTOR);
  });
});

describe('holdToPlainRead', () => {
  const parts = [ingredient('rice', 200, 260), ingredient('pork', 100, 290)];

  it('scales every part so the shown total lands on the band edge', () => {
    const before = meal(parts);
    const app = kcalOf(before.displayedNutrition);
    const out = holdToPlainRead(before, { read: read(app / 2) });

    expect(out.outcome).toBe('held');
    expect(out.appKcal).toBe(app);
    expect(kcalOf(out.result.displayedNutrition)).toBeCloseTo(
      (app / 2) * (1 + HOLD_BAND)
    );
    // Grams and nutrients move together: the split between parts is kept.
    const [rice, pork] = out.result.mealItems[0].ingredients;
    expect(rice.estimatedGrams).toBeCloseTo(200 * out.factor);
    expect(pork.rawEquivalentGrams).toBeCloseTo(100 * out.factor);
    expect(rice.boundedNutrition.proteinG?.high).toBeCloseTo(
      13 * 1.1 * out.factor
    );
    // The input is not mutated.
    expect(before.mealItems[0].ingredients[0].estimatedGrams).toBe(200);
  });

  it('matches what confirm re-derives from the scaled bounded triples', () => {
    const out = holdToPlainRead(meal(parts), { read: read(1500) });
    const ingredients = out.result.mealItems[0].ingredients;
    const reDerived = goalAdjustNutrition(
      sumBoundedNutrition(ingredients.map((i) => i.boundedNutrition)),
      'cutting',
      0.5
    );
    expect(kcalOf(reDerived)).toBeCloseTo(
      kcalOf(out.result.displayedNutrition)
    );
  });

  it('leaves missing reads and in-band meals unchanged', () => {
    const m = meal(parts);
    const app = kcalOf(m.displayedNutrition);
    expect(holdToPlainRead(m, { read: null }).outcome).toBe('no_read');
    const inBand = holdToPlainRead(m, { read: read(app) });
    expect(inBand.outcome).toBe('within_band');
    expect(inBand.result).toBe(m);
  });

  it('holds the other parts to what the read gives them, typed parts left as they are', () => {
    // "2 gói mì + 100g rau": the noodles came out as one pack.
    const veg = {
      ...ingredient('rau', 100, 40),
      typedAmount: 'grams' as const,
    };
    const before = meal([ingredient('mì', 80, 380), veg]);
    const out = holdToPlainRead(before, {
      read: read(810, [
        [160, 760],
        [100, 50],
      ]),
    });

    expect(out.outcome).toBe('held');
    const [noodles, vegAfter] = out.result.mealItems[0].ingredients;
    expect(vegAfter).toBe(veg);
    // The noodles land on the band edge of the read's noodles, not of the meal.
    const edge = 760 / (1 + HOLD_BAND);
    expect(kcalOf(noodles.displayedNutrition)).toBeCloseTo(edge);
    // Its grams land on the band edge of the read's grams for it.
    expect(noodles.estimatedGrams).toBeCloseTo(160 / (1 + HOLD_BAND));
    expect(out.gramsFactor).toBeCloseTo(160 / (1 + HOLD_BAND) / 80);
    // Every total agrees.
    const shownVeg = kcalOf(veg.displayedNutrition);
    expect(kcalOf(out.result.displayedNutrition)).toBeCloseTo(edge + shownVeg);
    expect(kcalOf(out.result.mealItems[0].displayedNutrition)).toBeCloseTo(
      edge + shownVeg
    );
  });

  it('leaves grams that agree with the read alone when only the calories are off', () => {
    // Two packs of noodles at the right 160 g, priced on a row far too lean.
    const before = meal([ingredient('mì', 160, 340)]);
    const out = holdToPlainRead(before, { read: read(760, [[160, 760]]) });
    expect(out.outcome).toBe('held');
    expect(out.gramsFactor).toBe(1);
    const [noodles] = out.result.mealItems[0].ingredients;
    expect(noodles.estimatedGrams).toBe(160);
    expect(noodles.rawEquivalentGrams).toBe(160);
    expect(kcalOf(noodles.displayedNutrition)).toBeCloseTo(
      760 / (1 + HOLD_BAND)
    );
  });

  it('moves grams alone when the calories already agree', () => {
    const before = meal([ingredient('soup', 100, 200)]);
    const app = kcalOf(before.displayedNutrition);
    const out = holdToPlainRead(before, { read: read(app, [[400, app]]) });
    expect(out.outcome).toBe('held');
    expect(out.factor).toBe(1);
    expect(out.result.mealItems[0].ingredients[0].estimatedGrams).toBeCloseTo(
      400 / (1 + HOLD_BAND)
    );
    expect(kcalOf(out.result.displayedNutrition)).toBeCloseTo(app);
  });

  it('does not make the other parts absorb a difference over a typed part', () => {
    // The read prices the 200 g of salmon far above the row; the broccoli
    // agrees with the read and stays.
    const salmon = {
      ...ingredient('salmon', 200, 275),
      typedAmount: 'grams' as const,
    };
    const m = meal([salmon, ingredient('broccoli', 110, 40)]);
    const out = holdToPlainRead(m, {
      read: read(456, [
        [200, 416],
        [120, 40],
      ]),
    });
    expect(out.outcome).toBe('within_band');
    expect(out.result).toBe(m);
  });

  it('pairs a typed part with the read food of the same grams that is closest in calories', () => {
    const rice = {
      ...ingredient('rice', 100, 130),
      typedAmount: 'grams' as const,
    };
    const m = meal([rice, ingredient('egg', 50, 78)]);
    // Two 100 g foods in the read: the rice must not be paired with the chicken.
    const out = holdToPlainRead(m, {
      read: read(373, [
        [100, 165],
        [100, 130],
        [50, 78],
      ]),
    });
    // Free parts against the read's remainder (165 + 78): the egg is moved up.
    expect(out.outcome).toBe('held');
    expect(
      kcalOf(out.result.mealItems[0].ingredients[1].displayedNutrition)
    ).toBeCloseTo(243 / (1 + HOLD_BAND));
  });

  it('moves the other parts toward the total, within 2x, when a typed part is not in the read', () => {
    const beef = {
      ...ingredient('beef', 75, 130),
      typedAmount: 'grams' as const,
    };
    const before = meal([beef, ingredient('rice', 100, 130)]);
    // The read lists no 75 g food.
    const out = holdToPlainRead(before, { read: read(1300, [[400, 1300]]) });
    expect(out.outcome).toBe('held');
    expect(out.factor).toBe(2);
    expect(out.result.mealItems[0].ingredients[0]).toBe(beef);
  });

  it('leaves the meal alone when nothing is free or the typed parts reach the read', () => {
    const typed = (name: string, grams: number, kcal: number) => ({
      ...ingredient(name, grams, kcal),
      typedAmount: 'grams' as const,
    });
    const allTyped = meal([
      typed('rice', 150, 195),
      typed('chicken', 120, 200),
    ]);
    expect(holdToPlainRead(allTyped, { read: read(900) }).outcome).toBe(
      'typed_parts'
    );
    // The typed salmon alone is above the read's total, and the read lists
    // no 250 g food to compare it with.
    const m = meal([
      typed('salmon', 250, 760),
      ingredient('broccoli', 150, 50),
    ]);
    const out = holdToPlainRead(m, { read: read(500) });
    expect(out.outcome).toBe('typed_parts');
    expect(out.result).toBe(m);
  });
});

describe('holdToPlainRead, a part the user typed calories for', () => {
  it('finds it in the read by its calories, not by its estimated grams', () => {
    // "160kcal yogurt and a banana": the yogurt's 100 g is an estimate, and
    // the read's banana also weighs 100 g.
    const yogurt = {
      ...ingredient('yogurt', 100, 160),
      typedAmount: 'kcal' as const,
    };
    const banana = ingredient('banana', 100, 89);
    const m = meal([yogurt, banana]);
    const y = kcalOf(yogurt.displayedNutrition);
    const b = kcalOf(banana.displayedNutrition);
    const out = holdToPlainRead(m, {
      read: read(y + b, [
        [150, y],
        [100, b],
      ]),
    });
    expect(out.outcome).toBe('within_band');
    expect(out.result).toBe(m);
  });

  it('picks the read food closest in grams when two have the same calories', () => {
    // "160kcal yogurt and toast": both come out at the same calories, and the
    // read lists the toast first.
    const yogurt = {
      ...ingredient('yogurt', 150, 160),
      typedAmount: 'kcal' as const,
    };
    const toast = ingredient('toast', 50, 160);
    const m = meal([yogurt, toast]);
    const k = kcalOf(yogurt.displayedNutrition);
    const out = holdToPlainRead(m, {
      read: read(2 * k, [
        [50, k],
        [150, k],
      ]),
    });
    expect(out.outcome).toBe('within_band');
    expect(out.result).toBe(m);
  });
});

describe('holdToPlainRead, parts weighed one by one in one dish', () => {
  it('pairs each with its own read food, not their sum with another food', () => {
    // "100g chicken and 200g rice, plus a dessert": the dessert also weighs 300 g.
    const weighed = (name: string, grams: number, kcal: number) => ({
      ...ingredient(name, grams, kcal),
      typedAmount: 'grams' as const,
    });
    const plate = meal([
      weighed('chicken', 100, 165),
      weighed('rice', 200, 260),
    ]);
    const dessert = meal([ingredient('dessert', 300, 600)]);
    const b = sumBoundedNutrition([
      plate.boundedNutrition,
      dessert.boundedNutrition,
    ]);
    const m: PipelineResult = {
      ...plate,
      mealItems: [...plate.mealItems, ...dessert.mealItems],
      boundedNutrition: b,
      displayedNutrition: goalAdjustNutrition(b, 'cutting', 0.5),
    };
    const shown = (i: number, j: number) =>
      kcalOf(m.mealItems[i].ingredients[j].displayedNutrition);
    const out = holdToPlainRead(m, {
      read: read(kcalOf(m.displayedNutrition), [
        [300, shown(1, 0)],
        [100, shown(0, 0)],
        [200, shown(0, 1)],
      ]),
    });
    expect(out.outcome).toBe('within_band');
    expect(out.result).toBe(m);
  });
});
