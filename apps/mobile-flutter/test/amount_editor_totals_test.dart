import 'package:flutter_test/flutter_test.dart';
import 'package:nham_mobile/features/logging/data/logging_models.dart';
import 'package:nham_mobile/features/logging/logic/amount_editor_totals.dart';

PersistedIngredient ing(
  String id, {
  double? grams,
  double? kcal,
  double? p,
  double? c,
  double? f,
}) =>
    PersistedIngredient(
      id: id,
      ingredientName: id,
      estimatedGrams: grams,
      userFacingUnit: 'g',
      nutrition: MealNutrition(
        caloriesKcal: kcal,
        proteinG: p,
        carbohydrateG: c,
        fatG: f,
      ),
    );

EditableIngredientRow row(String id, {double? grams, bool removed = false}) =>
    EditableIngredientRow(id: id, grams: grams, removed: removed);

void main() {
  group('computeEditedTotals', () {
    test('unchanged grams pass macros through at scale 1', () {
      final ingredients = [
        ing('a', grams: 100, kcal: 200, p: 10, c: 20, f: 5),
      ];
      final totals =
          computeEditedTotals(ingredients, [row('a', grams: 100)]);
      expect(totals.caloriesKcal, 200);
      expect(totals.proteinG, 10);
      expect(totals.carbohydrateG, 20);
      expect(totals.fatG, 5);
    });

    test('scales each field by editedGrams / estimatedGrams', () {
      final ingredients = [
        ing('a', grams: 100, kcal: 200, p: 10, c: 20, f: 5),
      ];
      // Doubled grams → doubled macros.
      final totals =
          computeEditedTotals(ingredients, [row('a', grams: 200)]);
      expect(totals.caloriesKcal, 400);
      expect(totals.proteinG, 20);
      expect(totals.carbohydrateG, 40);
      expect(totals.fatG, 10);
    });

    test('sums scaled contributions across ingredients', () {
      final ingredients = [
        ing('a', grams: 100, kcal: 100, p: 10, c: 0, f: 0),
        ing('b', grams: 50, kcal: 50, p: 0, c: 5, f: 2),
      ];
      final totals = computeEditedTotals(ingredients, [
        row('a', grams: 150), // 1.5x → 150 kcal, 15 p
        row('b', grams: 50), // 1x → 50 kcal, 5 c, 2 f
      ]);
      expect(totals.caloriesKcal, 200);
      expect(totals.proteinG, 15);
      expect(totals.carbohydrateG, 5);
      expect(totals.fatG, 2);
    });

    test('removed rows contribute nothing', () {
      final ingredients = [
        ing('a', grams: 100, kcal: 100, p: 10, c: 20, f: 5),
        ing('b', grams: 100, kcal: 300, p: 30, c: 40, f: 15),
      ];
      final totals = computeEditedTotals(ingredients, [
        row('a', grams: 100),
        row('b', grams: 100, removed: true),
      ]);
      expect(totals.caloriesKcal, 100);
      expect(totals.proteinG, 10);
      expect(totals.carbohydrateG, 20);
      expect(totals.fatG, 5);
    });

    test('a field is null only when NO remaining ingredient has it', () {
      final ingredients = [
        ing('a', grams: 100, kcal: 100, p: 10, c: null, f: 2),
        ing('b', grams: 100, kcal: 50, p: null, c: null, f: 3),
      ];
      final totals = computeEditedTotals(ingredients, [
        row('a', grams: 100),
        row('b', grams: 100),
      ]);
      // calories: both have it → summed.
      expect(totals.caloriesKcal, 150);
      // protein: only a has it → a's value.
      expect(totals.proteinG, 10);
      // carbs: neither has it → null (renders N/A).
      expect(totals.carbohydrateG, isNull);
      // fat: both have it → summed.
      expect(totals.fatG, 5);
    });

    test('null or zero estimatedGrams falls back to scale 1', () {
      final ingredients = [
        ing('a', grams: null, kcal: 80, p: 4, c: 8, f: 1),
        ing('b', grams: 0, kcal: 20, p: 1, c: 2, f: 0),
      ];
      // Even with a non-null edited grams, missing/zero base means no scaling.
      final totals = computeEditedTotals(ingredients, [
        row('a', grams: 250),
        row('b', grams: 250),
      ]);
      expect(totals.caloriesKcal, 100);
      expect(totals.proteinG, 5);
      expect(totals.carbohydrateG, 10);
      expect(totals.fatG, 1);
    });

    test('every field null when the only rows are removed', () {
      final ingredients = [
        ing('a', grams: 100, kcal: 100, p: 10, c: 20, f: 5),
      ];
      final totals =
          computeEditedTotals(ingredients, [row('a', grams: 100, removed: true)]);
      expect(totals.caloriesKcal, isNull);
      expect(totals.proteinG, isNull);
      expect(totals.carbohydrateG, isNull);
      expect(totals.fatG, isNull);
    });
  });
}
