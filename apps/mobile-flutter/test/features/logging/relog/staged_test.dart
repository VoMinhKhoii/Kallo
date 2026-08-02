import 'package:flutter_test/flutter_test.dart';

import 'package:nham_mobile/models/relog.dart';

RelogDishCandidate _dish({
  String name = 'Phở bò',
  int order = 0,
  double? protein = 20,
  double? carbs = 60,
  double? fat = 10,
  double? calories = 410,
}) => RelogDishCandidate(
  sourceMealId: 'meal-1',
  name: name,
  occurrenceCount: 3,
  lastLoggedAt: '2026-07-01T00:00:00.000Z',
  summary: RelogMacroSummary(
    caloriesKcal: calories,
    proteinG: protein,
    carbohydrateG: carbs,
    fatG: fat,
  ),
  mealItemOrder: order,
  ingredientCount: 4,
);

void main() {
  group('toStagedEntry', () {
    test('a dish stages as a dish reference carrying its item order', () {
      final entry = toStagedEntry(_dish(order: 2), 'stage-1');
      expect(entry.ref, const RelogDishRef(
        sourceMealId: 'meal-1',
        mealItemOrder: 2,
      ));
      expect(entry.label, 'Phở bò');
      expect(entry.partCount, 4); // ingredient count
    });

    test('a meal stages as a meal reference and counts its dishes', () {
      const candidate = RelogMealCandidate(
        sourceMealId: 'meal-9',
        name: 'phở bò với trà đá',
        occurrenceCount: 1,
        lastLoggedAt: '2026-07-01T00:00:00.000Z',
        summary: RelogMacroSummary(caloriesKcal: 500),
        dishCount: 2,
      );
      final entry = toStagedEntry(candidate, 'stage-2');
      expect(entry.ref, const RelogMealRef(sourceMealId: 'meal-9'));
      expect(entry.partCount, 2);
    });

    test('the reference carries no nutrition — only a pointer', () {
      final json = toStagedEntry(_dish(), 'stage-1').ref.toJson();
      expect(json.keys.toSet(), {'kind', 'sourceMealId', 'mealItemOrder'});
    });
  });

  group('sumStagedMacros', () {
    test('sums across several picks', () {
      final totals = sumStagedMacros([
        toStagedEntry(_dish(), 'a'),
        toStagedEntry(_dish(protein: 5, carbs: 15, fat: 2, calories: 100), 'b'),
      ]);
      expect(totals.proteinG, 25);
      expect(totals.carbohydrateG, 75);
      expect(totals.fatG, 12);
      expect(totals.caloriesKcal, 510);
    });

    test('an empty list totals to unknown, not zero', () {
      final totals = sumStagedMacros([]);
      expect(totals.caloriesKcal, isNull);
      expect(totals.proteinG, isNull);
    });

    test('a nutrient no entry carries stays null rather than becoming 0', () {
      final totals = sumStagedMacros([
        toStagedEntry(_dish(fat: null), 'a'),
        toStagedEntry(_dish(fat: null), 'b'),
      ]);
      expect(totals.fatG, isNull);
      expect(totals.proteinG, 40, reason: 'known nutrients still sum');
    });

    test('a null on ONE entry does not wipe the others', () {
      final totals = sumStagedMacros([
        toStagedEntry(_dish(fat: null), 'a'),
        toStagedEntry(_dish(fat: 7), 'b'),
      ]);
      expect(totals.fatG, 7);
    });
  });

  test('the staged cap mirrors the server contract', () {
    expect(kRelogMaxStaged, 20);
  });
}
