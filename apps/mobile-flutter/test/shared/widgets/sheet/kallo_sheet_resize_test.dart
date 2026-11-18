import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/shared/widgets/sheet/kallo_sheet.dart';

import '../../../shell/poses/harness/pose_harness.dart';
import '../../../shell/poses/harness/poses.dart';

Rect sheetRect(WidgetTester tester) => tester.getRect(
  find
      .descendant(
        of: find.byType(KalloSheetSurface),
        matching: find.byWidgetPredicate(
          (w) => w is Container && w.decoration is ShapeDecoration,
        ),
      )
      .first,
);

void main() {
  setUpAll(initializePoseHarness);
  testWidgets('weight sheet keeps 68.6 while its frame moves', (tester) async {
    final dispose = await bootPose(tester, outerPortrait, '/dashboard');
    await tester.tap(find.bySemanticsLabel('Add'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Log weight'));
    await tester.pumpAndSettle();
    final field = find.byType(EditableText).last;
    await tester.enterText(field, '68.6');
    expect(sheetRect(tester).left, 0);
    expect(sheetRect(tester).right, 382);
    expect(sheetRect(tester).bottom, 678);
    void checkCorners({required bool left, required bool right}) {
      final container = tester.widget<Container>(
        find
            .descendant(
              of: find.byType(KalloSheetSurface),
              matching: find.byWidgetPredicate(
                (w) => w is Container && w.decoration is ShapeDecoration,
              ),
            )
            .first,
      );
      final shape =
          (container.decoration! as ShapeDecoration).shape
              as RoundedSuperellipseBorder;
      final corners = shape.borderRadius.resolve(TextDirection.ltr);
      expect(corners.bottomLeft.x, left ? 34 : 0);
      expect(corners.bottomRight.x, right ? 34 : 0);
    }

    checkCorners(left: false, right: true);
    for (final pose in [innerLandscape, innerPortrait, outerPortrait]) {
      resize(tester, pose);
      await tester.pumpAndSettle();
      expect(tester.widget<EditableText>(field).controller.text, '68.6');
      if (pose == innerLandscape) {
        checkCorners(left: true, right: true);
        expect(sheetRect(tester).left, 495.5);
        expect(sheetRect(tester).right, 867);
      }
      if (pose == innerPortrait) {
        checkCorners(left: true, right: true);
        expect(sheetRect(tester).left, 54.5);
        expect(sheetRect(tester).right, 614.5);
        expect(sheetRect(tester).top, greaterThanOrEqualTo(495.5));
      }
    }
    expect(tester.takeException(), isNull);
    await dispose();
  });
}
