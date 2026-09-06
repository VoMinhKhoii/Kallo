import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/dashboard/data/dashboard_providers.dart';
import 'package:kallo_mobile/features/dashboard/widgets/weight/weight_chart.dart';
import 'package:kallo_mobile/features/dashboard/widgets/weight/weight_chart_canvas.dart';
import 'package:kallo_mobile/models/profile/weight.dart';

import '../../../app_fonts.dart';
import '../../../l10n_test_loader.dart';

/// The FIRST weigh-in draws a chart with exactly one point. Its x domain was
/// 0…1 with the lone spot pinned at x = 0, so the tick label under it started
/// at the plot's left edge and ran off it — and the date row's height was a
/// fixed 22, sized for the retired 12pt meta tier, which clips the current
/// 14 × 1.25 line box the moment the user scales text up.
const _args = (userId: 'u1', date: '2026-09-01');

WeightSummaryData _oneWeight() => const WeightSummaryData(
      range: '30d',
      weights: [65.9],
      weightDates: ['2026-08-06'],
      currentWeight: 65.9,
      todayWeight: 65.9,
      weightPlaceholder: 65.9,
      daysLogged: 1,
      periodStartWeight: 65.9,
      expectedEndWeight: 64.0,
      goalDirection: WeightGoalDirection.down,
      periodElapsedDays: 1,
      projectedEndWeight: 64.5,
      canProject: false,
    );

Widget _app({required TextScaler scaler}) => ProviderScope(
      overrides: [
        weightSummaryProvider.overrideWith((ref, args) async => _oneWeight()),
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
            home: MediaQuery(
              // 320pt of card, the narrowest phone the app supports.
              data: MediaQuery.of(context).copyWith(textScaler: scaler),
              child: const Scaffold(
                body: Center(
                  child: SizedBox(
                    width: 320,
                    child: WeightChart(args: _args),
                  ),
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
    // Width assertions are worthless in the placeholder font (see app_fonts).
    await loadAppFonts();
  });

  for (final scaler in const [TextScaler.noScaling, TextScaler.linear(1.3)]) {
    testWidgets('a single logged weight fits its axis at $scaler',
        (tester) async {
      tester.view.physicalSize = const Size(430, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_app(scaler: scaler));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull,
          reason: 'no overflow from the one-point axis');

      final chart = tester.getRect(find.byType(WeightChartCanvas));
      // The point's own date — not "Start", and not nothing.
      final label = find.text('6/8');
      expect(label, findsOneWidget);
      final tick = tester.getRect(label);

      expect(tick.left, greaterThanOrEqualTo(chart.left - 0.01),
          reason: 'the tick must not hang off the plot');
      expect(tick.right, lessThanOrEqualTo(chart.right + 0.01));
      expect(tick.top, greaterThanOrEqualTo(chart.top - 0.01));
      expect(tick.bottom, lessThanOrEqualTo(chart.bottom + 0.01));

      // The date row used to reserve a flat 22 — 4 of lead plus an 18 slot
      // sized for the retired 12pt meta. The label's line box is 14 × 1.25
      // scaled, which is 22.75 on its own at 1.3x: the slot cut the descenders
      // off. Reserving the MEASURED height is the fix, so measure it back.
      expect(tick.height, greaterThanOrEqualTo(scaler.scale(14) * 1.25 - 0.01),
          reason: 'the date row must reserve the label\'s full line box');

      // The lone point owned x = 0 of a 0…1 domain, which parked it (and its
      // tick) against the plot's left edge with two thirds of the canvas
      // empty. A symmetric domain centres it.
      expect(tick.center.dx, closeTo(chart.center.dx, 40),
          reason: 'one point centres in the plot, it does not start it');
    });
  }
}
