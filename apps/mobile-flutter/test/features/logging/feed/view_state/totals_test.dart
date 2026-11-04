import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/logging/data/logging_models.dart';
import 'package:kallo_mobile/features/logging/data/stream_analysis_controller.dart';
import 'package:kallo_mobile/features/logging/logic/feed/view_state.dart';

const _profile = LoggingProfile(
  userId: 'u1',
  calorieTarget: 2000,
  proteinTargetG: 150,
  carbsTargetG: 200,
  fatTargetG: 60,
);

PersistedMeal _meal(String id, MealNutrition nutrition) => PersistedMeal(
  id: id,
  rawInput: id,
  loggedAt: '2026-08-10T12:00:00.000Z',
  nutrition: nutrition,
  mealItemGroups: const [],
);

FeedViewState _view(List<PersistedMeal> meals) => FeedViewState.from(
  day: LoggingDayData(persistedMeals: meals, pendingConfirmations: const []),
  dayIsLoading: false,
  dayHasError: false,
  stream: StreamAnalysisState.initial,
  profile: _profile,
  // A past day, so the partial-day notice is in play.
  date: '2026-08-10',
  pendingRemovalIds: const {},
  hasFailedAttempt: false,
);

const _pho = MealNutrition(
  caloriesKcal: 450,
  proteinG: 30,
  carbohydrateG: 50,
  fatG: 12,
);

void main() {
  test('a meal with blanks still adds what it knows', () {
    // The barcode tea that listed only carbs: protein and fat unknown.
    final view = _view([
      _meal('pho', _pho),
      _meal('tea', const MealNutrition(caloriesKcal: 119, carbohydrateG: 30)),
    ]);

    expect(view.dailyCalories, 569);
    expect(view.dailyProtein, 30);
    expect(view.dailyCarbs, 80);
    expect(view.incompleteTotals, {'protein', 'fat'});
  });

  test('a complete day has no incomplete totals', () {
    expect(_view([_meal('pho', _pho)]).incompleteTotals, isEmpty);
  });

  test('an unknown calorie total keeps the partial-day notice down', () {
    // 450 kcal on a past day reads as under-logged — unless a meal's calories
    // are unknown, when the low total may just be the gap.
    final known = _view([_meal('pho', _pho)]);
    final gap = _view([
      _meal('pho', _pho),
      _meal('mystery', const MealNutrition(proteinG: 5)),
    ]);

    expect(known.showPartialDayNotice, isTrue);
    expect(gap.incompleteTotals, contains('calories'));
    expect(gap.showPartialDayNotice, isFalse);
  });
}
