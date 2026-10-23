import 'package:flutter_test/flutter_test.dart';

/// Press and hold [target] until the meal hold menu (the system context menu)
/// opens, then lift.
///
/// The menu opens WHILE the finger is still down, once the press has been held
/// past its lift animation — longer than the 500ms `tester.longPress` gives.
Future<void> holdToOpenMenu(WidgetTester tester, Finder target) async {
  final hold = await tester.startGesture(tester.getCenter(target));
  await tester.pump(const Duration(milliseconds: 900));
  await tester.pumpAndSettle();
  await hold.up();
  await tester.pumpAndSettle();
}
