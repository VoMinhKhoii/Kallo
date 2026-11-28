import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/logging/data/logging_models.dart';
import 'package:kallo_mobile/features/logging/logic/days/this_week.dart';

PersistedMeal _meal(String text, String at, {double? kcal, double? protein}) =>
    PersistedMeal(
      id: text,
      rawInput: text,
      loggedAt: at,
      nutrition: MealNutrition(
        caloriesKcal: kcal,
        proteinG: protein,
        carbohydrateG: kcal == null ? null : 10,
        fatG: kcal == null ? null : 5,
      ),
      mealItemGroups: const [],
    );

void main() {
  group('thisWeekDays', () {
    test('runs from today back to Monday, newest first', () {
      // 2026-11-18 is a Wednesday.
      expect(thisWeekDays('2026-11-18'), [
        '2026-11-18',
        '2026-11-17',
        '2026-11-16',
      ]);
    });

    test('is today alone on a Monday', () {
      expect(thisWeekDays('2026-11-16'), ['2026-11-16']);
    });

    test('is the whole week on a Sunday', () {
      expect(thisWeekDays('2026-11-22'), hasLength(7));
      expect(thisWeekDays('2026-11-22').last, '2026-11-16');
    });

    test('crosses into the month before', () {
      // 2026-12-02 is a Wednesday; its Monday is Nov 30.
      expect(thisWeekDays('2026-12-02'), [
        '2026-12-02',
        '2026-12-01',
        '2026-11-30',
      ]);
    });

    test('crosses into the year before', () {
      // 2027-01-01 is a Friday; its Monday is 2026-12-28.
      final week = thisWeekDays('2027-01-01');
      expect(week.first, '2027-01-01');
      expect(week.last, '2026-12-28');
      expect(week, hasLength(5));
    });
  });

  group('DayTotals', () {
    test('sums the saved meals', () {
      final totals = DayTotals.of(
        LoggingDayData(
          persistedMeals: [
            _meal(
              'grilled salmon',
              '2026-11-18T19:00:00',
              kcal: 620,
              protein: 39,
            ),
            _meal(
              'oats with berries',
              '2026-11-18T08:00:00',
              kcal: 340,
              protein: 12,
            ),
          ],
          pendingConfirmations: const [],
        ),
      );
      expect(totals.kcal, 960);
      expect(totals.protein, 51);
      expect(totals.carbs, 20);
      expect(totals.empty, isFalse);
    });

    test('a meal waiting out its undo is not counted', () {
      final day = LoggingDayData(
        persistedMeals: [
          _meal('oats with berries', '2026-11-18T08:00:00', kcal: 420),
          _meal('lentil soup', '2026-11-18T12:30:00', kcal: 380),
        ],
        pendingConfirmations: const [],
      );
      final totals = DayTotals.of(day, held: {'lentil soup'});
      expect(totals.kcal, 420);
      // The only meal held: the day reads as empty, as the feed shows it.
      final none = DayTotals.of(
        day,
        held: {'oats with berries', 'lentil soup'},
      );
      expect(none.empty, isTrue);
      expect(none.kcal, isNull);
    });

    test('a missing macro stays unknown rather than reading as zero', () {
      final totals = DayTotals.of(
        LoggingDayData(
          persistedMeals: [_meal('tea', '2026-11-18T08:00:00')],
          pendingConfirmations: const [],
        ),
      );
      expect(totals.kcal, isNull);
      expect(totals.protein, isNull);
      expect(totals.empty, isFalse);
    });

    test('a day with no saved meals is empty', () {
      final totals = DayTotals.of(
        const LoggingDayData(persistedMeals: [], pendingConfirmations: []),
      );
      expect(totals.empty, isTrue);
    });
  });
}
