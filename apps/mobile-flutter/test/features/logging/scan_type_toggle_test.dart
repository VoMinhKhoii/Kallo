import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/widgets/sheets/scan/scan_type_toggle.dart';

import '../../app_fonts.dart';
import '../../l10n_test_loader.dart';

/// The scan sheet's Barcode / Nutrition segmented control, measured.
///
/// It was pinned to `width: 240`, which left ~105pt per segment — enough to
/// ellipsise "Nutrition label" into "Nutrition l…" in English, and nowhere
/// near enough for the Vietnamese label at an accessibility text scale. The
/// fix is full content width, 4pt inner padding, and a shorter label; the
/// point of this file is that all three stay that way.
///
/// Every width here is REAL: `loadAppFonts()` puts Be Vietnam Pro in the test
/// binding first. Without it flutter_test measures a placeholder face with
/// ~1em advances and every assertion below is fiction.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  // The narrowest phone the app supports: 320 - 2*16 of sheet inset = 288 of
  // content width for the control.
  const double screenWidth = 320;
  const double trackWidth = screenWidth - 2 * 16;
  const double trackPadding = 3;
  const double segmentPadding = 4;
  const double segmentWidth = (trackWidth - 2 * trackPadding) / 2;
  const double textRoom = segmentWidth - 2 * segmentPadding;

  setUpAll(() async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.flutter.io/shared_preferences'),
          (call) async => call.method == 'getAll' ? <String, Object>{} : null,
        );
    await EasyLocalization.ensureInitialized();
  });

  Future<void> pumpToggle(
    WidgetTester tester, {
    required Locale locale,
    required double scale,
    required ScanType selected,
  }) async {
    await loadAppFonts();
    await tester.pumpWidget(
      EasyLocalization(
        supportedLocales: const [Locale('en'), Locale('vi')],
        path: 'assets/l10n',
        fallbackLocale: const Locale('en'),
        startLocale: locale,
        assetLoader: const FsL10nLoader(),
        child: Builder(
          builder: (context) => MaterialApp(
            localizationsDelegates: context.localizationDelegates,
            supportedLocales: context.supportedLocales,
            locale: context.locale,
            home: Builder(
              builder: (context) => MediaQuery(
                data: MediaQuery.of(
                  context,
                ).copyWith(textScaler: TextScaler.linear(scale)),
                child: Align(
                  alignment: Alignment.topCenter,
                  child: SizedBox(
                    width: screenWidth,
                    child: ScanTypeToggle(value: selected, onChange: (_) {}),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  /// The two segment boxes, left to right.
  List<Size> segmentSizes(WidgetTester tester) => [
    tester.getSize(find.byType(AnimatedContainer).at(0)),
    tester.getSize(find.byType(AnimatedContainer).at(1)),
  ];

  for (final locale in const [Locale('en'), Locale('vi')]) {
    for (final scale in const [1.0, 1.3]) {
      for (final selected in ScanType.values) {
        final name =
            '${locale.languageCode} @ ${scale}x, ${selected.name} selected';

        testWidgets('$name: neither label is ellipsised', (tester) async {
          await pumpToggle(tester, locale: locale, scale: scale, selected: selected);

          for (final key in const [
            'logging.scan.barcodeTab',
            'logging.scan.labelTab',
          ]) {
            final label = key.tr();
            final paragraph = tester.renderObject<RenderParagraph>(
              find.text(label),
            );
            expect(
              paragraph.didExceedMaxLines,
              isFalse,
              reason: '"$label" ($name) is clipped by maxLines: 1',
            );
            // Belt and braces: the laid-out line has to fit the room the
            // segment actually gives it, ellipsis or not.
            expect(
              paragraph.size.width,
              lessThanOrEqualTo(textRoom),
              reason: '"$label" ($name) is wider than the segment',
            );
          }
        });

        testWidgets('$name: the segments are equal and fill the sheet', (
          tester,
        ) async {
          await pumpToggle(tester, locale: locale, scale: scale, selected: selected);

          expect(
            tester.getSize(find.byType(ScanTypeToggle)).width,
            screenWidth,
          );
          final sizes = segmentSizes(tester);
          expect(sizes[0].width, closeTo(sizes[1].width, 0.5));
          // Equal AND the full content width: a selected pill that is wider
          // than the segment beside it, or a control floating at 240, are both
          // failures of the same rule.
          expect(sizes[0].width, closeTo(segmentWidth, 0.5));
        });
      }
    }
  }
}
