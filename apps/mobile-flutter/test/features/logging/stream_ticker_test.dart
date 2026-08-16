import 'package:flutter_test/flutter_test.dart';
import 'package:nham_mobile/features/logging/data/stream_analysis_controller.dart';
import 'package:nham_mobile/features/logging/logic/feed/stream_ticker.dart';
import 'package:nham_mobile/models/meal.dart';
import 'package:nham_mobile/models/streaming.dart';

MealItem _item(String id, String name, double calories) => MealItem(
  id: id,
  name: name,
  quantity: 1,
  unit: 'serving',
  macros: MacroBreakdown(calories: calories, protein: 0, carbs: 0, fat: 0),
);

StreamAnalysisState _state({
  StreamStatus status = StreamStatus.decomposing,
  List<String> items = const [],
  List<MealItem> completed = const [],
  bool isAnalyzing = true,
}) => StreamAnalysisState(
  status: status,
  items: items,
  completedItems: completed,
  isAnalyzing: isAnalyzing,
);

void main() {
  group('deriveStreamTicker', () {
    test('is null when nothing is in flight', () {
      expect(deriveStreamTicker(StreamAnalysisState.initial), isNull);
      expect(deriveStreamTicker(_state(isAnalyzing: false)), isNull);
    });

    test('falls back to the stage label before any dish is known', () {
      final frame = deriveStreamTicker(_state(status: StreamStatus.matching));
      expect(frame, isA<PhaseFrame>());
      expect(
        (frame! as PhaseFrame).labelKey,
        'logging.streaming.matching',
      );
    });

    test('unmapped statuses fall back to the generic analyzing label', () {
      for (final status in [StreamStatus.authenticating, StreamStatus.idle]) {
        final frame = deriveStreamTicker(_state(status: status))! as PhaseFrame;
        expect(frame.labelKey, 'logging.streaming.analyzing');
      }
    });

    test('shows the latest detected name once one arrives', () {
      final frame = deriveStreamTicker(
        _state(items: ['Phở bò', 'Rau thơm']),
      );
      expect(frame, isA<ItemFrame>());
      expect((frame! as ItemFrame).name, 'Rau thơm');
    });

    test('a resolved dish outranks a merely detected one', () {
      final frame = deriveStreamTicker(
        _state(
          items: ['Phở bò', 'Rau thơm'],
          completed: [_item('a', 'Phở bò', 480)],
        ),
      );
      expect(frame, isA<MacrosFrame>());
      final macros = frame! as MacrosFrame;
      expect(macros.name, 'Phở bò');
      expect(macros.calories, 480);
    });

    test('rounds calories to whole kcal', () {
      final frame =
          deriveStreamTicker(_state(completed: [_item('a', 'Chè', 480.6)]))!
              as MacrosFrame;
      expect(frame.calories, 481);
    });

    test('assembling stops advertising dishes and says what it is doing', () {
      final frame = deriveStreamTicker(
        _state(
          status: StreamStatus.assembling,
          items: ['Phở bò'],
          completed: [_item('a', 'Phở bò', 480)],
        ),
      );
      expect(frame, isA<PhaseFrame>());
      expect(
        (frame! as PhaseFrame).labelKey,
        'logging.streaming.assembling',
      );
    });
  });

  group('frame keys', () {
    // The key drives the flip. A key that churned across identical states would
    // re-flip the line on every rebuild; one that failed to change would leave
    // stale text on screen.
    test('are stable across identical states', () {
      final state = _state(completed: [_item('a', 'Phở bò', 480)]);
      expect(
        deriveStreamTicker(state)!.key,
        deriveStreamTicker(state)!.key,
      );
    });

    test('change when a new dish resolves', () {
      final first = deriveStreamTicker(
        _state(completed: [_item('a', 'Phở bò', 480)]),
      )!;
      final second = deriveStreamTicker(
        _state(completed: [_item('a', 'Phở bò', 480), _item('b', 'Chè', 210)]),
      )!;
      expect(first.key, isNot(second.key));
    });

    test('change when a second dish of the SAME name is detected', () {
      final first = deriveStreamTicker(_state(items: ['Chè']))!;
      final second = deriveStreamTicker(_state(items: ['Chè', 'Chè']))!;
      expect(first.key, isNot(second.key));
    });

    test('track the stage while no dish is known', () {
      expect(
        deriveStreamTicker(_state(status: StreamStatus.connecting))!.key,
        isNot(deriveStreamTicker(_state(status: StreamStatus.matching))!.key),
      );
    });
  });
}
