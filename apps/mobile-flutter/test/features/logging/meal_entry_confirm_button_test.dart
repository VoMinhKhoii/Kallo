import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/widgets/meal_entry_confirm_button.dart';

import '../../l10n_test_loader.dart';

Widget _wrap(Widget child) => EasyLocalization(
  supportedLocales: const [Locale('en'), Locale('vi')],
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

  testWidgets('disabled refuses the tap, not just the opacity', (tester) async {
    // `disabled` used to drive nothing but a 50% opacity, leaving every
    // callback live. The card's own call site nulls `onTap` alongside it, so
    // nothing was reachable — but the two are separate arguments, and this
    // button saves a meal.
    var taps = 0;
    await tester.pumpWidget(
      _wrap(
        MealEntryConfirmButton(
          editing: false,
          disabled: true,
          onTap: () => taps++,
        ),
      ),
    );
    await tester.pumpAndSettle(); // EasyLocalization resolves on the next frame

    await tester.tap(find.byType(MealEntryConfirmButton));
    await tester.pumpAndSettle();

    expect(taps, 0);
  });

  testWidgets('and still fires when it is enabled', (tester) async {
    var taps = 0;
    await tester.pumpWidget(
      _wrap(
        MealEntryConfirmButton(
          editing: false,
          disabled: false,
          onTap: () => taps++,
        ),
      ),
    );
    await tester.pumpAndSettle(); // EasyLocalization resolves on the next frame

    await tester.tap(find.byType(MealEntryConfirmButton));
    await tester.pumpAndSettle();

    expect(taps, 1);
  });
}
