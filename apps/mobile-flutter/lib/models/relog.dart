/// Deterministic relog models.
///
/// Ported from `lib/logging/relog/relog.ts`. The user types `/` in the
/// composer, picks a dish (or a whole meal) they have logged before, and the
/// server copies the stored `meal_items` rows verbatim — no AI pipeline, no
/// re-estimation.
///
/// Why verbatim rather than recompute: `meals`/`meal_items` store
/// GOAL-ADJUSTED macros and carry no goal/aggression snapshot, so a past dish's
/// accepted numbers cannot be re-derived.
library;

import 'ingredient.dart' show IngredientMacrosPer100g;

/// How many candidates the picker asks for per group.
const int kRelogSearchLimit = 8;

/// Max staged entries before server-side expansion — mirrors the Zod contract
/// (`relogItemsSchema.items.max(20)`). Picking past this is refused client-side
/// so the user finds out at the tap, not at submit.
const int kRelogMaxStaged = 20;

double? _num(Object? v) => (v as num?)?.toDouble();

/// Macro summary carried on every candidate so the picker subtitle and the
/// staged running total render without a second round-trip. These are SUMs of
/// the stored (already goal-adjusted) row values, so they equal what the
/// persisted card shows — the numbers agree by construction.
class RelogMacroSummary {
  final double? totalGrams;
  final double? caloriesKcal;
  final double? proteinG;
  final double? carbohydrateG;
  final double? fatG;

  const RelogMacroSummary({
    this.totalGrams,
    this.caloriesKcal,
    this.proteinG,
    this.carbohydrateG,
    this.fatG,
  });

  factory RelogMacroSummary.fromJson(Map<String, dynamic> json) =>
      RelogMacroSummary(
        totalGrams: _num(json['totalGrams']),
        caloriesKcal: _num(json['caloriesKcal']),
        proteinG: _num(json['proteinG']),
        carbohydrateG: _num(json['carbohydrateG']),
        fatG: _num(json['fatG']),
      );
}

/// One row the `/` picker can offer. A dish is one `meal_items` group; a meal
/// is a whole past entry that expands into its dishes when picked.
sealed class RelogCandidate {
  /// Payload identity: the most recent occurrence this candidate points at.
  final String sourceMealId;

  /// Display name — a dish's name, or a meal's original text.
  final String name;

  /// Times this appears in the lookback window — drives the ranking.
  final int occurrenceCount;
  final String lastLoggedAt;
  final RelogMacroSummary summary;

  const RelogCandidate({
    required this.sourceMealId,
    required this.name,
    required this.occurrenceCount,
    required this.lastLoggedAt,
    required this.summary,
  });

  /// Ingredient count for a dish, dish count for a meal.
  int get partCount;

  /// The reference this candidate stages as. Deliberately carries no nutrition,
  /// grams or name — only a pointer the server re-resolves.
  RelogRef get ref;
}

/// One past dish (a `meal_items` group sharing `meal_item_order` +
/// `meal_item_name`), deduplicated across history by its case-folded name.
class RelogDishCandidate extends RelogCandidate {
  final int mealItemOrder;

  /// How many ingredient rows the dish decomposes into.
  final int ingredientCount;

  const RelogDishCandidate({
    required super.sourceMealId,
    required super.name,
    required super.occurrenceCount,
    required super.lastLoggedAt,
    required super.summary,
    required this.mealItemOrder,
    required this.ingredientCount,
  });

  factory RelogDishCandidate.fromJson(Map<String, dynamic> json) =>
      RelogDishCandidate(
        sourceMealId: json['sourceMealId'] as String,
        name: json['name'] as String? ?? '',
        occurrenceCount: (json['occurrenceCount'] as num?)?.toInt() ?? 0,
        lastLoggedAt: json['lastLoggedAt'] as String? ?? '',
        summary: RelogMacroSummary.fromJson(json),
        mealItemOrder: (json['mealItemOrder'] as num?)?.toInt() ?? 0,
        ingredientCount: (json['ingredientCount'] as num?)?.toInt() ?? 0,
      );

  @override
  int get partCount => ingredientCount;

  @override
  RelogRef get ref =>
      RelogDishRef(sourceMealId: sourceMealId, mealItemOrder: mealItemOrder);
}

/// One past meal, deduplicated by its case-folded `raw_input`. Weaker dedup
/// than a dish name (raw_input is free text), which is why dishes list first.
class RelogMealCandidate extends RelogCandidate {
  /// How many dishes this meal expands into when picked.
  final int dishCount;

  const RelogMealCandidate({
    required super.sourceMealId,
    required super.name,
    required super.occurrenceCount,
    required super.lastLoggedAt,
    required super.summary,
    required this.dishCount,
  });

  factory RelogMealCandidate.fromJson(Map<String, dynamic> json) =>
      RelogMealCandidate(
        sourceMealId: json['sourceMealId'] as String,
        name: json['name'] as String? ?? '',
        occurrenceCount: (json['occurrenceCount'] as num?)?.toInt() ?? 0,
        lastLoggedAt: json['lastLoggedAt'] as String? ?? '',
        summary: RelogMacroSummary.fromJson(json),
        dishCount: (json['dishCount'] as num?)?.toInt() ?? 0,
      );

  @override
  int get partCount => dishCount;

  @override
  RelogRef get ref => RelogMealRef(sourceMealId: sourceMealId);
}

/// The picker's two groups, in render order.
class RelogCandidatesResponse {
  final List<RelogDishCandidate> dishes;
  final List<RelogMealCandidate> meals;

  const RelogCandidatesResponse({this.dishes = const [], this.meals = const []});

  factory RelogCandidatesResponse.fromJson(Map<String, dynamic> json) =>
      RelogCandidatesResponse(
        dishes:
            (json['dishes'] as List<dynamic>? ?? const [])
                .cast<Map<String, dynamic>>()
                .map(RelogDishCandidate.fromJson)
                .toList(),
        meals:
            (json['meals'] as List<dynamic>? ?? const [])
                .cast<Map<String, dynamic>>()
                .map(RelogMealCandidate.fromJson)
                .toList(),
      );

  /// Both groups flattened in render order. The picker walks this, so it never
  /// has to know groups exist — headers are presentational.
  List<RelogCandidate> get options => [...dishes, ...meals];

  bool get isEmpty => dishes.isEmpty && meals.isEmpty;
}

/// What the client posts back on submit. Deliberately carries NO nutrition,
/// grams or names — only a pointer the server re-resolves under
/// `WHERE user_id = …`. The client is never the source of truth for numbers.
sealed class RelogRef {
  final String sourceMealId;
  const RelogRef({required this.sourceMealId});

  Map<String, dynamic> toJson();
}

class RelogDishRef extends RelogRef {
  final int mealItemOrder;
  const RelogDishRef({
    required super.sourceMealId,
    required this.mealItemOrder,
  });

  @override
  Map<String, dynamic> toJson() => {
    'kind': 'dish',
    'sourceMealId': sourceMealId,
    'mealItemOrder': mealItemOrder,
  };

  @override
  bool operator ==(Object other) =>
      other is RelogDishRef &&
      other.sourceMealId == sourceMealId &&
      other.mealItemOrder == mealItemOrder;

  @override
  int get hashCode => Object.hash(sourceMealId, mealItemOrder);
}

class RelogMealRef extends RelogRef {
  const RelogMealRef({required super.sourceMealId});

  @override
  Map<String, dynamic> toJson() => {
    'kind': 'meal',
    'sourceMealId': sourceMealId,
  };

  @override
  bool operator ==(Object other) =>
      other is RelogMealRef && other.sourceMealId == sourceMealId;

  @override
  int get hashCode => sourceMealId.hashCode;
}

/// One picked entry. [stageId] is client-minted so duplicate picks of the same
/// dish stay independently removable — keying on the ref would make "remove"
/// hit the wrong row. [label] and [summary] are display-only; a stale entry can
/// render a stale subtitle but can never corrupt a save, because the server
/// re-resolves nutrition from the reference.
class RelogStagedEntry {
  final String stageId;
  final RelogRef ref;
  final String label;
  final int partCount;
  final RelogMacroSummary summary;

  const RelogStagedEntry({
    required this.stageId,
    required this.ref,
    required this.label,
    required this.partCount,
    required this.summary,
  });
}

/// Freeze a candidate into a staged entry under a client-minted [stageId].
RelogStagedEntry toStagedEntry(RelogCandidate candidate, String stageId) =>
    RelogStagedEntry(
      stageId: stageId,
      ref: candidate.ref,
      label: candidate.name,
      partCount: candidate.partCount,
      summary: candidate.summary,
    );

/// Sum staged macros for the totals line. Per nutrient: the sum of non-null
/// values, or null when no entry carries it — unknown is not zero.
IngredientMacrosPer100g sumStagedMacros(List<RelogStagedEntry> entries) {
  double? calories;
  double? protein;
  double? carbs;
  double? fat;
  double? add(double? total, double? value) =>
      value == null ? total : (total ?? 0) + value;

  for (final entry in entries) {
    calories = add(calories, entry.summary.caloriesKcal);
    protein = add(protein, entry.summary.proteinG);
    carbs = add(carbs, entry.summary.carbohydrateG);
    fat = add(fat, entry.summary.fatG);
  }
  return IngredientMacrosPer100g(
    caloriesKcal: calories,
    proteinG: protein,
    carbohydrateG: carbs,
    fatG: fat,
  );
}
