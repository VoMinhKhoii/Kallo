import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/widgets/feed/feed_scroll_pin.dart';

/// A list whose length and bottom padding the test can grow, standing in for
/// the streaming card getting taller and the keyboard inset re-padding the feed.
Widget _host({
  required FeedScrollPinHandle handle,
  required ScrollController controller,
  required int items,
  double padding = 0,
}) => MaterialApp(
  home: Scaffold(
    body: SizedBox(
      height: 300,
      child: FeedScrollPin(
        handle: handle,
        controller: controller,
        child: ListView.builder(
          controller: controller,
          padding: EdgeInsets.only(bottom: padding),
          itemCount: items,
          itemBuilder: (_, i) => SizedBox(height: 100, child: Text('$i')),
        ),
      ),
    ),
  ),
);

/// Past the pin's settle window — the point after which it has let go.
const _afterSettle = Duration(seconds: 2);

void main() {
  testWidgets('rides the tail down to the bottom when asked', (tester) async {
    final handle = FeedScrollPinHandle();
    final controller = ScrollController();
    addTearDown(controller.dispose);
    await tester.pumpWidget(
      _host(handle: handle, controller: controller, items: 10),
    );

    handle.pinToBottom('2026-01-01');
    await tester.pumpAndSettle();

    expect(controller.position.pixels, controller.position.maxScrollExtent);
  });

  testWidgets('corrects while the layout under the travel is still moving', (
    tester,
  ) async {
    final handle = FeedScrollPinHandle();
    final controller = ScrollController();
    addTearDown(controller.dispose);
    await tester.pumpWidget(
      _host(handle: handle, controller: controller, items: 10),
    );
    handle.pinToBottom('2026-01-01');
    await tester.pumpAndSettle();
    final firstBottom = controller.position.maxScrollExtent;

    // The keyboard's inset ramp and the dock's re-measure both land after the
    // target was computed. Inside the settle window the pin still owns the
    // feed, so it closes the gap they opened.
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
    handle.pinToBottom('2026-01-01');
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

  testWidgets('returning to the tail does not re-arm it', (tester) async {
    final handle = FeedScrollPinHandle();
    final controller = ScrollController();
    addTearDown(controller.dispose);
    await tester.pumpWidget(
      _host(handle: handle, controller: controller, items: 10),
    );
    handle.pinToBottom('2026-01-01');
    await tester.pumpAndSettle();
    await tester.drag(find.byType(ListView), const Offset(0, 250));
    await tester.pumpAndSettle();

    // Scroll back to the end under their own power.
    await tester.drag(find.byType(ListView), const Offset(0, -400));
    await tester.pumpAndSettle();
    final restingAt = controller.position.pixels;
    expect(restingAt, controller.position.maxScrollExtent);

    // Silently re-arming here is what made every later layout change — the
    // keyboard opening, above all — throw the feed to the bottom.
    await tester.pumpWidget(
      _host(handle: handle, controller: controller, items: 20),
    );
    await tester.pumpAndSettle();

    expect(
      controller.position.pixels,
      restingAt,
      reason: 'only an explicit request may arm the pin',
    );
  });

  testWidgets('releases itself once the layout has settled', (tester) async {
    final handle = FeedScrollPinHandle();
    final controller = ScrollController();
    addTearDown(controller.dispose);
    await tester.pumpWidget(
      _host(handle: handle, controller: controller, items: 10),
    );
    handle.pinToBottom('2026-01-01');
    await tester.pumpAndSettle();
    await tester.pump(_afterSettle);
    final restingAt = controller.position.pixels;

    // The answer streaming in, a second after the send. The turn the user is
    // reading must stay where it is.
    await tester.pumpWidget(
      _host(handle: handle, controller: controller, items: 20),
    );
    await tester.pumpAndSettle();

    expect(
      controller.position.pixels,
      restingAt,
      reason: 'a settled pin does not follow the card as it grows',
    );
  });

  testWidgets('a fast answer, moments after the travel, is not chased', (
    tester,
  ) async {
    final handle = FeedScrollPinHandle();
    final controller = ScrollController();
    addTearDown(controller.dispose);
    await tester.pumpWidget(
      _host(handle: handle, controller: controller, items: 10),
    );
    handle.pinToBottom('2026-01-01');
    await tester.pumpAndSettle();
    // A reveal this quick used to fall inside the 1.2s window, and was taken
    // to the new bottom as an un-animated jump — the reveal-scroll again.
    await tester.pump(const Duration(milliseconds: 300));
    final restingAt = controller.position.pixels;

    await tester.pumpWidget(
      _host(handle: handle, controller: controller, items: 20),
    );
    await tester.pumpAndSettle();

    expect(
      controller.position.pixels,
      restingAt,
      reason: 'the settle window must not outlast the layout it follows',
    );
  });

  testWidgets('a second request mid-travel travels, it does not jump', (
    tester,
  ) async {
    final handle = FeedScrollPinHandle();
    final controller = ScrollController();
    addTearDown(controller.dispose);
    await tester.pumpWidget(
      _host(handle: handle, controller: controller, items: 10),
    );

    handle.pinToBottom('2026-01-01');
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100)); // mid-travel

    // Every pixel move from here: a request refused mid-travel used to be
    // rescued by the correction, which carries the whole remaining distance in
    // a single frame.
    final startedAt = controller.position.pixels;
    final steps = <double>[];
    var last = startedAt;
    controller.addListener(() {
      steps.add((controller.position.pixels - last).abs());
      last = controller.position.pixels;
    });

    await tester.pumpWidget(
      _host(handle: handle, controller: controller, items: 20),
    );
    handle.pinToBottom('2026-01-01');
    await tester.pumpAndSettle(const Duration(milliseconds: 16));

    expect(controller.position.pixels, controller.position.maxScrollExtent);
    final travelled = (controller.position.pixels - startedAt).abs();
    expect(
      steps.reduce(math.max),
      lessThan(travelled / 3),
      reason: 'one frame carried the whole distance, so it was a jump',
    );
  });

  testWidgets('opening the keyboard long after a send moves nothing', (
    tester,
  ) async {
    final handle = FeedScrollPinHandle();
    final controller = ScrollController();
    addTearDown(controller.dispose);
    await tester.pumpWidget(
      _host(handle: handle, controller: controller, items: 10),
    );
    handle.pinToBottom('2026-01-01');
    await tester.pumpAndSettle();
    await tester.pump(_afterSettle);

    final restingAt = controller.position.pixels;

    // Tapping the composer opens the keyboard, which grows the feed's reserved
    // padding and with it `maxScrollExtent`. That was all a still-armed pin
    // needed: it chased the new bottom and the day slid up under the thumb.
    await tester.pumpWidget(
      _host(handle: handle, controller: controller, items: 10, padding: 300),
    );
    await tester.pumpAndSettle();

    expect(
      controller.position.pixels,
      restingAt,
      reason: 'opening the keyboard is not a request to scroll',
    );
  });
}
