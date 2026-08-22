import { describe, expect, it } from 'vitest';
import {
  buildPersistedIngredient,
  buildPersistedMeal,
  buildPersistedMealItemGroup,
} from '@/lib/actions/logging/persisted-meal';
import type { PersistedMeal } from '@/lib/actions/meals/types';
import { NULL_NUTRITION_VALUES } from '@/lib/ai/__fixtures__/test-helpers';

describe('persisted-meal builders (save/load parity)', () => {
  // The save (confirmAndSaveMealAction) and load (loadMealsByDate) paths both
  // construct PersistedMeal via these shared builders, so they cannot drift.
  // These assert the builders' contract — the single shape both paths inherit.
  const nutrition = (calories: number) => ({
    ...NULL_NUTRITION_VALUES,
    caloriesKcal: calories,
    proteinG: 10,
    carbohydrateG: 20,
    fatG: 5,
  });

  function ingredient(id: string, calories: number) {
    return buildPersistedIngredient({
      id,
      ingredientName: `ing-${id}`,
      foodCompositionId: null,
      estimatedGrams: 100,
      userFacingUnit: 'g',
      cookingMethod: null,
      matchConfidence: 0.9,
      nutrition: nutrition(calories),
    });
  }

  it('sums displayed ingredient nutrition for the group total', () => {
    const group = buildPersistedMealItemGroup('Phở bò', 0, [
      ingredient('a', 300),
      ingredient('b', 150),
    ]);

    expect(group.name).toBe('Phở bò');
    expect(group.order).toBe(0);
    expect(group.ingredients).toHaveLength(2);
    // The parity-critical rule: SUM of displayed ingredient nutrition.
    expect(group.nutrition.caloriesKcal).toBe(450);
    expect(group.nutrition.proteinG).toBe(20);
  });

  it('produces the full PersistedMeal shape with no missing keys', () => {
    const meal: PersistedMeal = buildPersistedMeal({
      id: 'meal-1',
      rawInput: 'Phở bò',
      mealSlot: 'lunch',
      confidenceOverall: 'high',
      loggedAt: '2026-05-04T05:30:00.000Z',
      nutrition: nutrition(450),
      mealItemGroups: [
        buildPersistedMealItemGroup('Phở bò', 0, [ingredient('a', 450)]),
      ],
      entryMode: 'precise',
      alcoholG: null,
      cheatSliders: null,
      share: null,
    });

    // Lock the top-level contract both paths return. If a field is added to
    // PersistedMeal, this (and the builder's typed signature) must be updated.
    expect(Object.keys(meal).sort()).toEqual(
      [
        'alcoholG',
        'cheatSliders',
        'confidenceOverall',
        'entryMode',
        'id',
        'loggedAt',
        'mealItemGroups',
        'mealSlot',
        'nutrition',
        'rawInput',
        'share',
      ].sort()
    );
    const ing = meal.mealItemGroups[0]?.ingredients[0];
    expect(Object.keys(ing ?? {}).sort()).toEqual(
      [
        'cookingMethod',
        'estimatedGrams',
        'foodCompositionId',
        'id',
        'ingredientName',
        'matchConfidence',
        'nutrition',
        'userFacingUnit',
      ].sort()
    );
  });
});
