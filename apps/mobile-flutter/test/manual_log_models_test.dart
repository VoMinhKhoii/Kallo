import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/models/ingredient.dart';

void main() {
  group('IngredientSearchResult.fromJson', () {
    test('parses the search endpoint payload', () {
      final result = IngredientSearchResult.fromJson(const {
        'id': 'fct-rice',
        'namePrimary': 'Cơm trắng',
        'nameEn': 'White rice',
        'nameAlt': ['cơm'],
        'state': 'cooked',
        'similarity': 0.92,
        'per100g': {
          'caloriesKcal': 130,
          'proteinG': 2.7,
          'carbohydrateG': 28,
          'fatG': null,
        },
      });

      expect(result.id, 'fct-rice');
      expect(result.namePrimary, 'Cơm trắng');
      expect(result.nameEn, 'White rice');
      expect(result.state, 'cooked');
      expect(result.per100g.caloriesKcal, 130);
      expect(result.per100g.proteinG, 2.7);
      expect(result.per100g.fatG, isNull);
    });

    test('tolerates missing optional fields', () {
      final result = IngredientSearchResult.fromJson(const {
        'id': 'x',
        'namePrimary': 'Gạo',
        'nameEn': null,
      });
      expect(result.nameEn, isNull);
      expect(result.state, 'raw');
      expect(result.per100g.caloriesKcal, isNull);
    });
  });

  group('scaledTo', () {
    test('scales per-100g macros by grams/100, preserving nulls', () {
      const per100g = IngredientMacrosPer100g(
        caloriesKcal: 130,
        proteinG: 2.7,
        carbohydrateG: 28,
      );
      final scaled = per100g.scaledTo(150);
      expect(scaled.caloriesKcal, closeTo(195, 1e-9));
      expect(scaled.proteinG, closeTo(4.05, 1e-9));
      expect(scaled.carbohydrateG, closeTo(42, 1e-9));
      expect(scaled.fatG, isNull);
    });
  });

  group('ManualLogItem', () {
    const rice = IngredientSearchResult(
      id: 'fct-rice',
      namePrimary: 'Cơm trắng',
      nameEn: 'White rice',
      state: 'cooked',
      per100g: IngredientMacrosPer100g(caloriesKcal: 130, proteinG: 2.7),
    );

    test('isComplete requires positive finite grams', () {
      expect(
        const ManualLogItem(id: '1', ingredient: rice, grams: 100).isComplete,
        isTrue,
      );
      expect(
        const ManualLogItem(id: '1', ingredient: rice, grams: null).isComplete,
        isFalse,
      );
      expect(
        const ManualLogItem(id: '1', ingredient: rice, grams: 0).isComplete,
        isFalse,
      );
      expect(
        const ManualLogItem(
          id: '1',
          ingredient: rice,
          grams: double.nan,
        ).isComplete,
        isFalse,
      );
    });

    test('totalsForManualItems sums complete items only', () {
      const chicken = IngredientSearchResult(
        id: 'fct-chicken',
        namePrimary: 'Thịt gà ta',
        nameEn: 'Chicken meat',
        state: 'raw',
        per100g: IngredientMacrosPer100g(
          caloriesKcal: 200,
          proteinG: 20,
          fatG: 13,
        ),
      );
      final totals = totalsForManualItems(const [
        ManualLogItem(id: '1', ingredient: rice, grams: 100),
        ManualLogItem(id: '2', ingredient: chicken, grams: 50),
        ManualLogItem(id: '3', ingredient: rice, grams: null), // incomplete
      ]);
      expect(totals.caloriesKcal, closeTo(230, 1e-9));
      expect(totals.proteinG, closeTo(12.7, 1e-9));
      // fat known only for chicken — known values still sum.
      expect(totals.fatG, closeTo(6.5, 1e-9));
      // carbs unknown everywhere → null, never a false zero.
      expect(totals.carbohydrateG, isNull);
    });
  });
}
