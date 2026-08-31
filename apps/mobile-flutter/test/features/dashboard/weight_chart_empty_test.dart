import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/dashboard/data/dashboard_providers.dart';
import 'package:kallo_mobile/features/dashboard/widgets/weight/weight_chart.dart';
import 'package:kallo_mobile/models/profile/weight.dart';

import '../../l10n_test_loader.dart';

/// Device QA: a fresh account's Progress card headlined "65.9 kg" — the
/// ONBOARDING profile weight — directly above "Log your first weight to start
/// tracking your trend", which keys off zero LOGGED entries. A number and a
/// denial that there is one, on the same card.
const _args = (userId: 'u1', date: '2026-09-01');

WeightSummaryData _summary({required List<double> weights}) =>
    WeightSummaryData(
      range: '30d',
      weights: weights,
      weightDates: [for (var i = 0; i < weights.length; i++) '2026-08-0${i + 1}'],
      currentWeight: 65.9,
      todayWeight: null,
      weightPlaceholder: 65.9,
      daysLogged: weights.length,
      periodStartWeight: 67.0,
      expectedEndWeight: 64.0,
      goalDirection: WeightGoalDirection.down,
      periodElapsedDays: 10,
      projectedEndWeight: 64.5,
      canProject: false,
    );

Widget _app(WeightSummaryData summary) => ProviderScope(
      overrides: [
        weightSummaryProvider.overrideWith((ref, args) async => summary),
      ],
      child: EasyLocalization(
        supportedLocales: const [Locale('en')],
        path: 'assets/l10n',
        fallbackLocale: const Locale('en'),
        assetLoader: const FsL10nLoader(),
        child: Builder(
          builder: (context) => MaterialApp(
            localizationsDelegates: context.localizationDelegates,
            supportedLocales: context.supportedLocales,
            locale: context.locale,
            home: const Scaffold(body: WeightChart(args: _args)),
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

  testWidgets('with nothing logged the card is ONLY the empty state',
      (tester) async {
    await tester.pumpWidget(_app(_summary(weights: const [])));
    await tester.pumpAndSettle();

    expect(
      find.text('Log your first weight to start tracking your trend.'),
      findsOneWidget,
    );
    expect(find.text('65.9'), findsNothing,
        reason: 'the profile weight is not a reading — no hero number');
    expect(find.text('kg'), findsNothing,
        reason: 'no unit without a figure to qualify');
  });

  testWidgets('once something is logged the hero number comes back',
      (tester) async {
    await tester.pumpWidget(_app(_summary(weights: const [67.0, 65.9])));
    await tester.pumpAndSettle();

    expect(find.text('65.9'), findsOneWidget);
    expect(
      find.text('Log your first weight to start tracking your trend.'),
      findsNothing,
    );
  });
}
