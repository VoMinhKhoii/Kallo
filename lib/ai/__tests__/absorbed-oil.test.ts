import { describe, expect, it } from 'vitest';
import {
  ABSORBED_OIL_RANGES,
  absorbedOil,
  COOKING_FAT_ROW_NAMES,
  isDiscreteOilIngredient,
  mealItemHasDiscreteOil,
  renderAbsorbedOilPromptRule,
} from '@/lib/ai/absorbed-oil';
import type { RawNutritionAdjustment } from '@/lib/ai/pipeline/nutrition';
import { __testing } from '@/lib/ai/pipeline/nutrition';

const vegetableEstimate: RawNutritionAdjustment['mealItems'][number]['ingredients'][number] =
  {
    ingredientName: 'rau muống',
    caloriesKcal: { low: 45, mid: 55, high: 65 },
    proteinG: { low: 2, mid: 3, high: 4 },
    carbohydrateG: { low: 4, mid: 5, high: 6 },
    fatG: { low: 6, mid: 7, high: 8 },
  };

describe('absorbed cooking oil', () => {
  it('uses one shared set of figures for the prompt and server allowance', () => {
    const promptRule = renderAbsorbedOilPromptRule();
    expect(promptRule).toContain(
      `stir-fry ${ABSORBED_OIL_RANGES.stirFryG.low}–${ABSORBED_OIL_RANGES.stirFryG.high}g`
    );
    expect(promptRule).toContain(
      `deep-fry ~${ABSORBED_OIL_RANGES.deepFryWeightRatio.low * 100}–${ABSORBED_OIL_RANGES.deepFryWeightRatio.high * 100}%`
    );
    expect(absorbedOil('xào', 100)).toBe(ABSORBED_OIL_RANGES.stirFryG.high);
    expect(absorbedOil('chiên ngập dầu', 100)).toBe(
      100 * ABSORBED_OIL_RANGES.deepFryWeightRatio.high
    );
  });

  it('returns zero for absent and explicitly no-oil methods', () => {
    expect(absorbedOil(null, 100)).toBe(0);
    expect(absorbedOil('nướng không dầu', 100)).toBe(0);
    expect(absorbedOil('air-fried', 100)).toBe(0);
  });

  it('lets a stir-fried vegetable retain non-trivial absorbed fat', () => {
    const resolved = __testing.resolveIngredientMacros(
      vegetableEstimate,
      {
        caloriesKcal: 20,
        proteinG: 2,
        carbohydrateG: 3,
        fatG: 0.4,
      },
      100,
      false,
      'xào'
    );

    expect(resolved.fatG).toEqual({ low: 6, mid: 7, high: 8 });
    expect(resolved.fatG.mid).toBeGreaterThan(5);

    const clamped = __testing.resolveIngredientMacros(
      {
        ...vegetableEstimate,
        fatG: { low: 18, mid: 20, high: 22 },
      },
      {
        caloriesKcal: 20,
        proteinG: 2,
        carbohydrateG: 3,
        fatG: 0.4,
      },
      100,
      false,
      'xào'
    );
    // base × 3 + stir-fry maximum = 0.4 × 3 + 10 = 11.2g.
    expect(clamped.fatG.mid).toBeCloseTo(11.2, 8);
    expect(clamped.fatG.mid).not.toBeCloseTo(0.4, 8);
  });
});

/**
 * Cooking fat is counted exactly once. Call 1 emits it as its own ingredient
 * so its grams, fat and micronutrients (vitamin E especially) reach the meal
 * total; Call 2 and the server guard must then NOT also load it into whatever
 * it was fried in. Observed before this rule: a plate of deep-fried potatoes
 * reporting 21.8g of absorbed fat beside a discrete 25g `Oil` row.
 */
describe('discrete oil rows suppress the sibling allowance', () => {
  it('identifies cooking fats, and does not mistake avocado for butter', () => {
    for (const name of ['dầu ăn', 'Dầu', 'Oil', 'butter', 'ghee', 'mỡ heo']) {
      expect(isDiscreteOilIngredient(name)).toBe(true);
    }
    // `bơ` alone is avocado as often as butter in Vietnamese; a false positive
    // would silently strip the oil allowance from every other ingredient.
    for (const name of ['quả bơ', 'bơ', 'khoai tây', 'rau muống', '']) {
      expect(isDiscreteOilIngredient(name)).toBe(false);
    }
    expect(mealItemHasDiscreteOil(['Khoai tây', 'Dầu ăn'])).toBe(true);
    expect(mealItemHasDiscreteOil(['Khoai tây', 'Thịt bò'])).toBe(false);
  });

  // `dầu giấm` and `dầu hào` carry the token `dầu` without being the fat
  // anything was fried in. Counting them as the dish's cooking fat strips the
  // absorbed-oil allowance from a genuinely fried sibling — the opposite of
  // this module's purpose. `salad dầu giấm` is in our own eval set.
  it('does not mistake vinaigrette or oyster sauce for cooking fat', () => {
    expect(isDiscreteOilIngredient('dầu giấm')).toBe(false);
    expect(isDiscreteOilIngredient('Salad dầu giấm')).toBe(false);
    expect(isDiscreteOilIngredient('dầu hào')).toBe(false);
    expect(isDiscreteOilIngredient('sốt dầu hào')).toBe(false);
    // Sesame oil genuinely is a fat and must keep matching.
    expect(isDiscreteOilIngredient('dầu mè')).toBe(true);
    expect(mealItemHasDiscreteOil(['Cá chiên', 'Salad dầu giấm'])).toBe(false);
    expect(mealItemHasDiscreteOil(['Cá chiên', 'Dầu ăn'])).toBe(true);
  });

  // The prompt renders this list verbatim, so a name it offers Call 1 that
  // this module cannot read back is exactly the drift that let a butter row's
  // siblings claim absorbed oil on top of it.
  it('recognises every cooking-fat name the decomposition prompt asks for', () => {
    for (const name of COOKING_FAT_ROW_NAMES) {
      expect(isDiscreteOilIngredient(name)).toBe(true);
    }
  });

  it('does not grant a fried food an allowance when the oil has its own row', () => {
    const base = {
      caloriesKcal: 80,
      proteinG: 2,
      carbohydrateG: 18,
      fatG: 0.25,
    };
    const friedPotato = {
      ...vegetableEstimate,
      ingredientName: 'Khoai tây',
      fatG: { low: 18, mid: 21.8, high: 26 },
    };

    // No discrete oil row: the potato absorbs, so the allowance applies.
    const absorbing = __testing.resolveIngredientMacros(
      friedPotato,
      base,
      250,
      false,
      'deep-fried',
      [],
      false
    );
    expect(absorbing.fatG.mid).toBeCloseTo(21.8, 8);

    // A sibling `Oil` row exists: the potato is clamped back toward base
    // instead of double-counting the same oil.
    const suppressed = __testing.resolveIngredientMacros(
      friedPotato,
      base,
      250,
      false,
      'deep-fried',
      [],
      true
    );
    expect(suppressed.fatG.mid).toBeCloseTo(base.fatG * 3, 8);
    expect(suppressed.fatG.mid).toBeLessThan(absorbing.fatG.mid);
  });

  it('keeps the oil row own allowance so it is not clamped to an unfried base', () => {
    const oilRow = {
      ...vegetableEstimate,
      ingredientName: 'Dầu ăn',
      fatG: { low: 22, mid: 25, high: 28 },
    };
    const resolved = __testing.resolveIngredientMacros(
      oilRow,
      { caloriesKcal: 221, proteinG: 0, carbohydrateG: 0, fatG: 25 },
      25,
      false,
      'deep-fried',
      [],
      true
    );
    expect(resolved.fatG.mid).toBeCloseTo(25, 8);
  });
});

/**
 * Callers concatenate the dish cooking method with the user's verbatim prep
 * notes, so the two can contradict each other. Resolution is by specificity,
 * and both directions of that trap are load-bearing: testing no-oil first
 * fails closed to the original bug (a typed `chiên ngập dầu` yielding zero
 * allowance), while testing fry first charges `chiên không dầu` a full
 * shallow-fry allowance it never absorbed.
 */
describe('absorbedOil precedence with contradictory signals', () => {
  const GRAMS = 150;

  it('lets an explicit deep-fry beat a stale no-oil method', () => {
    const deepFry = GRAMS * ABSORBED_OIL_RANGES.deepFryWeightRatio.high;
    // `luộc` here is the dish-level method Call 1 broadcast onto the tofu;
    // `chiên ngập dầu` is what the user actually typed.
    expect(absorbedOil('luộc chiên ngập dầu', GRAMS)).toBeCloseTo(deepFry, 8);
    expect(absorbedOil('boiled deep-fried', GRAMS)).toBeCloseTo(deepFry, 8);
    expect(absorbedOil('nướng không dầu chiên ngập dầu', GRAMS)).toBeCloseTo(
      deepFry,
      8
    );
  });

  it('lets an explicit negation beat a generic fry verb', () => {
    expect(absorbedOil('chiên không dầu', GRAMS)).toBe(0);
    expect(absorbedOil('air-fried', GRAMS)).toBe(0);
    expect(absorbedOil('nướng không dầu', GRAMS)).toBe(0);
    expect(absorbedOil('luộc', GRAMS)).toBe(0);
  });

  // A method that simply uses no fat is not a statement that no fat was used.
  // Treating `luộc` and `boiled` as negations made every two-stage dish report
  // zero absorbed oil, which is the original bug wearing a different hat.
  it('lets a fry verb beat a merely non-fry method that preceded it', () => {
    const shallowFry = ABSORBED_OIL_RANGES.shallowFryG.high;
    expect(absorbedOil('luộc rồi chiên', GRAMS)).toBe(shallowFry);
    expect(absorbedOil('boiled then pan-fried', GRAMS)).toBe(shallowFry);
    expect(absorbedOil('hấp xong chiên', GRAMS)).toBe(shallowFry);
    expect(absorbedOil('luộc xong xào', GRAMS)).toBe(
      ABSORBED_OIL_RANGES.stirFryG.high
    );
    // …but a genuine negation still wins, and a bare non-fry method is zero.
    expect(absorbedOil('luộc rồi chiên không dầu', GRAMS)).toBe(0);
    expect(absorbedOil('luộc', GRAMS)).toBe(0);
    expect(absorbedOil('hấp', GRAMS)).toBe(0);
  });

  it('still resolves unambiguous methods', () => {
    expect(absorbedOil('chiên ít dầu', GRAMS)).toBe(
      ABSORBED_OIL_RANGES.shallowFryG.high
    );
    expect(absorbedOil('xào', GRAMS)).toBe(ABSORBED_OIL_RANGES.stirFryG.high);
    expect(absorbedOil('áp chảo', GRAMS)).toBe(
      ABSORBED_OIL_RANGES.panSearG.high
    );
    expect(absorbedOil('', GRAMS)).toBe(0);
    expect(absorbedOil('chiên ngập dầu', 0)).toBe(0);
  });
});
