import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/nutrition/screens/nutrition_screen.dart';
import 'package:kallo_mobile/features/logging/widgets/feed/feed_area.dart';
import 'package:kallo_mobile/features/logging/widgets/feed/feed_list.dart';
import 'package:kallo_mobile/features/logging/widgets/persisted/persisted_meal_card_content.dart';
import 'package:kallo_mobile/features/paywall/screens/paywall_purchase_face.dart';
import 'package:kallo_mobile/features/paywall/widgets/plans/plan_toggle.dart';
import 'package:kallo_mobile/features/paywall/widgets/plans/paywall_buy_band.dart';
import 'package:kallo_mobile/features/paywall/widgets/pitch/plan_comparison.dart';

import 'harness/pose_harness.dart';
import 'harness/poses.dart';

void main() {
  setUpAll(initializePoseHarness);
  testWidgets('compact Log shows two reachable meal cards after scrolling', (
    tester,
  ) async {
    final dispose = await bootPose(tester, outerLandscape, '/logging');
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
    final dispose = await bootPose(tester, outerPortrait, '/logging');
    final state = tester.state(find.byType(FeedArea));
    final field = find.byType(EditableText).last;
    await tester.enterText(field, '2 eggs and toast');
    for (final pose in [outerLandscape, outerPortrait]) {
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
    final dispose = await bootPose(tester, outerPortrait, '/paywall');
    final state = tester.state(find.byType(PaywallPurchaseFace));
    final toggle = tester.widget<PlanToggle>(find.byType(PlanToggle));
    final yearly = toggle.onChanged == null ? toggle.yearly : !toggle.yearly;
    toggle.onChanged?.call(yearly);
    await tester.pump();
    for (final pose in [
      innerLandscape,
      pipPinned,
      outerLandscape,
      outerPortrait,
    ]) {
      resize(tester, pose);
      await settlePose(tester);
      expect(tester.state(find.byType(PaywallPurchaseFace)), same(state));
      expect(tester.widget<PlanToggle>(find.byType(PlanToggle)).yearly, yearly);
      final table = tester.widget<PlanComparison>(find.byType(PlanComparison));
      expect(table.availableWidth, lessThanOrEqualTo(420));
      final band = tester.getRect(find.byType(PaywallBuyBand));
      if (pose == outerPortrait || pose == outerLandscape) {
        expect(band.left, 0);
        expect(band.right, pose.size.width);
      }
      if (pose == innerLandscape || pose == pipPinned) {
        expect(
          tester.getRect(find.byType(PlanToggle)).left,
          greaterThanOrEqualTo(495.5),
        );
        expect(
          tester.getRect(find.byType(PlanToggle)).bottom,
          lessThan(tester.getRect(find.textContaining('Start Premium')).top),
        );
      }
    }
    await dispose();
  });
  testWidgets('Nutrition keeps its branch and scroll across folding', (
    tester,
  ) async {
    final dispose = await bootPose(tester, outerPortrait, '/nutrition');
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
    for (final pose in [innerLandscape, outerPortrait]) {
      resize(tester, pose);
      await settlePose(tester);
      expect(tester.state(find.byType(NutritionScreen)), same(screen));
      expect(position.pixels, 120);
    }
    await dispose();
  });
}
