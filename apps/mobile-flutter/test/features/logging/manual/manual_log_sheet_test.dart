import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../app_fonts.dart';
import 'manual_harness.dart';

/// Every control a step of the flow needs stays ON SCREEN — the meal's Save,
/// the add sheet's search, the food page's "Add to meal" — on the viewports
/// that break sheets and at the app's 1.3x Dynamic Type ceiling. A layout
/// overflow anywhere in the walk fails the test on its own.
const _viewports = <String, Size>{
  'short phone': Size(320, 568),
  'android': Size(360, 640),
  'landscape': Size(667, 375),
  'iPhone 14': Size(390, 844),
};

Future<void> _expectOnScreen(
  WidgetTester tester,
  Finder finder,
  Size size,
  String what,
) async {
  expect(finder, findsOneWidget, reason: '$what is missing');
  final rect = tester.getRect(finder);
  expect(
    rect.bottom,
    lessThanOrEqualTo(size.height + 0.5),
    reason: '$what clipped below the ${size.width}x${size.height} viewport',
  );
  expect(rect.top, greaterThanOrEqualTo(-0.5), reason: '$what clipped above');
  expect(tester.any(finder.hitTestable()), isTrue, reason: '$what is covered');
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

  for (final MapEntry(key: name, value: size) in _viewports.entries) {
    for (final scale in [1.0, 1.3]) {
      testWidgets('every step keeps its action on screen, $name @${scale}x', (
        tester,
      ) async {
        sizeTo(tester, size, scale);
        await openManualSheet(tester, FakeManualApi());
        await _expectOnScreen(tester, find.text('Save'), size, 'Save');

        // In landscape the plate scrolls under the pinned Save; reach the row
        // the way a thumb would.
        await tester.ensureVisible(find.text('Add ingredient'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Add ingredient'));
        await tester.pumpAndSettle();
        await _expectOnScreen(
          tester,
          find.byType(TextField).last,
          size,
          'the search field',
        );

        await tester.ensureVisible(find.text('Cơm trắng'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Cơm trắng'));
        await tester.pumpAndSettle();
        await _expectOnScreen(
          tester,
          find.text('Add to meal'),
          size,
          'Add to meal',
        );

        await tester.tap(find.text('Add to meal'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Done'));
        await tester.pumpAndSettle();
        await _expectOnScreen(tester, find.text('Save'), size, 'Save');
      });
    }
  }
}
