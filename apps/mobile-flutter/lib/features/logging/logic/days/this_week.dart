/// This week's days on a two-pane Log, and what one day's row says about
/// it.
///
/// Pure: dates and a day's data in, rows out, so the grouping is tested
/// without a widget.
library;

import '../../data/logging_models.dart';
import '../timeline_utils.dart';

/// Today back to this week's Monday, newest first. Weeks start on Monday, as
/// the rings above and the week strip on Today do.
List<String> thisWeekDays(String today) {
  final back = dateStringToDate(today).weekday - DateTime.monday;
  return [for (var i = 0; i <= back; i++) addDays(today, -i)];
}

/// One day's totals, read from the day the feed loads
/// (`/api/v1/logging/day`), so a row and the gauges beside it count the same
/// meals.
class DayTotals {
  const DayTotals({
    required this.kcal,
    required this.protein,
    required this.carbs,
    required this.fat,
    required this.empty,
  });

  /// Saved meals only: a staged card has not been eaten yet. A meal in
  /// [held] is being deleted and waits out its undo window; the gauges have
  /// stopped counting it, so this does too.
  factory DayTotals.of(LoggingDayData day, {Set<String> held = const {}}) {
    final meals = [
      for (final meal in day.persistedMeals)
        if (!held.contains(meal.id)) meal,
    ]..sort((a, b) => a.loggedAt.compareTo(b.loggedAt));
    double? sum(double? Function(MealNutrition n) pick) {
      double? total;
      for (final meal in meals) {
        final value = pick(meal.nutrition);
        if (value != null) total = (total ?? 0) + value;
      }
      return total;
    }

    return DayTotals(
      kcal: sum((n) => n.caloriesKcal),
      protein: sum((n) => n.proteinG),
      carbs: sum((n) => n.carbohydrateG),
      fat: sum((n) => n.fatG),
      empty: meals.isEmpty,
    );
  }

  final double? kcal;
  final double? protein;
  final double? carbs;
  final double? fat;

  /// No saved meal that day.
  final bool empty;
}
