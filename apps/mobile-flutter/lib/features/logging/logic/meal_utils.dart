/// Pure meal-quantity helpers — vendored 1:1 from web
/// `lib/domain/meals/quantity-recalculation.ts`. The scaling math must match
/// the web exactly so confirmed edits agree with the server.
library;

import '../../../models/logging/meal.dart';

/// Minimum allowed cooked weight for a grams/ml dish.
const double minDishGrams = 10;

/// A day reads as under-logged when its calories fall below this fraction of
/// the target (ported from `lib/nutrition/pattern/completeness.ts`). A day
/// counts as fully logged only once it reaches 85% of the daily goal.
const double partialDayFraction = 0.85;

/// True when a past day's logged calories are positive but below
/// [partialDayFraction] of the target — likely under-logged, so the trends set
/// it aside.
///
/// [isMarked] short-circuits everything: the user has explicitly attested this
/// day is fully logged, and a direct statement from the person who ate the food
/// outranks a heuristic about them. Mirrors the `isMarked` parameter on the TS
/// twin — keep the two in step.
bool isLikelyPartialDay(
  double calories,
  int? calorieTarget, {
  bool isMarked = false,
}) {
  if (isMarked) return false;
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
