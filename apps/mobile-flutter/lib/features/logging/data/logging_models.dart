/// Logging-surface response models — ported from the server contract types in
/// `lib/actions/meals.ts` (`PersistedMeal`, `PersistedMealItemGroup`,
/// `PendingMealConfirmation`, `LoggingDayData`).
///
/// Only the fields the logging UI consumes are modeled; the full
/// `NutritionValues` table is collapsed to a [MealNutrition] view exposing the
/// four macros the feed renders. Unknown fields are ignored on decode.
library;

import '../../../models/logging/cheat.dart';
import '../../../models/logging/meal.dart';
import '../../../models/nutrition/nutrition_enums.dart';

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

/// A single ingredient row within a dish group — the amount-editable unit.
/// Mirrors the web `PersistedIngredient` built by
/// `lib/actions/persisted-meal.ts#buildPersistedIngredient`; only the fields the
/// mobile amount editor consumes are modeled (unknown keys are ignored).
class PersistedIngredient {
  /// The `meal_items` row id — the stable key edits/removals are addressed by.
  final String id;
  final String ingredientName;

  /// Cooked grams; nullable for legacy rows with no recorded amount (the editor
  /// can't step those, and totals fall back to scale 1).
  final double? estimatedGrams;

  /// Display unit (e.g. `g`, `ml`), when the server recorded one.
  final String? userFacingUnit;
  final MealNutrition nutrition;

  const PersistedIngredient({
    required this.id,
    required this.ingredientName,
    required this.estimatedGrams,
    required this.userFacingUnit,
    required this.nutrition,
  });

  factory PersistedIngredient.fromJson(Map<String, dynamic> json) =>
      PersistedIngredient(
        id: json['id'] as String,
        ingredientName: json['ingredientName'] as String? ?? '',
        estimatedGrams: MealNutrition._num(json['estimatedGrams']),
        userFacingUnit: json['userFacingUnit'] as String?,
        nutrition: MealNutrition.fromJson(
          json['nutrition'] as Map<String, dynamic>,
        ),
      );
}

/// A named dish group within a persisted meal (collapsed/expanded rows).
class PersistedMealItemGroup {
  final String name;
  final int order;
  final MealNutrition nutrition;

  /// The dish's ingredient rows. Absent on older day-feed payloads → `[]`.
  final List<PersistedIngredient> ingredients;

  const PersistedMealItemGroup({
    required this.name,
    required this.order,
    required this.nutrition,
    this.ingredients = const [],
  });

  factory PersistedMealItemGroup.fromJson(
    Map<String, dynamic> json,
  ) => PersistedMealItemGroup(
    name: json['name'] as String,
    order: (json['order'] as num).toInt(),
    nutrition: MealNutrition.fromJson(
      json['nutrition'] as Map<String, dynamic>,
    ),
    ingredients:
        (json['ingredients'] as List<dynamic>? ?? [])
            .map((e) => PersistedIngredient.fromJson(e as Map<String, dynamic>))
            .toList(),
  );
}

/// A saved meal in the day's feed.
/// A meal's circle-share state, or null if it was never shared. `shareId` keys
/// the shareable Macro Card; `visibility` (`'private' | 'circle' | 'public'`)
/// seeds the "Share to circle" toggle from real server state. Mirrors the web
/// `PersistedMeal['share']` (`lib/actions/meals/types.ts`).
class MealShare {
  const MealShare({required this.shareId, required this.visibility});

  /// Nullable — absent in the payload must not masquerade as a real id (the
  /// share-card link is keyed off it).
  final String? shareId;
  final String visibility;

  bool get isShared => visibility != 'private';

  factory MealShare.fromJson(Map<String, dynamic> json) => MealShare(
    shareId: json['shareId'] as String?,
    visibility: json['visibility'] as String? ?? 'private',
  );
}

class PersistedMeal {
  final String id;
  final String rawInput;
  final String loggedAt; // ISO-8601 timestamp
  final MealNutrition nutrition;
  final List<PersistedMealItemGroup> mealItemGroups;

  /// 'precise' (default pipeline) or 'cheat' (slider estimate).
  final String entryMode;

  /// Cheat-only: ethanol grams folded into the calorie total.
  final double? alcoholG;

  /// Cheat-only: slider spec + chosen levels, for the "you set" recap.
  final CheatSlidersPersisted? cheatSliders;

  /// Circle-share state (null when never shared).
  final MealShare? share;

  const PersistedMeal({
    required this.id,
    required this.rawInput,
    required this.loggedAt,
    required this.nutrition,
    required this.mealItemGroups,
    this.entryMode = 'precise',
    this.alcoholG,
    this.cheatSliders,
    this.share,
  });

  bool get isCheat => entryMode == 'cheat';

  factory PersistedMeal.fromJson(Map<String, dynamic> json) => PersistedMeal(
    id: json['id'] as String,
    rawInput: json['rawInput'] as String? ?? '',
    loggedAt: json['loggedAt'] as String,
    nutrition: MealNutrition.fromJson(
      json['nutrition'] as Map<String, dynamic>,
    ),
    mealItemGroups:
        (json['mealItemGroups'] as List<dynamic>? ?? [])
            .map(
              (e) => PersistedMealItemGroup.fromJson(e as Map<String, dynamic>),
            )
            .toList(),
    entryMode: json['entryMode'] as String? ?? 'precise',
    alcoholG: MealNutrition._num(json['alcoholG']),
    cheatSliders:
        json['cheatSliders'] == null
            ? null
            : CheatSlidersPersisted.fromJson(
              json['cheatSliders'] as Map<String, dynamic>,
            ),
    share:
        json['share'] == null
            ? null
            : MealShare.fromJson(json['share'] as Map<String, dynamic>),
  );
}

/// An unconfirmed analysis awaiting the user's confirm tap.
class PendingMealConfirmation {
  final String id;
  final String rawInput;
  final String loggedAt;

  /// Set for precise entries. Null for cheat entries (which carry [cheatSpec]).
  final ParsedMeal? parsedMeal;

  /// Set for cheat entries: the staged slider spec the user confirms against.
  final CheatSliderSpec? cheatSpec;

  const PendingMealConfirmation({
    required this.id,
    required this.rawInput,
    required this.loggedAt,
    this.parsedMeal,
    this.cheatSpec,
  });

  factory PendingMealConfirmation.fromJson(Map<String, dynamic> json) =>
      PendingMealConfirmation(
        id: json['id'] as String,
        rawInput: json['rawInput'] as String? ?? '',
        loggedAt: json['loggedAt'] as String,
        parsedMeal:
            json['parsedMeal'] == null
                ? null
                : ParsedMeal.fromJson(
                  json['parsedMeal'] as Map<String, dynamic>,
                ),
        cheatSpec:
            json['cheatSpec'] == null
                ? null
                : CheatSliderSpec.fromJson(
                  json['cheatSpec'] as Map<String, dynamic>,
                ),
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
    persistedMeals:
        (json['persistedMeals'] as List<dynamic>? ?? [])
            .map((e) => PersistedMeal.fromJson(e as Map<String, dynamic>))
            .toList(),
    pendingConfirmations:
        (json['pendingConfirmations'] as List<dynamic>? ?? [])
            .map(
              (e) =>
                  PendingMealConfirmation.fromJson(e as Map<String, dynamic>),
            )
            .toList(),
  );

  LoggingDayData copyWith({
    List<PersistedMeal>? persistedMeals,
    List<PendingMealConfirmation>? pendingConfirmations,
  }) => LoggingDayData(
    persistedMeals: persistedMeals ?? this.persistedMeals,
    pendingConfirmations: pendingConfirmations ?? this.pendingConfirmations,
  );
}

/// The logging profile the feed needs: what a day is supposed to add up to,
/// and which direction the user is counting.
///
/// Mirrors the web `LoggingProfile` (`lib/domain/logging/types.ts`), which has
/// carried `goal` all along.
class LoggingProfile {
  final String userId;
  final int calorieTarget;
  final int proteinTargetG;
  final int carbsTargetG;
  final int fatTargetG;

  /// Not a target, but it comes off the same profile row, and the calorie dial
  /// cannot pick its headline without it. Null reads as counting up.
  final MacroGoal? goal;

  const LoggingProfile({
    required this.userId,
    required this.calorieTarget,
    required this.proteinTargetG,
    required this.carbsTargetG,
    required this.fatTargetG,
    this.goal,
  });

  // Value equality: the logging screen rebuilds this from the profile query on
  // every build, so without it two identical profiles compare unequal and
  // anything downstream that diffs on the value sees a change that never
  // happened. Six scalars — cheap to compare, and the alternative is a
  // widget-identity trap that is invisible until something re-runs.
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is LoggingProfile &&
          other.userId == userId &&
          other.calorieTarget == calorieTarget &&
          other.proteinTargetG == proteinTargetG &&
          other.carbsTargetG == carbsTargetG &&
          other.fatTargetG == fatTargetG &&
          other.goal == goal;

  @override
  int get hashCode => Object.hash(
    userId,
    calorieTarget,
    proteinTargetG,
    carbsTargetG,
    fatTargetG,
    goal,
  );
}
