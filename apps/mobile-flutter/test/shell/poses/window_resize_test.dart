import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/nutrition/screens/nutrition_screen.dart';
import 'package:kallo_mobile/features/logging/widgets/feed/feed_area.dart';
import 'package:kallo_mobile/features/logging/widgets/feed/feed_list.dart';
import 'package:kallo_mobile/features/logging/widgets/persisted/persisted_meal_card_content.dart';
import 'package:kallo_mobile/features/paywall/screens/paywall_purchase_face.dart';
import 'package:kallo_mobile/features/paywall/widgets/plans/plan_toggle.dart';
import 'package:kallo_mobile/shared/widgets/dialog/kallo_confirm.dart';
import 'package:kallo_mobile/shared/widgets/dialog/kallo_alert_surface.dart';
import 'package:kallo_mobile/shared/widgets/sheet/kallo_sheet.dart';
import 'package:kallo_mobile/shell/nav/pill_nav_surface.dart';

import 'pose_harness.dart';
import 'poses.dart';

void resize(WidgetTester tester, Pose pose) {
  final dpr = pose.devicePixelRatio;
  tester.view.physicalSize = pose.size * dpr;
  final padding = FakeViewPadding(
    left: pose.padding.left * dpr,
    top: pose.padding.top * dpr,
    right: pose.padding.right * dpr,
    bottom: pose.padding.bottom * dpr,
  );
  tester.view.padding = padding;
  tester.view.viewPadding = padding;
}

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
  testWidgets('compact Log shows two reachable meal cards after scrolling', (
    tester,
  ) async {
    final dispose = await bootPose(tester, poses[2], '/logging');
    final scroll =
        tester
            .state<ScrollableState>(
              find
                  .descendant(
                    of: find.byType(FeedList),
                    matching: find.byType(Scrollable),
                  )
                  .first,
            )
            .position;
    final top = tester.getRect(find.byType(FeedList)).top;
    final bottom = tester.getRect(find.byType(EditableText).last).top - 12;
    var most = 0;
    for (double offset = 0; offset <= scroll.maxScrollExtent; offset += 30) {
      scroll.jumpTo(offset);
      await tester.pump();
      var visible = 0;
      for (final element in find.byType(PersistedMealCardContent).evaluate()) {
        final rect = tester.getRect(
          find.byElementPredicate((e) => e == element),
        );
        final visibleTop = rect.top < top ? top : rect.top;
        final visibleBottom = rect.bottom > bottom ? bottom : rect.bottom;
        if (visibleBottom - visibleTop >= 44) visible++;
      }
      if (visible > most) most = visible;
    }
    expect(most, greaterThanOrEqualTo(2));
    await dispose();
  });
  testWidgets('Log keeps its composer draft across compact height', (
    tester,
  ) async {
    final dispose = await bootPose(tester, poses[1], '/logging');
    final state = tester.state(find.byType(FeedArea));
    final field = find.byType(EditableText).last;
    await tester.enterText(field, '2 eggs and toast');
    for (final pose in [poses[2], poses[1]]) {
      resize(tester, pose);
      await settlePose(tester);
      expect(tester.state(find.byType(FeedArea)), same(state));
      expect(
        tester.widget<EditableText>(field).controller.text,
        '2 eggs and toast',
      );
    }
    await dispose();
  });
  testWidgets('Paywall keeps purchase state across compact height', (
    tester,
  ) async {
    final dispose = await bootPose(tester, poses[1], '/paywall');
    final state = tester.state(find.byType(PaywallPurchaseFace));
    final yearly = tester.widget<PlanToggle>(find.byType(PlanToggle)).yearly;
    for (final pose in [poses[2], poses[1]]) {
      resize(tester, pose);
      await settlePose(tester);
      expect(tester.state(find.byType(PaywallPurchaseFace)), same(state));
      expect(tester.widget<PlanToggle>(find.byType(PlanToggle)).yearly, yearly);
    }
    await dispose();
  });
  testWidgets('capsule is 272 tall and follows the column', (tester) async {
    final dispose = await bootPose(tester, poses[1], '/dashboard');
    expect(
      tester.getRect(find.byType(PillNavSurface)),
      const Rect.fromLTRB(396, 364, 452, 636),
    );
    resize(tester, poses[2]);
    await settlePose(tester);
    expect(
      tester.getRect(find.byType(PillNavSurface)),
      const Rect.fromLTRB(608, 97, 664, 369),
    );
    await dispose();
  });

  testWidgets('weight sheet keeps 68.6 while its frame moves', (tester) async {
    final dispose = await bootPose(tester, poses[1], '/dashboard');
    await tester.tap(find.bySemanticsLabel('Add'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Log weight'));
    await tester.pumpAndSettle();
    final field = find.byType(EditableText).last;
    await tester.enterText(field, '68.6');
    expect(sheetRect(tester).left, 0);
    expect(sheetRect(tester).right, 382);
    expect(sheetRect(tester).bottom, 678);
    for (final pose in [poses[5], poses[3], poses[1]]) {
      resize(tester, pose);
      await tester.pumpAndSettle();
      expect(tester.widget<EditableText>(field).controller.text, '68.6');
      if (pose == poses[5]) {
        expect(sheetRect(tester).left, 495.5);
        expect(sheetRect(tester).right, 867);
      }
      if (pose == poses[3]) {
        expect(sheetRect(tester).left, 54.5);
        expect(sheetRect(tester).right, 614.5);
        expect(sheetRect(tester).top, greaterThanOrEqualTo(495.5));
      }
    }
    expect(tester.takeException(), isNull);
    await dispose();
  });

  testWidgets('confirm centres above the fold or in the near pane', (
    tester,
  ) async {
    final dispose = await bootPose(tester, poses[5], '/dashboard');
    showKalloConfirm(
      tester.element(find.byType(PillNavSurface)),
      title: 'Remove?',
      confirmLabel: 'Remove',
      cancelLabel: 'Keep',
    );
    await tester.pumpAndSettle();
    expect(tester.getCenter(find.byKey(kKalloConfirmSurface)).dx, 681.25);
    resize(tester, poses[3]);
    await tester.pumpAndSettle();
    expect(tester.getCenter(find.byKey(kKalloConfirmSurface)).dy, 268.75);
    await dispose();
  });

  testWidgets('Nutrition keeps its branch and scroll across folding', (
    tester,
  ) async {
    final dispose = await bootPose(tester, poses[1], '/nutrition');
    final screen = tester.state(find.byType(NutritionScreen));
    final scroll =
        find
            .descendant(
              of: find.byType(NutritionScreen),
              matching: find.byType(Scrollable),
            )
            .first;
    final position = tester.state<ScrollableState>(scroll).position;
    position.jumpTo(120);
    await tester.pump();
    for (final pose in [poses[5], poses[1]]) {
      resize(tester, pose);
      await settlePose(tester);
      expect(tester.state(find.byType(NutritionScreen)), same(screen));
      expect(position.pixels, 120);
    }
    await dispose();
  });
}
