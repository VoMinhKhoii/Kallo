import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/shared/widgets/calorie_ring/calorie_ring.dart';
import 'package:kallo_mobile/shared/widgets/calorie_ring/ring_painter.dart';

/// The dashboard and logging each carried their own copy of this ring. The
/// copies agreed on everything the painter draws and disagreed on ONE thing:
/// what the sweep animates FROM when the numbers change. Logging continued from
/// wherever the arc sat; the dashboard swept from empty again.
///
/// Consolidating them put that difference behind [CalorieRing.refillFromEmpty]
/// rather than picking a winner, so these tests exist to keep both halves of it
/// alive — a later "simplification" that drops the flag fails here.
///
/// A [center] child is always supplied so the default in-ring readout (which
/// needs easy_localization) never builds; the arc is what's under test.

double _ratio(WidgetTester tester) =>
    (tester.widget<CustomPaint>(find.byType(CustomPaint)).painter!
            as CalorieRingPainter)
        .ratio;

Future<void> _pump(
  WidgetTester tester, {
  required double current,
  required double target,
  required bool refillFromEmpty,
}) => tester.pumpWidget(
  Directionality(
    textDirection: TextDirection.ltr,
    child: Center(
      child: refillFromEmpty
          ? CalorieRing.refilling(
              current: current,
              target: target,
              center: const SizedBox.shrink(),
            )
          : CalorieRing(
              current: current,
              target: target,
              center: const SizedBox.shrink(),
            ),
    ),
  ),
);

void main() {
  group('the sweep', () {
    testWidgets('settles on the consumed fraction of the target', (
      tester,
    ) async {
      await _pump(tester, current: 500, target: 2000, refillFromEmpty: false);
      await tester.pumpAndSettle();
      expect(_ratio(tester), 0.25);
    });

    testWidgets('starts from empty on first build', (tester) async {
      await _pump(tester, current: 500, target: 2000, refillFromEmpty: false);
      expect(_ratio(tester), 0);
    });

    testWidgets('reads zero rather than dividing by a zero target', (
      tester,
    ) async {
      await _pump(tester, current: 500, target: 0, refillFromEmpty: false);
      await tester.pumpAndSettle();
      expect(_ratio(tester), 0);
    });

    testWidgets('passes an over-target fraction through past 1.0', (
      tester,
    ) async {
      await _pump(tester, current: 2500, target: 2000, refillFromEmpty: false);
      await tester.pumpAndSettle();
      expect(_ratio(tester), 1.25);
    });
  });

  group('refillFromEmpty: false — logging continues the arc', () {
    testWidgets('re-animates from where the arc already sits', (tester) async {
      await _pump(tester, current: 500, target: 2000, refillFromEmpty: false);
      await tester.pumpAndSettle();

      await _pump(tester, current: 1000, target: 2000, refillFromEmpty: false);
      expect(_ratio(tester), 0.25, reason: 'the ring must not drop to empty');

      await tester.pumpAndSettle();
      expect(_ratio(tester), 0.5);
    });

    testWidgets('stays put when the numbers move but the ratio does not', (
      tester,
    ) async {
      await _pump(tester, current: 500, target: 2000, refillFromEmpty: false);
      await tester.pumpAndSettle();

      // Same 25%, different numbers: nothing to travel to, so no animation.
      await _pump(tester, current: 1000, target: 4000, refillFromEmpty: false);
      await tester.pump(const Duration(milliseconds: 500));
      expect(_ratio(tester), 0.25);
    });
  });

  group('refillFromEmpty: true — the dashboard refills', () {
    testWidgets('drops to empty and sweeps up again', (tester) async {
      await _pump(tester, current: 500, target: 2000, refillFromEmpty: true);
      await tester.pumpAndSettle();

      await _pump(tester, current: 1000, target: 2000, refillFromEmpty: true);
      expect(_ratio(tester), 0, reason: 'the dashboard ring restarts at empty');

      await tester.pumpAndSettle();
      expect(_ratio(tester), 0.5);
    });

    testWidgets('restarts even when the ratio is unchanged', (tester) async {
      await _pump(tester, current: 500, target: 2000, refillFromEmpty: true);
      await tester.pumpAndSettle();

      await _pump(tester, current: 1000, target: 4000, refillFromEmpty: true);
      expect(_ratio(tester), 0);

      await tester.pumpAndSettle();
      expect(_ratio(tester), 0.25);
    });
  });
}
