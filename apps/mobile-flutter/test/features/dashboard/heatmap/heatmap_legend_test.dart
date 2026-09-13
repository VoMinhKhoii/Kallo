import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/dashboard/logic/heatmap_colors.dart';
import 'package:kallo_mobile/features/dashboard/widgets/heatmap/heatmap_legend.dart';
import 'package:kallo_mobile/theme/kallo_colors.dart';

import '../../../app_fonts.dart';
import '../../../l10n_test_loader.dart';

Widget _host() => EasyLocalization(
  supportedLocales: const [Locale('en'), Locale('vi')],
  startLocale: const Locale('vi'),
  path: 'assets/l10n',
  fallbackLocale: const Locale('en'),
  assetLoader: const FsL10nLoader(),
  child: Builder(
    builder:
        (context) => MaterialApp(
          localizationsDelegates: context.localizationDelegates,
          supportedLocales: context.supportedLocales,
          locale: context.locale,
          home: const Scaffold(body: HeatmapLegend()),
        ),
  ),
);

/// The swatch drawn beside [label]. Each legend item is its own Row holding
/// exactly one swatch Container, so the first Container under that Row is it.
Container _swatchFor(WidgetTester tester, String label) =>
    tester.widget<Container>(
      find
          .descendant(
            of:
                find
                    .ancestor(of: find.text(label), matching: find.byType(Row))
                    .first,
            matching: find.byType(Container),
          )
          .first,
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
  });

  testWidgets('names every kind of cell the grid can paint', (tester) async {
    await tester.pumpWidget(_host());
    await tester.pumpAndSettle();

    for (final label in [
      'Chưa ghi nhận',
      'Đúng mục tiêu',
      'Vượt mục tiêu',
      'Ngày xả',
      'Chờ xác nhận',
    ]) {
      expect(find.text(label), findsOneWidget, reason: label);
    }
  });

  // The regression: this swatch drew a flat fill inside an accent ring — the
  // recipe the cell used BEFORE the aurora landed — so the key described a
  // different app than the grid beside it.
  testWidgets('draws the cheat swatch exactly as the cell paints it', (
    tester,
  ) async {
    await tester.pumpWidget(_host());
    await tester.pumpAndSettle();

    final background =
        _swatchFor(tester, 'Ngày xả').decoration as BoxDecoration;

    // The swatch must be the SAME paint record the grid painter consumes, not
    // an equal-looking one assembled here — assembling is what let this key
    // claim a flat ringed swatch while the cell drew a ringless wash.
    expect(background.gradient, same(HeatmapCellPaints.cheat.gradient));
    expect(background.color, HeatmapCellPaints.cheat.fill);
    // The cell is ringless — being the grid's only gradient is what earns that.
    expect(background.border, isNull);
    expect(background.color, isNot(KalloColors.accent));
  });

  testWidgets('keeps the ring on the one cell that has one', (tester) async {
    await tester.pumpWidget(_host());
    await tester.pumpAndSettle();

    final background =
        _swatchFor(tester, 'Chờ xác nhận').decoration as BoxDecoration;

    // Same record the painter reads, so the ring cannot go missing on one side.
    expect(background.color, HeatmapCellPaints.awaiting.fill);
    expect(
      background.border,
      Border.all(color: HeatmapCellPaints.awaiting.stroke!),
    );
    expect(background.gradient, isNull);
  });
}
