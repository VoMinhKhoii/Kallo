import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/shared/widgets/dialog/kallo_alert_surface.dart';
import 'package:kallo_mobile/shared/widgets/dialog/kallo_confirm.dart';
import 'package:kallo_mobile/shell/nav/pill_nav_surface.dart';

import '../../../shell/poses/harness/pose_harness.dart';
import '../../../shell/poses/harness/poses.dart';

void main() {
  setUpAll(initializePoseHarness);
  testWidgets('confirm centres above the fold or in the near pane', (
    tester,
  ) async {
    final dispose = await bootPose(tester, innerLandscape, '/dashboard');
    showKalloConfirm(
      tester.element(find.byType(PillNavSurface)),
      title: 'Remove?',
      confirmLabel: 'Remove',
      cancelLabel: 'Keep',
    );
    await tester.pumpAndSettle();
    expect(tester.getCenter(find.byKey(kKalloConfirmSurface)).dx, 681.25);
    resize(tester, innerPortrait);
    await tester.pumpAndSettle();
    expect(tester.getCenter(find.byKey(kKalloConfirmSurface)).dy, 268.75);
    await dispose();
  });
}
