import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nham_mobile/features/logging/data/logging_models.dart';
import 'package:nham_mobile/features/logging/data/stream_analysis_controller.dart';
import 'package:nham_mobile/features/logging/logic/feed/view_state.dart';
import 'package:nham_mobile/features/logging/widgets/feed/feed_footer.dart';
import 'package:nham_mobile/features/logging/widgets/meal_time_divider.dart';
import 'package:nham_mobile/features/logging/widgets/streaming/streaming_entry.dart';
import 'package:nham_mobile/features/logging/widgets/user_message_bubble.dart';
import 'package:nham_mobile/models/meal.dart';
import 'package:nham_mobile/models/streaming.dart';

import '../../../l10n_test_loader.dart';

const _raw = 'phở bò tái nạm';

const _meal = ParsedMeal(
  mealName: 'Bữa trưa',
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

FeedViewState _view({
  bool streaming = false,
  bool revealing = false,
  List<PendingMealConfirmation> pending = const [],
}) => FeedViewState(
  persistedMeals: const [],
  pendingConfirmations: pending,
  isLoading: false,
  hasError: false,
  hasUnknownDailyMacros: false,
  isStreaming: streaming,
  isRevealing: revealing,
  isCheatRevealing: false,
  dailyCalories: 0,
  dailyProtein: 0,
  dailyCarbs: 0,
  dailyFat: 0,
  hasFailedAttempt: false,
  isEmpty: false,
  hasFooterItems: true,
  showPartialDayNotice: false,
);

Widget _wrap({
  required FeedViewState view,
  required StreamAnalysisState stream,
  String? streamingRawInput,
  String? revealRawInput,
  DateTime? sentAt,
}) => EasyLocalization(
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
          body: SingleChildScrollView(
            child: FeedFooter(
              view: view,
              stream: stream,
              streamingRawInput: streamingRawInput,
              revealRawInput: revealRawInput,
              confirmPending: false,
              loaderIndex: 0,
              sentAt: sentAt,
              onConfirm: (_, _) {},
              onConfirmReveal: (_, _) {},
              onConfirmCheat: (_, _) {},
              onConfirmCheatReveal: (_) {},
              onClarifyCheat: (_) {},
              failedText: null,
              failedRetryable: true,
              onRetry: () {},
              onDiscardFailed: () {},
            ),
          ),
        ),
      ),
    ),
  ),
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

  testWidgets('while streaming: the bubble carries the words, bare rows below', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(
        view: _view(streaming: true),
        stream: const StreamAnalysisState(
          status: StreamStatus.decomposing,
          isAnalyzing: true,
        ),
        streamingRawInput: _raw,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(UserMessageBubble), findsOneWidget);
    expect(find.byType(StreamingEntry), findsOneWidget);
    expect(find.text(_raw), findsOneWidget);
  });

  testWidgets('at reveal: the bubble stays and the card regains its quote', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(
        view: _view(revealing: true),
        stream: const StreamAnalysisState(
          status: StreamStatus.done,
          result: _meal,
          analysisId: 'a1',
        ),
        revealRawInput: _raw,
      ),
    );
    await tester.pumpAndSettle();

    // The bubble stays, and the card carries its own quote again — the words
    // deliberately appear twice.
    expect(find.byType(UserMessageBubble), findsOneWidget);
    expect(find.byType(StreamingEntry), findsNothing);
    expect(find.text(_raw), findsNWidgets(2));
  });

  testWidgets('the turn is stamped from the moment of sending, once', (
    tester,
  ) async {
    final sentAt = DateTime(2026, 8, 11, 12, 15);

    // While streaming there is no card at all, so the divider can only be the
    // footer's own — the timeline must not wait for the answer to land.
    await tester.pumpWidget(
      _wrap(
        view: _view(streaming: true),
        stream: const StreamAnalysisState(
          status: StreamStatus.decomposing,
          isAnalyzing: true,
        ),
        streamingRawInput: _raw,
        sentAt: sentAt,
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byType(MealTimeDivider), findsOneWidget);

    // And at reveal the card must NOT add a second one.
    await tester.pumpWidget(
      _wrap(
        view: _view(revealing: true),
        stream: const StreamAnalysisState(
          status: StreamStatus.done,
          result: _meal,
          analysisId: 'a1',
        ),
        revealRawInput: _raw,
        sentAt: sentAt,
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byType(MealTimeDivider), findsOneWidget);
  });

  testWidgets('the divider sits above the bubble, not under it', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(
        view: _view(streaming: true),
        stream: const StreamAnalysisState(
          status: StreamStatus.decomposing,
          isAnalyzing: true,
        ),
        streamingRawInput: _raw,
        sentAt: DateTime(2026, 8, 11, 12, 15),
      ),
    );
    await tester.pumpAndSettle();

    expect(
      tester.getRect(find.byType(MealTimeDivider)).bottom,
      lessThanOrEqualTo(tester.getRect(find.byType(UserMessageBubble)).top),
    );
  });

  testWidgets('the bubble survives the streaming → reveal swap without remounting', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(
        view: _view(streaming: true),
        stream: const StreamAnalysisState(
          status: StreamStatus.assembling,
          isAnalyzing: true,
        ),
        streamingRawInput: _raw,
      ),
    );
    await tester.pumpAndSettle();
    final before = tester.element(find.byType(UserMessageBubble));

    await tester.pumpWidget(
      _wrap(
        view: _view(revealing: true),
        stream: const StreamAnalysisState(
          status: StreamStatus.done,
          result: _meal,
          analysisId: 'a1',
        ),
        revealRawInput: _raw,
      ),
    );
    await tester.pumpAndSettle();

    // Same element: a remount here would replay the entrance and the user's
    // own sentence would visibly blink as the card appeared beneath it.
    expect(tester.element(find.byType(UserMessageBubble)), same(before));
  });

  testWidgets('a pending card is stamped when it was STAGED, not when it mounted', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(
        view: _view(
          pending: const [
            PendingMealConfirmation(
              id: 'p1',
              rawInput: 'cơm gà',
              // 12:15 local, staged well before this card ever mounted.
              loggedAt: '2026-08-11T12:15:00.000',
              parsedMeal: _meal,
            ),
          ],
        ),
        stream: StreamAnalysisState.initial,
      ),
    );
    await tester.pumpAndSettle();

    // Reading the clock here showed an hour-old pending meal as "just now".
    // Matched on the widget's own value, not on find.text: intl separates the
    // meridiem with U+202F, so a plain-space literal never matches.
    final divider = tester.widget<MealTimeDivider>(
      find.byType(MealTimeDivider),
    );
    expect(divider.time, startsWith('12:15'));
  });

  testWidgets('a pending confirmation wears the same turn header as a saved meal', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(
        view: _view(
          pending: const [
            PendingMealConfirmation(
              id: 'p1',
              rawInput: 'cơm gà',
              loggedAt: '2026-08-11T12:00:00.000Z',
              parsedMeal: _meal,
            ),
          ],
        ),
        stream: StreamAnalysisState.initial,
      ),
    );
    await tester.pumpAndSettle();

    // Every meal in the feed reads the same way — divider, the user's words as
    // a sent message, then the card, which keeps its own quote.
    expect(find.byType(UserMessageBubble), findsOneWidget);
    expect(find.byType(MealTimeDivider), findsOneWidget);
    expect(find.text('cơm gà'), findsNWidgets(2));
  });

  testWidgets('a second meal sits BELOW the unconfirmed one, not around it', (
    tester,
  ) async {
    const staged = PendingMealConfirmation(
      id: 'p1',
      rawInput: 'cơm gà',
      loggedAt: '2026-08-11T12:00:00.000Z',
      parsedMeal: _meal,
    );

    await tester.pumpWidget(
      _wrap(
        view: _view(streaming: true, pending: const [staged]),
        stream: const StreamAnalysisState(
          status: StreamStatus.decomposing,
          isAnalyzing: true,
        ),
        streamingRawInput: _raw,
        sentAt: DateTime(2026, 8, 11, 12, 15),
      ),
    );
    await tester.pumpAndSettle();

    // The new turn's header used to render ABOVE the older staged card, with
    // its own streaming rows below it — the turn split in half around a meal
    // that came first.
    // The staged meal now has a bubble of its own, so target the LIVE turn's
    // by key rather than by type.
    final newBubble = tester.getRect(
      find.byKey(const ValueKey('user-bubble')),
    );
    final newRows = tester.getRect(find.byType(StreamingEntry));

    // Every trace of the older meal — its bubble AND its card quote — sits
    // above the new turn.
    for (final staged in find.text('cơm gà').evaluate()) {
      expect(
        tester.getRect(find.byWidget(staged.widget)).bottom,
        lessThanOrEqualTo(newBubble.top),
      );
    }
    expect(newBubble.bottom, lessThanOrEqualTo(newRows.top));
  });
}
