import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/nutrition/widgets/nutrients/source_attribution.dart';

import '../../../app_fonts.dart';
import '../../../l10n_test_loader.dart';

/// The narrowest phone the app supports — the width at which the Vietnamese
/// caption ("Mục tiêu theo WHO/FAO · RDA Việt Nam · NASEM DRI") wraps, which is
/// the case the old Row got wrong.
const Size _kSmallPhone = Size(320, 568);

Widget _wrap(Widget child) => EasyLocalization(
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
          home: Scaffold(body: Center(child: child)),
        ),
  ),
);

Future<void> _pump(WidgetTester tester) async {
  tester.view.physicalSize = _kSmallPhone;
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(_wrap(const SourceAttribution()));
  await tester.pumpAndSettle();
}

/// The caption's own paragraph. `.first` because each inline [Icon] is itself
/// a [RichText] nested inside this one, and tree order puts the outer one first.
RenderParagraph _paragraph(WidgetTester tester) =>
    tester.renderObject<RenderParagraph>(
      find
          .descendant(
            of: find.byType(SourceAttribution),
            matching: find.byType(RichText),
          )
          .first,
    );

/// The box the paragraph laid out for one span, in paragraph coordinates.
Rect _boxFor(RenderParagraph paragraph, int start, int end) {
  final boxes = paragraph.getBoxesForSelection(
    TextSelection(baseOffset: start, extentOffset: end),
  );
  expect(boxes, isNotEmpty);
  return boxes.first.toRect();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.flutter.io/shared_preferences'),
          (call) async => call.method == 'getAll' ? <String, Object>{} : null,
        );
    await EasyLocalization.ensureInitialized();
    // Without the real font the caption measures in placeholder glyphs and the
    // wrap this test is about never happens.
    await loadAppFonts();
  });

  testWidgets('carries both icons as inline spans, not Row children', (
    tester,
  ) async {
    await _pump(tester);
    final text = tester.widget<Text>(
      find.descendant(
        of: find.byType(SourceAttribution),
        matching: find.byType(Text),
      ),
    );
    final spans = (text.textSpan! as TextSpan).children!;
    final icons =
        spans.whereType<WidgetSpan>().where((s) => s.child is Icon).toList();
    expect(
      icons.length,
      2,
      reason: 'the shield and the info glyph must flow with the words',
    );
    // Both ride the text's middle so they sit on the line, not on its box.
    for (final icon in icons) {
      expect(icon.alignment, PlaceholderAlignment.middle);
    }
    expect(find.byType(Row), findsNothing);
  });

  testWidgets('sits the shield on the caption\'s first line', (tester) async {
    await _pump(tester);
    final paragraph = _paragraph(tester);
    // Span order: shield (1 char), gap (1 char), then the caption from offset 2.
    final shield = _boxFor(paragraph, 0, 1);
    final firstGlyph = _boxFor(paragraph, 2, 3);
    expect(
      shield.center.dy,
      closeTo(firstGlyph.center.dy, 2),
      reason:
          'the icon used to be a Row cell centred on the WHOLE wrapped block, '
          'which floated it off line one',
    );
  });

  testWidgets('keeps the 44pt target and still opens the citations', (
    tester,
  ) async {
    await _pump(tester);
    expect(find.byType(GestureDetector), findsWidgets);
    expect(
      tester.getSize(find.byType(SourceAttribution)).height,
      greaterThanOrEqualTo(44),
    );
    await tester.tap(find.byType(SourceAttribution));
    await tester.pumpAndSettle();
    expect(find.text(tr('nutrition.sources.title')), findsOneWidget);
  });
}
