import { describe, expect, it } from 'vitest';
import { classifyIngredientPlausibility } from '../plausibility';

describe('classifyIngredientPlausibility — unresolved', () => {
  it('flags a missing portion as unresolved_estimate', () => {
    expect(
      classifyIngredientPlausibility({
        grams: null,
        hasNutrition: false,
        caloriesPer100g: null,
        name: 'ức gà',
      })
    ).toBe('unresolved_estimate');
  });

  it('flags zero/negative/non-finite grams as unresolved_estimate', () => {
    for (const grams of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        classifyIngredientPlausibility({
          grams,
          hasNutrition: true,
          caloriesPer100g: 200,
          name: 'cơm',
        })
      ).toBe('unresolved_estimate');
    }
  });

  it('flags a resolved portion with no nutrition as unresolved_estimate', () => {
    expect(
      classifyIngredientPlausibility({
        grams: 100,
        hasNutrition: false,
        caloriesPer100g: 130,
        name: 'cơm',
      })
    ).toBe('unresolved_estimate');
  });
});

describe('classifyIngredientPlausibility — genuinely non-caloric', () => {
  it('does NOT flag water even at a large volume (near-zero density)', () => {
    expect(
      classifyIngredientPlausibility({
        grams: 300,
        hasNutrition: true,
        caloriesPer100g: 0,
        name: 'nước lọc',
      })
    ).toBe('genuinely_noncaloric');
  });

  it('classifies black coffee / plain tea by name even without a match', () => {
    expect(
      classifyIngredientPlausibility({
        grams: 200,
        hasNutrition: true,
        caloriesPer100g: null,
        name: 'black coffee',
      })
    ).toBe('genuinely_noncaloric');
    expect(
      classifyIngredientPlausibility({
        grams: 250,
        hasNutrition: true,
        caloriesPer100g: null,
        name: 'trà đá không đường',
      })
    ).toBe('genuinely_noncaloric');
  });
});

describe('classifyIngredientPlausibility — small concentrated portions', () => {
  it('permits a ≤5g oil/spice/sweetener/sauce portion', () => {
    for (const name of ['dầu ăn', 'muối', 'đường', 'nước mắm', 'olive oil']) {
      expect(
        classifyIngredientPlausibility({
          grams: 3,
          hasNutrition: true,
          caloriesPer100g: 884,
          name,
        })
      ).toBe('small_concentrated_portion');
    }
  });

  it('does NOT give a small non-concentrated food a pass (blanket ≤5g rejected)', () => {
    // A 3g "chicken breast" is implausible but not in the concentrated class,
    // so it is NOT small_concentrated_portion — it falls through to 'ok' and
    // downstream anomaly detection can still flag it.
    expect(
      classifyIngredientPlausibility({
        grams: 3,
        hasNutrition: true,
        caloriesPer100g: 165,
        name: 'ức gà',
      })
    ).toBe('ok');
  });

  it('does not treat a large oil portion as small_concentrated', () => {
    expect(
      classifyIngredientPlausibility({
        grams: 40,
        hasNutrition: true,
        caloriesPer100g: 884,
        name: 'dầu ăn',
      })
    ).toBe('ok');
  });
});

describe('classifyIngredientPlausibility — ok', () => {
  it('classifies a normal resolved ingredient as ok', () => {
    expect(
      classifyIngredientPlausibility({
        grams: 150,
        hasNutrition: true,
        caloriesPer100g: 165,
        name: 'ức gà',
      })
    ).toBe('ok');
  });
});
