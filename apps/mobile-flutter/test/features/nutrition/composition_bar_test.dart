import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/shared/logic/macro_composition.dart';
import 'package:kallo_mobile/shared/widgets/nutrition/composition_bar.dart';

void main() {
  // Regression: the bar once reserved its height and painted nothing, because
  // Expanded ties only the MAIN axis and a childless ColoredBox collapses to
  // zero height under the loose cross-axis constraint a centred Row hands out.
  // Measuring the CompositionBar itself cannot catch this — the container was
  // always the right size. Measure a SEGMENT.
  testWidgets('every segment paints at the full bar height', (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: Center(
          child: SizedBox(
            width: 300,
            child: CompositionBar(
              segments: compositionFromGrams(
                (protein: 25, carbohydrate: 89, fat: 15),
              ).segments,
              height: 6,
            ),
          ),
        ),
      ),
    ));
    final boxes = find.descendant(
      of: find.byType(CompositionBar),
      matching: find.byType(ColoredBox),
    );
    expect(boxes, findsNWidgets(3));
    for (var i = 0; i < 3; i++) {
      final s = tester.getSize(boxes.at(i));
      expect(s.height, 6, reason: 'segment $i painted at height ${s.height}');
      expect(s.width, greaterThan(0), reason: 'segment $i had no width');
    }
  });
}
