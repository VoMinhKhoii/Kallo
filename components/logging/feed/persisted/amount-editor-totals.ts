import type { PersistedMeal } from '@/lib/actions/meals/types';
import type { EditableRow } from './amount-editor-row';

const TOTAL_FIELDS = [
  'caloriesKcal',
  'proteinG',
  'carbohydrateG',
  'fatG',
] as const;

export type EditedTotals = Record<(typeof TOTAL_FIELDS)[number], number | null>;

/**
 * Live macro totals for the amount editor: each remaining row's ingredient
 * nutrition scaled by its edited grams. A field is null (renders N/A) only
 * when no contributing ingredient has a value for it.
 */
export function computeEditedTotals(
  meal: PersistedMeal,
  rows: EditableRow[]
): EditedTotals {
  const ingredients = new Map(
    meal.mealItemGroups.flatMap((group) =>
      group.ingredients.map((ingredient) => [ingredient.id, ingredient])
    )
  );
  const sums = Object.fromEntries(TOTAL_FIELDS.map((field) => [field, 0]));
  const hasValue = Object.fromEntries(
    TOTAL_FIELDS.map((field) => [field, false])
  );

  for (const row of rows) {
    if (row.removed) continue;
    const ingredient = ingredients.get(row.id);
    if (!ingredient) continue;
    const scale =
      row.grams == null ||
      ingredient.estimatedGrams == null ||
      ingredient.estimatedGrams === 0
        ? 1
        : row.grams / ingredient.estimatedGrams;
    for (const field of TOTAL_FIELDS) {
      const value = ingredient.nutrition[field];
      if (value == null) continue;
      sums[field] += value * scale;
      hasValue[field] = true;
    }
  }

  return Object.fromEntries(
    TOTAL_FIELDS.map((field) => [field, hasValue[field] ? sums[field] : null])
  ) as EditedTotals;
}
