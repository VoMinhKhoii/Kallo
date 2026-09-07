import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/shared/logic/macro_composition.dart';
import 'package:kallo_mobile/shared/widgets/nutrition/composition_bar.dart';
import 'package:kallo_mobile/theme/kallo_theme.dart';

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

  // The bar is one mark made of three: rounding only the outer clip squares off
  // the two INTERIOR ends, so the middle segment reads as a slab wedged between
  // two lozenges. Each segment carries its own pill instead.
  testWidgets('every segment is its own pill', (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: Center(
          child: SizedBox(
            width: 300,
            child: CompositionBar(
              segments: compositionFromGrams(
                (protein: 25, carbohydrate: 89, fat: 15),
              ).segments,
            ),
          ),
        ),
      ),
    ));
    final clips = find.descendant(
      of: find.byType(CompositionBar),
      matching: find.byType(ClipRRect),
    );
    expect(clips, findsNWidgets(4), reason: 'outer silhouette + one per segment');

    final boxes = find.descendant(
      of: find.byType(CompositionBar),
      matching: find.byType(ColoredBox),
    );
    expect(boxes, findsNWidgets(3));
    for (var i = 0; i < 3; i++) {
      final wrappers = find.ancestor(
        of: boxes.at(i),
        matching: find.byType(ClipRRect),
      );
      expect(
        wrappers,
        findsNWidgets(2),
        reason: 'segment $i should sit inside its own clip AND the outer one',
      );
      final own = tester.widget<ClipRRect>(wrappers.first);
      expect(
        own.borderRadius,
        BorderRadius.circular(KalloRadii.pill),
        reason: 'segment $i was not rounded at both ends',
      );
    }
  });

  // Pills meeting flush overlap at their curved ends and show hairline wedges
  // of the surface behind. The gutter is what makes rounded segments legible,
  // so the full-size variant carries it too — not just the compact one.
  testWidgets('the full-size bar gutters its segments', (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: Center(
          child: SizedBox(
            width: 300,
            child: CompositionBar(
              segments: compositionFromGrams(
                (protein: 25, carbohydrate: 89, fat: 0),
              ).segments,
            ),
          ),
        ),
      ),
    ));
    final boxes = find.descendant(
      of: find.byType(CompositionBar),
      matching: find.byType(ColoredBox),
    );
    expect(boxes, findsNWidgets(2), reason: 'the zero-fat segment is dropped');
    expect(
      tester.getRect(boxes.at(1)).left - tester.getRect(boxes.at(0)).right,
      2,
    );
  });
}
