import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/logging/data/logging_models.dart';
import 'package:kallo_mobile/features/logging/data/stream_analysis_controller.dart';
import 'package:kallo_mobile/features/logging/logic/feed/view_state.dart';
import 'package:kallo_mobile/shared/logic/display_format.dart';

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

const _pho = MealNutrition(
  caloriesKcal: 450,
  proteinG: 30,
  carbohydrateG: 50,
  fatG: 12,
);

FeedViewState _view({
  required String date,
  List<PersistedMeal> meals = const [],
  bool closed = false,
}) => FeedViewState.from(
  day: LoggingDayData(
    persistedMeals: meals,
    pendingConfirmations: const [],
    markedComplete: closed,
  ),
  dayIsLoading: false,
  dayHasError: false,
  stream: StreamAnalysisState.initial,
  profile: _profile,
  date: date,
  pendingRemovalIds: const {},
  hasFailedAttempt: false,
);

void main() {
  final today = todayDateString();

  test('today with a saved meal offers "I\'ve eaten enough"', () {
    final view = _view(date: today, meals: [_meal('pho', _pho)]);
    expect(view.showTodayClose, isTrue);
    expect(view.isDayClosed, isFalse);
  });

  test('an empty today, and any other day, do not', () {
    expect(_view(date: today).showTodayClose, isFalse);
    expect(
      _view(date: '2026-08-10', meals: [_meal('pho', _pho)]).showTodayClose,
      isFalse,
    );
  });

  test(
    'a meal with unknown calories holds it back, a closed day always shows',
    () {
      final gap = [
        _meal('pho', _pho),
        _meal('mystery', const MealNutrition(proteinG: 5)),
      ];
      expect(_view(date: today, meals: gap).showTodayClose, isFalse);

      final closed = _view(date: today, meals: gap, closed: true);
      expect(closed.showTodayClose, isTrue);
      expect(closed.isDayClosed, isTrue);
    },
  );
}
