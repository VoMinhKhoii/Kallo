import { describe, expect, it } from 'vitest';
import {
  decomposedIngredientV2Schema,
  groundedEstimationSchema,
  groundedIngredientEstimateSchema,
  mealDecompositionV2Schema,
} from '../schemas';

describe('decomposedIngredientV2Schema', () => {
  it('accepts the minimum required fields (rawName + canonicalName)', () => {
    const parsed = decomposedIngredientV2Schema.parse({
      rawName: 'cơm',
      canonicalName: 'Cơm',
    });
    expect(parsed.rawName).toBe('cơm');
    expect(parsed.canonicalName).toBe('Cơm');
    expect(parsed.stateHint).toBeUndefined();
    expect(parsed.prepNotes).toBeUndefined();
  });

  it('REJECTS grams (deliberately removed in v2 — grams now lives in Call 2)', () => {
    expect(() =>
      decomposedIngredientV2Schema.parse({
        rawName: 'cơm',
        canonicalName: 'Cơm',
        // @ts-expect-error grams is intentionally not in v2
        grams: 200,
      })
    ).toThrow();
  });

  it('REJECTS weightBasis (replaced by stateHint enum)', () => {
    expect(() =>
      decomposedIngredientV2Schema.parse({
        rawName: 'ức gà',
        canonicalName: 'Ức gà',
        // @ts-expect-error weightBasis is not in v2
        weightBasis: 'raw',
      })
    ).toThrow();
  });

  it('REJECTS expectedState (matching now uses stateHint + cookingMethod)', () => {
    expect(() =>
      decomposedIngredientV2Schema.parse({
        rawName: 'thịt bò',
        canonicalName: 'Thịt bò',
        // @ts-expect-error expectedState is not in v2
        expectedState: 'cooked',
      })
    ).toThrow();
  });

  it('accepts stateHint enum values and free-form stateNote', () => {
    const parsed = decomposedIngredientV2Schema.parse({
      rawName: 'ức gà',
      canonicalName: 'Ức gà',
      stateHint: 'raw_weight',
      stateNote: 'cân sống',
    });
    expect(parsed.stateHint).toBe('raw_weight');
    expect(parsed.stateNote).toBe('cân sống');
  });

  it('caps prepNotes at 6 entries and 60 chars each', () => {
    expect(() =>
      decomposedIngredientV2Schema.parse({
        rawName: 'đùi gà',
        canonicalName: 'Đùi gà',
        prepNotes: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], // 7
      })
    ).toThrow();
    expect(() =>
      decomposedIngredientV2Schema.parse({
        rawName: 'đùi gà',
        canonicalName: 'Đùi gà',
        prepNotes: ['x'.repeat(61)],
      })
    ).toThrow();
  });
});

describe('mealDecompositionV2Schema', () => {
  it('parses a typical Vietnamese meal', () => {
    const parsed = mealDecompositionV2Schema.parse({
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          name: 'cơm trắng',
          cookingMethod: 'nấu',
          ingredients: [
            {
              rawName: 'cơm',
              canonicalName: 'Cơm',
            },
          ],
        },
        {
          name: 'đùi gà nướng',
          cookingMethod: 'nướng',
          ingredients: [
            {
              rawName: 'đùi gà',
              canonicalName: 'Đùi gà',
              prepNotes: ['bỏ da', 'bỏ mỡ'],
            },
          ],
        },
      ],
    });
    expect(parsed.mealItems).toHaveLength(2);
    expect(parsed.mealItems[1].ingredients[0].prepNotes).toEqual([
      'bỏ da',
      'bỏ mỡ',
    ]);
  });

  it('parses non-food input', () => {
    const parsed = mealDecompositionV2Schema.parse({
      isFood: false,
      mealItems: [],
      mealSlot: null,
    });
    expect(parsed.isFood).toBe(false);
  });
});

describe('groundedIngredientEstimateSchema', () => {
  it('accepts an accepted candidate', () => {
    const parsed = groundedIngredientEstimateSchema.parse({
      ingredientName: 'đùi gà',
      selectedCandidateId: 'c1',
      grams: 150,
      caloriesKcal: { low: 300, mid: 330, high: 360 },
      proteinG: { low: 35, mid: 36, high: 37 },
      carbohydrateG: { low: 0, mid: 0, high: 0 },
      fatG: { low: 18, mid: 21, high: 24 },
    });
    expect(parsed.selectedCandidateId).toBe('c1');
  });

  it('accepts a "none" verdict with rejectReason', () => {
    const parsed = groundedIngredientEstimateSchema.parse({
      ingredientName: 'ức gà',
      selectedCandidateId: 'none',
      rejectReason:
        'category mismatch — ức gà ≠ Thịt gà ta whole-bird aggregate',
      grams: 150,
      caloriesKcal: { low: 150, mid: 180, high: 210 },
      proteinG: { low: 30, mid: 33, high: 35 },
      carbohydrateG: { low: 0, mid: 0, high: 0 },
      fatG: { low: 3, mid: 4, high: 5 },
    });
    expect(parsed.selectedCandidateId).toBe('none');
    expect(parsed.rejectReason).toMatch(/category mismatch/);
  });

  it('accepts an unmatched ingredient (no selectedCandidateId)', () => {
    const parsed = groundedIngredientEstimateSchema.parse({
      ingredientName: 'nem lụi',
      grams: 200,
      caloriesKcal: { low: 480, mid: 540, high: 600 },
      proteinG: { low: 28, mid: 32, high: 36 },
      carbohydrateG: { low: 4, mid: 5, high: 6 },
      fatG: { low: 28, mid: 34, high: 40 },
    });
    expect(parsed.selectedCandidateId).toBeUndefined();
  });

  it('rejects rejectReason longer than 120 chars', () => {
    expect(() =>
      groundedIngredientEstimateSchema.parse({
        ingredientName: 'x',
        selectedCandidateId: 'none',
        rejectReason: 'x'.repeat(121),
        grams: 100,
        caloriesKcal: { low: 0, mid: 0, high: 0 },
        proteinG: { low: 0, mid: 0, high: 0 },
        carbohydrateG: { low: 0, mid: 0, high: 0 },
        fatG: { low: 0, mid: 0, high: 0 },
      })
    ).toThrow();
  });
});

describe('groundedEstimationSchema', () => {
  it('round-trips a multi-item, multi-ingredient meal', () => {
    const sample = {
      mealItems: [
        {
          mealItemName: 'cơm trắng',
          ingredients: [
            {
              ingredientName: 'cơm',
              selectedCandidateId: 'c1',
              grams: 200,
              caloriesKcal: { low: 250, mid: 260, high: 270 },
              proteinG: { low: 5, mid: 5, high: 5 },
              carbohydrateG: { low: 55, mid: 56, high: 57 },
              fatG: { low: 0.5, mid: 0.6, high: 0.7 },
            },
          ],
        },
      ],
    };
    expect(groundedEstimationSchema.parse(sample)).toEqual(sample);
  });
});
