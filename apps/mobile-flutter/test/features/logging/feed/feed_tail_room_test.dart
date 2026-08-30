import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/widgets/feed/feed_scroll_pin.dart';
import 'package:kallo_mobile/features/logging/widgets/feed/feed_tail_room.dart';

const double _viewport = 600;
const double _dock = 120;
const double _turn = 80;

/// A three-item list standing in for a short day: two saved cards and the turn
/// the user just sent. Mirrors how `FeedList` wires the room — same floor on
/// the same last item, same dock padding.
Widget _host({
  required FeedScrollPinHandle handle,
  required ScrollController controller,
  String date = 'day-1',
  int items = 3,
}) => MaterialApp(
  home: Scaffold(
    body: SizedBox(
      height: _viewport,
      child: FeedScrollPin(
        handle: handle,
        controller: controller,
        child: FeedTailRoom(
          pin: handle,
          dockHeight: _dock,
          date: date,
          builder:
              (context, tailRoom) => ListView.builder(
                controller: controller,
                padding: const EdgeInsets.only(bottom: _dock),
                itemCount: items,
                itemBuilder: (context, index) {
                  final item = SizedBox(
                    key: ValueKey('item-$index'),
                    height: _turn,
                    child: Text('$index'),
                  );
                  return index == items - 1
                      ? withTailRoom(tailRoom, item)
                      : item;
                },
              ),
        ),
      ),
    ),
  ),
);

void main() {
  testWidgets('a short day does not scroll at all until the room opens', (
    tester,
  ) async {
    final handle = FeedScrollPinHandle();
    final controller = ScrollController();
    addTearDown(controller.dispose);
    await tester.pumpWidget(_host(handle: handle, controller: controller));

    // Three 80px turns plus a 120px dock is well inside a 600px viewport —
    // which is exactly why a send used to look like it had done nothing.
    expect(controller.position.maxScrollExtent, 0);
  });

  testWidgets('sending travels the newest turn to the top of the viewport', (
    tester,
  ) async {
    final handle = FeedScrollPinHandle();
    final controller = ScrollController();
    addTearDown(controller.dispose);
    await tester.pumpWidget(_host(handle: handle, controller: controller));

    handle.pinToBottom();
    await tester.pumpAndSettle();

    final viewport = tester.getRect(find.byType(FeedTailRoom));
    final turn = tester.getRect(find.byKey(const ValueKey('item-2')));
    expect(turn.top, closeTo(viewport.top, 0.5));
  });

  testWidgets('the keyboard no longer moves the feed', (tester) async {
    final handle = FeedScrollPinHandle();
    final controller = ScrollController();
    addTearDown(controller.dispose);
    await tester.pumpWidget(_host(handle: handle, controller: controller));

    handle.pinToBottom();
    await tester.pumpAndSettle();
    final settled = controller.position.pixels;

    // The keyboard coming up shrinks the viewport. The room shrinks with it,
    // so the extent — and the turn the user is reading — stays put. This is
    // the regression: the feed used to travel at THIS moment instead of on
    // send.
    tester.view.viewInsets = const FakeViewPadding(bottom: 300);
    addTearDown(tester.view.resetViewInsets);
    await tester.pumpAndSettle();

    expect(controller.position.pixels, closeTo(settled, 0.5));
  });

  testWidgets('a taller-than-viewport turn ignores the floor', (tester) async {
    final handle = FeedScrollPinHandle();
    final controller = ScrollController();
    addTearDown(controller.dispose);
    await tester.pumpWidget(
      _host(handle: handle, controller: controller, items: 20),
    );

    handle.pinToBottom();
    await tester.pumpAndSettle();

    // Twenty turns overflow the viewport on their own, so the room adds
    // nothing and the tail rides to the bottom exactly as it did before.
    expect(controller.position.pixels, controller.position.maxScrollExtent);
    final turn = tester.getRect(find.byKey(const ValueKey('item-19')));
    final viewport = tester.getRect(find.byType(FeedTailRoom));
    expect(turn.bottom, lessThanOrEqualTo(viewport.bottom + 0.5));
  });

  testWidgets('paging to another day gives the room back', (tester) async {
    final handle = FeedScrollPinHandle();
    final controller = ScrollController();
    addTearDown(controller.dispose);
    await tester.pumpWidget(_host(handle: handle, controller: controller));

    handle.pinToBottom();
    await tester.pumpAndSettle();
    expect(controller.position.maxScrollExtent, greaterThan(0));

    await tester.pumpWidget(
      _host(handle: handle, controller: controller, date: 'day-2'),
    );
    await tester.pumpAndSettle();

    // An old day's last meal must not sit above a screen of nothing.
    expect(handle.tailRoomOpen.value, isFalse);
    expect(controller.position.maxScrollExtent, 0);
  });
}
