import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/nutrition/widgets/charts/macro_trend_axis.dart';

void main() {
  test('kcal gutter grows with text while preserving the six-point gap', () {
    for (final scale in [1.0, 1.3]) {
      final axis = kcalAxisTitles(
        step: 500,
        maxLabel: 3000,
        textScaler: TextScaler.linear(scale),
      );
      expect(axis.sideTitles.reservedSize, closeTo(32 * scale + 6, .001));
    }
  });
}
