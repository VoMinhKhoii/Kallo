import { beforeEach, describe, expect, it, vi } from 'vitest';

const gate = vi.hoisted(() => vi.fn());
vi.mock('@/lib/domain/billing/feature-gate', () => ({
  checkFeatureGate: gate,
}));

import type { PersistedMeal } from '@/lib/actions/meals/types';
import { scopeMealResponseForViewer } from '@/lib/actions/meals/viewer-scope/viewer-scope';
import {
  NUTRITION_KEYS,
  type NutritionValues,
} from '@/lib/ai/types/nutrition-values';

const values = Object.fromEntries(
  NUTRITION_KEYS.map((key) => [key, 12])
) as unknown as NutritionValues;
values.proteinG = null;

const meal: PersistedMeal = {
  id: 'meal',
  rawInput: 'Sữa',
  mealSlot: null,
  confidenceOverall: 'high',
  loggedAt: '2026-11-01T12:00:00Z',
  entryMode: 'precise',
  alcoholG: null,
  cheatSliders: null,
  share: null,
  nutrition: values,
  mealItemGroups: [
    {
      name: 'Sữa',
      order: 0,
      nutrition: values,
      ingredients: [
        {
          id: 'item',
          ingredientName: 'Sữa',
          foodCompositionId: null,
          estimatedGrams: 100,
          userFacingUnit: 'g',
          cookingMethod: null,
          matchConfidence: 1,
          nutrition: values,
        },
      ],
    },
  ],
};

function expectLocked(scoped: PersistedMeal) {
  for (const nutrition of [
    scoped.nutrition,
    scoped.mealItemGroups[0].nutrition,
    scoped.mealItemGroups[0].ingredients[0].nutrition,
  ]) {
    for (const key of NUTRITION_KEYS) {
      expect(nutrition[key]).toBe(
        ['caloriesKcal', 'proteinG', 'carbohydrateG', 'fatG'].includes(key)
          ? values[key]
          : null
      );
    }
  }
}

describe('scopeMealResponseForViewer', () => {
  beforeEach(() => {
    gate.mockReset();
  });

  it('nulls all non-macros at every level without mutating stored objects', async () => {
    gate.mockResolvedValue({ locked: true });
    const before = structuredClone(meal);

    const result = await scopeMealResponseForViewer(
      'user-1',
      Promise.resolve({ mealId: 'meal', meal })
    );

    expectLocked(result.meal!);
    expect(result.mealId).toBe('meal');
    expect(result.meal!.mealItemGroups[0].ingredients[0].estimatedGrams).toBe(
      100
    );
    expect(meal).toEqual(before);
    expect(gate).toHaveBeenCalledExactlyOnceWith(
      { userId: 'user-1' },
      'micronutrients'
    );
  });

  it('returns the complete stored meal to an entitled viewer', async () => {
    gate.mockResolvedValue({ locked: false });
    const response = { mealId: 'meal', meal };

    // An upgrade reads the same complete history, with no recomputation.
    expect(
      await scopeMealResponseForViewer('user-1', Promise.resolve(response))
    ).toBe(response);
  });

  it('scopes every meal of a list and passes a null meal through', async () => {
    gate.mockResolvedValue({ locked: true });

    const [scoped] = await scopeMealResponseForViewer(
      'user-1',
      Promise.resolve([meal])
    );
    expectLocked(scoped);
    expect(
      await scopeMealResponseForViewer(
        'user-1',
        Promise.resolve({ meal: null })
      )
    ).toEqual({ meal: null });
  });

  it('degrades to locked and still returns when the gate fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    gate.mockRejectedValue(new Error('entitlements unavailable'));

    const result = await scopeMealResponseForViewer(
      'user-1',
      Promise.resolve({ mealId: 'meal', meal })
    );

    expectLocked(result.meal!);
    expect(error).toHaveBeenCalledOnce();
    error.mockRestore();
  });
});
