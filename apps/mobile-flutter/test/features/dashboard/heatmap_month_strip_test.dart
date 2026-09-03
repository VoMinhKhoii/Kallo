import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/dashboard/data/dashboard_providers.dart';
import 'package:kallo_mobile/features/dashboard/widgets/heatmap/adherence_heatmap.dart';
import 'package:kallo_mobile/features/dashboard/widgets/heatmap/heatmap_grid_painter.dart';
import 'package:kallo_mobile/features/dashboard/widgets/heatmap/heatmap_month_strip.dart';
import 'package:kallo_mobile/models/profile/heatmap.dart';
import 'package:kallo_mobile/theme/calm_tokens.dart';

import '../../app_fonts.dart';
import '../../l10n_test_loader.dart';

/// The month strip was a hard-coded 16pt box — sized when meta was 12pt. Meta
/// is now 14 × 1.25 = 17.5, so the label's line box already overran its own
/// strip, ate the 4pt gap under it and painted into the grid's first cell row;
/// scaled text pushed it a further row down.
const _args = (userId: 'u1', date: '2026-09-01');

const _weeks = 13;

HeatmapData _threeMonths() => HeatmapData(
      cells: [
        for (var day = 0; day < 7; day++)
          [
            for (var week = 0; week < _weeks; week++)
              HeatmapCell(
                date: '2026-08-0${(day % 9) + 1}',
                ratio: 0.95,
                consumedRatio: 0.95,
                status: HeatmapCellStatus.logged,
              ),
          ],
      ],
      monthHeaders: const [
        HeatmapMonthHeader(month: 'Jul', monthIndex: 7, startColumn: 0, span: 4),
        HeatmapMonthHeader(month: 'Aug', monthIndex: 8, startColumn: 4, span: 5),
        HeatmapMonthHeader(month: 'Sep', monthIndex: 9, startColumn: 9, span: 4),
      ],
    );

Widget _app({required TextScaler scaler}) => ProviderScope(
      overrides: [
        heatmapProvider.overrideWith((ref, args) async => _threeMonths()),
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
              data: MediaQuery.of(context).copyWith(textScaler: scaler),
              child: const Scaffold(
                body: Center(
                  child: SizedBox(
                    width: 360,
                    child: AdherenceHeatmap(args: _args),
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
    // The strip's WIDTH decides which months get labelled at all.
    await loadAppFonts();
  });

  test('the strip is measured from its style, never assumed', () {
    // 14 × 1.25 = 17.5 → 18. The retired constant was 16, which is the number
    // this assertion exists to make impossible to reintroduce.
    expect(
      HeatmapMonthStrip.heightFor(dashMeta(), TextScaler.noScaling),
      greaterThanOrEqualTo(18),
    );
  });

  for (final scaler in const [TextScaler.noScaling, TextScaler.linear(1.3)]) {
    testWidgets('month labels clear the grid at $scaler', (tester) async {
      tester.view.physicalSize = const Size(430, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_app(scaler: scaler));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);

      final grid = tester.getRect(
        find.byWidgetPredicate(
          (w) => w is CustomPaint && w.painter is HeatmapGridPainter,
        ),
      );

      var labelled = 0;
      for (final month in const ['Jul', 'Aug', 'Sep']) {
        final finder = find.text(month);
        if (finder.evaluate().isEmpty) continue;
        labelled++;
        final label = tester.getRect(finder);
        expect(
          label.bottom,
          lessThanOrEqualTo(grid.top + 0.01),
          reason:
              '"$month" ran $label into the first cell row, which starts at '
              '${grid.top}',
        );
      }
      expect(labelled, greaterThanOrEqualTo(2),
          reason: 'a 3-month window must label at least two of them');
    });
  }
}
