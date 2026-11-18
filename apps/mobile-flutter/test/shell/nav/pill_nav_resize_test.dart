import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/shell/nav/pill_nav_surface.dart';

import '../poses/harness/pose_harness.dart';
import '../poses/harness/poses.dart';

void main() {
  setUpAll(initializePoseHarness);
  testWidgets('capsule is 272 tall and follows the column', (tester) async {
    final dispose = await bootPose(tester, outerPortrait, '/dashboard');
    expect(
      tester.getRect(find.byType(PillNavSurface)),
      const Rect.fromLTRB(390, 364, 446, 636),
    );
    resize(tester, outerLandscape);
    await settlePose(tester);
    expect(
      tester.getRect(find.byType(PillNavSurface)),
      const Rect.fromLTRB(602, 97, 658, 369),
    );
    resize(tester, innerLandscape);
    await settlePose(tester);
    expect(tester.getRect(find.byType(PillNavSurface)).left, 875);
    resize(tester, huge);
    await settlePose(tester);
    final pill = tester.getRect(find.byType(PillNavSurface));
    // No control column, so one column however wide: the pill is centred.
    expect(pill.width, 420);
    expect(pill.center.dx, 600);
    await dispose();
  });
}
