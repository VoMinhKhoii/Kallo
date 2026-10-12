import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/shared/logic/macro_composition.dart';
import 'package:kallo_mobile/shared/widgets/gauge/macro_ring.dart';

MacroRingPainter painter(MacroGrams grams, {double gap = 2}) =>
    MacroRingPainter(
      segments: compositionFromGrams(grams).segments,
      thickness: 12,
      gapDegrees: gap,
    );

double deg(double radians) => radians * 180 / math.pi;

void main() {
  test('segments run clockwise from 12 in protein, carbs, fat order', () {
    final arcs = painter((
      protein: 38.4,
      carbohydrate: 45.2,
      fat: 14.5,
    )).arcs(64);
    expect(arcs.keys, ['protein', 'carbohydrate', 'fat']);
    final starts = [for (final (start, _) in arcs.values) start];
    expect(starts.first, greaterThan(-math.pi / 2));
    expect(starts, orderedEquals([...starts]..sort()));
  });

  test('neighbours leave exactly the gap once their caps are drawn', () {
    final p = painter((protein: 30, carbohydrate: 30, fat: 10));
    final arcs = p.arcs(64).values.toList();
    const mid = 64 - 6.0;
    final cap = 6 / mid; // a round cap reaches thickness/2 past the arc end
    for (var i = 0; i < arcs.length - 1; i++) {
      final (start, sweep) = arcs[i];
      final (next, _) = arcs[i + 1];
      final air = (next - cap) - (start + sweep + cap);
      expect(deg(air), closeTo(2, 1e-9));
    }
  });

  test('sweeps follow ENERGY share, not grams', () {
    // 10 g fat is 90 kcal; 10 g protein 40 — fat must draw the longer arc.
    final arcs = painter((protein: 10, carbohydrate: 0, fat: 10)).arcs(64);
    expect(arcs.containsKey('carbohydrate'), isFalse);
    expect(arcs['fat']!.$2, greaterThan(arcs['protein']!.$2));
  });

  testWidgets('shows the calories in its middle', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: MacroRing(kcal: 475.4, protein: 38, carbs: 45, fat: 14),
        ),
      ),
    );
    expect(find.text('475'), findsOneWidget);
    expect(find.text('kcal'), findsOneWidget);
    expect(tester.getSize(find.byType(MacroRing)), const Size(128, 128));
  });
}
