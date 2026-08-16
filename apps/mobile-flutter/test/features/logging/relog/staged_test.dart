import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/models/relog.dart';

RelogDishCandidate _dish({String name = 'Phở bò', int order = 0}) =>
    RelogDishCandidate(
      sourceMealId: 'meal-1',
      name: name,
      occurrenceCount: 3,
      lastLoggedAt: '2026-07-01T00:00:00.000Z',
      summary: const RelogMacroSummary(caloriesKcal: 410, proteinG: 20),
      mealItemOrder: order,
      ingredientCount: 4,
    );

void main() {
  group('a candidate\'s reference', () {
    test('a dish points at its item order within the source meal', () {
      expect(
        _dish(order: 2).ref,
        const RelogDishRef(sourceMealId: 'meal-1', mealItemOrder: 2),
      );
    });

    test('a meal points at the whole meal', () {
      const candidate = RelogMealCandidate(
        sourceMealId: 'meal-9',
        name: 'phở bò với trà đá',
        occurrenceCount: 1,
        lastLoggedAt: '2026-07-01T00:00:00.000Z',
        summary: RelogMacroSummary(caloriesKcal: 500),
        dishCount: 2,
      );
      expect(candidate.ref, const RelogMealRef(sourceMealId: 'meal-9'));
    });

    test('carries no nutrition — only a pointer', () {
      // What the composer stages is this and nothing else: the server
      // re-resolves the numbers when it copies the rows, so nothing cached
      // client-side can drift into a save.
      expect(_dish().ref.toJson().keys.toSet(), {
        'kind',
        'sourceMealId',
        'mealItemOrder',
      });
      // The MEAL reference too — it is the one that stages a whole entry, so a
      // cached macro added there would travel furthest before anyone noticed.
      expect(const RelogMealRef(sourceMealId: 'meal-9').toJson().keys.toSet(), {
        'kind',
        'sourceMealId',
      });
    });
  });

  test('a staged entry is a label over a reference, and nothing else', () {
    const entry = RelogStagedEntry(
      stageId: 's',
      ref: RelogMealRef(sourceMealId: 'meal-1'),
      label: '/Phở bò',
    );
    expect(entry.label, '/Phở bò', reason: 'the slash is part of the token');
    expect(entry.ref, const RelogMealRef(sourceMealId: 'meal-1'));
  });

  test('the staged cap mirrors the server contract', () {
    expect(kRelogMaxStaged, 20);
  });
}
