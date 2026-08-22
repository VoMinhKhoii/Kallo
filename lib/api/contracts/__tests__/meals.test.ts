import { describe, expect, it } from 'vitest';
import {
  cheatOccasionsQuerySchema,
  cheatRepeatSchema,
  confirmMealSchema,
} from '@/lib/api/contracts/meals';

const ANALYSIS_ID = '5f0b2c8e-9c9a-4e56-8d3e-2a1b3c4d5e6f';
const MEAL_ID = '0a1b2c3d-4e5f-6071-8293-a4b5c6d7e8f9';

describe('confirmMealSchema', () => {
  it('accepts a precise confirm without levels', () => {
    const parsed = confirmMealSchema.parse({ analysisId: ANALYSIS_ID });
    expect(parsed.levels).toBeUndefined();
  });

  it('preserves cheat slider levels (the mobile confirm path)', () => {
    const parsed = confirmMealSchema.parse({
      analysisId: ANALYSIS_ID,
      mealId: MEAL_ID,
      levels: { protein: 6, carbs: 8.5, fat: 10, drinks: 0 },
    });
    expect(parsed.levels).toEqual({
      protein: 6,
      carbs: 8.5,
      fat: 10,
      drinks: 0,
    });
  });

  it('accepts a partial levels record', () => {
    const parsed = confirmMealSchema.parse({
      analysisId: ANALYSIS_ID,
      levels: { fat: 4 },
    });
    expect(parsed.levels).toEqual({ fat: 4 });
  });

  it('rejects out-of-range levels', () => {
    expect(() =>
      confirmMealSchema.parse({
        analysisId: ANALYSIS_ID,
        levels: { protein: 11 },
      })
    ).toThrow();
    expect(() =>
      confirmMealSchema.parse({
        analysisId: ANALYSIS_ID,
        levels: { carbs: -1 },
      })
    ).toThrow();
  });

  it('rejects unknown slider keys', () => {
    expect(() =>
      confirmMealSchema.parse({
        analysisId: ANALYSIS_ID,
        levels: { dessert: 5 },
      })
    ).toThrow();
  });
});

/**
 * `confirmAndSaveMealAction` parses its input with this exact object — the
 * schema is defined here (the contract is the pure module both clients import)
 * and imported back by the `'use server'` action, mirroring `updateMealSchema`.
 *
 * These cases therefore pin the ACTION's validation, not just the wire shape.
 * Zod strips unknown keys, so a field that falls out of this object is a field
 * the action silently stops honouring — which is exactly how a mobile cheat
 * confirm would have been saved at the spec's default `levels`.
 */
describe('confirmMealSchema — one schema for contract and action', () => {
  it('requires analysisId and rejects a non-UUID', () => {
    expect(() => confirmMealSchema.parse({})).toThrow();
    expect(() =>
      confirmMealSchema.parse({ analysisId: 'not-a-uuid' })
    ).toThrow();
  });

  it('accepts an optional client-generated mealId, rejecting a non-UUID', () => {
    expect(
      confirmMealSchema.parse({ analysisId: ANALYSIS_ID, mealId: MEAL_ID })
        .mealId
    ).toBe(MEAL_ID);
    expect(
      confirmMealSchema.parse({ analysisId: ANALYSIS_ID }).mealId
    ).toBeUndefined();
    expect(() =>
      confirmMealSchema.parse({ analysisId: ANALYSIS_ID, mealId: 'nope' })
    ).toThrow();
  });

  it('accepts a whole-dish edit — omitted ingredientIndex means total grams', () => {
    const parsed = confirmMealSchema.parse({
      analysisId: ANALYSIS_ID,
      edits: [{ mealItemOrder: 0, newGrams: 450 }],
    });
    expect(parsed.edits).toEqual([{ mealItemOrder: 0, newGrams: 450 }]);
  });

  it('accepts a per-ingredient edit', () => {
    const parsed = confirmMealSchema.parse({
      analysisId: ANALYSIS_ID,
      edits: [{ mealItemOrder: 1, ingredientIndex: 2, newGrams: 30 }],
    });
    expect(parsed.edits?.[0].ingredientIndex).toBe(2);
  });

  it('caps edits at 50 entries', () => {
    const edit = { mealItemOrder: 0, newGrams: 1 };
    expect(() =>
      confirmMealSchema.parse({
        analysisId: ANALYSIS_ID,
        edits: Array.from({ length: 51 }, () => edit),
      })
    ).toThrow();
    expect(() =>
      confirmMealSchema.parse({
        analysisId: ANALYSIS_ID,
        edits: Array.from({ length: 50 }, () => edit),
      })
    ).not.toThrow();
  });

  it('rejects newGrams that is zero, negative, non-finite or over 100000', () => {
    for (const newGrams of [0, -1, Number.POSITIVE_INFINITY, 100_001]) {
      expect(() =>
        confirmMealSchema.parse({
          analysisId: ANALYSIS_ID,
          edits: [{ mealItemOrder: 0, newGrams }],
        })
      ).toThrow();
    }
  });

  it('rejects a fractional or negative index', () => {
    expect(() =>
      confirmMealSchema.parse({
        analysisId: ANALYSIS_ID,
        edits: [{ mealItemOrder: 0.5, newGrams: 10 }],
      })
    ).toThrow();
    expect(() =>
      confirmMealSchema.parse({
        analysisId: ANALYSIS_ID,
        edits: [{ mealItemOrder: 0, ingredientIndex: -1, newGrams: 10 }],
      })
    ).toThrow();
  });

  it('strips keys the action does not read', () => {
    const parsed = confirmMealSchema.parse({
      analysisId: ANALYSIS_ID,
      caloriesKcal: 9999,
    });
    expect(parsed).toEqual({ analysisId: ANALYSIS_ID });
  });
});

describe('cheatOccasionsQuerySchema', () => {
  it('coerces the limit search param string', () => {
    expect(cheatOccasionsQuerySchema.parse({ limit: '5' }).limit).toBe(5);
  });

  it('allows an absent limit', () => {
    expect(cheatOccasionsQuerySchema.parse({}).limit).toBeUndefined();
  });

  it('rejects limits outside 1–12', () => {
    expect(() => cheatOccasionsQuerySchema.parse({ limit: '0' })).toThrow();
    expect(() => cheatOccasionsQuerySchema.parse({ limit: '13' })).toThrow();
  });
});

describe('cheatRepeatSchema', () => {
  it('accepts a valid repeat request', () => {
    const parsed = cheatRepeatSchema.parse({
      sourceMealId: MEAL_ID,
      loggedDate: '2026-07-10',
      timezoneOffset: -420,
    });
    expect(parsed.sourceMealId).toBe(MEAL_ID);
  });

  it('rejects a non-UUID sourceMealId', () => {
    expect(() =>
      cheatRepeatSchema.parse({
        sourceMealId: 'last-tuesday',
        loggedDate: '2026-07-10',
        timezoneOffset: 0,
      })
    ).toThrow();
  });
});
