import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/widgets/sheets/manual/add/manual_add_sheet.dart';
import 'package:kallo_mobile/features/logging/widgets/sheets/manual/manual_log_sheet.dart';

import '../../../app_fonts.dart';
import 'manual_harness.dart';

/// Back and forth through the two sheets: every way in and out of the add
/// sheet and the food page, and what each leaves on the plate.
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

  Finder inAdd(Finder finder) =>
      find.descendant(of: find.byType(ManualAddSheet), matching: finder);
  Finder inMeal(Finder finder) =>
      find.descendant(of: find.byType(ManualLogSheet), matching: finder);

  Future<void> tap(WidgetTester tester, Finder finder) async {
    await tester.tap(finder);
    await tester.pumpAndSettle();
  }

  Future<void> openAdd(WidgetTester tester) =>
      tap(tester, find.text('Add ingredient'));

  /// Pick [name] from the add sheet's list and add it at its opening amount.
  Future<void> addFood(WidgetTester tester, String name) async {
    await tap(tester, inAdd(find.text(name)));
    await tap(tester, find.text('Add to meal'));
  }

  testWidgets('open and close untouched: nothing sent, next open is empty', (
    tester,
  ) async {
    sizeTo(tester, const Size(390, 844));
    final api = FakeManualApi();
    await openManualSheet(tester, api);
    await tap(tester, inMeal(find.bySemanticsLabel('Close')));
    expect(find.byType(ManualLogSheet), findsNothing);
    expect(api.posts, isEmpty);

    await tap(tester, find.text('open'));
    expect(find.text('Optional'), findsOneWidget);
    expect(find.textContaining('ingredient'), findsOneWidget); // the add row
  });

  testWidgets('add sheet closed without adding: no Done, plate still empty', (
    tester,
  ) async {
    sizeTo(tester, const Size(390, 844));
    await openManualSheet(tester, FakeManualApi());
    await openAdd(tester);
    expect(find.text('Done'), findsNothing);
    // First open: the search is focused, keyboard up.
    expect(tester.testTextInput.isVisible, isTrue);

    await tap(tester, inAdd(find.bySemanticsLabel('Close')));
    expect(find.byType(ManualAddSheet), findsNothing);
    expect(find.text('Optional'), findsOneWidget);
    expect(find.text('1 ingredient'), findsNothing);
  });

  testWidgets('pick, back, pick another: only the second goes in', (
    tester,
  ) async {
    sizeTo(tester, const Size(390, 844));
    await openManualSheet(tester, FakeManualApi());
    await openAdd(tester);
    await search(tester, 'ức gà');

    await tap(tester, inAdd(find.text('Ức gà hầm, bỏ da')));
    expect(find.textContaining('kcal with this'), findsOneWidget);
    expect(tester.testTextInput.isVisible, isFalse);

    // Back keeps the query and its results; the strip forgets the food.
    await tap(tester, inAdd(find.bySemanticsLabel('Back')));
    expect(find.text('Results for “ức gà”'), findsOneWidget);
    expect(find.widgetWithText(TextField, 'ức gà'), findsOneWidget);
    expect(find.text('No ingredients yet'), findsOneWidget);
    expect(find.textContaining('kcal with this'), findsNothing);
    expect(find.text('Done'), findsNothing);
    // Coming back leaves the keyboard down.
    expect(tester.testTextInput.isVisible, isFalse);

    await addFood(tester, 'Ức gà');
    expect(find.text('Raw · 150 g in meal'), findsOneWidget);
    expect(
      find.text('Cooked · Skinless chicken breast, stewed'),
      findsOneWidget,
    );
    await tap(tester, find.text('Done'));
    expect(find.text('1 ingredient'), findsOneWidget);
    expect(find.text('Raw · 150 g'), findsOneWidget);
  });

  testWidgets('swiping the add sheet away from a food page adds nothing', (
    tester,
  ) async {
    sizeTo(tester, const Size(390, 844));
    await openManualSheet(tester, FakeManualApi());
    await openAdd(tester);
    await tap(tester, inAdd(find.text('Cơm trắng')));
    expect(find.text('Add to meal'), findsOneWidget);

    await tester.fling(
      inAdd(find.text('Add ingredients')),
      const Offset(0, 500),
      2000,
    );
    await tester.pumpAndSettle();
    expect(find.byType(ManualAddSheet), findsNothing);
    expect(find.text('Optional'), findsOneWidget);
    expect(find.text('1 ingredient'), findsNothing);
  });

  testWidgets('add two, Done, reopen: both marked, Done waits for a new add', (
    tester,
  ) async {
    sizeTo(tester, const Size(390, 844));
    await openManualSheet(tester, FakeManualApi());
    await openAdd(tester);
    await addFood(tester, 'Cơm trắng');
    await search(tester, 'ức gà');
    await addFood(tester, 'Ức gà');
    await tap(tester, find.text('Done'));
    expect(find.text('2 ingredients'), findsOneWidget);
    expect(find.text('Cơm trắng + Ức gà'), findsOneWidget);

    await openAdd(tester);
    // A fresh add sheet: recents, not the last query; both foods marked.
    expect(find.text('Recent'), findsOneWidget);
    expect(inAdd(find.textContaining('g in meal')), findsNWidgets(2));
    expect(find.text('Done'), findsNothing);
    expect(find.textContaining('2 ingredients ·'), findsOneWidget);

    await addFood(tester, 'Sữa chua (từ sữa bò)');
    await tap(tester, find.text('Done'));
    expect(find.text('3 ingredients'), findsOneWidget);
  });

  testWidgets('edit from the plate: no arrow until the amount moves; '
      'closing keeps the old amount', (tester) async {
    sizeTo(tester, const Size(390, 844));
    await openManualSheet(tester, FakeManualApi());
    await openAdd(tester);
    await search(tester, 'ức gà');
    await addFood(tester, 'Ức gà');
    await tap(tester, find.text('Done'));

    await tap(tester, find.text('Raw · 150 g'));
    expect(find.text('Update'), findsOneWidget);
    // Opened from the plate, the leading control closes — there is no list
    // to go back to.
    expect(inAdd(find.bySemanticsLabel('Back')), findsNothing);
    expect(find.text('1 ingredient · 180 kcal'), findsOneWidget);

    await tap(tester, find.bySemanticsLabel('More'));
    expect(find.textContaining('192 kcal'), findsOneWidget);
    await tap(tester, inAdd(find.bySemanticsLabel('Close')));
    expect(find.text('Raw · 150 g'), findsOneWidget);
    expect(find.text('180 kcal'), findsOneWidget);

    // Update without a change is a no-op.
    await tap(tester, find.text('Raw · 150 g'));
    await tap(tester, find.text('Update'));
    expect(find.text('Raw · 150 g'), findsOneWidget);
    expect(find.text('1 ingredient'), findsOneWidget);
  });

  testWidgets('removing the only item turns Save back off', (tester) async {
    sizeTo(tester, const Size(390, 844));
    final api = FakeManualApi();
    await openManualSheet(tester, api);
    await openAdd(tester);
    await addFood(tester, 'Cơm trắng');
    await tap(tester, find.text('Done'));

    // The row's subtitle — its name is also the name field's placeholder.
    await tap(tester, inMeal(find.textContaining('Cooked ·')));
    await tap(tester, find.text('Remove from meal'));
    expect(find.byType(ManualAddSheet), findsNothing);
    expect(find.text('Optional'), findsOneWidget);
    await tap(tester, find.text('Save'));
    expect(api.posts, isEmpty);
    expect(find.byType(ManualLogSheet), findsOneWidget);
  });

  testWidgets('an added row in the results reopens for an update, in place', (
    tester,
  ) async {
    sizeTo(tester, const Size(390, 844));
    await openManualSheet(tester, FakeManualApi());
    await openAdd(tester);
    await search(tester, 'ức gà');
    await addFood(tester, 'Ức gà');

    await tap(tester, inAdd(find.text('Ức gà')));
    expect(find.text('Update'), findsOneWidget);
    // The leading control goes back to the list here, not out of the sheet.
    expect(inAdd(find.bySemanticsLabel('Back')), findsOneWidget);
    await tap(tester, find.bySemanticsLabel('More'));
    await tap(tester, find.text('Update'));
    expect(find.text('Raw · 160 g in meal'), findsOneWidget);
    expect(find.text('Done'), findsOneWidget);
    await tap(tester, find.text('Done'));
    expect(find.text('1 ingredient'), findsOneWidget);
    expect(find.text('Raw · 160 g'), findsOneWidget);
  });

  testWidgets('raw and stewed chicken are two foods: both go in', (
    tester,
  ) async {
    sizeTo(tester, const Size(390, 844));
    final api = FakeManualApi();
    await openManualSheet(tester, api);
    await openAdd(tester);
    await search(tester, 'ức gà');
    await addFood(tester, 'Ức gà');
    await addFood(tester, 'Ức gà hầm, bỏ da');
    await tap(tester, find.text('Done'));
    expect(find.text('2 ingredients'), findsOneWidget);
    expect(find.text('Ức gà + Ức gà hầm, bỏ da'), findsOneWidget);

    await tap(tester, find.text('Save'));
    final body = api.posts.single.$2! as Map<String, dynamic>;
    expect(body.containsKey('name'), isFalse);
    expect(
      [for (final item in body['items'] as List) item['foodCompositionId']],
      ['fct-chicken-raw', 'fct-chicken-stewed'],
    );
  });

  testWidgets('closing the meal sheet discards its plate', (tester) async {
    sizeTo(tester, const Size(390, 844));
    final api = FakeManualApi();
    await openManualSheet(tester, api);
    await openAdd(tester);
    await addFood(tester, 'Cơm trắng');
    await tap(tester, find.text('Done'));
    await tap(tester, inMeal(find.bySemanticsLabel('Close')));
    expect(api.posts, isEmpty);

    await tap(tester, find.text('open'));
    expect(find.text('Optional'), findsOneWidget);
    expect(find.text('1 ingredient'), findsNothing);
  });
}
