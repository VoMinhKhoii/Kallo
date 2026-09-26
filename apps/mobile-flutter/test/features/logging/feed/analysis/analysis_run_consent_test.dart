import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/data/stream_analysis_controller.dart';
import 'package:kallo_mobile/features/logging/logic/feed/analysis/analysis_run.dart';
import 'package:kallo_mobile/features/logging/widgets/composer/meal_input.dart';
import 'package:kallo_mobile/features/logging/widgets/relog/mention_text_controller.dart';
import 'package:kallo_mobile/features/onboarding/data/profile_row.dart';
import 'package:kallo_mobile/features/onboarding/providers/onboarding_providers.dart';
import 'package:kallo_mobile/features/privacy/data/ai_consent_providers.dart';
import 'package:kallo_mobile/features/privacy/widgets/ai_consent_sheet.dart';
import 'package:kallo_mobile/models/http/stream_analyze_input.dart';
import 'package:kallo_mobile/models/logging/streaming.dart';
import 'package:kallo_mobile/services/auth/session_provider.dart';
import 'package:kallo_mobile/services/http/api_client.dart';
import 'package:kallo_mobile/shell/kallo_app_theme.dart';

import '../../../../l10n_test_loader.dart';

/// Records every analyze request and every consent write, answering neither
/// stream: the test decides how each run ends.
class _Api extends ApiClient {
  final List<StreamAnalyzeInput> sent = [];
  final List<Object?> puts = [];

  @override
  Stream<StreamEvent> analyzeMeal(StreamAnalyzeInput input) {
    sent.add(input);
    return const Stream<StreamEvent>.empty();
  }

  @override
  Future<T> put<T>(String path, [Object? body]) async {
    puts.add(body);
    return {'aiProcessingConsentedAt': '2026-09-25T12:10:00.000Z'} as T;
  }
}

/// Holds the composer's text and counts clears: the composer is untouched
/// until a run actually starts.
class _Input extends MealInputController {
  int cleared = 0;
  String text = '';

  @override
  String getText() => text;

  @override
  void setText(String value) => text = value;

  @override
  void clear() {
    cleared++;
    text = '';
  }
}

class _Harness {
  _Harness(this.api, this.run, this.input);
  final _Api api;
  final FeedAnalysisRun run;
  final _Input input;
  late BuildContext context;
  late WidgetRef ref;
}

Future<_Harness> _pump(WidgetTester tester, {required bool consented}) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  final composer = MentionTextEditingController();
  addTearDown(composer.dispose);
  final input = _Input();
  final h = _Harness(
    _Api(),
    FeedAnalysisRun(
      composer: composer,
      input: input,
      onChanged: () {},
      onScrollToAnswer: () {},
    ),
    input,
  );
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        apiClientProvider.overrideWithValue(h.api),
        currentSessionProvider.overrideWith((ref) => null),
        profileProvider.overrideWith(
          (ref) async => ProfileRow({
            'onboardingStep': 3,
            if (consented)
              'aiProcessingConsentedAt': '2026-09-25T12:10:00.000Z',
          }),
        ),
      ],
      child: EasyLocalization(
        supportedLocales: const [Locale('en'), Locale('vi')],
        startLocale: const Locale('en'),
        path: 'assets/l10n',
        fallbackLocale: const Locale('en'),
        assetLoader: const FsL10nLoader(),
        child: Builder(
          builder:
              (context) => MaterialApp(
                theme: kalloAppTheme(),
                localizationsDelegates: context.localizationDelegates,
                supportedLocales: context.supportedLocales,
                locale: context.locale,
                home: Scaffold(
                  body: Consumer(
                    builder: (c, r, _) {
                      h.context = c;
                      h.ref = r;
                      return const SizedBox();
                    },
                  ),
                ),
              ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return h;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpL10nBinding();

  testWidgets('"Not now" sends nothing and leaves the composer alone', (
    tester,
  ) async {
    final h = await _pump(tester, consented: false);
    h.input.text = 'phở bò, half eaten';
    h.run.startPlain(
      h.context,
      h.ref,
      userId: 'u1',
      date: '2026-09-25',
      text: 'phở bò, half eaten',
    );
    await tester.pumpAndSettle();
    expect(find.byType(AiConsentSheet), findsOneWidget);
    await tester.tap(find.text('Not now'));
    await tester.pumpAndSettle();

    expect(h.api.sent, isEmpty);
    expect(h.input.cleared, 0);
    expect(h.input.text, 'phở bò, half eaten');
    expect(h.run.inFlightLabel, isNull);
  });

  testWidgets('"Not now" hands a quick-log meal to the empty composer', (
    tester,
  ) async {
    final h = await _pump(tester, consented: false);
    // Parked by the dashboard's quick-log sheet, which is gone by now: the
    // feed composer below has never held these words.
    expect(h.input.text, isEmpty);
    h.run.startPlain(
      h.context,
      h.ref,
      userId: 'u1',
      date: '2026-09-25',
      text: 'cơm tấm sườn',
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Not now'));
    await tester.pumpAndSettle();

    expect(h.api.sent, isEmpty);
    expect(h.input.text, 'cơm tấm sườn', reason: 'the typed meal survives');
  });

  testWidgets('a double tap opens one consent sheet and sends once', (
    tester,
  ) async {
    final h = await _pump(tester, consented: false);
    h.input.text = 'bánh mì';
    for (var i = 0; i < 2; i++) {
      h.run.startPlain(
        h.context,
        h.ref,
        userId: 'u1',
        date: '2026-09-25',
        text: 'bánh mì',
      );
    }
    await tester.pumpAndSettle();
    expect(find.byType(AiConsentSheet), findsOneWidget);
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();

    expect(find.byType(AiConsentSheet), findsNothing);
    expect(h.api.puts, hasLength(1));
    expect(h.api.sent, hasLength(1));

    h.ref.read(streamAnalysisProvider.notifier).cancel();
    await tester.pump();
  });

  testWidgets(
    'a clarify goes through the same gate and keeps its card on "Not now"',
    (tester) async {
      final h = await _pump(tester, consented: false);
      // Agreed for the first run, then withdrawn elsewhere while its question
      // card sat there.
      h.run.startPlain(
        h.context,
        h.ref,
        userId: 'u1',
        date: '2026-09-25',
        text: 'buffet',
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Continue'));
      await tester.pumpAndSettle();
      h.run.reveal(h.ref, userId: 'u1', date: '2026-09-25');
      h.ref.read(streamAnalysisProvider.notifier).cancel();
      h.ref.read(aiConsentRecordProvider.notifier).markMissing();
      await tester.pumpAndSettle();

      h.run.restartClarify(
        h.context,
        h.ref,
        userId: 'u1',
        date: '2026-09-25',
        answer: 'Lẩu',
      );
      await tester.pumpAndSettle();
      expect(find.byType(AiConsentSheet), findsOneWidget);
      await tester.tap(find.text('Not now'));
      await tester.pumpAndSettle();

      expect(h.api.sent, hasLength(1), reason: 'only the first run went out');
      expect(h.run.revealRawInput, 'buffet', reason: 'the question card stays');
    },
  );

  testWidgets('"Continue" after a server refusal re-sends the same request', (
    tester,
  ) async {
    final h = await _pump(tester, consented: true);

    h.run.startPlain(
      h.context,
      h.ref,
      userId: 'u1',
      date: '2026-09-25',
      text: 'phở bò',
    );
    await tester.pump();
    expect(h.api.sent, hasLength(1));

    // The server answered 403 ai_consent_required.
    h.run.fail(h.context, h.ref, (
      retryable: false,
      paymentRequired: false,
      consentRequired: true,
    ));
    await tester.pumpAndSettle();
    expect(find.byType(AiConsentSheet), findsOneWidget);
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();

    expect(h.api.sent, hasLength(2));
    expect(h.api.sent[1].toJson(), h.api.sent[0].toJson());
    expect(h.run.failedText, isNull, reason: 'no error card for a consent ask');

    h.ref.read(streamAnalysisProvider.notifier).cancel();
    await tester.pump();
  });
}
