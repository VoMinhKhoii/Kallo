import { describe, expect, it } from 'vitest';
import {
  buildGroundedIngredientEstimateSchema,
  groundedEstimationSchema,
  groundedIngredientEstimateSchema,
} from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';

describe('groundedIngredientEstimateSchema', () => {
  it('requires valid grossG and refusePct', () => {
    const schema = buildGroundedIngredientEstimateSchema();
    const base = {
      ingredientName: 'sườn dê',
      grossG: 100,
      refusePct: 50,
      caloriesKcal: { low: 100, mid: 110, high: 120 },
      proteinG: { low: 8, mid: 10, high: 12 },
      carbohydrateG: { low: 0, mid: 0, high: 0 },
      fatG: { low: 4, mid: 5, high: 6 },
    };
    expect(schema.parse(base)).toMatchObject({ grossG: 100, refusePct: 50 });
    const { refusePct: _refusePct, ...withoutRefuse } = base;
    expect(() => schema.parse(withoutRefuse)).toThrow();
    expect(() => schema.parse({ ...base, refusePct: -1 })).toThrow();
    expect(() => schema.parse({ ...base, refusePct: 81 })).toThrow();
    expect(() => schema.parse({ ...base, refusePct: 10.5 })).toThrow();
    expect(() => schema.parse({ ...base, grossG: 0 })).toThrow();
    expect(() => schema.parse({ ...base, grams: 50 })).toThrow();
  });

  it('accepts an accepted candidate', () => {
    const parsed = groundedIngredientEstimateSchema.parse({
      ingredientName: 'đùi gà',
      selectedCandidateId: 'c1',
      grossG: 150,
      refusePct: 0,
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
      grossG: 150,
      refusePct: 0,
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
      grossG: 200,
      refusePct: 0,
      caloriesKcal: { low: 480, mid: 540, high: 600 },
      proteinG: { low: 28, mid: 32, high: 36 },
      carbohydrateG: { low: 4, mid: 5, high: 6 },
      fatG: { low: 28, mid: 34, high: 40 },
    });
    expect(parsed.selectedCandidateId).toBeUndefined();
  });

  it('REJECTS an ingredient missing any macro triple (the mì gói regression)', () => {
    // Prod incident: `carbohydrateG` was optional, Call 2 omitted it for the
    // unmatched noodles, and the absence persisted as C:0g / 412 kcal. All
    // four triples are now required — zod rejection here is the backstop
    // behind the provider's own `required` enforcement, and this test is the
    // executable guard that the optionality never quietly returns.
    const base = {
      ingredientName: 'mì gói',
      grossG: 80,
      refusePct: 0,
      caloriesKcal: { low: 340, mid: 355, high: 370 },
      proteinG: { low: 7, mid: 8, high: 9 },
      carbohydrateG: { low: 46, mid: 48, high: 50 },
      fatG: { low: 13, mid: 14, high: 15 },
    };
    for (const field of [
      'caloriesKcal',
      'proteinG',
      'carbohydrateG',
    ] as const) {
      const { [field]: _omitted, ...withoutField } = base;
      expect(
        () => groundedIngredientEstimateSchema.parse(withoutField),
        `omitting ${field} must fail parse`
      ).toThrow();
    }
  });

  it('accepts explicit zero triples — 0 is a value, absence is a violation', () => {
    const parsed = groundedIngredientEstimateSchema.parse({
      ingredientName: 'mì chính',
      grossG: 3,
      refusePct: 0,
      caloriesKcal: { low: 0, mid: 0, high: 0 },
      proteinG: { low: 0, mid: 0, high: 0 },
      carbohydrateG: { low: 0, mid: 0, high: 0 },
      fatG: { low: 0, mid: 0, high: 0 },
    });
    expect(parsed.carbohydrateG.mid).toBe(0);
  });

  it('rejects rejectReason longer than 120 chars', () => {
    expect(() =>
      groundedIngredientEstimateSchema.parse({
        ingredientName: 'x',
        selectedCandidateId: 'none',
        rejectReason: 'x'.repeat(121),
        grossG: 100,
        refusePct: 0,
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
              grossG: 200,
              refusePct: 0,
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
