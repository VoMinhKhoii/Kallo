import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/widgets/composer/meal_input.dart';
import 'package:kallo_mobile/features/logging/widgets/composer/composer_action_row.dart';
import 'package:kallo_mobile/features/logging/widgets/composer/meal_input_controls.dart';
import 'package:kallo_mobile/theme/calm_tokens.dart';

import '../../../app_fonts.dart';
import '../../../l10n_test_loader.dart';

/// The composer's mode pill and the order of the controls beside it.
///
/// The pill reads "Cheat meal Medium": the mode is the state, the intensity is
/// a detail OF it, and the only thing separating them is colour — same size,
/// same weight. Bolding the mode was tried and rejected: two weights in one
/// six-word run reads as two labels, not one.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.flutter.io/shared_preferences'),
          (call) async => call.method == 'getAll' ? <String, Object>{} : null,
        );
    await EasyLocalization.ensureInitialized();
    // The control-order assertions measure horizontal positions.
    await loadAppFonts();
  });

  Widget host({String? modeDetail, bool withBarcode = false}) =>
      EasyLocalization(
        supportedLocales: const [Locale('en')],
        path: 'assets/l10n',
        fallbackLocale: const Locale('en'),
        assetLoader: const FsL10nLoader(),
        child: Builder(
          builder: (context) => MaterialApp(
            localizationsDelegates: context.localizationDelegates,
            supportedLocales: context.supportedLocales,
            locale: context.locale,
            home: Scaffold(
              body: MealInput(
                controller: MealInputController(),
                onSubmit: (_) {},
                modeLabel: 'Cheat meal',
                modeDetail: modeDetail,
                onModePressed: () {},
                onBarcodePressed: withBarcode ? () {} : null,
              ),
            ),
          ),
        ),
      );

  List<TextSpan> pillSpans(WidgetTester tester) {
    // The button's leading Icon is a RichText too — the label is the one
    // carrying spans.
    final rich = tester
        .widgetList<RichText>(
          find.descendant(
            of: find.byType(ComposerModeButton),
            matching: find.byType(RichText),
          ),
        )
        .firstWhere((r) => (r.text as TextSpan).children != null);
    // `Text.rich` nests the caller's span under one carrying the inherited
    // style; unwrap the single-child wrappers to reach the real runs.
    var span = rich.text as TextSpan;
    while (span.text == null && span.children?.length == 1) {
      span = span.children!.single as TextSpan;
    }
    return span.children?.cast<TextSpan>() ?? [span];
  }

  testWidgets('the pill renders the mode in ink and the intensity muted', (
    tester,
  ) async {
    await tester.pumpWidget(host(modeDetail: 'Medium'));
    await tester.pumpAndSettle();

    final spans = pillSpans(tester);
    expect(spans, hasLength(2));
    expect(spans[0].text, 'Cheat meal');
    expect(spans[1].text, ' Medium');

    final mode = spans[0].style!;
    final intensity = spans[1].style!;
    expect(
      intensity.color,
      kInkMuted,
      reason: 'the intensity is the muted half of the pill',
    );
    expect(mode.color, isNot(kInkMuted), reason: 'the mode name stays ink');
    // Colour is the ONLY difference: same size, same weight, and the mode is
    // explicitly not bold.
    expect(intensity.fontSize, mode.fontSize);
    expect(intensity.fontWeight, mode.fontWeight);
    expect(mode.fontWeight, FontWeight.w400);
    expect(mode.fontWeight, isNot(FontWeight.bold));
  });

  testWidgets('a mode with no intensity renders its name alone', (
    tester,
  ) async {
    await tester.pumpWidget(host());
    await tester.pumpAndSettle();

    final spans = pillSpans(tester);
    expect(spans, hasLength(1));
    expect(spans[0].text, 'Cheat meal');
    expect(spans.single.style!.color, isNot(kInkMuted));
  });

  testWidgets('the pill announces mode and intensity as one label', (
    tester,
  ) async {
    await tester.pumpWidget(host(modeDetail: 'Medium'));
    await tester.pumpAndSettle();

    final semantics = tester.widget<Semantics>(
      find
          .descendant(
            of: find.byType(ComposerModeButton),
            matching: find.byType(Semantics),
          )
          .first,
    );
    expect(semantics.properties.label, 'Cheat meal Medium');
  });

  testWidgets('the scan button sits between the mode pill and send', (
    tester,
  ) async {
    await tester.pumpWidget(host(withBarcode: true));
    await tester.pumpAndSettle();

    final mode = tester.getRect(find.byType(ComposerModeButton));
    final scan = tester.getRect(find.byType(ComposerBarcodeButton));
    final send = tester.getRect(find.byType(ComposerActionButton));

    expect(mode.right, lessThan(scan.left));
    expect(
      scan.right,
      lessThanOrEqualTo(send.left),
      reason: 'scan belongs to the right-hand cluster, left of send',
    );
    // The two share the right edge rather than scan hiding beside the mode
    // name: nothing but their own tap targets between them.
    expect(send.left - scan.right, lessThan(8));
    // Both keep the 44pt HIG target.
    expect(scan.width, 44);
    expect(scan.height, 44);
    expect(send.width, 44);
    expect(send.height, 44);
  });
}
