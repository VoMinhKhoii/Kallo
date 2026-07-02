/// Logging-surface response models — ported from the server contract types in
/// `lib/actions/meals.ts` (`PersistedMeal`, `PersistedMealItemGroup`,
/// `PendingMealConfirmation`, `LoggingDayData`).
///
/// Only the fields the logging UI consumes are modeled; the full
/// `NutritionValues` table is collapsed to a [MealNutrition] view exposing the
/// four macros the feed renders. Unknown fields are ignored on decode.
library;

import '../../../models/meal.dart';

/// The macro subset of `NutritionValues` the feed shows. Each value is nullable
/// (legacy meals can have unknown macros → `N/A`).
class MealNutrition {
  final double? caloriesKcal;
  final double? proteinG;
  final double? carbohydrateG;
  final double? fatG;

  const MealNutrition({
    this.caloriesKcal,
    this.proteinG,
    this.carbohydrateG,
    this.fatG,
  });

  static double? _num(Object? v) => v == null ? null : (v as num).toDouble();

  factory MealNutrition.fromJson(Map<String, dynamic> json) => MealNutrition(
        caloriesKcal: _num(json['caloriesKcal']),
        proteinG: _num(json['proteinG']),
        carbohydrateG: _num(json['carbohydrateG']),
        fatG: _num(json['fatG']),
      );
}

/// A named dish group within a persisted meal (collapsed/expanded rows).
class PersistedMealItemGroup {
  final String name;
  final int order;
  final MealNutrition nutrition;

  const PersistedMealItemGroup({
    required this.name,
    required this.order,
    required this.nutrition,
  });

  factory PersistedMealItemGroup.fromJson(Map<String, dynamic> json) =>
      PersistedMealItemGroup(
        name: json['name'] as String,
        order: (json['order'] as num).toInt(),
        nutrition:
            MealNutrition.fromJson(json['nutrition'] as Map<String, dynamic>),
      );
}

/// A saved meal in the day's feed.
/// A meal's circle-share state, or null if it was never shared. `shareId` keys
/// the shareable Macro Card; `visibility` (`'private' | 'circle' | 'public'`)
/// seeds the "Share to circle" toggle from real server state. Mirrors the web
/// `PersistedMeal['share']` (`lib/actions/meals/types.ts`).
class MealShare {
  const MealShare({required this.shareId, required this.visibility});

  final String shareId;
  final String visibility;

  bool get isShared => visibility != 'private';

  factory MealShare.fromJson(Map<String, dynamic> json) => MealShare(
        shareId: json['shareId'] as String? ?? '',
        visibility: json['visibility'] as String? ?? 'private',
      );
}

class PersistedMeal {
  final String id;
  final String rawInput;
  final String loggedAt; // ISO-8601 timestamp
  final MealNutrition nutrition;
  final List<PersistedMealItemGroup> mealItemGroups;

  /// Circle-share state (null when never shared).
  final MealShare? share;

  const PersistedMeal({
    required this.id,
    required this.rawInput,
    required this.loggedAt,
    required this.nutrition,
    required this.mealItemGroups,
    this.share,
  });

  factory PersistedMeal.fromJson(Map<String, dynamic> json) => PersistedMeal(
        id: json['id'] as String,
        rawInput: json['rawInput'] as String? ?? '',
        loggedAt: json['loggedAt'] as String,
        nutrition:
            MealNutrition.fromJson(json['nutrition'] as Map<String, dynamic>),
        mealItemGroups: (json['mealItemGroups'] as List<dynamic>? ?? [])
            .map((e) =>
                PersistedMealItemGroup.fromJson(e as Map<String, dynamic>))
            .toList(),
        share: json['share'] == null
            ? null
            : MealShare.fromJson(json['share'] as Map<String, dynamic>),
      );
}

/// An unconfirmed analysis awaiting the user's confirm tap.
class PendingMealConfirmation {
  final String id;
  final String rawInput;
  final String loggedAt;
  final ParsedMeal parsedMeal;

  const PendingMealConfirmation({
    required this.id,
    required this.rawInput,
    required this.loggedAt,
    required this.parsedMeal,
  });

  factory PendingMealConfirmation.fromJson(Map<String, dynamic> json) =>
      PendingMealConfirmation(
        id: json['id'] as String,
        rawInput: json['rawInput'] as String? ?? '',
        loggedAt: json['loggedAt'] as String,
        parsedMeal:
            ParsedMeal.fromJson(json['parsedMeal'] as Map<String, dynamic>),
      );
}

/// `GET /api/v1/logging/day` payload.
class LoggingDayData {
  final List<PersistedMeal> persistedMeals;
  final List<PendingMealConfirmation> pendingConfirmations;

  const LoggingDayData({
    required this.persistedMeals,
    required this.pendingConfirmations,
  });

  factory LoggingDayData.fromJson(Map<String, dynamic> json) => LoggingDayData(
        persistedMeals: (json['persistedMeals'] as List<dynamic>? ?? [])
            .map((e) => PersistedMeal.fromJson(e as Map<String, dynamic>))
            .toList(),
        pendingConfirmations:
            (json['pendingConfirmations'] as List<dynamic>? ?? [])
                .map((e) =>
                    PendingMealConfirmation.fromJson(e as Map<String, dynamic>))
                .toList(),
      );

  LoggingDayData copyWith({
    List<PersistedMeal>? persistedMeals,
    List<PendingMealConfirmation>? pendingConfirmations,
  }) =>
      LoggingDayData(
        persistedMeals: persistedMeals ?? this.persistedMeals,
        pendingConfirmations: pendingConfirmations ?? this.pendingConfirmations,
      );
}

/// The logging profile (targets) the feed needs. Mirrors the RN `LoggingProfile`.
class LoggingProfile {
  final String userId;
  final int calorieTarget;
  final int proteinTargetG;
  final int carbsTargetG;
  final int fatTargetG;

  const LoggingProfile({
    required this.userId,
    required this.calorieTarget,
    required this.proteinTargetG,
    required this.carbsTargetG,
    required this.fatTargetG,
  });
}
