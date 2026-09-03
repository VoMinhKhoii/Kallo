import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/shared/widgets/sheet/sheet_page_swap.dart';
import 'package:kallo_mobile/theme/kallo_motion.dart';

/// The two levels a sheet swaps between, deliberately at very different
/// heights — the short list first, the tall detail page second.
const Key kFirst = ValueKey('page-first');
const Key kSecond = ValueKey('page-second');

Widget _host(bool second) => Directionality(
  textDirection: TextDirection.ltr,
  child: Align(
    alignment: Alignment.topCenter,
    child: SizedBox(
      width: 320,
      child: SheetPageSwap(
        isSecondLevel: second,
        child:
            second
                ? const SizedBox(
                  key: kSecond,
                  width: double.infinity,
                  height: 300,
                )
                : const SizedBox(
                  key: kFirst,
                  width: double.infinity,
                  height: 100,
                ),
      ),
    ),
  ),
);

void main() {
  Future<void> startSwap(WidgetTester tester) async {
    await tester.pumpWidget(_host(false));
    await tester.pumpAndSettle();
    expect(tester.getSize(find.byType(SheetPageSwap)).height, 100);
    await tester.pumpWidget(_host(true));
  }

  // A quarter, a half and three quarters of the way through the paging token.
  final Duration step = KalloMotion.page ~/ 4;

  testWidgets('pages without crossfading — no opacity anywhere', (
    tester,
  ) async {
    await startSwap(tester);
    for (var frame = 1; frame <= 3; frame++) {
      await tester.pump(step);
      expect(
        find.byType(FadeTransition),
        findsNothing,
        reason:
            'the pages translate; a fade at ${frame * 25}% is the old '
            'AnimatedSwitcher cross-dissolve coming back',
      );
      expect(find.byType(SlideTransition), findsNWidgets(2));
    }
  });

  testWidgets('holds the taller height for the whole slide', (tester) async {
    await startSwap(tester);
    // Straight after the flip, before a single millisecond of the slide: the
    // loose Stack already stands at the incoming page's height, so the page
    // arriving from the right is never clipped by a box still growing.
    expect(tester.getSize(find.byType(SheetPageSwap)).height, 300);
    for (var frame = 1; frame <= 3; frame++) {
      await tester.pump(step);
      expect(
        tester.getSize(find.byType(SheetPageSwap)).height,
        greaterThanOrEqualTo(300),
        reason: 'the sheet must not shrink to fit mid-transition',
      );
    }
    await tester.pumpAndSettle();
    expect(tester.getSize(find.byType(SheetPageSwap)).height, 300);
  });

  testWidgets('lands the incoming page flush and drops the outgoing one', (
    tester,
  ) async {
    await startSwap(tester);
    // Both are mounted while they travel — that is what the outgoing slide has
    // to animate.
    await tester.pump(step);
    expect(find.byKey(kFirst), findsOneWidget);
    expect(find.byKey(kSecond), findsOneWidget);

    await tester.pumpAndSettle();
    expect(
      find.byKey(kFirst),
      findsNothing,
      reason: 'the page left behind must be unmounted, not parked off-screen',
    );
    final swap = tester.getRect(find.byType(SheetPageSwap));
    expect(tester.getRect(find.byKey(kSecond)).left, closeTo(swap.left, 0.01));
  });

  testWidgets('a pop travels the other way', (tester) async {
    await tester.pumpWidget(_host(true));
    await tester.pumpAndSettle();
    await tester.pumpWidget(_host(false));
    await tester.pump(step);
    // Pushing sends the incoming page in from the RIGHT; popping must bring it
    // back from the left, or "back" reads as another step forward.
    expect(
      tester.getRect(find.byKey(kFirst)).left,
      lessThan(tester.getRect(find.byType(SheetPageSwap)).left),
    );
    await tester.pumpAndSettle();
    expect(find.byKey(kSecond), findsNothing);
    expect(tester.getSize(find.byType(SheetPageSwap)).height, 100);
  });
}
