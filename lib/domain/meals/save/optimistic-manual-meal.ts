'use client';

import type {
  PersistedMeal,
  PersistedMealItemGroup,
} from '@/lib/actions/meals/types';
import type { SaveManualMealInput } from '@/lib/api/contracts/meals';
import { getUtcInstantForLocalDate } from '@/lib/core/date/local-day';
import {
  type IngredientMacrosPer100g,
  itemLabel,
  type ManualMealItem,
  macrosAt,
  manualDishOf,
  manualMealTitle,
  sumMacros,
} from '@/lib/domain/logging/manual-logging';
import { EMPTY_NUTRITION } from './nutrition-row';

export type SaveManualMealVariables = Omit<
  SaveManualMealInput,
  'mealId' | 'items'
> & {
  mealId: string;
  originDate: string;
  items: ManualMealItem[];
};

// Build the optimistic persisted meal from the per-100g macros the client
// already holds. Micros are left null; the server response fills them in.
export function buildOptimisticManualMeal(
  variables: SaveManualMealVariables
): PersistedMeal {
  const { items, mealId, name } = variables;
  // Same derivation the server applies — no second source of truth.
  const loggedAt = getUtcInstantForLocalDate(
    variables.loggedDate,
    variables.timezoneOffset
  ).toISOString();
  const macros = items.map((item) => macrosAt(item.ingredient, item.grams));
  const nutrition = { ...EMPTY_NUTRITION, ...sumMacros(macros) };
  // The server's grouping: by dish (name + order), each dish's nutrition the
  // sum of its foods.
  const dishes = new Map<
    string,
    { name: string; order: number; macros: IngredientMacrosPer100g[] }
  >();
  items.forEach((item, index) => {
    const dish = manualDishOf(name, itemLabel(item), index);
    const key = `${dish.order}:${dish.name}`;
    const group = dishes.get(key) ?? { ...dish, macros: [] };
    group.macros.push(macros[index]);
    dishes.set(key, group);
  });
  const groups: PersistedMealItemGroup[] = [...dishes.values()].map((dish) => ({
    name: dish.name,
    order: dish.order,
    ingredients: [],
    nutrition: { ...EMPTY_NUTRITION, ...sumMacros(dish.macros) },
  }));
  return {
    // Same id the server will persist — one stable React key from optimistic
    // insert through reconciliation (no re-fade).
    id: mealId,
    rawInput: manualMealTitle(name, items.map(itemLabel)),
    mealSlot: variables.mealSlot ?? null,
    confidenceOverall: 'high',
    loggedAt,
    nutrition,
    mealItemGroups: groups,
    entryMode: 'precise',
    alcoholG: null,
    cheatSliders: null,
    // Private until the save response says otherwise. The Circle auto-share
    // preference lives server-side and is off by default, so guessing
    // 'circle' here would briefly show a meal as shared that never was.
    share: null,
  };
}
