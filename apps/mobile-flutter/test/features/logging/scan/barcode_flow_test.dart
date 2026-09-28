import 'dart:async';

import 'package:flutter/cupertino.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/logic/relog/scan_purpose.dart';
import 'package:kallo_mobile/features/logging/widgets/sheets/scan/result/amount/cup_ruler.dart';
import 'package:kallo_mobile/models/logging/scan_outcome.dart';

import 'harness.dart';

/// The barcode path end to end, forward and back: a code is caught, looked
/// up, sized by portion and amount, looked into, and logged — and every panel
/// on the way can be left again for a live camera.
void main() {
  setUpScanTests();

  const code = '8938507849131';
  const search = '/api/v1/barcode/search?code=$code';
  const barcodeLog = '/api/v1/barcode/log';
  const labelLog = '/api/v1/nutrition-label/log';

  Object? found(String method, String path, Object? body) =>
      path == search
          ? <String, dynamic>{'product': coconutWaterJson}
          : <String, dynamic>{};

  Object? notFound(String method, String path, Object? body) =>
      path.startsWith('/api/v1/barcode/search')
          ? throw apiError('BARCODE_NOT_FOUND', 404)
          : <String, dynamic>{};

  Future<ScanHarness> atProduct(
    WidgetTester tester, {
    ScanPurpose purpose = ScanPurpose.log,
  }) async {
    final h = ScanHarness(tester, purpose: purpose)..api.handler = found;
    await h.open();
    await h.detect(code);
    return h;
  }

  group('a caught code', () {
    testWidgets('rises as the product, one serving to start', (tester) async {
      final h = ScanHarness(tester)..api.handler = found;
      await h.open();
      expect(h.cameraIsLive, isTrue);

      await h.detect(code);

      expect(h.api.requests.map((r) => r.$2), contains(search));
      expect(find.text('Barcode'), findsWidgets, reason: 'the sheet title');
      expect(find.text('Coconut Water'), findsOneWidget);
      expect(find.text('Coco Xim'), findsOneWidget);
      expect(find.text('16'), findsOneWidget, reason: '16 kcal per 100 ml');
      expect(find.text('100 ml / serving'), findsOneWidget);
      expect(find.text('1 serving'), findsOneWidget);
      expect(find.text('Add meal'), findsOneWidget);
      expect(h.cameraIsLive, isFalse, reason: 'the result covers the tools');
    });

    testWidgets('is looked up once, however often it is decoded', (
      tester,
    ) async {
      final h = ScanHarness(tester)..api.handler = found;
      await h.open();
      h.scanner
        ..detect(code)
        ..detect(code)
        ..detect(code);
      await tester.pumpAndSettle();
      expect(h.api.bodiesTo(search), hasLength(1));
    });

    testWidgets('closing the result goes back to a live camera that catches '
        'the next code', (tester) async {
      final h = await atProduct(tester);
      await h.tapLabel('Close');
      expect(h.cameraIsLive, isTrue);
      expect(find.text('Coconut Water'), findsNothing);

      await h.detect(code);
      expect(h.api.bodiesTo(search), hasLength(2));
      expect(find.text('Coconut Water'), findsOneWidget);
    });

    testWidgets('closing the camera pops with nothing', (tester) async {
      final h = ScanHarness(tester);
      await h.open();
      await h.tapLabel('Close');
      expect(h.closed, isTrue);
      expect(h.outcome, isNull);
    });
  });

  group('portion and amount', () {
    testWidgets('servings and packs count by one, and scale the kcal', (
      tester,
    ) async {
      await atProduct(tester);
      await tester.tap(find.bySemanticsLabel('More'));
      await tester.pumpAndSettle();
      expect(find.text('2 servings'), findsOneWidget);
      expect(find.text('32'), findsOneWidget);

      await tester.tap(find.text('100 ml / serving'));
      await tester.pumpAndSettle();
      expect(find.text('1 L'), findsOneWidget, reason: 'the pack, in the menu');
      await tester.tap(find.text('Pack'));
      await tester.pumpAndSettle();
      expect(find.text('1 pack'), findsOneWidget);
      expect(find.text('160'), findsOneWidget);
      expect(
        find.bySemanticsLabel('Less'),
        findsOneWidget,
        reason: 'still there, just disabled at one',
      );
    });

    testWidgets('custom carries the amount on screen, steps by 10 and shows '
        'the cups for a drink', (tester) async {
      await atProduct(tester);
      await tester.tap(find.bySemanticsLabel('More'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('100 ml / serving'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Custom'));
      await tester.pumpAndSettle();

      expect(find.byType(ScanCupRuler), findsOneWidget);
      expect(find.widgetWithText(CupertinoTextField, '200'), findsOneWidget);

      await tester.tap(find.bySemanticsLabel('Less'));
      await tester.pumpAndSettle();
      expect(find.widgetWithText(CupertinoTextField, '190'), findsOneWidget);
      expect(find.text('30'), findsOneWidget, reason: '16 x 1.9 = 30.4');

      await tester.enterText(find.byType(CupertinoTextField), '330');
      await tester.pumpAndSettle();
      expect(find.text('53'), findsOneWidget, reason: '16 x 3.3 = 52.8');

      // 0 is not an amount: leaving the field puts back the one Add logs.
      await tester.enterText(find.byType(CupertinoTextField), '0');
      await tester.pumpAndSettle();
      FocusManager.instance.primaryFocus?.unfocus();
      await tester.pumpAndSettle();
      expect(find.widgetWithText(CupertinoTextField, '330'), findsOneWidget);

      // Back to servings: the count the user had is kept.
      await tester.tap(find.text('Custom').first);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Serving'));
      await tester.pumpAndSettle();
      expect(find.text('2 servings'), findsOneWidget);
      expect(find.byType(ScanCupRuler), findsNothing);
    });
  });

  testWidgets('the cups hold still while the amount is being saved', (
    tester,
  ) async {
    final h = await atProduct(tester);
    await tester.tap(find.text('100 ml / serving'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Custom'));
    await tester.pumpAndSettle();
    final answer = Completer<Object?>();
    h.api.handler =
        (_, path, _) =>
            path == barcodeLog ? answer.future : <String, dynamic>{};
    await tester.tap(find.text('Add meal'));
    await tester.pump();

    final frozen = tester.widget<IgnorePointer>(
      find
          .descendant(
            of: find.byType(ScanCupRuler),
            matching: find.byType(IgnorePointer),
          )
          .first,
    );
    expect(frozen.ignoring, isTrue);

    answer.complete(<String, dynamic>{});
    await tester.pumpAndSettle();
    expect(h.outcome, isA<ScanSaved>());
  });

  group('other nutrients', () {
    testWidgets('opens over the same product and comes back', (tester) async {
      final h = await atProduct(tester);
      await tester.tap(find.bySemanticsLabel('More'));
      await tester.pumpAndSettle();
      await h.tapText('Other nutrients');

      expect(find.text('Coconut Water'), findsOneWidget);
      expect(find.text('In 2 servings · 200 ml'), findsOneWidget);
      expect(find.text('Calcium'), findsOneWidget);
      expect(find.text('20 mg'), findsOneWidget, reason: '10 mg x 2');
      expect(find.text('Potassium'), findsOneWidget);
      expect(find.text('Sodium'), findsOneWidget);
      expect(find.text('Iron'), findsNothing, reason: 'not listed: not 0');
      expect(find.text('Add meal'), findsNothing);

      await tester.tap(find.bySemanticsLabel('Back'));
      await tester.pumpAndSettle();
      expect(find.text('2 servings'), findsOneWidget, reason: 'amount kept');
      expect(find.text('Add meal'), findsOneWidget);
    });
  });

  group('adding', () {
    testWidgets('logs by barcode at the chosen amount and closes', (
      tester,
    ) async {
      final h = await atProduct(tester);
      await tester.tap(find.bySemanticsLabel('More'));
      await tester.pumpAndSettle();
      await h.tapText('Add meal');

      final body = h.api.bodiesTo(barcodeLog).single! as Map<String, Object?>;
      expect(body['barcode'], code);
      expect(body['grams'], 200);
      expect(body['loggedDate'], '2026-09-28');
      expect(h.api.bodiesTo(labelLog), isEmpty);
      expect(h.outcome, isA<ScanSaved>());
    });

    testWidgets('a failed save keeps the result, its amount and says why; '
        'the retry saves', (tester) async {
      final h = await atProduct(tester);
      await tester.tap(find.bySemanticsLabel('More'));
      await tester.pumpAndSettle();
      h.api.handler =
          (_, path, _) =>
              path == barcodeLog
                  ? throw apiError('INTERNAL', 500)
                  : <String, dynamic>{};
      await h.tapText('Add meal');

      expect(h.closed, isFalse);
      expect(
        find.text('Something went wrong. Please try again.'),
        findsOneWidget,
      );
      expect(find.text('2 servings'), findsOneWidget);

      h.api.handler = (_, _, _) => <String, dynamic>{};
      await h.tapText('Add meal');
      expect(h.outcome, isA<ScanSaved>());
      final bodies = h.api.bodiesTo(barcodeLog).cast<Map<String, Object?>>();
      expect(bodies, hasLength(2));
      expect(
        bodies.last['mealId'],
        bodies.first['mealId'],
        reason: 'a retry is the same meal, never a second one',
      );
    });

    testWidgets('from the composer, hands the product back unsaved', (
      tester,
    ) async {
      final h = await atProduct(tester, purpose: ScanPurpose.pick);
      await h.tapText('Add to meal');

      final picked = h.outcome! as ScanPicked;
      expect(picked.ref.barcode, code);
      expect(picked.ref.grams, 100);
      expect(h.api.bodiesTo(barcodeLog), isEmpty);
      expect(h.api.bodiesTo(labelLog), isEmpty);
    });
  });

  group('editing a product', () {
    testWidgets('logs the edited numbers through the label log', (
      tester,
    ) async {
      final h = await atProduct(tester);
      await h.tapText('Edit');
      expect(find.text('Edit'), findsWidgets, reason: 'the editor title');
      expect(
        find.widgetWithText(CupertinoTextField, 'Coconut Water'),
        findsOneWidget,
      );
      expect(find.widgetWithText(CupertinoTextField, '16'), findsOneWidget);

      await h.type('Calories', '20');
      await h.tapText('Save');

      expect(find.text('20'), findsOneWidget, reason: 'per serving now');
      await h.tapText('Add meal');

      expect(h.api.bodiesTo(barcodeLog), isEmpty);
      final body = h.api.bodiesTo(labelLog).single! as Map<String, Object?>;
      expect(body['productName'], 'Coconut Water');
      expect(body['amount'], 100);
      expect(body['unit'], 'ml');
      expect(body['calories'], 20);
      expect(body['calciumMg'], 10);
      expect(body.containsKey('fiberGrams'), isFalse, reason: 'unknown');
      expect(body.containsKey('labelImageId'), isFalse);
      expect(h.outcome, isA<ScanSaved>());
    });

    testWidgets('keeps the chosen amount through an edit', (tester) async {
      final h = await atProduct(tester);
      await tester.tap(find.bySemanticsLabel('More'));
      await tester.pumpAndSettle();
      await h.tapText('Edit');
      await tester.enterText(h.nameField, 'Nước dừa');
      await tester.pumpAndSettle();
      await h.tapText('Save');

      expect(find.text('2 servings'), findsOneWidget);
      await h.tapText('Add meal');
      final body = h.api.bodiesTo(labelLog).single! as Map<String, Object?>;
      expect(body['productName'], 'Nước dừa');
      expect(body['amount'], 200);
    });

    testWidgets('closing the editor keeps the product as it was', (
      tester,
    ) async {
      final h = await atProduct(tester);
      await h.tapText('Edit');
      await h.type('Calories', '99');
      await h.tapLabel('Close');

      expect(find.text('16'), findsOneWidget);
      expect(find.text('Add meal'), findsOneWidget);
      await h.tapText('Add meal');
      expect(h.api.bodiesTo(barcodeLog), hasLength(1));
    });

    testWidgets('an edited pick is logged, not handed back', (tester) async {
      final h = await atProduct(tester, purpose: ScanPurpose.pick);
      expect(find.text('Add to meal'), findsOneWidget);
      await h.tapText('Edit');
      await h.type('Calories', '20');
      await h.tapText('Save');

      expect(find.text('Add to meal'), findsNothing);
      await h.tapText('Add meal');
      expect(h.api.bodiesTo(labelLog), hasLength(1));
      expect(h.outcome, isA<ScanSaved>());
    });
  });

  group('typing the barcode', () {
    testWidgets('Look up waits for 8 digits; back returns to the camera', (
      tester,
    ) async {
      final h = ScanHarness(tester)..api.handler = found;
      await h.open();
      await h.tapText('Type barcode');
      expect(h.cameraIsLive, isFalse);

      await tester.enterText(find.byType(CupertinoTextField), '893850');
      await tester.pumpAndSettle();
      expect(find.text('8938 50'), findsOneWidget, reason: 'grouped by four');
      await h.tapText('Look up');
      expect(h.api.bodiesTo(search), isEmpty, reason: 'too short');

      await h.tapLabel('Back');
      expect(h.cameraIsLive, isTrue);

      await h.tapText('Type barcode');
      await tester.enterText(find.byType(CupertinoTextField), code);
      await tester.pumpAndSettle();
      expect(find.text('8938 5078 4913 1'), findsOneWidget);
      await h.tapText('Look up');
      expect(h.api.bodiesTo(search), hasLength(1));
      expect(find.text('Coconut Water'), findsOneWidget);
    });
  });

  group('misses', () {
    testWidgets('not found says which code, and closes to the camera', (
      tester,
    ) async {
      final h = ScanHarness(tester)..api.handler = notFound;
      await h.open();
      await h.detect(code);

      expect(find.text('No match found'), findsOneWidget);
      expect(
        find.text("Barcode $code isn't in our database yet."),
        findsOneWidget,
      );
      expect(find.text('Enter manually'), findsOneWidget);
      await h.tapLabel('Close');
      expect(h.cameraIsLive, isTrue);
    });

    testWidgets('not found → scan the label → back to barcode starts clean', (
      tester,
    ) async {
      final h = ScanHarness(tester)..api.handler = notFound;
      await h.open();
      await h.detect(code);
      await h.tapText('Scan nutrition label');

      expect(h.cameraIsLive, isTrue);
      expect(find.text('Library'), findsOneWidget, reason: 'label mode');
      expect(find.text('No match found'), findsNothing);

      await h.tapText('Barcode');
      expect(h.cameraIsLive, isTrue);
      expect(find.text('Type barcode'), findsOneWidget);
      expect(find.text('No match found'), findsNothing);
    });

    testWidgets('a failed lookup offers another scan', (tester) async {
      final h = ScanHarness(tester)
        ..api.handler = (_, _, _) => throw apiError('INTERNAL', 500);
      await h.open();
      await h.detect(code);

      expect(find.text("Couldn't look it up"), findsOneWidget);
      await h.tapText('Scan again');
      expect(h.cameraIsLive, isTrue);

      h.api.handler = found;
      await h.detect(code);
      expect(find.text('Coconut Water'), findsOneWidget);
    });
  });
}
