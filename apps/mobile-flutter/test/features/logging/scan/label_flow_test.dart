import 'dart:async';

import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/logic/label/image.dart';
import 'package:kallo_mobile/features/logging/widgets/sheets/scan/camera/problem.dart';
import 'package:kallo_mobile/models/logging/scan_outcome.dart';

import 'harness.dart';

/// The nutrition-label path end to end, forward and back: a photo is read,
/// the extracted table is sized and logged; a photo that can't be read says
/// so and offers the ways on — and none of them strands the user.
void main() {
  setUpScanTests();

  const scan = '/api/v1/nutrition-label/scan';
  const labelLog = '/api/v1/nutrition-label/log';

  Object? reads(String method, String path, Object? body) =>
      path == scan
          ? <String, dynamic>{
            'label': biscuitLabelJson,
            'labelImageId': 'img-1',
          }
          : <String, dynamic>{};

  Future<ScanHarness> inLabelMode(
    WidgetTester tester, {
    Object? Function(String, String, Object?)? handler,
  }) async {
    final h = ScanHarness(tester)..api.handler = handler ?? reads;
    await h.open();
    await h.tapText('Nutrition label');
    expect(h.cameraIsLive, isTrue);
    expect(find.text('Library'), findsOneWidget);
    return h;
  }

  group('a read label', () {
    testWidgets('reads the picked photo at once, under "Reading the label"', (
      tester,
    ) async {
      final reply = Completer<Object?>();
      final h = await inLabelMode(
        tester,
        handler: (_, path, _) => path == scan ? reply.future : null,
      );
      await tester.tap(find.text('Library'));
      await tester.pump();
      await tester.pump();

      expect(find.text('Reading the label'), findsOneWidget);
      expect(h.cameraIsLive, isFalse, reason: 'no shutter mid-read');
      final body = h.api.bodiesTo(scan).single! as Map<String, Object?>;
      expect(body['mimeType'], 'image/png');

      reply.complete(<String, dynamic>{'label': biscuitLabelJson});
      await tester.pumpAndSettle();
      expect(find.text('Reading the label'), findsNothing);
      expect(find.text('Bánh quy Cosy'), findsOneWidget);
    });

    testWidgets('rises as the extracted table, one serving to start', (
      tester,
    ) async {
      final h = await inLabelMode(tester);
      await h.tapText('Library');

      expect(find.text('Extracted nutrition'), findsOneWidget);
      expect(find.text('Bánh quy Cosy'), findsOneWidget);
      expect(find.text('From the label'), findsOneWidget);
      expect(find.text('30 g / serving'), findsOneWidget);
      expect(find.text('144'), findsOneWidget, reason: '480 kcal x 0.3');
    });

    testWidgets('logs the scaled table with its photo, and closes', (
      tester,
    ) async {
      final h = await inLabelMode(tester);
      await h.tapText('Library');
      await tester.tap(find.bySemanticsLabel('More'));
      await tester.pumpAndSettle();
      await h.tapText('Add meal');

      final body = h.api.bodiesTo(labelLog).single! as Map<String, Object?>;
      expect(body['productName'], 'Bánh quy Cosy');
      expect(body['amount'], 60);
      expect(body['unit'], 'g');
      expect(body['confidence'], 'high');
      expect(body['calories'], 288);
      expect(body['sodiumMg'], 192);
      expect(body['labelImageId'], 'img-1');
      expect(body.containsKey('fiberGrams'), isFalse, reason: 'not printed');
      expect(h.outcome, isA<ScanSaved>());
    });

    testWidgets('an edit keeps the photo link and logs the edited values', (
      tester,
    ) async {
      final h = await inLabelMode(tester);
      await h.tapText('Library');
      await h.tapText('Edit');
      await h.type('Fiber', '3');
      await h.tapText('Save');

      expect(find.text('Extracted nutrition'), findsOneWidget);
      await h.tapText('Add meal');
      final body = h.api.bodiesTo(labelLog).single! as Map<String, Object?>;
      expect(body['fiberGrams'], 0.9, reason: '3 g per 100 g, 30 g eaten');
      expect(body['labelImageId'], 'img-1');
    });

    testWidgets('closing the result drops the photo for a live camera', (
      tester,
    ) async {
      final h = await inLabelMode(tester);
      await h.tapText('Library');
      await h.tapLabel('Close');

      expect(h.cameraIsLive, isTrue);
      expect(find.text('Library'), findsOneWidget);
      expect(find.text('Bánh quy Cosy'), findsNothing);
    });
  });

  group('a label that could not be read', () {
    Object? noLabel(String method, String path, Object? body) =>
        path == scan
            ? throw apiError('OCR_NO_LABEL_DETECTED', 422)
            : <String, dynamic>{};

    testWidgets('says so, never offers the same photo again, and retakes', (
      tester,
    ) async {
      final h = await inLabelMode(tester, handler: noLabel);
      await h.tapText('Library');

      expect(find.text("Couldn't read the label"), findsOneWidget);
      expect(
        find.text('Make sure the whole table is in the photo.'),
        findsOneWidget,
      );
      expect(find.text('Try again'), findsNothing);
      expect(find.text('Enter manually'), findsOneWidget);

      await h.tapText('Retake photo');
      expect(h.cameraIsLive, isTrue);
      expect(find.text('Library'), findsOneWidget);
    });

    testWidgets('can switch to the barcode instead', (tester) async {
      final h = await inLabelMode(tester, handler: noLabel);
      await h.tapText('Library');
      await h.tapText('Scan barcode');

      expect(h.cameraIsLive, isTrue);
      expect(find.text('Type barcode'), findsOneWidget, reason: 'barcode mode');
      expect(find.text("Couldn't read the label"), findsNothing);
    });

    testWidgets('a busy service offers the same photo again', (tester) async {
      var calls = 0;
      final h = await inLabelMode(
        tester,
        handler: (method, path, body) {
          if (path != scan) return <String, dynamic>{};
          if (calls++ == 0) throw apiError('OCR_RATE_LIMITED', 429);
          return reads(method, path, body);
        },
      );
      await h.tapText('Library');

      expect(find.text('Try again'), findsOneWidget);
      expect(find.text('Scan barcode'), findsNothing);
      await h.tapText('Try again');

      expect(h.api.bodiesTo(scan), hasLength(2));
      expect(find.text('Bánh quy Cosy'), findsOneWidget);
    });

    testWidgets('a photo that cannot be used is said on the camera, whose '
        'tools stay live', (tester) async {
      final h = await inLabelMode(tester);
      h.pickResult = const LabelImageResult.failure(
        LabelImageFailure.unsupported,
      );
      await h.tapText('Library');

      expect(find.byType(ScanCameraProblem), findsOneWidget);
      expect(find.text("Couldn't read the label"), findsNothing);
      expect(h.cameraIsLive, isTrue);
      expect(h.api.bodiesTo(scan), isEmpty);

      h.pickResult = LabelImageResult.success(labelPhoto());
      await h.tapText('Library');
      expect(find.byType(ScanCameraProblem), findsNothing);
      expect(find.text('Bánh quy Cosy'), findsOneWidget);
    });

    testWidgets('of two photos in flight, only the latest is read', (
      tester,
    ) async {
      final h = await inLabelMode(tester);
      final first = Completer<LabelImageResult>();
      h.picker = () => first.future;
      await tester.tap(find.text('Library'));
      await tester.pump();

      h.picker = () async => LabelImageResult.success(labelPhoto());
      await h.tapText('Library');
      expect(h.api.bodiesTo(scan), hasLength(1));
      expect(find.text('Bánh quy Cosy'), findsOneWidget);

      first.complete(LabelImageResult.success(labelPhoto()));
      await tester.pumpAndSettle();
      expect(h.api.bodiesTo(scan), hasLength(1), reason: 'the older one drops');
      expect(find.text('Bánh quy Cosy'), findsOneWidget, reason: 'result kept');
    });

    testWidgets('a cancelled pick changes nothing', (tester) async {
      final h = await inLabelMode(tester);
      h.pickResult = const LabelImageResult.failure(
        LabelImageFailure.cancelled,
      );
      await h.tapText('Library');

      expect(h.cameraIsLive, isTrue);
      expect(find.byType(ScanCameraProblem), findsNothing);
      expect(h.api.requests, isEmpty);
    });
  });
}
