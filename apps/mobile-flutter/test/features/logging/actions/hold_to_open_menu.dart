import 'package:flutter_test/flutter_test.dart';

/// Press and hold [target] until the meal hold menu opens, then lift.
///
/// 550ms, frame by frame: the card answers the same 500ms hold a sent message
/// does (`KalloHoldMenu`). It used to take 900 — `CupertinoContextMenu`'s
/// 800ms preview timeout plus its lift — so a hold that opens the menu here
/// is also the proof the wait came down.
Future<void> holdToOpenMenu(WidgetTester tester, Finder target) async {
  final hold = await tester.startGesture(tester.getCenter(target));
  for (var i = 0; i < 11; i++) {
    await tester.pump(const Duration(milliseconds: 50));
  }
  await hold.up();
  await tester.pumpAndSettle();
}
