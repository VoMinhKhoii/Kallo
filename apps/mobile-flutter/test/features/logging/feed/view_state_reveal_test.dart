import 'package:flutter_test/flutter_test.dart';
import 'package:nham_mobile/features/logging/data/logging_models.dart';
import 'package:nham_mobile/features/logging/data/stream_analysis_controller.dart';
import 'package:nham_mobile/features/logging/logic/feed/feed_entries.dart';
import 'package:nham_mobile/features/logging/logic/feed/view_state.dart';
import 'package:nham_mobile/models/meal.dart';
import 'package:nham_mobile/models/streaming.dart';

const _date = '2026-08-11';

const _parsed = ParsedMeal(
  mealName: 'Phở bò',
  totalMacros: MacroBreakdown(calories: 480, protein: 30, carbs: 50, fat: 12),
  items: [
    MealItem(
      id: 'i1',
      name: 'Phở bò',
      quantity: 1,
      unit: 'bát',
      macros: MacroBreakdown(calories: 480, protein: 30, carbs: 50, fat: 12),
    ),
  ],
);

const _staged = PendingMealConfirmation(
  id: 'a1',
  rawInput: 'phở bò',
  loggedAt: '2026-08-11T12:15:00.000Z',
  parsedMeal: _parsed,
);

const _profile = LoggingProfile(
  userId: 'u1',
  calorieTarget: 2000,
  proteinTargetG: 150,
  carbsTargetG: 200,
  fatTargetG: 60,
);

FeedViewState _view({
  required StreamAnalysisState stream,
  List<PendingMealConfirmation> pending = const [],
}) => FeedViewState.from(
  day: LoggingDayData(persistedMeals: const [], pendingConfirmations: pending),
  dayIsLoading: false,
  dayHasError: false,
  stream: stream,
  profile: _profile,
  date: _date,
  pendingRemovalIds: const {},
  hasFailedAttempt: false,
);

void main() {
  group('a revealed answer and its own staged row are one meal', () {
    test('the staged row is hidden while the reveal is up', () {
      final view = _view(
        pending: const [_staged],
        stream: const StreamAnalysisState(
          status: StreamStatus.done,
          result: _parsed,
          analysisId: 'a1',
          loggedDate: _date,
        ),
      );

      // The day is refreshed the moment an analysis is staged, so both exist
      // at once. Rendering both would show the same meal twice.
      expect(view.isRevealing, isTrue);
      expect(view.pendingConfirmations, isEmpty);
    });

    test('the staged row carries the card once the stream is gone', () {
      // What a hot reload leaves behind: Riverpod re-runs Notifier.build, so
      // the stream is back to idle — but the meal is still staged, and the
      // refresh at reveal time means the day cache now holds it.
      final view = _view(
        pending: const [_staged],
        stream: StreamAnalysisState.initial,
      );

      expect(view.isRevealing, isFalse);
      expect(view.isStreaming, isFalse);
      expect(view.pendingConfirmations, hasLength(1));
      expect(view.pendingConfirmations.single.id, 'a1');
      // And the day is not mistaken for an empty one — the staged row is a
      // card in the list, even though nothing is live below it.
      expect(view.isEmpty, isFalse);
      expect(view.hasLiveTail, isFalse);
      expect(view.entries.single, isA<StagedEntry>());
    });

    test('another meal staged alongside the reveal still shows', () {
      const other = PendingMealConfirmation(
        id: 'a2',
        rawInput: 'cơm gà',
        loggedAt: '2026-08-11T12:30:00.000Z',
        parsedMeal: _parsed,
      );
      final view = _view(
        pending: const [_staged, other],
        stream: const StreamAnalysisState(
          status: StreamStatus.done,
          result: _parsed,
          analysisId: 'a1',
          loggedDate: _date,
        ),
      );

      // Only the reveal's OWN row is folded away.
      expect(view.pendingConfirmations, hasLength(1));
      expect(view.pendingConfirmations.single.id, 'a2');
    });

    test('a still-streaming run hides nothing — it has no id yet', () {
      final view = _view(
        pending: const [_staged],
        stream: const StreamAnalysisState(
          status: StreamStatus.estimating,
          isAnalyzing: true,
          loggedDate: _date,
        ),
      );

      expect(view.isStreaming, isTrue);
      expect(view.pendingConfirmations, hasLength(1));
    });
  });

  group('the day reads down in the order things happened', () {
    test('staged meals come back oldest first, not newest first', () {
      // The server hands these back ORDER BY logged_at DESC.
      const later = PendingMealConfirmation(
        id: 'a2',
        rawInput: 'cơm gà',
        loggedAt: '2026-08-11T13:30:00.000Z',
        parsedMeal: _parsed,
      );
      const earlier = PendingMealConfirmation(
        id: 'a1',
        rawInput: 'phở bò',
        loggedAt: '2026-08-11T12:15:00.000Z',
        parsedMeal: _parsed,
      );

      final view = _view(
        pending: const [later, earlier],
        stream: StreamAnalysisState.initial,
      );

      expect(
        view.pendingConfirmations.map((p) => p.id),
        ['a1', 'a2'],
        reason: 'two unconfirmed meals must not read backwards',
      );
    });
  });
}
