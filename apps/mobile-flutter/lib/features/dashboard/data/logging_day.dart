/// Minimal models for the logging-day slice consumed by the dashboard.
///
/// Mirrors the server `LoggingDayData` / `PersistedMeal` shapes
/// (`lib/actions/meals.ts`), but decodes only the fields the dashboard's
/// TodaySection reads: each meal's `id`, `rawInput`, `loggedAt`, and the four
/// macro nutrition values. The full server payload carries 28 nutrients and a
/// `mealItemGroups` tree; those are intentionally not modeled here (other
/// surfaces own the rich logging model). Unknown JSON fields are ignored.
library;

/// The four macro nutrition values the dashboard reads off a persisted meal.
/// All nullable (not all foods have data), matching `NutritionValues`.
class MealNutrition {
  const MealNutrition({
    this.caloriesKcal,
    this.proteinG,
    this.carbohydrateG,
    this.fatG,
  });

  final double? caloriesKcal;
  final double? proteinG;
  final double? carbohydrateG;
  final double? fatG;

  factory MealNutrition.fromJson(Map<String, dynamic> json) => MealNutrition(
        caloriesKcal: (json['caloriesKcal'] as num?)?.toDouble(),
        proteinG: (json['proteinG'] as num?)?.toDouble(),
        carbohydrateG: (json['carbohydrateG'] as num?)?.toDouble(),
        fatG: (json['fatG'] as num?)?.toDouble(),
      );
}

/// A persisted meal row for the day — the subset the dashboard renders.
class PersistedMeal {
  const PersistedMeal({
    required this.id,
    required this.rawInput,
    required this.loggedAt,
    required this.nutrition,
  });

  final String id;
  final String rawInput;

  /// ISO-8601 timestamp; sorted lexicographically (matches the RN
  /// `a.loggedAt.localeCompare(b.loggedAt)`).
  final String loggedAt;
  final MealNutrition nutrition;

  factory PersistedMeal.fromJson(Map<String, dynamic> json) => PersistedMeal(
        id: json['id'] as String,
        rawInput: json['rawInput'] as String? ?? '',
        loggedAt: json['loggedAt'] as String? ?? '',
        nutrition: MealNutrition.fromJson(
          (json['nutrition'] as Map<String, dynamic>?) ?? const {},
        ),
      );
}

/// A day's logging payload — the dashboard only reads [persistedMeals].
class LoggingDayData {
  const LoggingDayData({required this.persistedMeals});

  final List<PersistedMeal> persistedMeals;

  factory LoggingDayData.fromJson(Map<String, dynamic> json) => LoggingDayData(
        persistedMeals: ((json['persistedMeals'] as List<dynamic>?) ?? const [])
            .map((e) => PersistedMeal.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}
