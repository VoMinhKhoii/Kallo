import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/shared/widgets/surface/kallo_pressable.dart';
import 'package:kallo_mobile/theme/kallo_colors.dart';
import 'package:kallo_mobile/theme/kallo_motion.dart';

/// The press contract the primitive exists to guarantee: washed for the WHOLE
/// hold (past the long-press threshold, where an arena-driven wash dies),
/// fires on release, drag-off clears without firing, disabled never washes.
void main() {
  Color washOf(WidgetTester tester) {
    final box = tester.widget<AnimatedContainer>(
      find.byType(AnimatedContainer),
    );
    return (box.decoration! as BoxDecoration).color!;
  }

  Future<void> pump(WidgetTester tester, {VoidCallback? onTap}) =>
      tester.pumpWidget(
        Directionality(
          textDirection: TextDirection.ltr,
          child: Center(
            child: KalloPressable(
              onTap: onTap,
              height: 44,
              constraints: const BoxConstraints(minWidth: 120),
              child: const Text('go'),
            ),
          ),
        ),
      );

  testWidgets('stays washed through a long hold, then fires on release', (
    tester,
  ) async {
    var fired = 0;
    await pump(tester, onTap: () => fired++);

    final gesture = await tester.startGesture(
      tester.getCenter(find.text('go')),
    );
    await tester.pump(const Duration(milliseconds: 300));
    expect(washOf(tester), KalloColors.pressWash);
    // Well past kLongPressTimeout, finger still down.
    await tester.pump(const Duration(milliseconds: 1200));
    expect(
      washOf(tester),
      KalloColors.pressWash,
      reason: 'the wash must survive the long-press threshold',
    );

    await gesture.up();
    await tester.pumpAndSettle();
    expect(washOf(tester), const Color(0x00000000));
    expect(fired, 1);
  });

  testWidgets('a drag-off clears the wash and fires nothing', (tester) async {
    var fired = 0;
    await pump(tester, onTap: () => fired++);

    final gesture = await tester.startGesture(
      tester.getCenter(find.text('go')),
    );
    await tester.pump(const Duration(milliseconds: 200));
    expect(washOf(tester), KalloColors.pressWash);
    await gesture.moveBy(const Offset(0, 200));
    await gesture.up();
    await tester.pumpAndSettle();

    expect(washOf(tester), const Color(0x00000000));
    expect(fired, 0);
  });

  // A SCROLL that begins on a pressed target. The pointer never lifts, so
  // nothing used to clear the wash and a flick down the Circle feed left the
  // post it started on grey for the whole drag. Past kTouchSlop the finger is
  // scrolling, not pressing.
  testWidgets('a scroll past the slop releases the wash and fires nothing', (
    tester,
  ) async {
    var fired = 0;
    await pump(tester, onTap: () => fired++);

    final gesture = await tester.startGesture(
      tester.getCenter(find.text('go')),
    );
    await tester.pump(KalloMotion.press);
    expect(washOf(tester), KalloColors.pressWash);

    await gesture.moveBy(const Offset(0, kTouchSlop + 1));
    await tester.pump(KalloMotion.press);
    expect(
      washOf(tester),
      const Color(0x00000000),
      reason: 'the feed must not stay grey under a scrolling finger',
    );

    // Still no tap: the recognizer lost the pointer at the same slop.
    await gesture.up();
    await tester.pumpAndSettle();
    expect(fired, 0);
  });

  testWidgets('a move within the slop keeps the wash', (tester) async {
    // A finger never holds perfectly still; a press is not over until it
    // travels far enough to be a drag.
    await pump(tester, onTap: () {});

    final gesture = await tester.startGesture(
      tester.getCenter(find.text('go')),
    );
    await tester.pump(KalloMotion.press);
    await gesture.moveBy(const Offset(0, kTouchSlop / 2));
    await tester.pump(KalloMotion.press);

    expect(washOf(tester), KalloColors.pressWash);
    await gesture.up();
    await tester.pumpAndSettle();
  });

  testWidgets('disabled never washes', (tester) async {
    await pump(tester, onTap: null);
    final gesture = await tester.startGesture(
      tester.getCenter(find.text('go')),
    );
    await tester.pump(const Duration(milliseconds: 300));
    expect(washOf(tester), const Color(0x00000000));
    await gesture.up();
  });

  // Nesting. A Circle post is a pressable (the whole post opens its thread)
  // holding pressables (heart, reply, log). Both are hit, so both would wash
  // and a tap on the heart would flash the entire post — only the INNER one
  // may wash.
  testWidgets('a nested pressable washes alone', (tester) async {
    Color washAt(int index) {
      final box = tester.widget<AnimatedContainer>(
        find.byType(AnimatedContainer).at(index),
      );
      return (box.decoration! as BoxDecoration).color!;
    }

    await tester.pumpWidget(
      Directionality(
        textDirection: TextDirection.ltr,
        child: Center(
          child: KalloPressable(
            onTap: () {},
            alignment: Alignment.topLeft,
            child: SizedBox(
              width: 300,
              height: 200,
              child: Align(
                alignment: Alignment.bottomRight,
                child: KalloPressable(
                  onTap: () {},
                  height: 44,
                  constraints: const BoxConstraints(minWidth: 60),
                  child: const Text('inner'),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    // Depth-first, so index 0 is the outer target's container.
    const outer = 0;
    const inner = 1;
    expect(tester.getSize(find.byType(KalloPressable).first).width, 300);

    var gesture = await tester.startGesture(
      tester.getCenter(find.text('inner')),
    );
    await tester.pump(KalloMotion.press);
    expect(washAt(inner), KalloColors.pressWash);
    expect(
      washAt(outer),
      const Color(0x00000000),
      reason: 'the post must not flash when a glyph inside it is pressed',
    );
    await gesture.up();
    await tester.pumpAndSettle();
    expect(washAt(inner), const Color(0x00000000));
    expect(washAt(outer), const Color(0x00000000));

    // The margin around the inner target still belongs to the post.
    gesture = await tester.startGesture(
      tester.getTopLeft(find.byType(KalloPressable).first) +
          const Offset(10, 10),
    );
    await tester.pump(KalloMotion.press);
    expect(washAt(outer), KalloColors.pressWash);
    expect(washAt(inner), const Color(0x00000000));
    await gesture.up();
    await tester.pumpAndSettle();
    expect(washAt(outer), const Color(0x00000000));
    expect(washAt(inner), const Color(0x00000000));
  });

  // A control that is disabled MID-INTERACTION is still a control. The Circle
  // heart drops its `onTap` while its reaction is in flight, and it sits
  // inside the post's own tap target: if the disabled glyph let the press
  // through, a double tap on the heart would open the thread (2026-09-08).
  testWidgets('a disabled nested target absorbs the tap', (tester) async {
    Color washAt(int index) {
      final box = tester.widget<AnimatedContainer>(
        find.byType(AnimatedContainer).at(index),
      );
      return (box.decoration! as BoxDecoration).color!;
    }

    var outerTaps = 0;
    await tester.pumpWidget(
      Directionality(
        textDirection: TextDirection.ltr,
        child: Center(
          child: KalloPressable(
            onTap: () => outerTaps++,
            alignment: Alignment.topLeft,
            child: const SizedBox(
              width: 300,
              height: 200,
              child: Align(
                alignment: Alignment.bottomRight,
                child: KalloPressable(
                  onTap: null,
                  height: 44,
                  constraints: BoxConstraints(minWidth: 60),
                  child: Text('inner'),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    const outer = 0;
    const inner = 1;

    final gesture = await tester.startGesture(
      tester.getCenter(find.text('inner')),
    );
    await tester.pump(KalloMotion.press);
    expect(washAt(inner), const Color(0x00000000));
    expect(
      washAt(outer),
      const Color(0x00000000),
      reason: 'a press on a disabled glyph must not wash the post behind it',
    );
    await gesture.up();
    await tester.pumpAndSettle();

    expect(
      outerTaps,
      0,
      reason: 'the disabled glyph owns the press; the post never sees it',
    );
    expect(washAt(outer), const Color(0x00000000));
  });

  // Multi-touch. The wash belongs to the finger that started it, so a second
  // finger landing and lifting elsewhere on the same target leaves it alone.
  testWidgets(
    "a second finger lifting does not clear the first finger's wash",
    (tester) async {
      await pump(tester, onTap: () {});
      final centre = tester.getCenter(find.text('go'));

      final first = await tester.startGesture(
        centre - const Offset(30, 0),
        pointer: 1,
      );
      await tester.pump(KalloMotion.press);
      expect(washOf(tester), KalloColors.pressWash);

      final second = await tester.startGesture(
        centre + const Offset(30, 0),
        pointer: 2,
      );
      await tester.pump(KalloMotion.press);
      await second.up();
      await tester.pumpAndSettle();
      expect(
        washOf(tester),
        KalloColors.pressWash,
        reason: 'the first finger is still down, so the wash is still its own',
      );

      await first.up();
      await tester.pumpAndSettle();
      expect(washOf(tester), const Color(0x00000000));
    },
  );

  // Sizing. The target shrink-wraps its child in both axes; a parent that
  // wants it wider hands it tight constraints. Container's own `alignment`
  // is an Align WITHOUT size factors, which grows to any finite max width —
  // inside a Wrap (which offers the column width) that made every
  // FeedActionButton column-wide, one action per line (2026-09-08).
  // `Center` because pumpWidget hands its root a TIGHT 800x600: a bare
  // SizedBox under tight constraints cannot shrink to 300.
  Widget sized(Widget parent) => Directionality(
    textDirection: TextDirection.ltr,
    child: Center(child: SizedBox(width: 300, child: parent)),
  );

  // `alignment` explicitly, because that is what puts the Align in the tree —
  // and every real consumer passes one (FeedActionButton, KalloAlertAction).
  Widget target() => KalloPressable(
    onTap: () {},
    height: 44,
    alignment: Alignment.center,
    constraints: const BoxConstraints(minWidth: 44),
    child: const SizedBox(width: 60, height: 10),
  );

  testWidgets('inside a Wrap it shrink-wraps to its child', (tester) async {
    await tester.pumpWidget(sized(Wrap(children: [target()])));

    expect(
      tester.getSize(find.byType(KalloPressable)).width,
      60,
      reason: 'a column-wide target puts one action per line in the feed row',
    );
  });

  testWidgets('a stretching Column still gets a full-width target', (
    tester,
  ) async {
    await tester.pumpWidget(
      sized(
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [target()],
        ),
      ),
    );

    expect(
      tester.getSize(find.byType(KalloPressable)).width,
      300,
      reason:
          'the alert action is full-bleed from the Column that stretches it',
    );
  });
}
