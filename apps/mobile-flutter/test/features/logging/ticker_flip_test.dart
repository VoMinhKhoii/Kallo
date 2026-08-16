import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nham_mobile/features/logging/widgets/streaming/ticker_flip.dart';

Widget _wrap(String value, {bool reduceMotion = false}) => MediaQuery(
  data: MediaQueryData(disableAnimations: reduceMotion),
  child: Directionality(
    textDirection: TextDirection.ltr,
    child: TickerFlip(frameKey: value, child: Text(value)),
  ),
);

/// Every ticker line currently in the tree. The whole point of `mode="wait"`
/// is that this is never longer than one.
Iterable<String> _lines(WidgetTester tester) =>
    tester.widgetList<Text>(find.byType(Text)).map((t) => t.data!);

void main() {
  testWidgets('paints its frame at rest', (tester) async {
    await tester.pumpWidget(_wrap('a'));
    expect(_lines(tester), ['a']);
  });

  testWidgets('holds the outgoing line until the flip passes its midpoint', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap('a'));
    await tester.pumpWidget(_wrap('b'));

    // The flip has started but not reached the midpoint: the OLD line is still
    // the one on screen, leaving. Rendering 'b' here would be a cross-fade.
    expect(_lines(tester), ['a']);
    await tester.pump(const Duration(milliseconds: 120));
    expect(_lines(tester), ['a']);

    // Past the midpoint the new line takes over and rises into place.
    await tester.pump(const Duration(milliseconds: 90));
    expect(_lines(tester), ['b']);

    await tester.pumpAndSettle();
    expect(_lines(tester), ['b']);
  });

  testWidgets('never stacks two lines, even mid-flip', (tester) async {
    await tester.pumpWidget(_wrap('a'));
    await tester.pumpWidget(_wrap('b'));
    for (var i = 0; i < 12; i++) {
      expect(_lines(tester), hasLength(1));
      await tester.pump(const Duration(milliseconds: 30));
    }
    await tester.pumpAndSettle();
  });

  testWidgets('a burst mid-flip collapses to the latest frame', (tester) async {
    await tester.pumpWidget(_wrap('a'));
    await tester.pumpWidget(_wrap('b'));
    // Two more dishes resolve while 'b' is still leaving 'a' behind.
    await tester.pump(const Duration(milliseconds: 60));
    await tester.pumpWidget(_wrap('c'));
    await tester.pump(const Duration(milliseconds: 60));
    await tester.pumpWidget(_wrap('d'));

    await tester.pumpAndSettle();
    // 'b' and 'c' are skipped rather than queued one flip each — otherwise a
    // fast pipeline would still be showing stale dishes seconds later.
    expect(_lines(tester), ['d']);
  });

  testWidgets('a frame arriving after the midpoint still gets its own flip', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap('a'));
    await tester.pumpWidget(_wrap('b'));
    await tester.pump(const Duration(milliseconds: 220)); // past the midpoint
    expect(_lines(tester), ['b']);

    await tester.pumpWidget(_wrap('c'));
    await tester.pumpAndSettle();
    expect(_lines(tester), ['c']);
  });

  testWidgets('an unchanged key leaves the line completely alone', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap('a'));
    await tester.pumpWidget(_wrap('a'));
    // No animation to settle — a spurious flip would hang or blink here.
    expect(tester.hasRunningAnimations, isFalse);
    expect(_lines(tester), ['a']);
  });

  testWidgets('reduced motion swaps instantly, with no animation', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap('a', reduceMotion: true));
    await tester.pumpWidget(_wrap('b', reduceMotion: true));
    expect(_lines(tester), ['b']);
    expect(tester.hasRunningAnimations, isFalse);
  });
}
