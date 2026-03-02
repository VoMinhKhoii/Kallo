import type { MacroBreakdown, MealItem } from '@/lib/types/meal';

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

    const newQuantity = Math.max(0, item.quantity + delta);
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
