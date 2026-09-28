import 'package:flutter/cupertino.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/widgets/sheets/scan/editor/editor.dart';
import 'package:kallo_mobile/features/logging/widgets/sheets/scan/editor/field.dart';
import 'package:kallo_mobile/features/logging/widgets/sheets/scan/result/amount/cup_ruler.dart';
import 'package:kallo_mobile/models/logging/scan_outcome.dart';
import 'package:kallo_mobile/shared/widgets/list/grouped_list_card.dart';

import 'harness.dart';

/// "Enter manually" end to end — from the camera and from a miss — and the
/// Premium gate on everything that is not a plain barcode lookup.
void main() {
  setUpScanTests();

  const labelLog = '/api/v1/nutrition-label/log';

  Future<void> fillRequired(ScanHarness h) async {
    await h.tester.enterText(h.nameField, 'Chè bắp');
    await h.tester.pumpAndSettle();
    await h.type('Calories', '250');
    await h.type('Protein', '10');
    await h.type('Carbohydrates', '30');
    await h.type('Fat', '8');
  }

  group('Enter manually', () {
    testWidgets('group labels sit flush with the card they name', (
      tester,
    ) async {
      final h = ScanHarness(tester);
      await h.open();
      await h.tapText('Enter manually');

      final card = find.ancestor(
        of: find.widgetWithText(ScanEditorField, 'Calories'),
        matching: find.byType(GroupedListCard),
      );
      expect(
        tester.getTopLeft(find.text('Nutrition')).dx,
        tester.getTopLeft(card).dx,
        reason: 'not inset to the row text, as every group label in the app',
      );
    });

    testWidgets('Done waits for a name and the four; the food logs per 100 g', (
      tester,
    ) async {
      final h = ScanHarness(tester);
      await h.open();
      await h.tapText('Enter manually');

      expect(find.text('New food'), findsOneWidget);
      await h.tapText('Done');
      expect(
        find.byType(ScanFoodEditor),
        findsOneWidget,
        reason: 'Done is off while the form is empty',
      );

      await fillRequired(h);
      await h.type('Sodium', '0');
      await h.tapText('Done');

      expect(find.byType(ScanFoodEditor), findsNothing);
      expect(find.text('New food'), findsOneWidget, reason: 'result title');
      expect(find.text('Chè bắp'), findsOneWidget);
      expect(find.text('250'), findsOneWidget);
      expect(find.text('Custom'), findsOneWidget, reason: 'no serving known');

      await h.tapText('Add meal');
      final body = h.api.bodiesTo(labelLog).single! as Map<String, Object?>;
      expect(body['productName'], 'Chè bắp');
      expect(body['amount'], 100);
      expect(body['unit'], 'g');
      expect(body['calories'], 250);
      expect(body['sodiumMg'], 0, reason: '0 is a value');
      expect(body.containsKey('fiberGrams'), isFalse, reason: 'blank: unknown');
      expect(body.containsKey('labelImageId'), isFalse);
      expect(body['confidence'], 'low');
      expect(h.outcome, isA<ScanSaved>());
    });

    testWidgets('values per 100 ml make it a drink, with the cups', (
      tester,
    ) async {
      final h = ScanHarness(tester);
      await h.open();
      await h.tapText('Enter manually');
      await h.tapText('100 g');
      await h.tapText('100 ml');
      await fillRequired(h);
      await h.tapText('Done');

      expect(find.byType(ScanCupRuler), findsOneWidget);
      await h.tapText('Add meal');
      final body = h.api.bodiesTo(labelLog).single! as Map<String, Object?>;
      expect(body['unit'], 'ml');
    });

    testWidgets('closing the editor goes back to the camera, nothing kept', (
      tester,
    ) async {
      final h = ScanHarness(tester);
      await h.open();
      await h.tapText('Enter manually');
      await fillRequired(h);
      await h.tapLabel('Close');

      expect(h.cameraIsLive, isTrue);
      await h.tapText('Enter manually');
      expect(find.widgetWithText(CupertinoTextField, 'Chè bắp'), findsNothing);
    });

    testWidgets('from a miss, and the typed food closes to a live camera', (
      tester,
    ) async {
      final h = ScanHarness(tester)
        ..api.handler =
            (_, path, _) =>
                path.startsWith('/api/v1/barcode/search')
                    ? throw apiError('BARCODE_NOT_FOUND', 404)
                    : <String, dynamic>{};
      await h.open();
      await h.detect('8938507849131');
      await h.tapText('Enter manually');
      await fillRequired(h);
      await h.tapText('Done');

      expect(find.text('Chè bắp'), findsOneWidget);
      await h.tapLabel('Close');
      expect(h.cameraIsLive, isTrue);
      expect(find.text('No match found'), findsNothing);
    });

    testWidgets('a failed save keeps the typed food and says why', (
      tester,
    ) async {
      final h = ScanHarness(tester)
        ..api.handler =
            (_, path, _) =>
                path == labelLog
                    ? throw apiError('INTERNAL', 500)
                    : <String, dynamic>{};
      await h.open();
      await h.tapText('Enter manually');
      await fillRequired(h);
      await h.tapText('Done');
      await h.tapText('Add meal');

      expect(h.closed, isFalse);
      expect(find.text('Chè bắp'), findsOneWidget);
      expect(find.text('Add meal'), findsOneWidget);
    });
  });

  group('a free account', () {
    Future<ScanHarness> free(WidgetTester tester) async {
      final h = ScanHarness(tester, locked: true)
        ..api.handler =
            (_, path, _) =>
                path.startsWith('/api/v1/barcode/search')
                    ? <String, dynamic>{'product': coconutWaterJson}
                    : <String, dynamic>{};
      await h.open();
      return h;
    }

    testWidgets('meets the paywall on the label mode', (tester) async {
      final h = await free(tester);
      await h.tapText('Nutrition label');
      expect(find.text('paywall-route'), findsOneWidget);
    });

    testWidgets('meets the paywall on Enter manually', (tester) async {
      final h = await free(tester);
      await h.tapText('Enter manually');
      expect(find.text('paywall-route'), findsOneWidget);
      expect(find.byType(ScanFoodEditor), findsNothing);
    });

    testWidgets('meets the paywall on Edit, and still logs by barcode', (
      tester,
    ) async {
      final h = await free(tester);
      await h.detect('8938507849131');
      await h.tapText('Edit');
      expect(find.text('paywall-route'), findsOneWidget);

      Navigator.of(tester.element(find.text('paywall-route'))).pop();
      await tester.pumpAndSettle();
      await h.tapText('Add meal');
      expect(h.api.bodiesTo('/api/v1/barcode/log'), hasLength(1));
      expect(h.outcome, isA<ScanSaved>());
    });
  });
}
