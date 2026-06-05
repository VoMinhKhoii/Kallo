// Shared builders for the client-facing meal shape. Kept OUT of the
// 'use server' lib/actions/meals.ts module on purpose: that module may only
// export async Server Actions, so these synchronous builders live here and are
// imported by both the save (confirmAndSaveMealAction) and load
// (loadMealsByDateForUser) paths. They are the single construction point for the
// PersistedMeal shape so the two paths can never drift — adding a field to any
// Persisted* interface becomes a compile error until every call site supplies it,
// and the group-nutrition rule lives in exactly one place.
import type {
  PersistedIngredient,
  PersistedMeal,
  PersistedMealItemGroup,
} from '@/lib/actions/meals';
import { sumDisplayedNutrition } from '@/lib/ai/pipeline/goal-adjustment';

/** Build a PersistedIngredient — the single construction point for its shape. */
export function buildPersistedIngredient(
  fields: PersistedIngredient
): PersistedIngredient {
  return fields;
}

/**
 * Build a PersistedMealItemGroup. Group nutrition is always the SUM of the
 * displayed ingredient nutrition (never goalAdjust(sum)); this is the parity-
 * critical rule both paths must share.
 */
export function buildPersistedMealItemGroup(
  name: string,
  order: number,
  ingredients: PersistedIngredient[]
): PersistedMealItemGroup {
  return {
    name,
    order,
    ingredients,
    nutrition: sumDisplayedNutrition(ingredients.map((i) => i.nutrition)),
  };
}

/** Build a PersistedMeal — the single construction point for its shape. */
export function buildPersistedMeal(fields: PersistedMeal): PersistedMeal {
  return fields;
}
