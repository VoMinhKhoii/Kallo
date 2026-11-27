/// This week's days under the calendar on a two-pane Log, and what one day's
/// row says about it.
///
/// Pure: dates and a day's data in, rows out, so the grouping is tested
/// without a widget.
library;

import '../../data/logging_models.dart';
import '../timeline_utils.dart';

/// Which row the days pane draws. Two, so the owner can compare them; the
/// one not kept goes.
enum LogDayRowVariant {
  /// The day's name over its macros and calories.
  plain,

  /// [plain], then one line of what the person typed for each meal.
  withMeals,
}

/// Today back to this week's Monday, newest first. Weeks start on Monday, as
/// the calendar above and the week strip on Today do.
List<String> thisWeekDays(String today) {
  final back = dateStringToDate(today).weekday - DateTime.monday;
  return [for (var i = 0; i <= back; i++) addDays(today, -i)];
}

/// One day's totals and what the person typed, read from the day the feed
/// loads (`/api/v1/logging/day`), so a row and the gauges beside it count the
/// same meals.
class DayTotals {
  const DayTotals({
    required this.kcal,
    required this.protein,
    required this.carbs,
    required this.fat,
    required this.typed,
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
      typed: [
        for (final meal in meals)
          if (meal.rawInput.trim().isNotEmpty) meal.rawInput.trim(),
      ],
      empty: meals.isEmpty,
    );
  }

  final double? kcal;
  final double? protein;
  final double? carbs;
  final double? fat;

  /// The text of each saved meal's own message, in the order logged.
  final List<String> typed;

  /// No saved meal that day.
  final bool empty;
}

/// The typed texts joined for the row's one line.
String joinTyped(List<String> typed) => typed.join(' · ');
