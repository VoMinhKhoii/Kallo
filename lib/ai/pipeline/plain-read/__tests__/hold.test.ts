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
  hasTypedWeight,
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
    const out = holdToPlainRead(before, {
      readKcal: app / 2,
      typedWeight: false,
    });

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
    const out = holdToPlainRead(meal(parts), {
      readKcal: 1500,
      typedWeight: false,
    });
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

  it('leaves typed-weight meals, missing reads and in-band meals unchanged', () => {
    const m = meal(parts);
    const app = kcalOf(m.displayedNutrition);
    expect(
      holdToPlainRead(m, { readKcal: 100, typedWeight: true }).outcome
    ).toBe('typed_weight');
    expect(
      holdToPlainRead(m, { readKcal: null, typedWeight: false }).outcome
    ).toBe('no_read');
    const inBand = holdToPlainRead(m, { readKcal: app, typedWeight: false });
    expect(inBand.outcome).toBe('within_band');
    expect(inBand.result).toBe(m);
  });
});

describe('hasTypedWeight', () => {
  it.each([
    '150g thăn bò cân sống',
    '2 lạng thịt heo',
    '1 ký tôm',
    'an 200 gr com',
    '8 oz steak',
    '250ml sữa tươi',
    '1.5 kg ribs',
    '2 lạng thịt bò'.normalize('NFD'),
    'nửa ký thịt bò',
    'half a pound of ground beef',
    'a 6 ounce sirloin',
  ])('spots a typed weight in %s', (text) => {
    expect(hasTypedWeight(text)).toBe(true);
  });

  it.each([
    '2 gói mì tôm',
    '10 gà rán',
    '1 ly trà sữa size L',
    'a cup of 2% milk',
    '5 cái bánh rán',
  ])('does not mistake %s for a weight', (text) => {
    expect(hasTypedWeight(text)).toBe(false);
  });
});
