import { describe, expect, it } from 'vitest';
import type {
  BoundedEstimate,
  BoundedNutrition,
  NutritionValues,
} from '../types';
import {
  goalAdjust,
  goalAdjustNutrition,
  sumBoundedNutrition,
  sumDisplayedNutrition,
} from '../goal-adjustment';

// ---------------------------------------------------------------------------
// Helper: create a bounded estimate
// ---------------------------------------------------------------------------
function bounded(low: number, mid: number, high: number): BoundedEstimate {
  return { low, mid, high };
}

/** Minimal BoundedNutrition with only the 4 macros set, rest null */
function macrosOnly(
  cal: BoundedEstimate | null,
  protein: BoundedEstimate | null,
  carbs: BoundedEstimate | null,
  fat: BoundedEstimate | null,
): BoundedNutrition {
  return {
    caloriesKcal: cal,
    proteinG: protein,
    carbohydrateG: carbs,
    fatG: fat,
    fiberG: null,
    sodiumMg: null,
    calciumMg: null,
    ironMg: null,
    magnesiumMg: null,
    phosphorusMg: null,
    potassiumMg: null,
    zincMg: null,
    copperMcg: null,
    manganeseMg: null,
    betaCaroteneMcg: null,
    vitaminAMcg: null,
    vitaminDMcg: null,
    vitaminEMg: null,
    vitaminKMcg: null,
    vitaminCMg: null,
    vitaminB1Mg: null,
    vitaminB2Mg: null,
    vitaminPpMg: null,
    vitaminB5Mg: null,
    vitaminB6Mg: null,
    vitaminB9Mcg: null,
    vitaminB12Mcg: null,
    vitaminHMcg: null,
  };
}

describe('goalAdjust', () => {
  it('cutting + calories → biases toward high (pessimistic)', () => {
    expect(
      goalAdjust(bounded(200, 300, 400), 'cutting', 0.5, 'caloriesKcal'),
    ).toBe(350);
  });

  it('cutting + protein → biases toward low (pessimistic)', () => {
    expect(
      goalAdjust(bounded(200, 300, 400), 'cutting', 0.5, 'proteinG'),
    ).toBe(250);
  });

  it('cutting + fat → biases toward high (pessimistic)', () => {
    expect(goalAdjust(bounded(200, 300, 400), 'cutting', 0.5, 'fatG')).toBe(
      350,
    );
  });

  it('cutting + carbs → biases toward high (pessimistic)', () => {
    expect(
      goalAdjust(bounded(200, 300, 400), 'cutting', 0.5, 'carbohydrateG'),
    ).toBe(350);
  });

  it('bulking + calories → biases toward low (optimistic)', () => {
    expect(
      goalAdjust(bounded(200, 300, 400), 'bulking', 0.5, 'caloriesKcal'),
    ).toBe(250);
  });

  it('bulking + protein → biases toward high (optimistic)', () => {
    expect(
      goalAdjust(bounded(200, 300, 400), 'bulking', 0.5, 'proteinG'),
    ).toBe(350);
  });

  it('maintaining → always returns mid regardless of aggression', () => {
    expect(
      goalAdjust(bounded(200, 300, 400), 'maintaining', 0, 'caloriesKcal'),
    ).toBe(300);
    expect(
      goalAdjust(bounded(200, 300, 400), 'maintaining', 0, 'proteinG'),
    ).toBe(300);
  });

  it('aggression 0 → returns mid for any goal', () => {
    expect(
      goalAdjust(bounded(200, 300, 400), 'cutting', 0, 'caloriesKcal'),
    ).toBe(300);
    expect(
      goalAdjust(bounded(200, 300, 400), 'bulking', 0, 'proteinG'),
    ).toBe(300);
  });

  it('aggression 0.8 → strong bias toward goal bound', () => {
    expect(
      goalAdjust(bounded(200, 300, 400), 'cutting', 0.8, 'caloriesKcal'),
    ).toBe(380);
    expect(
      goalAdjust(bounded(200, 300, 400), 'bulking', 0.8, 'proteinG'),
    ).toBe(380);
  });

  it('non-goal-adjusted nutrient → always returns mid', () => {
    expect(goalAdjust(bounded(10, 20, 30), 'cutting', 0.8, 'fiberG')).toBe(20);
    expect(goalAdjust(bounded(10, 20, 30), 'bulking', 0.8, 'sodiumMg')).toBe(
      20,
    );
    expect(
      goalAdjust(bounded(10, 20, 30), 'cutting', 0.5, 'vitaminCMg'),
    ).toBe(20);
  });

  it('null bounded estimate → returns null', () => {
    expect(goalAdjust(null, 'cutting', 0.5, 'caloriesKcal')).toBeNull();
    expect(goalAdjust(null, 'bulking', 0.5, 'proteinG')).toBeNull();
  });
});

describe('goalAdjustNutrition', () => {
  it('applies goal adjustment to all nutrients in a BoundedNutrition', () => {
    const bn = macrosOnly(
      bounded(200, 300, 400),
      bounded(20, 30, 40),
      bounded(40, 50, 60),
      bounded(10, 15, 20),
    );

    const result = goalAdjustNutrition(bn, 'cutting', 0.5);

    expect(result.caloriesKcal).toBe(350);
    expect(result.proteinG).toBe(25);
    expect(result.carbohydrateG).toBe(55);
    expect(result.fatG).toBeCloseTo(17.5);
    expect(result.fiberG).toBeNull();
    expect(result.sodiumMg).toBeNull();
  });

  it('maintaining goal returns mid for all nutrients', () => {
    const bn = macrosOnly(
      bounded(200, 300, 400),
      bounded(20, 30, 40),
      bounded(40, 50, 60),
      bounded(10, 15, 20),
    );

    const result = goalAdjustNutrition(bn, 'maintaining', 0);

    expect(result.caloriesKcal).toBe(300);
    expect(result.proteinG).toBe(30);
    expect(result.carbohydrateG).toBe(50);
    expect(result.fatG).toBe(15);
  });

  it('includes micronutrients at mid when present', () => {
    const bn = macrosOnly(
      bounded(200, 300, 400),
      bounded(20, 30, 40),
      bounded(40, 50, 60),
      bounded(10, 15, 20),
    );
    bn.fiberG = bounded(3, 5, 7);
    bn.vitaminCMg = bounded(10, 15, 20);

    const result = goalAdjustNutrition(bn, 'cutting', 0.8);

    expect(result.fiberG).toBe(5);
    expect(result.vitaminCMg).toBe(15);
  });
});

describe('sumBoundedNutrition', () => {
  it('sums bounded nutrition from multiple items', () => {
    const items: BoundedNutrition[] = [
      macrosOnly(
        bounded(100, 150, 200),
        bounded(10, 15, 20),
        bounded(20, 25, 30),
        bounded(5, 8, 10),
      ),
      macrosOnly(
        bounded(200, 250, 300),
        bounded(20, 25, 30),
        bounded(30, 35, 40),
        bounded(10, 12, 15),
      ),
    ];

    const result = sumBoundedNutrition(items);

    expect(result.caloriesKcal).toEqual({ low: 300, mid: 400, high: 500 });
    expect(result.proteinG).toEqual({ low: 30, mid: 40, high: 50 });
    expect(result.carbohydrateG).toEqual({ low: 50, mid: 60, high: 70 });
    expect(result.fatG).toEqual({ low: 15, mid: 20, high: 25 });
  });

  it('handles null nutrients by skipping them in sum', () => {
    const items: BoundedNutrition[] = [
      macrosOnly(bounded(100, 150, 200), null, null, null),
      macrosOnly(bounded(200, 250, 300), null, bounded(30, 35, 40), null),
    ];

    const result = sumBoundedNutrition(items);

    expect(result.caloriesKcal).toEqual({ low: 300, mid: 400, high: 500 });
    expect(result.proteinG).toBeNull();
    expect(result.carbohydrateG).toEqual({ low: 30, mid: 35, high: 40 });
    expect(result.fatG).toBeNull();
  });

  it('returns all-null for empty array', () => {
    const result = sumBoundedNutrition([]);

    expect(result.caloriesKcal).toBeNull();
    expect(result.proteinG).toBeNull();
  });
});

describe('sumDisplayedNutrition', () => {
  it('sums displayed nutrition from multiple items', () => {
    const items: NutritionValues[] = [
      {
        caloriesKcal: 150,
        proteinG: 15,
        carbohydrateG: 25,
        fatG: 8,
        fiberG: null,
        sodiumMg: null,
        calciumMg: null,
        ironMg: null,
        magnesiumMg: null,
        phosphorusMg: null,
        potassiumMg: null,
        zincMg: null,
        copperMcg: null,
        manganeseMg: null,
        betaCaroteneMcg: null,
        vitaminAMcg: null,
        vitaminDMcg: null,
        vitaminEMg: null,
        vitaminKMcg: null,
        vitaminCMg: null,
        vitaminB1Mg: null,
        vitaminB2Mg: null,
        vitaminPpMg: null,
        vitaminB5Mg: null,
        vitaminB6Mg: null,
        vitaminB9Mcg: null,
        vitaminB12Mcg: null,
        vitaminHMcg: null,
      },
      {
        caloriesKcal: 250,
        proteinG: 25,
        carbohydrateG: 35,
        fatG: 12,
        fiberG: 3,
        sodiumMg: null,
        calciumMg: null,
        ironMg: null,
        magnesiumMg: null,
        phosphorusMg: null,
        potassiumMg: null,
        zincMg: null,
        copperMcg: null,
        manganeseMg: null,
        betaCaroteneMcg: null,
        vitaminAMcg: null,
        vitaminDMcg: null,
        vitaminEMg: null,
        vitaminKMcg: null,
        vitaminCMg: null,
        vitaminB1Mg: null,
        vitaminB2Mg: null,
        vitaminPpMg: null,
        vitaminB5Mg: null,
        vitaminB6Mg: null,
        vitaminB9Mcg: null,
        vitaminB12Mcg: null,
        vitaminHMcg: null,
      },
    ];

    const result = sumDisplayedNutrition(items);

    expect(result.caloriesKcal).toBe(400);
    expect(result.proteinG).toBe(40);
    expect(result.carbohydrateG).toBe(60);
    expect(result.fatG).toBe(20);
    expect(result.fiberG).toBe(3);
    expect(result.sodiumMg).toBeNull();
  });
});
