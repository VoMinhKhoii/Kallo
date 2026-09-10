import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/onboarding/widgets/onboarding_step_swipe.dart';

/// The wizard's right-swipe-goes-back gesture, in isolation.
///
/// The wizard itself is exercised in `onboarding_wizard_test.dart`; what this
/// file pins is the contract that file cannot see — that the gesture loses to a
/// horizontal control inside it (the goal screen's pace ruler), that it ignores
/// a vertical scroll, and that a null callback is a silent no-op rather than a
/// crash, which is how "while a save is in flight" and "screen 1 of a mandatory
/// run" are honoured with no extra state.
void main() {
  const width = 400.0;

  Widget host({
    required VoidCallback? onBack,
    Widget? child,
    TextDirection direction = TextDirection.ltr,
  }) => Directionality(
    textDirection: direction,
    child: Center(
      child: SizedBox(
        width: width,
        height: 600,
        child: OnboardingStepSwipe(
          onBack: onBack,
          child: child ?? const ColoredBox(color: Color(0xFFEEEEEE)),
        ),
      ),
    ),
  );

  Future<void> swipe(
    WidgetTester tester,
    double dx, {
    Duration duration = const Duration(milliseconds: 300),
  }) async {
    await tester.timedDragFrom(
      tester.getCenter(find.byType(OnboardingStepSwipe)),
      Offset(dx, 0),
      duration,
    );
    await tester.pumpAndSettle();
  }

  testWidgets('a right fling goes back', (tester) async {
    var backs = 0;
    await tester.pumpWidget(host(onBack: () => backs++));

    await swipe(tester, 150, duration: const Duration(milliseconds: 120));

    expect(backs, 1);
  });

  testWidgets('a slow drag past a fifth of the width goes back', (tester) async {
    var backs = 0;
    await tester.pumpWidget(host(onBack: () => backs++));

    // 30% of the width, slow enough that the fling threshold is not what
    // carries it.
    await swipe(tester, width * 0.3, duration: const Duration(seconds: 1));

    expect(backs, 1);
  });

  testWidgets('a short slow drag does not', (tester) async {
    var backs = 0;
    await tester.pumpWidget(host(onBack: () => backs++));

    await swipe(tester, width * 0.1, duration: const Duration(seconds: 1));

    expect(backs, 0);
  });

  testWidgets('a LEFT swipe never advances — forward stays on the CTA', (
    tester,
  ) async {
    var backs = 0;
    await tester.pumpWidget(host(onBack: () => backs++));

    await swipe(tester, -300, duration: const Duration(milliseconds: 120));

    expect(backs, 0);
  });

  testWidgets('a null callback is a silent no-op (busy, or mandatory screen 1)',
      (tester) async {
    await tester.pumpWidget(host(onBack: null));

    await swipe(tester, 300, duration: const Duration(milliseconds: 120));

    expect(tester.takeException(), isNull);
  });

  testWidgets('in RTL, back is a LEFT swipe', (tester) async {
    var backs = 0;
    await tester.pumpWidget(
      host(onBack: () => backs++, direction: TextDirection.rtl),
    );

    await swipe(tester, -300, duration: const Duration(milliseconds: 120));
    expect(backs, 1);

    await swipe(tester, 300, duration: const Duration(milliseconds: 120));
    expect(backs, 1, reason: 'the other way is forward, and forward is the CTA');
  });

  testWidgets('a horizontal control inside wins the drag — the pace ruler case',
      (tester) async {
    var backs = 0;
    final controller = ScrollController();
    addTearDown(controller.dispose);

    await tester.pumpWidget(
      host(
        onBack: () => backs++,
        child: ListView(
          controller: controller,
          scrollDirection: Axis.horizontal,
          children: <Widget>[
            for (var i = 0; i < 12; i++) SizedBox(width: 120, child: Text('$i')),
          ],
        ),
      ),
    );
    controller.jumpTo(400);
    await tester.pump();

    await swipe(tester, 300, duration: const Duration(milliseconds: 120));

    expect(backs, 0, reason: 'the ruler owns the drag, not the wizard');
    expect(controller.offset, lessThan(400), reason: 'and it actually scrolled');
  });

  testWidgets('a vertical scroll is not a back swipe', (tester) async {
    var backs = 0;
    final controller = ScrollController();
    addTearDown(controller.dispose);

    await tester.pumpWidget(
      host(
        onBack: () => backs++,
        child: ListView(
          controller: controller,
          children: <Widget>[
            for (var i = 0; i < 40; i++) SizedBox(height: 60, child: Text('$i')),
          ],
        ),
      ),
    );

    await tester.timedDragFrom(
      tester.getCenter(find.byType(OnboardingStepSwipe)),
      const Offset(0, -300),
      const Duration(milliseconds: 200),
    );
    await tester.pumpAndSettle();

    expect(backs, 0);
    expect(controller.offset, greaterThan(0));
  });
}
