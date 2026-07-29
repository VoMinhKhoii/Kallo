import { describe, expect, it } from 'vitest';
import {
  decomposedIngredientV2Schema,
  groundedEstimationSchema,
  groundedIngredientEstimateSchema,
  mealDecompositionV2Schema,
} from '../schemas-v2';

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
        grams: 200,
      })
    ).toThrow();
  });

  it('REJECTS weightBasis (replaced by stateHint enum)', () => {
    expect(() =>
      decomposedIngredientV2Schema.parse({
        rawName: 'ức gà',
        canonicalName: 'Ức gà',
        weightBasis: 'raw',
      })
    ).toThrow();
  });

  it('REJECTS expectedState (matching now uses stateHint + cookingMethod)', () => {
    expect(() =>
      decomposedIngredientV2Schema.parse({
        rawName: 'thịt bò',
        canonicalName: 'Thịt bò',
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

  it('accepts Phase-3 structured quantity evidence (count/unitToken/sizeModifier)', () => {
    const parsed = decomposedIngredientV2Schema.parse({
      rawName: 'bánh bao',
      canonicalName: 'Bánh bao nhân thịt',
      count: 2,
      unitToken: 'bánh bao',
      sizeModifier: 'large',
    });
    expect(parsed.count).toBe(2);
    expect(parsed.unitToken).toBe('bánh bao');
    expect(parsed.sizeModifier).toBe('large');
  });

  it('accepts a structured explicitMass with a raw/cooked basis', () => {
    const parsed = decomposedIngredientV2Schema.parse({
      rawName: 'ức gà',
      canonicalName: 'Ức gà',
      explicitMass: { grams: 250, basis: 'raw' },
    });
    expect(parsed.explicitMass).toEqual({ grams: 250, basis: 'raw' });
  });

  it('ACCEPTS a zero count (explicit user zero → clarify), REJECTS negative/invalid', () => {
    // count: 0 is meaningful ("0 fried chicken" — the resolver routes it to a
    // clarify); only negative counts are schema-invalid.
    expect(
      decomposedIngredientV2Schema.parse({
        rawName: 'x',
        canonicalName: 'x',
        count: 0,
      }).count
    ).toBe(0);
    expect(() =>
      decomposedIngredientV2Schema.parse({
        rawName: 'x',
        canonicalName: 'x',
        count: -1,
      })
    ).toThrow();
    expect(() =>
      decomposedIngredientV2Schema.parse({
        rawName: 'x',
        canonicalName: 'x',
        sizeModifier: 'huge',
      })
    ).toThrow();
  });

  it('REJECTS explicitMass with a non-positive weight or bad basis', () => {
    expect(() =>
      decomposedIngredientV2Schema.parse({
        rawName: 'x',
        canonicalName: 'x',
        explicitMass: { grams: -5, basis: 'raw' },
      })
    ).toThrow();
    expect(() =>
      decomposedIngredientV2Schema.parse({
        rawName: 'x',
        canonicalName: 'x',
        explicitMass: { grams: 100, basis: 'frozen' },
      })
    ).toThrow();
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
  const vesselDish = {
    name: 'phở bò tái',
    cookingMethod: 'nấu',
    ingredients: [
      {
        rawName: 'bánh phở',
        canonicalName: 'Bánh phở',
      },
    ],
  };

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

  it('parses a dish with vesselToken and vesselSize', () => {
    const parsed = mealDecompositionV2Schema.parse({
      isFood: true,
      mealSlot: null,
      mealItems: [
        {
          ...vesselDish,
          vesselToken: 'tô',
          vesselSize: 'large',
        },
      ],
    });
    expect(parsed.mealItems[0].vesselToken).toBe('tô');
    expect(parsed.mealItems[0].vesselSize).toBe('large');
  });

  it('parses a dish without optional vessel fields', () => {
    const parsed = mealDecompositionV2Schema.parse({
      isFood: true,
      mealSlot: null,
      mealItems: [vesselDish],
    });
    expect(parsed.mealItems[0].vesselToken).toBeUndefined();
    expect(parsed.mealItems[0].vesselSize).toBeUndefined();
  });

  it('rejects vesselToken on an ingredient', () => {
    expect(() =>
      decomposedIngredientV2Schema.parse({
        rawName: 'bánh phở',
        canonicalName: 'Bánh phở',
        vesselToken: 'tô',
      })
    ).toThrow();
  });

  it('rejects an invalid dish vesselSize enum value', () => {
    expect(() =>
      mealDecompositionV2Schema.parse({
        isFood: true,
        mealSlot: null,
        mealItems: [{ ...vesselDish, vesselSize: 'huge' }],
      })
    ).toThrow();
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
