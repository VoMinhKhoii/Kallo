import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/nutrition/logic/chart_axis.dart';

void main() {
  group('buildMacroTrendAxis', () {
    test('keeps the small-range ladder (maxY 1400 → 250 step)', () {
      final axis = buildMacroTrendAxis(1400);
      expect(axis.step, 250);
      expect(axis.maxLabel, 1500);
    });

    test('keeps a 2500 step while it fits six lines (maxY 14000)', () {
      expect(buildMacroTrendAxis(14000).step, 2500);
    });

    test('keeps climbing past 2500 for extreme days', () {
      // A 65,449 kcal day used to get a 2500 step: 27 stacked labels.
      expect(buildMacroTrendAxis(16000).step, 5000);
      expect(buildMacroTrendAxis(34799).step, 10000);
      final axis = buildMacroTrendAxis(65449);
      expect(axis.step, 25000);
      expect(axis.maxLabel, 75000);
    });

    test('never draws more than six labelled lines', () {
      for (final maxY in <double>[
        1.0,
        99,
        601,
        1501,
        6001,
        12001,
        15001,
        60001,
        1e6,
        3e7,
      ]) {
        final axis = buildMacroTrendAxis(maxY);
        expect(
          axis.maxLabel / axis.step,
          lessThanOrEqualTo(6),
          reason: '$maxY',
        );
      }
    });
  });
}
