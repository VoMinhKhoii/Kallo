import {
  isContainerFamily,
  midG,
  type VesselTier,
} from '@/lib/ai/portion/vessel-data';
import type {
  MacroBreakdown,
  MealItem,
  MealQuantityEdit,
} from '@/lib/types/meal';

/**
 * Minimum weight a gram/ml dish can be stepped down to. Enforced both in the
 * stepper (minus disabled at/below this) and in `applyQuantityChange`, so a
 * gram/ml dish can never drop below it — and never to 0g, which would silently
 * drop the edit. Non-weight units (e.g. servings) are unaffected.
 */
export const MIN_DISH_GRAMS = 10;

export function recalculateTotals(items: MealItem[]): MacroBreakdown {
  return items.reduce(
    (acc, item) => ({
      calories: acc.calories + item.macros.calories,
      protein: acc.protein + item.macros.protein,
      carbs: acc.carbs + item.macros.carbs,
      fat: acc.fat + item.macros.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

function scaleMacros(macros: MacroBreakdown, ratio: number): MacroBreakdown {
  return {
    calories: macros.calories * ratio,
    protein: macros.protein * ratio,
    carbs: macros.carbs * ratio,
    fat: macros.fat * ratio,
  };
}

export function applyQuantityChange(
  items: MealItem[],
  originalItems: MealItem[],
  itemId: string,
  delta: number
): MealItem[] {
  return items.map((item) => {
    if (item.id !== itemId) return item;
    const originalItem = originalItems.find((i) => i.id === itemId);
    if (!originalItem) return item;

    const minQuantity =
      item.unit === 'g' || item.unit === 'ml' ? MIN_DISH_GRAMS : 0;
    const newQuantity = Math.max(minQuantity, item.quantity + delta);
    const ratio =
      originalItem.quantity > 0 ? newQuantity / originalItem.quantity : 0;

    return {
      ...item,
      quantity: newQuantity,
      macros: scaleMacros(originalItem.macros, ratio),
    };
  });
}

export function vesselGramsForTier(
  item: MealItem,
  tier: VesselTier
): number | undefined {
  if (!item.vessel) return undefined;
  if (!isContainerFamily(item.vessel.family)) return undefined;
  if (!('dishClass' in item.vessel)) return undefined;
  return midG(item.vessel.family, tier, item.vessel.dishClass);
}

/**
 * Build the dish-level quantity overrides to send on confirm: one entry per
 * item whose quantity differs from the original AI estimate. Positional order
 * is the server's `mealItemOrder`.
 */
export function deriveQuantityEdits(
  items: MealItem[],
  originalItems: MealItem[]
): MealQuantityEdit[] {
  return items.flatMap((item, order) => {
    const original = originalItems[order];
    if (!original || item.quantity === original.quantity) return [];
    return [{ mealItemOrder: order, newGrams: item.quantity }];
  });
}
