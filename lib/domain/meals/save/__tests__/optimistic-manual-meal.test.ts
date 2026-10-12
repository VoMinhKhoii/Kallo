import { describe, expect, it } from 'vitest';
import type { IngredientSearchResult } from '@/lib/domain/logging/manual-logging';
import {
  buildOptimisticManualMeal,
  type SaveManualMealVariables,
} from '@/lib/domain/meals/save/optimistic-manual-meal';

const food = (
  id: string,
  namePrimary: string,
  per100g: IngredientSearchResult['per100g']
): IngredientSearchResult => ({
  id,
  namePrimary,
  nameEn: null,
  nameAlt: null,
  state: 'raw',
  similarity: 1,
  per100g,
});

const rice = food('fct-rice', 'Cơm trắng', {
  caloriesKcal: 130,
  proteinG: 2.7,
  carbohydrateG: 28,
  fatG: 0.3,
});
const herb = food('fct-herb', 'Lá mơ', {
  caloriesKcal: null,
  proteinG: 4,
  carbohydrateG: null,
  fatG: null,
});

const variables = (name: string | undefined): SaveManualMealVariables => ({
  mealId: 'meal-1',
  originDate: '2026-06-12',
  loggedDate: '2026-06-12',
  timezoneOffset: -420,
  name,
  items: [
    { ingredient: rice, grams: 200, label: 'cơm nhà' },
    { ingredient: herb, grams: 50 },
  ],
});

describe('buildOptimisticManualMeal', () => {
  it('an unnamed meal is a dish per food, titled by its labels', () => {
    const meal = buildOptimisticManualMeal(variables(undefined));
    expect(meal.rawInput).toBe('cơm nhà + Lá mơ');
    expect(
      meal.mealItemGroups.map((g) => [
        g.name,
        g.order,
        g.nutrition.caloriesKcal,
      ])
    ).toEqual([
      ['cơm nhà', 0, 260],
      // Unknown stays unknown — never a false 0.
      ['Lá mơ', 1, null],
    ]);
    expect(meal.nutrition.caloriesKcal).toBe(260);
    expect(meal.nutrition.proteinG).toBeCloseTo(7.4);
  });

  it('a named meal is one dish holding the whole meal', () => {
    const meal = buildOptimisticManualMeal(variables('Cơm trưa'));
    expect(meal.rawInput).toBe('Cơm trưa');
    expect(meal.mealItemGroups).toHaveLength(1);
    const [dish] = meal.mealItemGroups;
    expect([dish.name, dish.order]).toEqual(['Cơm trưa', 0]);
    expect(dish.nutrition.caloriesKcal).toBe(260);
    expect(dish.nutrition.proteinG).toBeCloseTo(7.4);
    expect(dish.ingredients).toEqual([]);
  });
});
