import 'dart:ui';

import 'package:easy_localization/easy_localization.dart';
// `Localization` and `Translations` are not on the umbrella export.
import 'package:easy_localization/src/localization.dart';
import 'package:easy_localization/src/translations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:kallo_mobile/features/logging/data/logging_models.dart';
import 'package:kallo_mobile/features/today_widget/logic/today_widget_snapshot.dart';

import '../../l10n_test_loader.dart';

TodayWidgetMeal _meal(
  String id,
  String loggedAt, {
  String text = 'phở bò',
  double? kcal = 400,
  double? protein = 20,
  double? carbs = 50,
  double? fat = 10,
}) => (
  loggedAt: loggedAt,
  rawInput: text,
  kcal: kcal,
  protein: protein,
  carbs: carbs,
  fat: fat,
);

const _profile = LoggingProfile(
  userId: 'u1',
  calorieTarget: 1932,
  proteinTargetG: 145,
  carbsTargetG: 169,
  fatTargetG: 75,
);

Future<void> _load(String code) async {
  final locale = Locale(code);
  final map = await const FsL10nLoader().load('assets/l10n', locale);
  Localization.load(locale, translations: Translations(map));
  await initializeDateFormatting(code, null);
}

void main() {
  setUpAll(() => _load('en'));

  Map<String, Object?> build(
    List<TodayWidgetMeal> meals, {
    String locale = 'en',
  }) => todayWidgetSnapshot(
    date: '2026-11-04',
    locale: locale,
    profile: _profile,
    meals: meals,
    tr: tr,
  );

  test('totals are the saved meals, rounded once like the dials', () {
    final snapshot = build([
      _meal('a', '2026-11-04T01:12:00Z', kcal: 380.4, protein: 16.4),
      _meal('b', '2026-11-04T02:40:00Z', kcal: 89.8, protein: 0.4),
    ]);
    expect(snapshot['eaten'], {
      'kcal': 470,
      'protein': 17,
      'carbs': 100,
      'fat': 20,
    });
    expect(snapshot['target'], {
      'kcal': 1932,
      'protein': 145,
      'carbs': 169,
      'fat': 75,
    });
    expect(snapshot['floors'], isEmpty);
    expect(snapshot['signedIn'], isTrue);
  });

  test('an unknown value counts what is known and marks a floor', () {
    final snapshot = build([
      _meal('a', '2026-11-04T01:00:00Z'),
      _meal('b', '2026-11-04T02:00:00Z', kcal: null, fat: null),
    ]);
    expect((snapshot['eaten']! as Map)['kcal'], 400);
    expect(snapshot['floors'], ['kcal', 'fat']);
    // The meal itself says so in the app's own words, never as 0 kcal.
    final meals = snapshot['meals']! as List;
    expect((meals[1] as Map)['kcal'], 'N/A');
  });

  test('meals run oldest first, in the locale time and grouping', () {
    final first = DateTime(2026, 11, 4, 8, 12).toUtc().toIso8601String();
    final second = DateTime(2026, 11, 4, 12, 40).toUtc().toIso8601String();
    final snapshot = build([
      _meal('late', second, text: 'chicken rice bowl', kcal: 1863),
      _meal('early', first, text: 'Oats with banana', kcal: 380),
    ]);
    expect(snapshot['meals'], [
      {'time': '8:12\u202fAM', 'text': 'Oats with banana', 'kcal': '380 kcal'},
      // Capitalised at render, as MealBlock does; the raw input stays intact.
      {
        'time': '12:40\u202fPM',
        'text': 'Chicken rice bowl',
        'kcal': '1,863 kcal',
      },
    ]);
  });

  test(
    'Vietnamese: the time and the grouping follow the app language',
    () async {
      await _load('vi');
      addTearDown(() => _load('en'));
      final at = DateTime(2026, 11, 4, 8, 12).toUtc().toIso8601String();
      final snapshot = build([_meal('a', at, kcal: 1863)], locale: 'vi');
      final meal = (snapshot['meals']! as List).single as Map;
      expect(
        meal['time'],
        DateFormat.jm('vi').format(DateTime(2026, 11, 4, 8, 12)),
      );
      expect(meal['kcal'], '1.863 kcal');
      final copy = snapshot['copy']! as Map;
      expect(copy['kcalEaten'], 'Kcal đã ghi');
      expect(copy['leftOfTarget'], 'Còn {left}/{target}');
      expect(copy['fat'], 'Chất béo');
    },
  );

  test('the copy keeps its placeholders for the widget to fill', () {
    final copy = build(const [])['copy']! as Map;
    expect(copy, {
      'kcalEaten': 'Kcal eaten',
      'eatenShort': 'Eaten',
      'leftOfTarget': '{left}/{target} left',
      'overTargetBy': '{over} over {target}',
      'fraction': '{logged}/{target}',
      'protein': 'Protein',
      'carbs': 'Carbs',
      'fat': 'Fat',
      'signedOut': 'Not signed in.',
    });
  });

  test('signed out carries no day at all', () {
    final snapshot = todayWidgetSignedOut(
      date: '2026-11-04',
      locale: 'en',
      tr: tr,
    );
    expect(snapshot['signedIn'], isFalse);
    expect(snapshot['meals'], isEmpty);
    expect(snapshot['eaten'], {'kcal': 0, 'protein': 0, 'carbs': 0, 'fat': 0});
    expect(snapshot['target'], {'kcal': 0, 'protein': 0, 'carbs': 0, 'fat': 0});
    expect((snapshot['copy']! as Map)['signedOut'], 'Not signed in.');
  });
}
