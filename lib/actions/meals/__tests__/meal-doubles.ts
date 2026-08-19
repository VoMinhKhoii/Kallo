// Shared doubles for the meal-action suites. All four drive the same
// transaction handle against the same schema stand-in, so the ids, the sample
// pipeline result and the tx.insert router live here instead of being copied
// into each file.

import { vi } from 'vitest';
import {
  NULL_BOUNDED_NUTRITION,
  NULL_NUTRITION_VALUES,
} from '@/lib/ai/__fixtures__/test-helpers';
import type { BoundedNutrition } from '@/lib/ai/types/nutrition-values';
import type { PipelineResult } from '@/lib/ai/types/result';

export const MOCK_USER = { id: 'user-123', email: 'test@example.com' };

/** The profile requireAuthAndProfile resolves to for every meal suite. */
export const MOCK_PROFILE = {
  goal: 'cutting',
  aggression: '0.5',
  autoShareToCircle: true,
};

// Valid v4 UUIDs (Zod v4 validates version+variant bits)
export const UUID_1 = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
export const UUID_2 = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';
export const UUID_MEAL = 'c2aade11-be2d-4aa0-8d8f-8ddbdf502c33';
export const LOGGED_AT = new Date('2026-04-05T17:30:00.000Z');

/** Column-name stand-in for `@/lib/infra/db/schema` — the insert router keys off it. */
export const schema = {
  meals: { id: 'meals.id', userId: 'meals.userId', loggedAt: 'meals.loggedAt' },
  mealItems: {
    id: 'mealItems.id',
    mealId: 'mealItems.mealId',
    estimatedGrams: 'mealItems.estimatedGrams',
  },
  mealShares: {
    mealId: 'mealShares.mealId',
    id: 'mealShares.id',
    visibility: 'mealShares.visibility',
  },
  pendingAnalyses: {
    id: 'pendingAnalyses.id',
    userId: 'pendingAnalyses.userId',
    expiresAt: 'pendingAnalyses.expiresAt',
    loggedAt: 'pendingAnalyses.loggedAt',
  },
  unmatchedIngredients: {
    queryText: 'unmatchedIngredients.queryText',
    mealId: 'unmatchedIngredients.mealId',
  },
  userProfiles: {
    userId: 'userProfiles.userId',
    autoShareToCircle: 'userProfiles.autoShareToCircle',
  },
};

export function makeBoundedNutrition(
  overrides: Partial<
    Record<keyof BoundedNutrition, { low: number; mid: number; high: number }>
  > = {}
): BoundedNutrition {
  const result = { ...NULL_BOUNDED_NUTRITION };
  for (const key of Object.keys(overrides) as (keyof BoundedNutrition)[]) {
    (result as Record<string, unknown>)[key] = overrides[key]!;
  }
  return result;
}

export const samplePipelineResult: PipelineResult = {
  mealSlot: 'lunch',
  confidenceOverall: 'high',
  unmatchedIngredients: [],
  boundedNutrition: NULL_BOUNDED_NUTRITION,
  displayedNutrition: NULL_NUTRITION_VALUES,
  mealItems: [
    {
      name: 'Phở bò',
      boundedNutrition: NULL_BOUNDED_NUTRITION,
      displayedNutrition: NULL_NUTRITION_VALUES,
      ingredients: [
        {
          ingredientName: 'Bánh phở',
          foodCompositionId: 'fc-1',
          estimatedGrams: 200,
          rawEquivalentGrams: 200,
          userFacingUnit: '1 tô',
          cookingMethod: 'luộc',
          matchConfidence: 0.9,
          boundedNutrition: makeBoundedNutrition({
            caloriesKcal: { low: 280, mid: 300, high: 320 },
            proteinG: { low: 4, mid: 5, high: 6 },
            carbohydrateG: { low: 55, mid: 60, high: 65 },
            fatG: { low: 1, mid: 2, high: 3 },
          }),
          displayedNutrition: NULL_NUTRITION_VALUES,
        },
        {
          ingredientName: 'Thịt bò',
          foodCompositionId: 'fc-2',
          estimatedGrams: 100,
          rawEquivalentGrams: 100,
          userFacingUnit: null,
          cookingMethod: 'luộc',
          matchConfidence: 0.85,
          boundedNutrition: makeBoundedNutrition({
            caloriesKcal: { low: 180, mid: 200, high: 220 },
            proteinG: { low: 24, mid: 26, high: 28 },
            fatG: { low: 10, mid: 12, high: 14 },
          }),
          displayedNutrition: NULL_NUTRITION_VALUES,
        },
      ],
    },
  ],
};

// Routes tx.insert by table: meals/mealItems push their values into
// `capturedValues` (so existing index-based assertions stay stable), while the
// default share-to-circle insert on mealShares returns its own
// `.values().onConflictDoNothing().returning()` chain without polluting
// capturedValues. Returns a stub share row { id: 'share-1', visibility }.
export function mockInsertRouting(
  capturedValues: unknown[] = [],
  mealId: string = UUID_MEAL
) {
  return (table: { id?: string }) => {
    if (table?.id === 'mealShares.id') {
      return {
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi
              .fn()
              .mockResolvedValue([{ id: 'share-1', visibility: 'circle' }]),
          }),
        }),
      };
    }
    return {
      values: vi.fn().mockImplementation((vals: unknown) => {
        capturedValues.push(vals);
        return { returning: vi.fn().mockResolvedValue([{ id: mealId }]) };
      }),
    };
  };
}
