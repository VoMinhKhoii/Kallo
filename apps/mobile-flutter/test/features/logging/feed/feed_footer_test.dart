import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/logging/data/stream_analysis_controller.dart';
import 'package:kallo_mobile/features/logging/logic/feed/view_state.dart';
import 'package:kallo_mobile/features/logging/widgets/feed/feed_footer.dart';
import 'package:kallo_mobile/features/logging/widgets/turn/meal_time_divider.dart';
import 'package:kallo_mobile/features/logging/widgets/streaming/streaming_entry.dart';
import 'package:kallo_mobile/features/logging/widgets/turn/user_message_bubble.dart';
import 'package:kallo_mobile/models/meal.dart';
import 'package:kallo_mobile/models/streaming.dart';

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
}) => FeedViewState(
  persistedMeals: const [],
  pendingConfirmations: const [],
  entries: const [],
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
  hasLiveTail: true,
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
              onConfirmReveal: (_, _) {},
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

}
