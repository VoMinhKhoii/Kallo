// Shared builders for the client-facing meal shape. Kept OUT of the
// 'use server' lib/actions/meals.ts module on purpose: that module may only
// export async Server Actions, so these synchronous builders live here and are
// imported by both save paths (confirmAndSaveMealAction, saveManualMealAction)
// and the load path (loadMealsByDateForUser). They are the single construction
// point for the PersistedMeal shape so the paths can never drift — adding a
// field to any Persisted* interface becomes a compile error until every call
// site supplies it, and the group-nutrition rule lives in exactly one place.
import type {
  PersistedIngredient,
  PersistedMeal,
  PersistedMealItemGroup,
} from '@/lib/actions/meals/types';
import { NUTRITION_KEYS } from '@/lib/ai/constants';
import { sumDisplayedNutrition } from '@/lib/ai/pipeline/goal-adjustment';
import type { NutritionValues } from '@/lib/ai/types';

/** Infer meal slot from time of day as fallback. Shared by both save paths so
 *  AI-confirmed and manually-logged meals classify identically. */
export function inferMealSlot(date: Date): string {
  const hour = date.getHours();
  if (hour < 10) return 'breakfast';
  if (hour < 14) return 'lunch';
  if (hour < 17) return 'snack';
  return 'dinner';
}

/** Project a NutritionValues onto the nutrient columns of meals/meal_items. */
export function nutritionValuesToRow(
  nutrition: NutritionValues
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const key of NUTRITION_KEYS) {
    row[key] = nutrition[key];
  }
  return row;
}

/** Extract flat NutritionValues from a Drizzle row keyed by NUTRITION_KEYS.
 *  Numeric columns may surface as strings (columns declared without
 *  `mode: 'number'`) — coerced with a finite guard, nulls preserved. */
export function extractNutritionValues(
  row: Record<string, unknown>
): NutritionValues {
  const result = {} as Record<string, number | null>;
  for (const key of NUTRITION_KEYS) {
    const val = row[key];
    if (typeof val === 'number') {
      result[key] = Number.isFinite(val) ? val : null;
    } else if (typeof val === 'string') {
      const parsed = Number(val);
      result[key] = Number.isFinite(parsed) ? parsed : null;
    } else {
      result[key] = null;
    }
  }
  return result as unknown as NutritionValues;
}

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

/** Row-shaped input for {@link buildMealItemGroupsFromRows}: the per-ingredient
 *  fields plus its already-resolved nutrition. Callers pick the id/grams/
 *  nutrition variant they need — stored DB values, scaled edits, or fresh-id
 *  copies — so the grouping itself can live in one place. */
export interface MealItemRow {
  id: string;
  ingredientName: string;
  mealItemName: string;
  mealItemOrder: number;
  foodCompositionId: string | null;
  estimatedGrams: number | null;
  userFacingUnit: string | null;
  cookingMethod: string | null;
  matchConfidence: number | null;
  nutrition: NutritionValues;
}

/**
 * Group flat ingredient rows into PersistedMealItemGroup[] by parent dish
 * (order:name), preserving row order within each group and sorting groups by
 * order. The single rebuild point shared by the day-load and the edit/duplicate
 * write paths, so the PersistedMeal shape can never drift between them.
 */
export function buildMealItemGroupsFromRows(
  rows: MealItemRow[]
): PersistedMealItemGroup[] {
  const byGroup = new Map<
    string,
    { name: string; order: number; ingredients: PersistedIngredient[] }
  >();
  for (const row of rows) {
    const key = `${row.mealItemOrder}:${row.mealItemName}`;
    let group = byGroup.get(key);
    if (!group) {
      group = {
        name: row.mealItemName,
        order: row.mealItemOrder,
        ingredients: [],
      };
      byGroup.set(key, group);
    }
    group.ingredients.push(
      buildPersistedIngredient({
        id: row.id,
        ingredientName: row.ingredientName,
        foodCompositionId: row.foodCompositionId,
        estimatedGrams: row.estimatedGrams,
        userFacingUnit: row.userFacingUnit,
        cookingMethod: row.cookingMethod,
        matchConfidence: row.matchConfidence,
        nutrition: row.nutrition,
      })
    );
  }
  return Array.from(byGroup.values())
    .sort((a, b) => a.order - b.order)
    .map((g) => buildPersistedMealItemGroup(g.name, g.order, g.ingredients));
}

/** Build a PersistedMeal — the single construction point for its shape. */
export function buildPersistedMeal(fields: PersistedMeal): PersistedMeal {
  return fields;
}
