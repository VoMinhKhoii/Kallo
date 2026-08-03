import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:nham_mobile/features/logging/logic/meal_log_mode.dart';
import 'package:nham_mobile/features/logging/widgets/portion/portion_picker_sheet.dart';
import 'package:nham_mobile/features/logging/widgets/sheets/meal_mode_sheet.dart';
import 'package:nham_mobile/models/vessel.dart';

import 'app_fonts.dart';
import 'l10n_test_loader.dart';

/// Every modal sheet, on the viewports that actually break them.
///
/// Material caps a non-`isScrollControlled` sheet at 9/16 of the screen and
/// clips anything past it, so the action row simply leaves the screen — the
/// user can see the sheet and cannot finish with it. Three sheets shipped that
/// way: the mode picker (104px over on a 320x568 phone at large text), the
/// citations list, and the portion picker (57px over, Apply off-screen, on a
/// cup portion). Nothing about the widgets themselves announced it.
///
/// The hostile set is: the shortest supported phone (320x568 — iOS deployment
/// target is 15.5, so the 1st-gen SE is in scope), a common Android size, and
/// LANDSCAPE, where the viewport is roughly half as tall and both Info.plist
/// and the Android manifest allow rotation. Each runs at 1.0x and at the app's
/// 1.3x Dynamic Type ceiling.
///
/// A RenderFlex overflow fails the test by itself; the explicit assertion is
/// that the primary action can be scrolled to and is genuinely on screen.

const _viewports = <String, Size>{
  'short phone': Size(320, 568),
  'android': Size(360, 640),
  'landscape': Size(667, 375),
};

const _scales = [1.0, 1.3];

Widget _wrap(Widget child) => EasyLocalization(
  supportedLocales: const [Locale('en'), Locale('vi')],
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
);

void _sizeTo(WidgetTester tester, Size size, double scale) {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1.0;
  // Root-level, not an inner MediaQuery: a modal sheet is its own route and
  // never sees a MediaQuery installed below the navigator.
  tester.platformDispatcher.textScaleFactorTestValue = scale;
  addTearDown(tester.view.reset);
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
}

Future<void> _openSheet(WidgetTester tester, VoidCallback Function(BuildContext) open) async {
  await tester.pumpWidget(
    _wrap(Builder(builder: (c) => TextButton(onPressed: open(c), child: const Text('open')))),
  );
  await tester.pumpAndSettle();
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
}

/// The action must be reachable — scrollable counts, clipped does not.
Future<void> _expectReachable(WidgetTester tester, Finder action, Size size) async {
  expect(action, findsOneWidget);
  await tester.ensureVisible(action);
  await tester.pumpAndSettle();
  final rect = tester.getRect(action);
  expect(
    rect.bottom,
    lessThanOrEqualTo(size.height),
    reason: 'action clipped below the viewport on ${size.width}x${size.height}',
  );
  expect(rect.top, greaterThanOrEqualTo(0));
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
    await loadAppFonts();
  });

  for (final entry in _viewports.entries) {
    for (final scale in _scales) {
      final where = '${entry.key} @${scale}x';

      testWidgets('portion picker — piece branch, $where', (tester) async {
        _sizeTo(tester, entry.value, scale);
        await _openSheet(
          tester,
          (c) => () => showPortionPicker(
            c,
            // Poultry: the drumstick is the tallest silhouette in the set.
            vessel: const PieceVessel(tier: 3, count: 1, kind: PieceKind.poultry),
            grams: 150,
            itemCalories: 300,
            itemQuantity: 150,
          ),
        );
        await _expectReachable(tester, find.text('Apply'), entry.value);
      });

      testWidgets('portion picker — cup branch, $where', (tester) async {
        _sizeTo(tester, entry.value, scale);
        await _openSheet(
          tester,
          (c) => () => showPortionPicker(
            c,
            // Cups are the tall case: aspect 0.57 makes tier 4 ~149pt tall,
            // which is what pushed Apply off a 320pt screen entirely.
            vessel: const ContainerVessel(
              family: ContainerFamily.cup,
              tier: 4,
              dishClass: DishClass.drink,
            ),
            grams: 600,
            itemCalories: 300,
            itemQuantity: 150,
          ),
        );
        await _expectReachable(tester, find.text('Apply'), entry.value);
      });

      testWidgets('meal mode sheet, $where', (tester) async {
        _sizeTo(tester, entry.value, scale);
        await _openSheet(
          tester,
          (c) => () => showMealModeSheet(c, current: MealLogMode.normal),
        );
        // The last row is the one the 9/16 cap used to eat. Barcode is gated
        // behind `isBarcodeLoggingSupported`, which is false under the test
        // binding, so Manual is the deepest row this harness can assert on —
        // in production the sheet is one row taller than what's covered here.
        await _expectReachable(
          tester,
          find.text('logging.modeSelector.manual'.tr()),
          entry.value,
        );
      });
    }
  }
}
