/// Live macro totals for the saved-meal amount editor — the Dart port of the
/// web's `components/logging/feed/persisted/amount-editor-totals.ts`. The scaling
/// and null-field semantics must match the web exactly so the on-screen total
/// agrees with the server's recomputed meal after a save.
library;

import '../data/logging_models.dart';

/// One editable ingredient row's mutable state: its current grams (null for a
/// legacy row that has no recorded amount) and whether it's flagged for removal.
class EditableIngredientRow {
  const EditableIngredientRow({
    required this.id,
    required this.grams,
    required this.removed,
  });

  final String id;
  final double? grams;
  final bool removed;

  EditableIngredientRow copyWith({double? grams, bool? removed}) =>
      EditableIngredientRow(
        id: id,
        grams: grams ?? this.grams,
        removed: removed ?? this.removed,
      );
}

/// The four display macros, each null when no remaining ingredient carries it.
class EditedTotals {
  const EditedTotals({
    required this.caloriesKcal,
    required this.proteinG,
    required this.carbohydrateG,
    required this.fatG,
  });

  final double? caloriesKcal;
  final double? proteinG;
  final double? carbohydrateG;
  final double? fatG;
}

/// Each remaining row's ingredient nutrition scaled by its edited grams, summed.
/// A field is null (renders N/A) only when NO contributing ingredient has a
/// value for it — matching `computeEditedTotals` on the web.
EditedTotals computeEditedTotals(
  List<PersistedIngredient> ingredients,
  List<EditableIngredientRow> rows,
) {
  final byId = {for (final ing in ingredients) ing.id: ing};

  var calories = 0.0, protein = 0.0, carbs = 0.0, fat = 0.0;
  var hasCalories = false, hasProtein = false, hasCarbs = false, hasFat = false;

  for (final row in rows) {
    if (row.removed) continue;
    final ing = byId[row.id];
    if (ing == null) continue;
    final base = ing.estimatedGrams;
    final scale = (row.grams == null || base == null || base == 0)
        ? 1.0
        : row.grams! / base;
    final n = ing.nutrition;
    if (n.caloriesKcal != null) {
      calories += n.caloriesKcal! * scale;
      hasCalories = true;
    }
    if (n.proteinG != null) {
      protein += n.proteinG! * scale;
      hasProtein = true;
    }
    if (n.carbohydrateG != null) {
      carbs += n.carbohydrateG! * scale;
      hasCarbs = true;
    }
    if (n.fatG != null) {
      fat += n.fatG! * scale;
      hasFat = true;
    }
  }

  return EditedTotals(
    caloriesKcal: hasCalories ? calories : null,
    proteinG: hasProtein ? protein : null,
    carbohydrateG: hasCarbs ? carbs : null,
    fatG: hasFat ? fat : null,
  );
}
