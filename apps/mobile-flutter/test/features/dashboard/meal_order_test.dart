import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/dashboard/data/logging_day.dart';
import 'package:kallo_mobile/features/dashboard/logic/meal_order.dart';

PersistedMeal _meal(String id, String loggedAt) => PersistedMeal(
      id: id,
      rawInput: id,
      loggedAt: loggedAt,
      nutrition: const MealNutrition(),
    );

void main() {
  group('mealsNewestFirst', () {
    test('puts the most recently logged meal first', () {
      final meals = [
        _meal('breakfast', '2026-09-05T07:10:00Z'),
        _meal('dinner', '2026-09-05T19:40:00Z'),
        _meal('lunch', '2026-09-05T12:25:00Z'),
      ];

      expect(
        mealsNewestFirst(meals).map((m) => m.id),
        ['dinner', 'lunch', 'breakfast'],
      );
    });

    test('does not mutate the list it was given', () {
      final meals = [
        _meal('first', '2026-09-05T07:10:00Z'),
        _meal('second', '2026-09-05T19:40:00Z'),
      ];

      mealsNewestFirst(meals);

      expect(meals.map((m) => m.id), ['first', 'second']);
    });

    test('handles an empty day', () {
      expect(mealsNewestFirst(const []), isEmpty);
    });
  });
}
