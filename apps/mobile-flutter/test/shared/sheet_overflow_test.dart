import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/logic/meal_log_mode.dart';
import 'package:kallo_mobile/features/logging/logic/meal_edit/meal_edit_sources.dart';
import 'package:kallo_mobile/features/logging/widgets/meal_edit/meal_edit_sheet.dart';
import 'package:kallo_mobile/features/logging/widgets/portion/ruler/portion_ruler_control.dart';
import 'package:kallo_mobile/models/logging/meal.dart';
import 'package:kallo_mobile/features/logging/widgets/sheets/meal_mode_sheet.dart';
import 'package:kallo_mobile/features/nutrition/widgets/nutrients/source_attribution.dart';
import 'package:kallo_mobile/models/nutrition/vessel.dart';
import 'package:kallo_mobile/services/billing/entitlements_provider.dart';

import '../app_fonts.dart';
import '../l10n_test_loader.dart';

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

// Signed out: the mode sheet reads its Premium markers from the entitlement
// snapshot, and a null user resolves that to "free, nothing enforced" without
// a network call.
Widget _wrap(Widget child) => ProviderScope(
  overrides: [entitlementsUserIdProvider.overrideWithValue(null)],
  child: EasyLocalization(
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
            home: Scaffold(body: child),
          ),
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

Future<void> _openSheet(
  WidgetTester tester,
  VoidCallback Function(BuildContext) open,
) async {
  await tester.pumpWidget(
    _wrap(
      Builder(
        builder:
            (c) => TextButton(onPressed: open(c), child: const Text('open')),
      ),
    ),
  );
  await tester.pumpAndSettle();
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
}

/// The meal edit sheet on one staged dish in [vessel], its Size dropdown open —
/// the tallest state the sheet has.
VoidCallback Function(BuildContext) _editSheet(ClientVessel vessel, int grams) {
  final items = [
    MealItem(
      id: 'a',
      name: 'Cá kho',
      quantity: grams.toDouble(),
      unit: 'g',
      macros: const MacroBreakdown(
        calories: 300,
        protein: 30,
        carbs: 4,
        fat: 18,
      ),
      vessel: vessel,
    ),
  ];
  return (c) =>
      () => showMealEditSheet(
        c,
        draft: draftFromStaged(items, items),
        commitLabel: 'Done',
        sizeOpen: 'a',
        onCommit: (_) async {},
      );
}

/// The action must be reachable — scrollable counts, clipped does not.
Future<void> _expectReachable(
  WidgetTester tester,
  Finder action,
  Size size,
) async {
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

  // Wrapping a sheet body in a scroll view puts a vertical drag recognizer
  // inside the one `BottomSheet` uses for swipe-to-dismiss. On a sheet whose
  // content fits, the inner scrollable has nothing to scroll and must not eat
  // the gesture — otherwise `scrollable: true` silently costs every one of
  // these sheets its dismiss gesture, which no overflow assertion would catch.
  testWidgets('a scrollable sheet still dismisses on swipe-down', (
    tester,
  ) async {
    _sizeTo(tester, const Size(390, 844), 1.0);
    await _openSheet(
      tester,
      _editSheet(
        const PieceVessel(tier: 3, count: 1, kind: PieceKind.fish),
        150,
      ),
    );
    expect(find.text('Edit meal'), findsOneWidget);
    await tester.drag(find.text('Edit meal'), const Offset(0, 500));
    await tester.pumpAndSettle();
    expect(
      find.text('Edit meal'),
      findsNothing,
      reason: 'the inner scroll view swallowed swipe-to-dismiss',
    );
  });

  for (final entry in _viewports.entries) {
    for (final scale in _scales) {
      final where = '${entry.key} @${scale}x';

      testWidgets('meal edit sheet — piece ruler, $where', (tester) async {
        _sizeTo(tester, entry.value, scale);
        await _openSheet(
          tester,
          // Poultry: the drumstick is the tallest silhouette in the set.
          _editSheet(
            const PieceVessel(tier: 3, count: 1, kind: PieceKind.poultry),
            150,
          ),
        );
        await _expectReachable(tester, find.text('Done'), entry.value);
        await _expectReachable(
          tester,
          find.byType(PortionRulerControl),
          entry.value,
        );
      });

      testWidgets('meal edit sheet — cup ruler, $where', (tester) async {
        _sizeTo(tester, entry.value, scale);
        await _openSheet(
          tester,
          // Cups are the tall case: aspect 0.57 makes tier 4 ~149pt tall,
          // which is what pushed the old picker's Apply off a 320pt screen.
          _editSheet(
            const ContainerVessel(
              family: ContainerFamily.cup,
              tier: 4,
              dishClass: DishClass.drink,
            ),
            600,
          ),
        );
        await _expectReachable(tester, find.text('Done'), entry.value);
        await _expectReachable(
          tester,
          find.byType(PortionRulerControl),
          entry.value,
        );
      });

      testWidgets('citations sheet, $where', (tester) async {
        _sizeTo(tester, entry.value, scale);
        // No public opener — the sheet is private to `SourceAttribution`, so
        // this goes in through the affordance a user actually taps. It is the
        // third sheet named at the top of this file as having shipped clipped,
        // and it was the one left without a guard.
        await tester.pumpWidget(_wrap(const SourceAttribution()));
        await tester.pumpAndSettle();
        await tester.tap(find.byType(SourceAttribution));
        await tester.pumpAndSettle();
        // The last citation is what the 9/16 cap ate.
        await _expectReachable(
          tester,
          find.text('nutrition.targetSources.nasem'.tr()),
          entry.value,
        );
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
