import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/widgets/sheets/scan/scan_type_toggle.dart';
import 'package:kallo_mobile/shared/widgets/form/segmented_strip.dart';
import 'package:kallo_mobile/theme/kallo_theme.dart';

import '../../app_fonts.dart';
import '../../l10n_test_loader.dart';

/// The scan sheet's Barcode / Nutrition segmented control, measured.
///
/// It draws through the shared [SegmentedStrip] — it used to own a private
/// copy with a pill track and a per-segment cross-fade. The width claims below
/// survived that move and are the reason it may not shrink back.
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
  const double trackPadding = SegmentedStrip.inset;
  // The thumb (and the label slot under it) is one segment of the INNER track.
  const double segmentWidth = (trackWidth - 2 * trackPadding) / 2;
  // The tap layer spans the full 44pt row, outside the track's inner padding.
  const double targetWidth = trackWidth / 2;

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

  /// The two tap targets, left to right.
  List<Size> targetSizes(WidgetTester tester) => [
    for (var i = 0; i < 2; i++)
      tester.getSize(
        find
            .descendant(
              of: find.byType(SegmentedStrip),
              matching: find.byType(GestureDetector),
            )
            .at(i),
      ),
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
              lessThanOrEqualTo(segmentWidth),
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
          final sizes = targetSizes(tester);
          expect(sizes[0].width, closeTo(sizes[1].width, 0.5));
          // Equal AND the full content width: a selected thumb wider than the
          // segment beside it, or a control floating at 240, are both failures
          // of the same rule.
          expect(sizes[0].width, closeTo(targetWidth, 0.5));
          // The thumb covers exactly one segment of the inner track.
          expect(
            tester
                .getSize(
                  find.descendant(
                    of: find.byType(FractionallySizedBox),
                    matching: find.byType(DecoratedBox),
                  ),
                )
                .width,
            closeTo(segmentWidth, 0.5),
          );
        });
      }
    }
  }

  testWidgets('draws the shared primitive on a rounded-rectangle track', (
    tester,
  ) async {
    await pumpToggle(
      tester,
      locale: const Locale('en'),
      scale: 1,
      selected: ScanType.barcode,
    );

    expect(find.byType(SegmentedStrip), findsOneWidget);
    // No pill anywhere: the toggle used to be a capsule, and the shape is the
    // whole point of routing it through the primitive.
    expect(find.byType(StadiumBorder), findsNothing);

    BorderRadius radiusOf(Finder finder) {
      final decoration =
          tester.widget<Container>(finder).decoration! as BoxDecoration;
      return decoration.borderRadius! as BorderRadius;
    }

    final track = radiusOf(
      find
          .descendant(
            of: find.byType(SegmentedStrip),
            matching: find.byType(Container),
          )
          .first,
    );
    expect(track, BorderRadius.circular(KalloRadii.buttonXl));
    // 12 is a rounded rectangle; 18 (half the 36pt track) would be the pill.
    expect(track.topLeft.x, lessThan(SegmentedStrip.height / 2));

    final thumb =
        tester
                .widget<DecoratedBox>(
                  find.descendant(
                    of: find.byType(FractionallySizedBox),
                    matching: find.byType(DecoratedBox),
                  ),
                )
                .decoration
            as BoxDecoration;
    expect(
      thumb.borderRadius,
      const BorderRadius.all(Radius.circular(KalloRadii.md)),
    );
  });
}
