import type {
  MacroBreakdown,
  MealItem,
  MealQuantityEdit,
} from '@/lib/types/meal';

/**
 * Vendored copy of the web's pure quantity helpers (lib/meal-utils.ts).
 *
 * TYPE imports from `@/lib/*` work fine (Babel erases them), but Metro can't
 * yet resolve a runtime VALUE import from outside the app root (the repo-root
 * `lib/` is under watchFolders but not crawled — see docs/mobile-rn-plan.md
 * Phase 3 notes). Until that infra is solved (likely a Bun workspace), these
 * four small pure functions are duplicated here verbatim. Keep them in sync
 * with lib/meal-utils.ts.
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
      macros: {
        calories: originalItem.macros.calories * ratio,
        protein: originalItem.macros.protein * ratio,
        carbs: originalItem.macros.carbs * ratio,
        fat: originalItem.macros.fat * ratio,
      },
    };
  });
}

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
