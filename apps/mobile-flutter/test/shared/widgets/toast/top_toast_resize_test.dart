import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/shared/widgets/toast/top_toast.dart';
import 'package:kallo_mobile/shared/widgets/toast/top_toast_pill.dart';
import 'package:kallo_mobile/shell/nav/pill_nav_surface.dart';

import '../../../shell/poses/harness/pose_harness.dart';
import '../../../shell/poses/harness/poses.dart';

void main() {
  setUpAll(initializePoseHarness);
  testWidgets('toast stays twelve points below the top safe inset on resize', (
    tester,
  ) async {
    final dispose = await bootPose(tester, outerPortrait, '/dashboard');
    showTopToast(tester.element(find.byType(PillNavSurface)), 'Meal saved');
    await tester.pumpAndSettle();
    for (final pose in [outerPortrait, innerPortrait, innerLandscape]) {
      resize(tester, pose);
      await tester.pumpAndSettle();
      expect(
        tester.getRect(find.byType(TopToastPill)).top,
        pose.padding.top + 12,
      );
    }
    await tester.pump(const Duration(seconds: 3));
    await tester.pumpAndSettle();
    await dispose();
  });
}
