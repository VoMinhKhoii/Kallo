import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/models/nutrition/ingredient.dart';
import 'package:kallo_mobile/models/nutrition/vessel.dart';

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

    test('reads the card display fields and vessel hint', () {
      final chicken = IngredientSearchResult.fromJson(const {
        'id': 'a',
        'namePrimary': 'Ức gà',
        'nameEn': 'Chicken, breast, meat only, raw',
        'state': 'raw',
        'displayNameEn': 'Skinless chicken breast',
        'stateLabel': 'raw',
        'brand': null,
        'vessel': {'family': 'piece', 'kind': 'poultry'},
      });
      expect(chicken.englishName, 'Skinless chicken breast');
      expect(chicken.stateLabel, 'raw');
      // Pieces open at the everyday medium cut, one of them.
      final piece = chicken.vessel as PieceVessel;
      expect((piece.kind, piece.tier, piece.count), (PieceKind.poultry, 3, 1));

      final milk = IngredientSearchResult.fromJson(const {
        'id': 'b',
        'namePrimary': 'Sữa bò tươi',
        'nameEn': 'Milk',
        'vessel': {'family': 'cup', 'dishClass': 'drink'},
      });
      final cup = milk.vessel as ContainerVessel;
      expect(
        (cup.family, cup.tier, cup.dishClass),
        (ContainerFamily.cup, 2, DishClass.drink),
      );
      // No card name: the table's English name stands in.
      expect(milk.englishName, 'Milk');

      // Rice opens at a chén, not a medium bowl; soup at a medium bowl.
      ContainerVessel bowl(String dishClass) =>
          vesselFromHint({'family': 'bowl', 'dishClass': dishClass})!
              as ContainerVessel;
      expect(bowl('solid').tier, 1);
      expect(bowl('soup').tier, 2);
    });

    test('degrades unknown or malformed hints to nothing, never throws', () {
      IngredientSearchResult parse(Object? vessel, Object? stateLabel) =>
          IngredientSearchResult.fromJson({
            'id': 'x',
            'namePrimary': 'Cá hộp',
            'nameEn': '  ',
            'state': 'raw',
            'stateLabel': stateLabel,
            'vessel': vessel,
          });
      expect(
        parse({'family': 'tray', 'dishClass': 'solid'}, null).vessel,
        isNull,
      );
      expect(parse({'family': 'piece', 'kind': 'tofu'}, null).vessel, isNull);
      expect(parse('bowl', null).vessel, isNull);
      // A table default of 'raw' is not a state the card claimed.
      expect(parse(null, null).stateLabel, isNull);
      expect(parse(null, 'fried').stateLabel, isNull);
      // A blank English name is no name.
      expect(parse(null, null).englishName, isNull);
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
