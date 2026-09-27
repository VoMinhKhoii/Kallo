import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/logging/logic/barcode_amount.dart';
import 'package:kallo_mobile/features/logging/widgets/sheets/barcode/barcode_grams_picker.dart';

import '../../../l10n_test_loader.dart';

/// The step owns the amount: every keystroke goes up through [onChanged] and
/// comes back down as [grams], exactly as `BarcodeProductStep` wires it.
class _Host extends StatefulWidget {
  const _Host();
  @override
  State<_Host> createState() => _HostState();
}

class _HostState extends State<_Host> {
  int grams = 100;

  @override
  Widget build(BuildContext context) => BarcodeGramsPicker(
    grams: grams,
    unit: 'ml',
    disabled: false,
    onAdjust: (delta) => setState(() => grams = clampGrams(grams + delta)),
    onChanged: (value) {
      if (value == null) return;
      setState(() => grams = clampGrams(value));
    },
  );
}

void main() {
  setUpAll(() async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.flutter.io/shared_preferences'),
          (call) async => call.method == 'getAll' ? <String, Object>{} : null,
        );
    await EasyLocalization.ensureInitialized();
  });

  Future<void> pump(WidgetTester tester) async {
    await tester.pumpWidget(
      EasyLocalization(
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
                home: const Scaffold(body: _Host()),
              ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  bool fieldFocused(WidgetTester tester) =>
      tester
          .state<EditableTextState>(find.byType(EditableText))
          .widget
          .focusNode
          .hasFocus;

  // The field used to be keyed on its own value, so every keystroke built a
  // brand-new field: focus went with the old one and iOS dropped the keyboard
  // after a single digit.
  testWidgets('typing an amount keeps the field focused and the keyboard up', (
    tester,
  ) async {
    await pump(tester);
    await tester.tap(find.byType(EditableText));
    await tester.pump();
    expect(fieldFocused(tester), isTrue);

    await tester.enterText(find.byType(EditableText), '3');
    await tester.pump();
    expect(fieldFocused(tester), isTrue);
    expect(tester.testTextInput.isVisible, isTrue);

    await tester.enterText(find.byType(EditableText), '33');
    await tester.pump();
    await tester.enterText(find.byType(EditableText), '330');
    await tester.pump();
    expect(fieldFocused(tester), isTrue);
    expect(tester.testTextInput.isVisible, isTrue);
    expect(find.text('330'), findsOneWidget);
  });

  testWidgets('a stepper tap still updates the typed text', (tester) async {
    await pump(tester);
    await tester.tap(find.bySemanticsLabel(tr('logging.barcode.increaseGrams')));
    await tester.pump();
    expect(find.text('150'), findsOneWidget);
  });

  testWidgets('a quick chip still updates the typed text', (tester) async {
    await pump(tester);
    await tester.tap(find.text('250ml'));
    await tester.pump();
    expect(find.text('250'), findsOneWidget);
  });
}
