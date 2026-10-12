import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/widgets/sheets/manual/add/manual_add_sheet.dart';

import '../../../app_fonts.dart';
import 'manual_harness.dart';

/// The whole manual-log flow, the way a user walks it: open the meal, stack
/// the add sheet, search, weigh a food on its page, add it, see it marked in
/// the results and counted on the plate, change it from the plate, name the
/// meal and save — asserting what the request finally carries.
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

  Finder more() => find.bySemanticsLabel('More');

  /// The add sheet is a second route over the meal sheet, which stays built
  /// under it — scope a finder to the sheet on top.
  Finder inAddSheet(Finder finder) =>
      find.descendant(of: find.byType(ManualAddSheet), matching: finder);

  testWidgets('add, weigh, edit, name and save a meal', (tester) async {
    sizeTo(tester, const Size(390, 844));
    final api = FakeManualApi();
    await openManualSheet(tester, api);

    // An empty plate: nothing to save yet.
    expect(find.text('Manual log'), findsOneWidget);
    expect(find.text('Optional'), findsOneWidget);
    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();
    expect(api.posts, isEmpty);

    // The add sheet stacks over it, recents first, with the meal peeking.
    await tester.tap(find.text('Add ingredient'));
    await tester.pumpAndSettle();
    expect(find.text('No ingredients yet'), findsOneWidget);
    expect(find.text('Recent'), findsOneWidget);
    expect(find.text('per 100 g'), findsOneWidget);
    expect(find.text('Raw · Skinless chicken breast'), findsOneWidget);
    // A food whose card names no state shows none — not the table's "raw".
    expect(find.text('Plain whole-milk yogurt'), findsOneWidget);

    await search(tester, 'ức gà');
    expect(find.text('Results for “ức gà”'), findsOneWidget);
    expect(
      find.text('Cooked · Skinless chicken breast, stewed'),
      findsOneWidget,
    );

    // The food page opens at the vessel's medium cut.
    await tester.tap(find.text('Ức gà'));
    await tester.pumpAndSettle();
    expect(find.text('Add to meal'), findsOneWidget);
    expect(find.text('Skinless chicken breast'), findsOneWidget);
    expect(find.text('Weighed'), findsOneWidget);
    expect(find.text('120 kcal / 100 g'), findsOneWidget);
    expect(find.text('medium cut'), findsOneWidget);
    expect(find.text('180'), findsOneWidget); // 150 g × 120 kcal/100 g
    expect(find.textContaining('0 ingredients · 0 kcal'), findsOneWidget);
    expect(find.textContaining('180 kcal with this'), findsOneWidget);

    // + steps 10 g. 160 is still within 10% of the medium cut and claims it;
    // 170 is past it, so the claim reads "custom".
    await tester.tap(more());
    await tester.pumpAndSettle();
    expect(find.text('medium cut'), findsOneWidget);
    await tester.tap(more());
    await tester.pumpAndSettle();
    expect(find.text('204'), findsOneWidget);
    expect(find.text('custom'), findsOneWidget);
    expect(find.textContaining('204 kcal with this'), findsOneWidget);

    await tester.tap(find.text('Add to meal'));
    await tester.pumpAndSettle();
    // Back on the results, the food reads as added and Done appears.
    expect(find.text('Raw · 170 g in meal'), findsOneWidget);
    expect(find.text('Done'), findsOneWidget);
    expect(find.text('1 ingredient · 204 kcal'), findsOneWidget);

    await tester.tap(find.text('Done'));
    await tester.pumpAndSettle();
    expect(find.text('1 ingredient'), findsOneWidget);
    expect(find.text('Raw · 170 g'), findsOneWidget);
    expect(find.text('204 kcal'), findsOneWidget);
    // The placeholder is the title the meal would save under.
    expect(find.text('Ức gà'), findsWidgets);

    // From the plate: the food page edits that item in place.
    await tester.tap(find.text('Raw · 170 g'));
    await tester.pumpAndSettle();
    expect(find.text('Update'), findsOneWidget);
    expect(find.text('Remove from meal'), findsOneWidget);
    await tester.tap(more());
    await tester.pumpAndSettle();
    expect(find.textContaining('1 ingredient · 204 kcal'), findsOneWidget);
    expect(find.textContaining('216 kcal'), findsOneWidget);
    await tester.tap(find.text('Update'));
    await tester.pumpAndSettle();
    expect(find.text('Raw · 180 g'), findsOneWidget);

    await tester.enterText(find.byType(TextField).first, 'Cơm gà trưa');
    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();

    final (path, body) = api.posts.single;
    expect(path, '/api/v1/meals/manual');
    final json = body! as Map<String, dynamic>;
    expect(json['name'], 'Cơm gà trưa');
    expect(json['items'], [
      {'foodCompositionId': 'fct-chicken-raw', 'grams': 180.0},
    ]);
    // Saved: the sheet is gone.
    expect(find.text('Manual log'), findsNothing);
  });

  testWidgets('remove from the plate, and a food already in the meal is '
      'edited, never added twice', (tester) async {
    sizeTo(tester, const Size(390, 844));
    await openManualSheet(tester, FakeManualApi());
    await tester.tap(find.text('Add ingredient'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Cơm trắng'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Add to meal'));
    await tester.pumpAndSettle();

    // Tapping the added row reopens it for an update, not a second add.
    await tester.tap(inAddSheet(find.text('Cơm trắng')));
    await tester.pumpAndSettle();
    expect(find.text('Update'), findsOneWidget);
    expect(find.text('Add to meal'), findsNothing);
    await tester.tap(find.text('Remove from meal'));
    await tester.pumpAndSettle();

    expect(find.text('No ingredients yet'), findsOneWidget);
    expect(find.text('Done'), findsOneWidget);
    await tester.tap(find.text('Done'));
    await tester.pumpAndSettle();
    expect(find.text('Optional'), findsOneWidget);
  });
}
