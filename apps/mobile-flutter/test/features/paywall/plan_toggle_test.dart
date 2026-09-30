import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/paywall/widgets/plans/plan_toggle.dart';

void main() {
  testWidgets(
    'the unchosen gold half is veiled inside its pill, not a square',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Center(
              child: SizedBox(
                width: 360,
                child: PlanToggle(
                  monthlyLabel: 'Monthly',
                  yearlyLabel: 'Yearly',
                  yearly: false,
                  onChanged: (_) {},
                ),
              ),
            ),
          ),
        ),
      );

      // Every tinted box inside the toggle must be rounded: a bare rectangle
      // behind the gold pill showed its corners as a grey square on device.
      final boxes = tester
          .widgetList<DecoratedBox>(
            find.descendant(
              of: find.byType(PlanToggle),
              matching: find.byType(DecoratedBox),
            ),
          )
          .map((b) => b.decoration)
          .whereType<BoxDecoration>()
          .where((d) => d.color != null && d.color != Colors.transparent);
      expect(boxes, isNotEmpty);
      for (final d in boxes) {
        expect(d.borderRadius, isNotNull, reason: 'color ${d.color}');
      }
      expect(
        find.byType(ColoredBox).evaluate().where((e) {
          final box = e.widget as ColoredBox;
          return box.color.a < 1 &&
              find
                  .ancestor(
                    of: find.byWidget(box),
                    matching: find.byType(PlanToggle),
                  )
                  .evaluate()
                  .isNotEmpty;
        }),
        isEmpty,
      );
    },
  );
}
