/// Pure meal-quantity helpers — vendored 1:1 from the web's `lib/meal-utils.ts`
/// (via `apps/mobile/src/lib/logging/logic/meal-utils.ts`). The scaling math
/// must match the web exactly so confirmed edits agree with the server.
library;

import '../../../models/logging/meal.dart';

/// Minimum allowed cooked weight for a grams/ml dish.
const double minDishGrams = 10;

/// A day reads as under-logged when its calories fall below this fraction of
/// the target (ported from `lib/nutrition/pattern/completeness.ts`).
const double partialDayFraction = 0.5;

/// True when a past day's logged calories are positive but below half the
/// target — likely under-logged, so the trends set it aside.
bool isLikelyPartialDay(double calories, int? calorieTarget) {
  if (calorieTarget == null || calorieTarget <= 0) return false;
  if (calories <= 0) return false;
  return calories < partialDayFraction * calorieTarget;
}

/// Sum each item's macros into a single [MacroBreakdown].
MacroBreakdown recalculateTotals(List<MealItem> items) {
  return items.fold(
    const MacroBreakdown(calories: 0, protein: 0, carbs: 0, fat: 0),
    (acc, item) => MacroBreakdown(
      calories: acc.calories + item.macros.calories,
      protein: acc.protein + item.macros.protein,
      carbs: acc.carbs + item.macros.carbs,
      fat: acc.fat + item.macros.fat,
    ),
  );
}

/// Apply a +/- quantity change to one item, scaling its macros off the
/// ORIGINAL item (so repeated taps don't compound rounding). Grams/ml dishes
/// clamp at [minDishGrams]; count dishes clamp at 0.
List<MealItem> applyQuantityChange(
  List<MealItem> items,
  List<MealItem> originalItems,
  String itemId,
  double delta,
) {
  return items.map((item) {
    if (item.id != itemId) return item;
    MealItem? originalItem;
    for (final i in originalItems) {
      if (i.id == itemId) {
        originalItem = i;
        break;
      }
    }
    if (originalItem == null) return item;

    final double minQuantity =
        (item.unit == 'g' || item.unit == 'ml') ? minDishGrams : 0;
    final double newQuantity =
        (item.quantity + delta) < minQuantity ? minQuantity : item.quantity + delta;
    final double ratio =
        originalItem.quantity > 0 ? newQuantity / originalItem.quantity : 0;

    return item.copyWith(
      quantity: newQuantity,
      macros: MacroBreakdown(
        calories: originalItem.macros.calories * ratio,
        protein: originalItem.macros.protein * ratio,
        carbs: originalItem.macros.carbs * ratio,
        fat: originalItem.macros.fat * ratio,
      ),
    );
  }).toList();
}

/// Compute the minimal set of quantity overrides vs. the original list, keyed
/// by item order (the server scales the whole dish to [MealQuantityEdit.newGrams]).
List<MealQuantityEdit> deriveQuantityEdits(
  List<MealItem> items,
  List<MealItem> originalItems,
) {
  final edits = <MealQuantityEdit>[];
  for (var order = 0; order < items.length; order++) {
    final item = items[order];
    if (order >= originalItems.length) continue;
    final original = originalItems[order];
    if (item.quantity == original.quantity) continue;
    edits.add(MealQuantityEdit(mealItemOrder: order, newGrams: item.quantity));
  }
  return edits;
}
