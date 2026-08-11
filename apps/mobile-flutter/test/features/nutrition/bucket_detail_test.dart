import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'package:nham_mobile/features/nutrition/logic/bucket_detail.dart';
import 'package:nham_mobile/models/nutrition.dart';

NutrientDaySeries _series(
  String metric,
  List<double?> values, {
  double? target,
  String unit = 'g',
}) {
  final buckets = <DaySeriesBucket>[];
  for (var i = 0; i < values.length; i++) {
    final date = '2026-05-0${i + 1}';
    final value = values[i];
    buckets.add(DaySeriesBucket(
      startDate: date,
      endDate: date,
      value: value,
      ratioOfTarget: value != null && target != null && target > 0
          ? value / target
          : null,
    ));
  }
  return NutrientDaySeries(
    metric: metric,
    labelKey: 'nutrition.macros.$metric',
    unit: unit,
    target: target,
    buckets: buckets,
    min: null,
    max: null,
  );
}

NutritionDaySeries _daySeries(List<NutrientDaySeries> list) =>
    NutritionDaySeries(unit: 'day', series: list);

void main() {
  setUpAll(() async {
    await initializeDateFormatting('en');
  });

  group('buildBucketDetail', () {
    test('splits the bucket into macros and micronutrients', () {
      final detail = buildBucketDetail(
        _daySeries([
          _series('calories', [2000, 1500], target: 2000, unit: 'kcal'),
          _series('protein', [100, 80], target: 100),
          _series('calciumMg', [500, 400], target: 1000, unit: 'mg'),
        ]),
        0,
      );

      expect(detail!.macros.map((m) => m.metric), ['calories', 'protein']);
      expect(detail.nutrients.map((m) => m.metric), ['calciumMg']);
      expect(detail.startDate, '2026-05-01');
      expect(detail.isWeekBucket, isFalse);
    });

    test('converts ratioOfTarget into a percentage', () {
      final detail = buildBucketDetail(
        _daySeries([_series('calciumMg', [500], target: 1000, unit: 'mg')]),
        0,
      );
      expect(detail!.nutrients.first.percentOfTarget, closeTo(50, 0.001));
    });

    test('leaves percentOfTarget null when the nutrient has no target', () {
      final detail = buildBucketDetail(
        _daySeries([_series('calciumMg', [500], unit: 'mg')]),
        0,
      );
      expect(detail!.nutrients.first.percentOfTarget, isNull);
      expect(detail.nutrients.first.value, 500);
    });

    test('returns null for a bucket that is a gap on every metric', () {
      final detail = buildBucketDetail(
        _daySeries([
          _series('calories', [2000, null], target: 2000, unit: 'kcal'),
          _series('calciumMg', [500, null], target: 1000, unit: 'mg'),
        ]),
        1,
      );
      expect(detail, isNull);
    });

    test('orders macros consistently regardless of series order', () {
      final detail = buildBucketDetail(
        _daySeries([
          _series('fat', [50], target: 70),
          _series('calories', [2000], target: 2000, unit: 'kcal'),
          _series('carbohydrate', [200], target: 200),
        ]),
        0,
      );
      expect(detail!.macros.map((m) => m.metric),
          ['calories', 'carbohydrate', 'fat']);
    });

    test('returns null for an out-of-range index', () {
      expect(
        buildBucketDetail(_daySeries([_series('calories', [2000])]), 9),
        isNull,
      );
    });
  });

  group('findTodayIndex', () {
    DaySeriesBucket bucket(String start, String end) => DaySeriesBucket(
        startDate: start, endDate: end, value: 1, ratioOfTarget: null);

    test('matches the exact day on a day axis', () {
      final buckets = [
        bucket('2026-05-04', '2026-05-04'),
        bucket('2026-05-05', '2026-05-05'),
      ];
      expect(findTodayIndex(buckets, '2026-05-05'), 1);
    });

    test('matches the containing week on a week axis', () {
      final buckets = [
        bucket('2026-04-27', '2026-05-03'),
        bucket('2026-05-04', '2026-05-10'),
      ];
      expect(findTodayIndex(buckets, '2026-05-07'), 1);
    });

    test('returns -1 when today is outside the window', () {
      expect(findTodayIndex([bucket('2026-05-04', '2026-05-04')], '2026-06-01'),
          -1);
    });
  });

  group('localIsoDate', () {
    test('reads the local calendar date and zero-pads', () {
      expect(localIsoDate(DateTime(2026, 1, 9, 22, 30)), '2026-01-09');
    });
  });

  group('formatDateSpan', () {
    test('collapses a single day to one dated day', () {
      expect(formatDateSpan('2026-05-04', '2026-05-04', 'en'), '4 May 2026');
    });

    test('states the month and year once inside a single month', () {
      expect(formatDateSpan('2026-08-10', '2026-08-16', 'en'), '10 – 16 Aug 2026');
    });

    test('repeats the month when the span crosses one', () {
      expect(formatDateSpan('2026-07-28', '2026-08-03', 'en'), '28 Jul – 3 Aug 2026');
    });

    test('states both years when the span crosses one', () {
      expect(formatDateSpan('2025-12-29', '2026-01-04', 'en'),
          '29 Dec 2025 – 4 Jan 2026');
    });
  });
}
