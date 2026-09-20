import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/dashboard/widgets/weight/weight_chart_canvas.dart';

import 'package:kallo_mobile/features/dashboard/data/dashboard_providers.dart';
import 'package:kallo_mobile/features/dashboard/widgets/weight/weight_chart.dart';
import 'package:kallo_mobile/models/profile/weight.dart';

import '../../../l10n_test_loader.dart';

/// Device QA: a fresh account's Progress card headlined "65.9 kg" — the
/// ONBOARDING profile weight — directly above "Log your first weight to start
/// tracking your trend", which keys off zero LOGGED entries. A number and a
/// denial that there is one, on the same card.
const _args = (userId: 'u1', date: '2026-09-01');

WeightSummaryData _summary({required List<double> weights}) =>
    WeightSummaryData(
      range: '30d',
      weights: weights,
      weightDates: [
        for (var i = 0; i < weights.length; i++) '2026-08-0${i + 1}',
      ],
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
  overrides: [weightSummaryProvider.overrideWith((ref, args) async => summary)],
  child: EasyLocalization(
    supportedLocales: const [Locale('en')],
    path: 'assets/l10n',
    fallbackLocale: const Locale('en'),
    assetLoader: const FsL10nLoader(),
    child: Builder(
      builder:
          (context) => MaterialApp(
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

  testWidgets('with nothing logged the card is the empty PLOT, and no hero', (
    tester,
  ) async {
    final semanticsHandle = tester.ensureSemantics();

    await tester.pumpWidget(_app(_summary(weights: const [])));
    await tester.pumpAndSettle();

    // The bare frame IS the empty state — gridlines, both bounds and the two
    // end ticks. No sentence over the plot: an empty chart already reads as
    // "nothing logged yet".
    expect(find.byType(WeightChartCanvas), findsOneWidget);
    expect(find.byType(LineChart), findsOneWidget);
    expect(find.text('Start'), findsOneWidget);
    expect(find.text('Now'), findsOneWidget);
    expect(
      find.text('Log your first weight to start tracking your trend.'),
      findsNothing,
      reason: 'the empty plot carries this, not a line of copy',
    );

    // A screen reader gets no frame, so the prompt is the chart's label.
    expect(
      find.bySemanticsLabel(RegExp('Log your first weight')),
      findsOneWidget,
    );
    semanticsHandle.dispose();

    expect(
      find.text('65.9'),
      findsNothing,
      reason: 'the profile weight is not a reading — no hero number',
    );
    expect(
      find.text('kg'),
      findsNothing,
      reason: 'no unit without a figure to qualify',
    );
  });

  testWidgets('once something is logged the hero number comes back', (
    tester,
  ) async {
    final semanticsHandle = tester.ensureSemantics();

    await tester.pumpWidget(_app(_summary(weights: const [67.0, 65.9])));
    await tester.pumpAndSettle();

    expect(find.text('65.9'), findsOneWidget);
    expect(
      find.text('Log your first weight to start tracking your trend.'),
      findsNothing,
    );
    expect(
      find.bySemanticsLabel(RegExp('Log your first weight')),
      findsNothing,
      reason: 'the prompt is only for the empty plot',
    );
    semanticsHandle.dispose();
  });
}
