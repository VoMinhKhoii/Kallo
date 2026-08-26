import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/widgets/composer/meal_input.dart';

import '../../../l10n_test_loader.dart';

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

  Widget host(MealInputController controller, List<String> submitted) =>
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
                home: Scaffold(
                  body: MealInput(
                    controller: controller,
                    onSubmit: submitted.add,
                  ),
                ),
              ),
        ),
      );

  testWidgets('drops the keyboard when the meal is sent', (tester) async {
    final controller = MealInputController();
    final submitted = <String>[];
    await tester.pumpWidget(host(controller, submitted));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), 'phở bò');
    await tester.pump();
    final field = tester.widget<TextField>(find.byType(TextField));
    expect(
      field.focusNode!.hasFocus,
      isTrue,
      reason: 'typing focuses the field',
    );

    await tester.tap(find.bySemanticsLabel('Analyze'));
    await tester.pumpAndSettle();

    expect(submitted, ['phở bò']);
    // The point of the fix: the answer is about to stream in below, and the
    // keyboard was covering half the feed while it did.
    expect(
      field.focusNode!.hasFocus,
      isFalse,
      reason: 'sending a meal should put the keyboard away',
    );
  });

  testWidgets('an empty composer neither submits nor steals focus', (
    tester,
  ) async {
    final controller = MealInputController();
    final submitted = <String>[];
    await tester.pumpWidget(host(controller, submitted));
    await tester.pumpAndSettle();

    controller.focus();
    await tester.pumpAndSettle();
    final field = tester.widget<TextField>(find.byType(TextField));

    await tester.tap(find.bySemanticsLabel('Analyze'), warnIfMissed: false);
    await tester.pumpAndSettle();

    expect(submitted, isEmpty);
    expect(
      field.focusNode!.hasFocus,
      isTrue,
      reason: 'a refused submit must not dismiss the keyboard mid-typing',
    );
  });
}
