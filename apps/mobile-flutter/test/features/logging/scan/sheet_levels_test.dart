import 'package:flutter/cupertino.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/widgets/sheets/scan/editor/editor.dart';
import 'package:kallo_mobile/features/logging/widgets/sheets/scan/panel/sheet.dart';

import 'harness.dart';

/// Going a level in or out of the scan sheet — the other nutrients, the
/// editor — is the content travelling inside ONE sheet: in from the right,
/// back from the left, the height blending between the two. The sheet never
/// drops and a new one comes up.
void main() {
  setUpScanTests();

  const code = '8938507849131';
  const search = '/api/v1/barcode/search?code=$code';

  Object? found(String method, String path, Object? body) =>
      path == search
          ? <String, dynamic>{'product': coconutWaterJson}
          : <String, dynamic>{};

  Future<ScanHarness> atProduct(WidgetTester tester) async {
    final h = ScanHarness(tester)..api.handler = found;
    await h.open();
    await h.detect(code);
    return h;
  }

  /// The sheet's surface top, in screen coordinates.
  double sheetTop(WidgetTester tester) =>
      tester
          .getTopLeft(
            find
                .descendant(
                  of: find.byType(ScanSheet),
                  matching: find.byType(DecoratedBox),
                )
                .first,
          )
          .dy;

  double x(WidgetTester tester, String text) =>
      tester.getTopLeft(find.text(text)).dx;

  testWidgets('other nutrients pushes in from the right, in the same sheet', (
    tester,
  ) async {
    final h = await atProduct(tester);
    final restX = x(tester, 'Add meal');
    final resultTop = sheetTop(tester);

    await tester.tap(find.text('Other nutrients'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 60));

    expect(find.byType(ScanSheet), findsOneWidget, reason: 'never a second');
    expect(x(tester, 'Add meal'), lessThan(restX), reason: 'leaving left');
    final calciumMid = x(tester, 'Calcium');
    final midTop = sheetTop(tester);

    await tester.pumpAndSettle();
    expect(
      calciumMid,
      greaterThan(x(tester, 'Calcium')),
      reason:
          'from the '
          'right',
    );
    final othersTop = sheetTop(tester);
    expect(othersTop, lessThan(resultTop), reason: 'one level up');
    expect(midTop, lessThan(resultTop), reason: 'the height blends');
    expect(midTop, greaterThan(othersTop));
    expect(find.text('Add meal'), findsNothing);
    expect(h.cameraIsLive, isFalse);

    await h.tapLabel('Back');
    expect(find.text('Add meal'), findsOneWidget);
    expect(sheetTop(tester), resultTop);
  });

  testWidgets('back pops from the left', (tester) async {
    await atProduct(tester);
    final addRestX = x(tester, 'Add meal');
    await tester.tap(find.text('Other nutrients'));
    await tester.pumpAndSettle();
    final restX = x(tester, 'Calcium');

    await tester.tap(find.bySemanticsLabel('Back'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 60));
    expect(find.byType(ScanSheet), findsOneWidget);
    expect(x(tester, 'Calcium'), greaterThan(restX), reason: 'leaving right');
    expect(x(tester, 'Add meal'), lessThan(addRestX), reason: 'from the left');
  });

  testWidgets('a released swipe back carries on from the finger', (
    tester,
  ) async {
    await atProduct(tester);
    await tester.tap(find.text('Other nutrients'));
    await tester.pumpAndSettle();
    final restX = x(tester, 'Calcium');

    final gesture = await tester.startGesture(
      tester.getCenter(find.text('Calcium')),
    );
    for (var i = 0; i < 10; i++) {
      await gesture.moveBy(const Offset(20, 0));
      await tester.pump(const Duration(milliseconds: 16));
    }
    final carried = x(tester, 'Calcium') - restX;
    expect(carried, greaterThan(150), reason: 'the page follows the finger');

    await gesture.up();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 16));
    expect(
      x(tester, 'Calcium') - restX,
      greaterThanOrEqualTo(carried - 1),
      reason: 'the pop starts where the finger let go, not back at 0',
    );
    await tester.pumpAndSettle();
    expect(find.text('Add meal'), findsOneWidget);
  });

  testWidgets('Edit pushes the editor; Save pops the result back, typed '
      'values riding out with the editor', (tester) async {
    await atProduct(tester);
    final restX = x(tester, 'Add meal');

    await tester.tap(find.text('Edit'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 60));
    expect(find.byType(ScanSheet), findsOneWidget);
    expect(x(tester, 'Add meal'), lessThan(restX));
    await tester.pumpAndSettle();

    final h = ScanHarness(tester);
    await tester.enterText(h.nameField, 'Nước dừa');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Save'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 60));

    expect(find.byType(ScanSheet), findsOneWidget);
    expect(
      find.widgetWithText(CupertinoTextField, 'Nước dừa'),
      findsOneWidget,
      reason: 'the leaving editor keeps what was typed',
    );
    expect(x(tester, 'Add meal'), lessThan(restX), reason: 'from the left');
    await tester.pumpAndSettle();
    expect(find.byType(ScanFoodEditor), findsNothing);
    expect(find.text('Nước dừa'), findsOneWidget, reason: 'the edited result');
  });

  testWidgets('a swipe right on the editor cancels, as its X does', (
    tester,
  ) async {
    await atProduct(tester);
    await tester.tap(find.text('Edit'));
    await tester.pumpAndSettle();

    await tester.drag(find.text('Macronutrients'), const Offset(300, 0));
    await tester.pumpAndSettle();
    expect(find.byType(ScanFoodEditor), findsNothing);
    expect(find.text('Coconut Water'), findsOneWidget);
    expect(find.text('Add meal'), findsOneWidget);
  });

  testWidgets('a taller level on the same page glides, never snaps', (
    tester,
  ) async {
    await atProduct(tester);
    final resultTop = sheetTop(tester);

    await tester.tap(find.text('100 ml / serving'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Custom'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 40));
    final midTop = sheetTop(tester);

    await tester.pumpAndSettle();
    final denseTop = sheetTop(tester);
    expect(denseTop, lessThan(resultTop), reason: 'the cup ruler: a level up');
    expect(midTop, lessThan(resultTop));
    expect(midTop, greaterThan(denseTop), reason: 'on its way, not there');
  });

  testWidgets('a miss pushes "Enter manually" and gets it back on close', (
    tester,
  ) async {
    final h = ScanHarness(tester)
      ..api.handler =
          (_, path, _) =>
              path.startsWith('/api/v1/barcode/search')
                  ? throw apiError('BARCODE_NOT_FOUND', 404)
                  : <String, dynamic>{};
    await h.open();
    await h.detect(code);
    expect(find.text('No match found'), findsOneWidget);

    await tester.tap(find.text('Enter manually'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 60));
    expect(find.byType(ScanSheet), findsOneWidget, reason: 'the same sheet');
    expect(find.text('No match found'), findsOneWidget, reason: 'leaving');
    expect(find.byType(ScanFoodEditor), findsOneWidget, reason: 'arriving');
    await tester.pumpAndSettle();

    await h.tapLabel('Close');
    expect(find.text('No match found'), findsOneWidget, reason: 'popped back');
    expect(find.byType(ScanFoodEditor), findsNothing);
  });
}
