import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/shared/widgets/surface/kallo_primitives.dart';
import 'package:kallo_mobile/shared/widgets/list/grouped_list_card.dart';
import 'package:kallo_mobile/features/logging/widgets/persisted/persisted_meal_card_content.dart';
import 'package:kallo_mobile/shell/nav/pill_nav_surface.dart';
import 'pose_harness.dart';
import 'poses.dart';
import 'window_resize_test.dart' show resize;

void main() {
  setUpAll(initializePoseHarness);
  for (final route in [
    '/dashboard',
    '/logging',
    '/nutrition',
    '/circle',
    '/settings',
  ]) {
    testWidgets(
      '$route bounds its cards and keeps the scroll across column resizing',
      (tester) async {
        final dispose = await bootPose(tester, poses[3], route);
        final cards = find.byWidgetPredicate(
          (w) =>
              w is KalloCard ||
              w is GroupedListCard ||
              w is PersistedMealCardContent,
        );
        expect(cards, findsWidgets);
        final rect = tester.getRect(cards.first);
        expect(rect.left, 54.5);
        expect(rect.right, 614.5);
        if (route != '/logging' && route != '/settings') {
          final pill = tester.getRect(find.byType(PillNavSurface));
          expect(pill.left, 124.5);
          expect(pill.right, 544.5);
        }
        final vertical = find.byWidgetPredicate(
          (w) =>
              w is Scrollable &&
              axisDirectionToAxis(w.axisDirection) == Axis.vertical,
        );
        final states =
            tester.stateList<ScrollableState>(vertical).toList()..sort(
              (a, b) => b.position.viewportDimension.compareTo(
                a.position.viewportDimension,
              ),
            );
        final state = states.first;
        state.position.jumpTo(40);
        await tester.pumpAndSettle();
        final offset = state.position.pixels;
        resize(tester, poses[2]);
        await settlePose(tester);
        expect(
          tester.stateList<ScrollableState>(vertical),
          contains(same(state)),
        );
        expect(state.position.pixels, offset);
        // Scroll back to ensure the first lazy card is available for measuring.
        state.position.jumpTo(0);
        await tester.pumpAndSettle();
        expect(tester.getRect(cards.first).left, 17);
        expect(tester.getRect(cards.first).right, 577);
        expect(tester.takeException(), isNull);
        await dispose();
      },
    );
  }
}
