import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/shell/launch/launch_painter.dart';
import 'package:kallo_mobile/shell/launch/launch_timeline.dart';

import '../../golden_tolerance.dart';

/// Pixel record of the two frames the launch curtain owes the platform.
///
/// The first frame must BE the native launch screen — the ink K, 72pt tall,
/// centred on the canvas — or iOS's fade from its storyboard to Flutter shows
/// a jump. At rest it must be the wordmark, counters and all. The numbers are
/// asserted in `rise_intro_test.dart`; these hold what numbers cannot see.
Widget _frameAt(double t) => Center(
  child: RepaintBoundary(
    child: SizedBox(
      width: 393,
      height: 852,
      child: CustomPaint(
        painter: LaunchPainter(
          clock: LaunchClock()..tick(t),
          timeline: const LaunchTimeline(),
        ),
      ),
    ),
  ),
);

void main() {
  setUpAll(useTolerantGoldens);

  Future<void> record(WidgetTester tester, double t, String name) async {
    tester.view.physicalSize = const Size(393, 852);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(_frameAt(t));
    await expectLater(
      find.byType(RepaintBoundary).first,
      matchesGoldenFile('goldens/$name.png'),
    );
  }

  testWidgets(
    'first frame: the native launch screen, redrawn',
    (tester) => record(tester, 0, 'launch_first_frame'),
    skip: skipOffGoldenPlatform,
  );

  testWidgets(
    'at rest: the wordmark, assembled and centred',
    (tester) =>
        record(tester, const LaunchTimeline().introEnd, 'launch_at_rest'),
    skip: skipOffGoldenPlatform,
  );
}
