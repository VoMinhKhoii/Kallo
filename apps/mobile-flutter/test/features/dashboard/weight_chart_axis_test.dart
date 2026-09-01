import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/dashboard/logic/weight_chart_axis.dart';

/// [niceYAxis] is a pure, public function that exists to be reasoned about
/// without a chart on screen — so it has to answer for the empty series on its
/// own rather than leaning on `WeightChart` checking `weights.isEmpty` before
/// it paints. `reduce` throws on an empty list, and that guard is one refactor
/// of the caller away from being gone.
void main() {
  test('an empty series still yields a usable band', () {
    final axis = niceYAxis(const []);

    expect(axis.step, greaterThan(0));
    expect(axis.max, greaterThan(axis.min));
    // The same three-step floor every other series gets, so the chart is never
    // asked to scale a zero-height domain.
    expect(axis.max - axis.min, greaterThanOrEqualTo(axis.step * 3 - 1e-9));
  });

  test('a single point sits inside its band, not on an edge', () {
    final axis = niceYAxis(const [65.9]);

    expect(axis.min, lessThan(65.9));
    expect(axis.max, greaterThan(65.9));
  });
}
