import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/nutrition/logic/macro_trend_bars.dart';
import 'package:kallo_mobile/models/nutrition.dart';

DaySeriesBucket _bucket(
  String date,
  double? value, {
  bool excluded = false,
}) =>
    DaySeriesBucket(
      startDate: date,
      endDate: date,
      value: value,
      ratioOfTarget: null,
      excluded: excluded,
    );

NutrientDaySeries _series(
  String metric,
  List<DaySeriesBucket> buckets,
) =>
    NutrientDaySeries(
      metric: metric,
      labelKey: 'nutrition.macros.$metric',
      unit: 'g',
      target: null,
      buckets: buckets,
      min: null,
      max: null,
    );

void main() {
  group('buildMacroTrendBars', () {
    test('carries the excluded flag through so the column can be greyed', () {
      // The middle day was logged but set aside by the "complete days" scope.
      // It must keep its real height — dropping it would leave a hole
      // indistinguishable from a day nobody logged.
      final bars = buildMacroTrendBars(NutritionDaySeries(
        unit: 'day',
        series: [
          _series('protein', [
            _bucket('2026-05-01', 100),
            _bucket('2026-05-02', 20, excluded: true),
            _bucket('2026-05-03', 90),
          ]),
        ],
      ));

      expect(bars, isNotNull);
      expect(bars!.bars[0].excluded, isFalse);
      expect(bars.bars[1].excluded, isTrue);
      expect(bars.bars[1].isGap, isFalse);
      expect(bars.bars[1].total, 80); // 20g protein × 4 kcal
      expect(bars.bars[2].excluded, isFalse);
    });

    test('a bucket with nothing logged is a gap, not an excluded column', () {
      final bars = buildMacroTrendBars(NutritionDaySeries(
        unit: 'day',
        series: [
          _series('protein', [
            _bucket('2026-05-01', 100),
            _bucket('2026-05-02', null),
          ]),
        ],
      ));

      expect(bars!.bars[1].isGap, isTrue);
      expect(bars.bars[1].excluded, isFalse);
      // …and the gap must not drag the axis down.
      expect(bars.maxY, 400);
    });
  });

  group('isColumnDimmed', () {
    MacroBar bar(int index, {bool excluded = false}) => MacroBar(
          index: index,
          startDate: '2026-05-0${index + 1}',
          endDate: '2026-05-0${index + 1}',
          protein: 100,
          carbohydrate: 200,
          fat: 10,
          excluded: excluded,
        );

    test('greys the scope-excluded columns when nothing is selected', () {
      expect(isColumnDimmed(bar(0), null), isFalse);
      expect(isColumnDimmed(bar(1, excluded: true), null), isTrue);
    });

    test('greys everything but the selection once one exists', () {
      expect(isColumnDimmed(bar(1), 1), isFalse);
      expect(isColumnDimmed(bar(0), 1), isTrue);
    });

    test('colours a selected column even when the scope excludes it', () {
      // The regression: `excluded || not-selected` greyed the WHOLE chart when
      // the tapped column was itself excluded, leaving no colour anywhere.
      expect(isColumnDimmed(bar(1, excluded: true), 1), isFalse);
      expect(isColumnDimmed(bar(0, excluded: true), 1), isTrue);
      expect(isColumnDimmed(bar(2), 1), isTrue);
    });
  });
}
