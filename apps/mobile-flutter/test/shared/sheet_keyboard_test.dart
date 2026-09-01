import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/logic/meal_log_mode.dart';
import 'package:kallo_mobile/features/logging/widgets/sheets/meal_mode_sheet.dart';
import 'package:kallo_mobile/shared/widgets/sheet/kallo_sheet.dart';
import 'package:kallo_mobile/shared/widgets/sheet/kallo_sheet_header.dart';

import '../l10n_test_loader.dart';

/// No sheet may sit under the keyboard.
///
/// `showModalBottomSheet` does not pay `viewInsets` for you, so every sheet
/// with a field was doing it by hand — and `group_info_sheet`, which has two
/// (inline rename, member search), was not doing it at all. `KalloSheetSurface`
/// owns it now; these assert the shared surface honours the inset and that a
/// real sheet's primary control stays above the pad.
const _keyboard = 300.0;
const _screen = Size(390, 844);

void _sizeTo(WidgetTester tester, {double keyboard = 0}) {
  tester.view.physicalSize = _screen;
  tester.view.devicePixelRatio = 1.0;
  tester.view.viewInsets = FakeViewPadding(bottom: keyboard);
  addTearDown(tester.view.reset);
}

Widget _wrap(Widget child) => ProviderScope(
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
        home: Scaffold(body: child),
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
  });

  testWidgets('the shared surface ends where the keyboard begins', (
    tester,
  ) async {
    _sizeTo(tester, keyboard: _keyboard);
    await tester.pumpWidget(
      _wrap(
        const Align(
          alignment: Alignment.bottomCenter,
          child: KalloSheetSurface(
            child: SizedBox(height: 200, child: Text('body')),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final painted = tester.getRect(
      find.descendant(
        of: find.byType(KalloSheetSurface),
        matching: find.byType(Container),
      ),
    );
    expect(
      painted.bottom,
      _screen.height - _keyboard,
      reason: 'the white surface must stop at the top of the keyboard',
    );
  });

  testWidgets('a real sheet keeps its content above the keyboard', (
    tester,
  ) async {
    _sizeTo(tester, keyboard: _keyboard);
    await tester.pumpWidget(
      _wrap(
        Builder(
          builder: (c) => TextButton(
            onPressed: () =>
                showMealModeSheet(c, current: MealLogMode.cheat),
            child: const Text('open'),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    final visible = _screen.height - _keyboard;
    // The header the sheet is dismissed from, and the deepest row it owns.
    for (final finder in [
      find.byType(KalloSheetHeader),
      find.text('logging.cheatIntensity.title'.tr()),
    ]) {
      await tester.ensureVisible(finder);
      await tester.pumpAndSettle();
      expect(
        tester.getRect(finder).bottom,
        lessThanOrEqualTo(visible),
        reason: '$finder is under the keyboard',
      );
    }
  });

  testWidgets('with no keyboard the surface still reaches the bottom', (
    tester,
  ) async {
    _sizeTo(tester);
    await tester.pumpWidget(
      _wrap(
        const Align(
          alignment: Alignment.bottomCenter,
          child: KalloSheetSurface(
            child: SizedBox(height: 200, child: Text('body')),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final painted = tester.getRect(
      find.descendant(
        of: find.byType(KalloSheetSurface),
        matching: find.byType(Container),
      ),
    );
    expect(painted.bottom, _screen.height);
  });
}
