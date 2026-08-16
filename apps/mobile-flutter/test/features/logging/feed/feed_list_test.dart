import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/logging/data/logging_models.dart';
import 'package:kallo_mobile/features/logging/data/stream_analysis_controller.dart';
import 'package:kallo_mobile/features/logging/logic/feed/view_state.dart';
import 'package:kallo_mobile/features/logging/widgets/feed/feed_footer.dart';
import 'package:kallo_mobile/features/logging/widgets/feed/feed_list.dart';
import 'package:kallo_mobile/features/logging/widgets/streaming/streaming_entry.dart';
import 'package:kallo_mobile/models/meal.dart';
import 'package:kallo_mobile/models/streaming.dart';

import '../../../l10n_test_loader.dart';

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

const _profile = LoggingProfile(
  userId: 'u1',
  calorieTarget: 2000,
  proteinTargetG: 150,
  carbsTargetG: 200,
  fatTargetG: 60,
);

PersistedMeal _saved(String id, String at) => PersistedMeal(
  id: id,
  rawInput: id,
  loggedAt: at,
  nutrition: const MealNutrition(
    caloriesKcal: 480,
    proteinG: 30,
    carbohydrateG: 50,
    fatG: 12,
  ),
  mealItemGroups: const [],
);

PendingMealConfirmation _staged(String id, String at) =>
    PendingMealConfirmation(
      id: id,
      rawInput: id,
      loggedAt: at,
      parsedMeal: _parsed,
    );

FeedViewState _view({
  List<PersistedMeal> saved = const [],
  List<PendingMealConfirmation> staged = const [],
  StreamAnalysisState stream = StreamAnalysisState.initial,
}) => FeedViewState.from(
  day: LoggingDayData(persistedMeals: saved, pendingConfirmations: staged),
  dayIsLoading: false,
  dayHasError: false,
  stream: stream,
  profile: _profile,
  date: _date,
  pendingRemovalIds: const {},
  hasFailedAttempt: false,
);

Widget _wrap(FeedViewState view, {Widget? footer}) => EasyLocalization(
  supportedLocales: const [Locale('en'), Locale('vi')],
  path: 'assets/l10n',
  fallbackLocale: const Locale('en'),
  assetLoader: const FsL10nLoader(),
  child: Builder(
    builder: (context) => MaterialApp(
      localizationsDelegates: context.localizationDelegates,
      supportedLocales: context.supportedLocales,
      locale: context.locale,
      home: MediaQuery(
        // The loaders tick forever; without this pumpAndSettle never returns.
        data: const MediaQueryData(disableAnimations: true),
        child: Scaffold(
          body: FeedList(
            view: view,
            dockHeight: 0,
            scrollController: ScrollController(),
            footer: footer ?? const SizedBox.shrink(),
            confirmPending: false,
            onRefresh: () async {},
            onRetryDay: () {},
            onRemoveMeal: (_) {},
            onUpdateMeal: (_, {required edits, required removeIds}) async {},
            onLogAgain: (_) async {},
            onConfirm: (_, _) {},
            onConfirmCheat: (_, _) {},
          ),
        ),
      ),
    ),
  ),
);

Widget _liveFooter(FeedViewState view, StreamAnalysisState stream) =>
    FeedFooter(
      view: view,
      stream: stream,
      streamingRawInput: 'bún chả',
      revealRawInput: null,
      confirmPending: false,
      loaderIndex: 0,
      sentAt: DateTime(2026, 8, 11, 13, 30),
      onConfirmReveal: (_, _) {},
      onConfirmCheatReveal: (_) {},
      onClarifyCheat: (_) {},
      failedText: null,
      failedRetryable: true,
      onRetry: () {},
      onDiscardFailed: () {},
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.flutter.io/shared_preferences'),
          (call) async => call.method == 'getAll' ? <String, Object>{} : null,
        );
    await EasyLocalization.ensureInitialized();
  });

  /// A tall viewport, so every card in these lists is really laid out rather
  /// than left unbuilt below the fold. Kept at the default 800 wide — a saved
  /// card's summary row overflows below that, which is a separate matter.
  void tall(WidgetTester tester) {
    tester.view.physicalSize = const Size(800, 4000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
  }

  double top(WidgetTester tester, String id) =>
      tester.getRect(find.byKey(ValueKey(id))).top;

  testWidgets('a staged meal sits at its own time, not below every saved one', (
    tester,
  ) async {
    tall(tester);
    await tester.pumpWidget(
      _wrap(
        _view(
          saved: [
            _saved('m-noon', '2026-08-11T12:00:00.000Z'),
            _saved('m-evening', '2026-08-11T18:00:00.000Z'),
          ],
          staged: [_staged('p-afternoon', '2026-08-11T15:00:00.000Z')],
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Staged meals used to render as a block BELOW every saved one, so an
    // unconfirmed lunch sat under a saved dinner.
    expect(top(tester, 'm-noon'), lessThan(top(tester, 'p-afternoon')));
    expect(top(tester, 'p-afternoon'), lessThan(top(tester, 'm-evening')));
  });

  testWidgets('saving the middle of three staged meals changes one card in place', (
    tester,
  ) async {
    tall(tester);
    final before = _view(
      staged: [
        _staged('p1', '2026-08-11T12:00:00.000Z'),
        _staged('p2', '2026-08-11T12:30:00.000Z'),
        _staged('p3', '2026-08-11T13:00:00.000Z'),
      ],
    );
    await tester.pumpWidget(_wrap(before));
    await tester.pumpAndSettle();
    final firstElement = tester.element(find.byKey(const ValueKey('p1')));
    final lastElement = tester.element(find.byKey(const ValueKey('p3')));

    // What the confirm refetch returns: p2 is now a saved meal, and it kept
    // the analysis's timestamp (confirm-and-save.ts reads `pending.loggedAt`).
    await tester.pumpWidget(
      _wrap(
        _view(
          saved: [_saved('m2', '2026-08-11T12:30:00.000Z')],
          staged: [
            _staged('p1', '2026-08-11T12:00:00.000Z'),
            _staged('p3', '2026-08-11T13:00:00.000Z'),
          ],
        ),
      ),
    );
    await tester.pumpAndSettle();

    // The saved meal holds the slot its staged card had. It used to jump to the
    // top of the day, above both of its unconfirmed neighbours.
    expect(top(tester, 'p1'), lessThan(top(tester, 'm2')));
    expect(top(tester, 'm2'), lessThan(top(tester, 'p3')));

    // And the neighbours are the SAME elements — a remount here replays every
    // card's entrance, which is the flicker the user sees around a save.
    expect(tester.element(find.byKey(const ValueKey('p1'))), same(firstElement));
    expect(tester.element(find.byKey(const ValueKey('p3'))), same(lastElement));
  });

  testWidgets('the first save does not swap the scroll view out from under the feed', (
    tester,
  ) async {
    tall(tester);
    await tester.pumpWidget(
      _wrap(_view(staged: [_staged('p1', '2026-08-11T12:00:00.000Z')])),
    );
    await tester.pumpAndSettle();
    final scrollable = tester.element(find.byType(Scrollable));

    await tester.pumpWidget(
      _wrap(_view(saved: [_saved('m1', '2026-08-11T12:00:00.000Z')])),
    );
    await tester.pumpAndSettle();

    // A day with no saved meals used to render through a different scrollable
    // entirely, so the very first confirm tore the whole feed down and rebuilt
    // it — every remaining card re-entered at once.
    expect(tester.element(find.byType(Scrollable)), same(scrollable));
  });

  testWidgets('a live turn sits below an unconfirmed meal, not around it', (
    tester,
  ) async {
    tall(tester);
    const stream = StreamAnalysisState(
      status: StreamStatus.decomposing,
      isAnalyzing: true,
      loggedDate: _date,
    );
    final view = _view(
      staged: [_staged('p1', '2026-08-11T12:00:00.000Z')],
      stream: stream,
    );
    await tester.pumpWidget(_wrap(view, footer: _liveFooter(view, stream)));
    await tester.pumpAndSettle();

    // The new turn's header used to render ABOVE the older staged card, with
    // its own streaming rows below it — the turn split in half around a meal
    // that came first.
    final staged = tester.getRect(find.byKey(const ValueKey('p1')));
    final bubble = tester.getRect(find.byKey(const ValueKey('user-bubble')));
    expect(staged.bottom, lessThanOrEqualTo(bubble.top));
    expect(
      bubble.bottom,
      lessThanOrEqualTo(tester.getRect(find.byType(StreamingEntry)).top),
    );
  });
}
