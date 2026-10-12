/// Ingredient-search and manual-logging data models.
///
/// Mirrors the web contracts in `lib/api/contracts/ingredients.ts` and
/// `lib/domain/logging/manual-logging.ts`: deterministic manual logging where
/// the user picks a food-composition entry and enters exact grams — nutrition
/// is per-100g data scaled client-side for live feedback, and recomputed
/// server-side on save.
library;

import 'vessel.dart';

/// Per-100g macro snapshot carried with every search result so the client can
/// compute row/total macros live without another round-trip.
class IngredientMacrosPer100g {
  final double? caloriesKcal;
  final double? proteinG;
  final double? carbohydrateG;
  final double? fatG;

  const IngredientMacrosPer100g({
    this.caloriesKcal,
    this.proteinG,
    this.carbohydrateG,
    this.fatG,
  });

  factory IngredientMacrosPer100g.fromJson(Map<String, dynamic> json) =>
      IngredientMacrosPer100g(
        caloriesKcal: (json['caloriesKcal'] as num?)?.toDouble(),
        proteinG: (json['proteinG'] as num?)?.toDouble(),
        carbohydrateG: (json['carbohydrateG'] as num?)?.toDouble(),
        fatG: (json['fatG'] as num?)?.toDouble(),
      );

  /// Scaled by grams/100, preserving nulls (unknown ≠ zero).
  IngredientMacrosPer100g scaledTo(double grams) {
    final ratio = grams / 100;
    double? scale(double? v) => v == null ? null : v * ratio;
    return IngredientMacrosPer100g(
      caloriesKcal: scale(caloriesKcal),
      proteinG: scale(proteinG),
      carbohydrateG: scale(carbohydrateG),
      fatG: scale(fatG),
    );
  }
}

/// One row returned by `GET /api/v1/ingredients/search`.
class IngredientSearchResult {
  final String id;

  /// Primary Vietnamese name (e.g. "Thịt gà ta").
  final String namePrimary;

  /// English name (e.g. "Chicken meat").
  final String? nameEn;

  /// 'raw' | 'cooked' — grams are interpreted against this state; the UI must
  /// surface it so users pick the entry matching how they weighed the food.
  final String state;

  /// True when found by the semantic (embedding) supplement rather than a
  /// lexical match — labelled as a related, not exact, hit.
  final bool semantic;

  final IngredientMacrosPer100g per100g;

  /// Clean English name from the row's food card ("Skinless chicken breast").
  /// Null when the row has no card — fall back to [nameEn].
  final String? displayNameEn;

  /// 'raw' | 'cooked' only when the card's own wording says so. Null for
  /// canned, dried, packaged and plain foods, where the table's default 'raw'
  /// in [state] would mislead — so the UI shows no state at all.
  final String? stateLabel;

  /// A packaged food's brand, shown where the state label would go.
  final String? brand;

  /// The vessel the amount ruler offers, at its everyday tier (a medium cut,
  /// a medium bowl, a regular cup). Null means grams only.
  final ClientVessel? vessel;

  const IngredientSearchResult({
    required this.id,
    required this.namePrimary,
    required this.nameEn,
    required this.state,
    required this.per100g,
    this.semantic = false,
    this.displayNameEn,
    this.stateLabel,
    this.brand,
    this.vessel,
  });

  /// The English name to show: the card's clean one, else the table's.
  String? get englishName {
    final name = displayNameEn ?? nameEn;
    return name == null || name.trim().isEmpty ? null : name;
  }

  factory IngredientSearchResult.fromJson(Map<String, dynamic> json) =>
      IngredientSearchResult(
        id: json['id'] as String,
        namePrimary: json['namePrimary'] as String,
        nameEn: json['nameEn'] as String?,
        state: json['state'] as String? ?? 'raw',
        semantic: json['semantic'] as bool? ?? false,
        per100g: IngredientMacrosPer100g.fromJson(
          (json['per100g'] as Map<String, dynamic>?) ?? const {},
        ),
        displayNameEn: _stringOrNull(json['displayNameEn']),
        stateLabel: switch (json['stateLabel']) {
          'raw' => 'raw',
          'cooked' => 'cooked',
          _ => null,
        },
        brand: _stringOrNull(json['brand']),
        vessel: vesselFromHint(json['vessel']),
      );
}

String? _stringOrNull(Object? value) =>
    value is String && value.trim().isNotEmpty ? value : null;

/// The search's vessel hint (`{family: 'piece', kind}` or `{family, dishClass}`)
/// as a vessel at its everyday tier: one medium cut; a regular cup or a medium
/// plate; a small bowl (a chén) of rice or beans, a medium bowl of soup. A
/// medium bowl of rice is ~390 g, twice what a chén holds. NEVER throws: a hint
/// is decoration, and an unknown family from a newer server degrades to grams.
ClientVessel? vesselFromHint(Object? hint) {
  if (hint is! Map) return null;
  if (hint['family'] == 'piece') {
    return ClientVessel.fromJson({...hint, 'tier': 3, 'count': 1});
  }
  final chen = hint['family'] == 'bowl' && hint['dishClass'] == 'solid';
  return ClientVessel.fromJson({...hint, 'tier': chen ? 1 : 2});
}

/// One picked item in the manual-log sheet: an ingredient + editable grams.
class ManualLogItem {
  final String id;
  final IngredientSearchResult ingredient;

  /// Null while the grams field is cleared mid-edit; such rows are excluded
  /// from totals and from the save payload.
  final double? grams;

  const ManualLogItem({
    required this.id,
    required this.ingredient,
    required this.grams,
  });

  ManualLogItem copyWith({double? Function()? grams}) => ManualLogItem(
    id: id,
    ingredient: ingredient,
    grams: grams != null ? grams() : this.grams,
  );

  bool get isComplete => grams != null && grams!.isFinite && grams! > 0;

  /// Live macros for this row (per100g × grams/100), or null when incomplete.
  IngredientMacrosPer100g? get macros =>
      isComplete ? ingredient.per100g.scaledTo(grams!) : null;
}

/// Sum macros across complete items. Per nutrient: sum of non-null values, or
/// null when no item carries it.
IngredientMacrosPer100g totalsForManualItems(List<ManualLogItem> items) {
  double? calories;
  double? protein;
  double? carbs;
  double? fat;
  for (final item in items) {
    final macros = item.macros;
    if (macros == null) continue;
    double? add(double? sum, double? v) => v == null ? sum : (sum ?? 0) + v;
    calories = add(calories, macros.caloriesKcal);
    protein = add(protein, macros.proteinG);
    carbs = add(carbs, macros.carbohydrateG);
    fat = add(fat, macros.fatG);
  }
  return IngredientMacrosPer100g(
    caloriesKcal: calories,
    proteinG: protein,
    carbohydrateG: carbs,
    fatG: fat,
  );
}
