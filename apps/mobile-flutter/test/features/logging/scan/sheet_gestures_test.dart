import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart' show TextField;
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/widgets/sheets/scan/camera/layer/barcode.dart';
import 'package:kallo_mobile/features/logging/widgets/sheets/scan/camera/layer/label.dart';
import 'package:kallo_mobile/features/logging/widgets/sheets/scan/editor/editor.dart';

import 'harness.dart';

/// The scan panels are sheets drawn inside the scan screen, not routes, so
/// they carry a sheet's gestures themselves: drag down or tap outside to
/// close, tap the sheet to put the keyboard away, swipe right to go back a
/// level. And the camera dips, rather than cuts, between modes.
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
    expect(find.text('Add meal'), findsOneWidget);
    return h;
  }

  /// Above every panel: the result stands at 214 of 844, the editor at 54.
  const outside = Offset(195, 40);

  group('the result sheet', () {
    testWidgets('a drag down closes it to a live camera', (tester) async {
      final h = await atProduct(tester);
      await tester.drag(find.text('Coconut Water'), const Offset(0, 300));
      await tester.pumpAndSettle();
      expect(h.cameraIsLive, isTrue);
    });

    testWidgets('a short drag springs back', (tester) async {
      final h = await atProduct(tester);
      final before = tester.getTopLeft(find.text('Coconut Water'));
      await tester.drag(find.text('Coconut Water'), const Offset(0, 40));
      await tester.pumpAndSettle();
      expect(h.cameraIsLive, isFalse);
      expect(tester.getTopLeft(find.text('Coconut Water')), before);
    });

    testWidgets('a tap on the frame above closes it', (tester) async {
      final h = await atProduct(tester);
      await tester.tapAt(outside);
      await tester.pumpAndSettle();
      expect(h.cameraIsLive, isTrue);
    });

    testWidgets('other nutrients swipes right back to the result', (
      tester,
    ) async {
      final h = await atProduct(tester);
      await h.tapText('Other nutrients');
      expect(find.text('Calcium'), findsOneWidget);
      expect(find.text('Add meal'), findsNothing);

      await tester.drag(find.text('Calcium'), const Offset(300, 0));
      await tester.pumpAndSettle();
      expect(find.text('Add meal'), findsOneWidget);
      expect(find.text('Calcium'), findsNothing);
      expect(h.cameraIsLive, isFalse, reason: 'back a level, not closed');
    });
  });

  group('the editor', () {
    Future<ScanHarness> editing(WidgetTester tester) async {
      final h = ScanHarness(tester);
      await h.open();
      await h.tapText('Enter manually');
      expect(find.byType(ScanFoodEditor), findsOneWidget);
      return h;
    }

    testWidgets('its body scrolls; pulled down at the top, the sheet goes', (
      tester,
    ) async {
      final h = await editing(tester);
      final body = find.byType(SingleChildScrollView);
      await tester.dragUntilVisible(
        find.text('Iron'),
        body,
        const Offset(0, -200),
      );
      await tester.pumpAndSettle();
      final scrolled = tester.getTopLeft(find.text('Iron'));

      // Part of the way back: the body scrolls, the sheet stays.
      await tester.drag(body, const Offset(0, 100));
      await tester.pumpAndSettle();
      expect(find.byType(ScanFoodEditor), findsOneWidget);
      // (Less the touch slop the scrollable spends deciding it is a drag.)
      expect(tester.getTopLeft(find.text('Iron')).dy, greaterThan(scrolled.dy));

      // One drag that brings the body home and keeps going: from the top on,
      // the pull is the sheet's.
      await tester.drag(body, const Offset(0, 3000));
      await tester.pumpAndSettle();
      expect(find.byType(ScanFoodEditor), findsNothing);
      expect(h.cameraIsLive, isTrue);
    });

    testWidgets('a tap on the sheet puts the keyboard away', (tester) async {
      final h = await editing(tester);
      await tester.tap(h.nameField);
      await tester.pump();
      expect(tester.testTextInput.isVisible, isTrue);

      await tester.tap(find.text('New food'));
      await tester.pump();
      expect(tester.testTextInput.isVisible, isFalse);
      expect(find.byType(ScanFoodEditor), findsOneWidget);
    });

    testWidgets('with the keyboard up, a tap outside only puts it away', (
      tester,
    ) async {
      final h = await editing(tester);
      await tester.tap(h.nameField);
      await tester.pump();
      tester.view.viewInsets = const FakeViewPadding(bottom: 900);
      addTearDown(tester.view.resetViewInsets);
      await tester.pumpAndSettle();

      await tester.tapAt(outside);
      await tester.pump();
      expect(tester.testTextInput.isVisible, isFalse);
      expect(find.byType(ScanFoodEditor), findsOneWidget);

      tester.view.resetViewInsets();
      await tester.pumpAndSettle();
      await tester.tapAt(outside);
      await tester.pumpAndSettle();
      expect(find.byType(ScanFoodEditor), findsNothing);
      expect(h.cameraIsLive, isTrue);
    });

    testWidgets('the four Done waits for say "Required" while empty', (
      tester,
    ) async {
      // CupertinoTextField keeps its placeholder mounted, hidden by a
      // Visibility, once there is text.
      int shown() =>
          find
              .text('Required')
              .evaluate()
              .where(
                (e) => e.findAncestorWidgetOfExactType<Visibility>()!.visible,
              )
              .length;
      final h = await editing(tester);
      expect(shown(), 4);
      await h.type('Calories', '250');
      expect(shown(), 3);
    });

    testWidgets('the name is a plain row, not a bordered Material field', (
      tester,
    ) async {
      final h = await editing(tester);
      expect(find.text('Food name'), findsOneWidget);
      expect(
        find.descendant(
          of: find.byType(ScanFoodEditor),
          matching: find.byType(TextField),
        ),
        findsNothing,
        reason: "the theme's outlined pill comes with every Material field",
      );
      expect(tester.widget<CupertinoTextField>(h.nameField).decoration, isNull);
    });
  });

  group('switching mode', () {
    testWidgets('dims the camera out before handing it over', (tester) async {
      final h = ScanHarness(tester)..api.handler = found;
      await h.open();
      await tester.tap(find.text('Nutrition label').last);
      await tester.pump();

      // The chip has moved; the barcode camera is still up under the veil.
      expect(find.text('Library'), findsOneWidget);
      expect(find.byType(BarcodeCameraLayer), findsOneWidget);
      expect(find.byType(LabelCameraLayer), findsNothing);

      // A code caught while it dims is not looked up in label mode.
      h.scanner.detect(code);
      await tester.pumpAndSettle();
      expect(h.api.requests.map((r) => r.$2), isNot(contains(search)));

      expect(find.byType(BarcodeCameraLayer), findsNothing);
      expect(find.byType(LabelCameraLayer), findsOneWidget);
      expect(h.cameraIsLive, isTrue);
    });

    testWidgets('switching straight back never hands the camera over', (
      tester,
    ) async {
      final h = ScanHarness(tester)..api.handler = found;
      await h.open();
      await tester.tap(find.text('Nutrition label').last);
      await tester.pump();
      await tester.tap(find.text('Barcode').last);
      await tester.pumpAndSettle();

      expect(find.byType(BarcodeCameraLayer), findsOneWidget);
      await h.detect(code);
      expect(h.api.requests.map((r) => r.$2), contains(search));
    });
  });
}
