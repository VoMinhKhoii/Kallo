import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/widgets/feed/feed_scroll_pin.dart';

/// A list whose length the test can grow, standing in for the streaming card
/// getting taller and the keyboard inset re-padding the feed.
Widget _host({
  required FeedScrollPinHandle handle,
  required ScrollController controller,
  required int items,
}) => MaterialApp(
  home: Scaffold(
    body: SizedBox(
      height: 300,
      child: FeedScrollPin(
        handle: handle,
        controller: controller,
        child: ListView.builder(
          controller: controller,
          itemCount: items,
          itemBuilder: (_, i) => SizedBox(height: 100, child: Text('$i')),
        ),
      ),
    ),
  ),
);

void main() {
  testWidgets('rides the tail down to the bottom when asked', (tester) async {
    final handle = FeedScrollPinHandle();
    final controller = ScrollController();
    addTearDown(controller.dispose);
    await tester.pumpWidget(
      _host(handle: handle, controller: controller, items: 10),
    );

    handle.pinToBottom();
    await tester.pumpAndSettle();

    expect(controller.position.pixels, controller.position.maxScrollExtent);
  });

  testWidgets('re-aims when the content grows underneath it', (tester) async {
    final handle = FeedScrollPinHandle();
    final controller = ScrollController();
    addTearDown(controller.dispose);
    await tester.pumpWidget(
      _host(handle: handle, controller: controller, items: 10),
    );
    handle.pinToBottom();
    await tester.pumpAndSettle();
    final firstBottom = controller.position.maxScrollExtent;

    // This is the case the old one-shot scroll got wrong: it aimed at an extent
    // that the streaming card and the keyboard were still changing, so it
    // landed short of the bottom it was asked for.
    await tester.pumpWidget(
      _host(handle: handle, controller: controller, items: 20),
    );
    await tester.pumpAndSettle();

    expect(controller.position.maxScrollExtent, greaterThan(firstBottom));
    expect(controller.position.pixels, controller.position.maxScrollExtent);
  });

  testWidgets('lets go when the user scrolls back up the day', (tester) async {
    final handle = FeedScrollPinHandle();
    final controller = ScrollController();
    addTearDown(controller.dispose);
    await tester.pumpWidget(
      _host(handle: handle, controller: controller, items: 10),
    );
    handle.pinToBottom();
    await tester.pumpAndSettle();

    // Drag downward — reading older cards.
    await tester.drag(find.byType(ListView), const Offset(0, 250));
    await tester.pumpAndSettle();
    final readingAt = controller.position.pixels;
    expect(readingAt, lessThan(controller.position.maxScrollExtent));

    // More content arrives. It must NOT yank them back to the bottom.
    await tester.pumpWidget(
      _host(handle: handle, controller: controller, items: 20),
    );
    await tester.pumpAndSettle();

    expect(
      controller.position.pixels,
      readingAt,
      reason: 'a released pin must never drag the user back to the tail',
    );
  });

  testWidgets('takes the tail back when the user returns to it', (
    tester,
  ) async {
    final handle = FeedScrollPinHandle();
    final controller = ScrollController();
    addTearDown(controller.dispose);
    await tester.pumpWidget(
      _host(handle: handle, controller: controller, items: 10),
    );
    handle.pinToBottom();
    await tester.pumpAndSettle();
    await tester.drag(find.byType(ListView), const Offset(0, 250));
    await tester.pumpAndSettle();

    // Scroll back to the end under their own power.
    await tester.drag(find.byType(ListView), const Offset(0, -400));
    await tester.pumpAndSettle();
    expect(controller.position.pixels, controller.position.maxScrollExtent);

    await tester.pumpWidget(
      _host(handle: handle, controller: controller, items: 20),
    );
    await tester.pumpAndSettle();

    expect(
      controller.position.pixels,
      controller.position.maxScrollExtent,
      reason: 'back at the tail, the feed should follow again',
    );
  });
}
