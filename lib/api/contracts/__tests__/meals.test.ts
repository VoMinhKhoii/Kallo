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
