import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/dashboard/data/dashboard_providers.dart';
import 'package:kallo_mobile/features/dashboard/widgets/heatmap/adherence_heatmap.dart';
import 'package:kallo_mobile/models/profile/heatmap.dart';

import '../../../app_fonts.dart';
import '../../../golden_tolerance.dart';
import '../../../l10n_test_loader.dart';

/// Pixel record of the whole card — grid AND key in one frame.
///
/// This is the golden that matters. The legend bug shipped because the swatch
/// and the cell it explains were checked separately and each looked fine on its
/// own; the mismatch only exists BETWEEN them. Rendering both together means a
/// human reviewing this image sees the key beside the thing it claims to
/// describe, which is exactly the comparison nobody made.
const _args = (userId: 'u1', date: '2026-09-01');
const _weeks = 14;

/// Every kind of cell the grid can paint, laid out deterministically so the
/// image is a catalogue rather than a sample: each row is one kind.
HeatmapData _everyCellKind() {
  HeatmapCell cell(int day, int week) {
    final date = '2026-08-${(week % 28 + 1).toString().padLeft(2, '0')}';
    return switch (day) {
      // The ramp, left to right, so a broken step is visible as a flat run.
      0 => HeatmapCell(
        date: date,
        ratio: 0.30 + week * 0.06,
        consumedRatio: 0.30 + week * 0.06,
        status: HeatmapCellStatus.logged,
      ),
      1 => HeatmapCell(
        date: date,
        ratio: 1.0,
        consumedRatio: 1.0,
        status: HeatmapCellStatus.logged,
      ),
      // Over target — off the ramp entirely.
      2 => HeatmapCell(
        date: date,
        ratio: 1.4,
        consumedRatio: 1.4,
        status: HeatmapCellStatus.logged,
      ),
      // Cheat: the grid's only gradient, and the one the legend got wrong.
      3 => HeatmapCell(
        date: date,
        ratio: 1.3,
        consumedRatio: 1.3,
        status: HeatmapCellStatus.logged,
        hasCheatMeal: true,
      ),
      // Logged, under the gate, unattested — the grid's only ring.
      4 => HeatmapCell(
        date: date,
        ratio: null,
        consumedRatio: 0.5,
        status: HeatmapCellStatus.partial,
      ),
      5 => HeatmapCell(
        date: date,
        ratio: null,
        consumedRatio: null,
        status: HeatmapCellStatus.unlogged,
      ),
      _ => HeatmapCell(
        date: date,
        ratio: null,
        consumedRatio: null,
        status: HeatmapCellStatus.outside,
      ),
    };
  }

  return HeatmapData(
    cells: [
      for (var day = 0; day < 7; day++)
        [for (var week = 0; week < _weeks; week++) cell(day, week)],
    ],
    monthHeaders: const [
      HeatmapMonthHeader(month: 'Jul', monthIndex: 7, startColumn: 0, span: 4),
      HeatmapMonthHeader(month: 'Aug', monthIndex: 8, startColumn: 4, span: 5),
      HeatmapMonthHeader(month: 'Sep', monthIndex: 9, startColumn: 9, span: 5),
    ],
  );
}

Widget _app(Locale locale) => ProviderScope(
  overrides: [
    heatmapProvider.overrideWith((ref, args) async => _everyCellKind()),
  ],
  child: EasyLocalization(
    supportedLocales: const [Locale('en'), Locale('vi')],
    startLocale: locale,
    path: 'assets/l10n',
    fallbackLocale: const Locale('en'),
    assetLoader: const FsL10nLoader(),
    child: Builder(
      builder:
          (context) => MaterialApp(
            debugShowCheckedModeBanner: false,
            localizationsDelegates: context.localizationDelegates,
            supportedLocales: context.supportedLocales,
            locale: context.locale,
            home: const Scaffold(
              body: Padding(
                padding: EdgeInsets.all(12),
                child: AdherenceHeatmap(args: _args),
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
    await loadAppFonts();
    useTolerantGoldens();
  });

  testWidgets('the card, every cell kind beside the key that names them', (
    tester,
  ) async {
    // iPhone 12 Pro — the device the palette regressions were caught on.
    tester.view.physicalSize = const Size(390, 320);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(_app(const Locale('vi')));
    // The reveal is a staggered per-cell animation; settle it or the golden
    // records a half-drawn grid whose contents depend on frame timing.
    await tester.pumpAndSettle();

    await expectLater(
      find.byType(AdherenceHeatmap),
      matchesGoldenFile('goldens/adherence_heatmap_vi.png'),
    );
  });
}
