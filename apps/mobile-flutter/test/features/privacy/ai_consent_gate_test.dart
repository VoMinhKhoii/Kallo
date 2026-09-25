import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/onboarding/data/profile_row.dart';
import 'package:kallo_mobile/features/onboarding/providers/onboarding_providers.dart';
import 'package:kallo_mobile/features/privacy/logic/ai_consent_gate.dart';
import 'package:kallo_mobile/features/privacy/widgets/ai_consent_sheet.dart';
import 'package:kallo_mobile/services/auth/session_provider.dart';
import 'package:kallo_mobile/services/http/api_client.dart';
import 'package:kallo_mobile/shell/kallo_app_theme.dart';

import '../../l10n_test_loader.dart';
import 'ai_consent_providers_test.dart' show FakeApiClient;

/// Mounts a button that asks the gate, in English, and records each answer.
Future<List<bool>> _pumpGate(
  WidgetTester tester, {
  required FakeApiClient api,
  required bool consented,
}) async {
  final answers = <bool>[];
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        apiClientProvider.overrideWithValue(api),
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
                    builder:
                        (context, ref, _) => TextButton(
                          onPressed: () async {
                            answers.add(await ensureAiConsent(context, ref));
                          },
                          child: const Text('log meal'),
                        ),
                  ),
                ),
              ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return answers;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpL10nBinding();

  late FakeApiClient api;
  setUp(() => api = FakeApiClient());

  testWidgets('a consented user goes straight through — no sheet', (
    tester,
  ) async {
    final answers = await _pumpGate(tester, api: api, consented: true);

    await tester.tap(find.text('log meal'));
    await tester.pumpAndSettle();

    expect(answers, [true]);
    expect(find.byType(AiConsentSheet), findsNothing);
    expect(api.puts, isEmpty);
  });

  testWidgets('Not now sends nothing and answers false', (tester) async {
    final answers = await _pumpGate(tester, api: api, consented: false);

    await tester.tap(find.text('log meal'));
    await tester.pumpAndSettle();
    expect(find.byType(AiConsentSheet), findsOneWidget);
    expect(find.textContaining('Gemini'), findsOneWidget);
    // The disclosure names every kind of text that reaches the AI.
    expect(find.textContaining('ingredient searches'), findsOneWidget);
    // A Cupertino route, not Material's bottom sheet.
    expect(
      ModalRoute.of(tester.element(find.byType(AiConsentSheet))),
      isA<CupertinoModalPopupRoute<bool>>(),
    );
    expect(find.byType(BottomSheet), findsNothing);

    await tester.tap(find.text('Not now'));
    await tester.pumpAndSettle();

    expect(answers, [false]);
    expect(api.puts, isEmpty);
  });

  testWidgets('a tap on the barrier answers false and sends nothing', (
    tester,
  ) async {
    final answers = await _pumpGate(tester, api: api, consented: false);

    await tester.tap(find.text('log meal'));
    await tester.pumpAndSettle();
    await tester.tapAt(const Offset(195, 40)); // above the sheet
    await tester.pumpAndSettle();

    expect(answers, [false]);
    expect(find.byType(AiConsentSheet), findsNothing);
    expect(api.puts, isEmpty);
  });

  testWidgets('Continue records consent, answers true, and never asks again', (
    tester,
  ) async {
    api.reply = (_) => {'aiProcessingConsentedAt': '2026-09-25T12:10:00.000Z'};
    final answers = await _pumpGate(tester, api: api, consented: false);

    await tester.tap(find.text('log meal'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();

    expect(answers, [true]);
    expect(api.puts.single.$2, {'consented': true});
    expect(find.byType(AiConsentSheet), findsNothing);

    // The second AI action goes through without the sheet.
    await tester.tap(find.text('log meal'));
    await tester.pumpAndSettle();
    expect(answers, [true, true]);
    expect(api.puts, hasLength(1));
  });
}
