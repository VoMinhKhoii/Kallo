/// Pure helpers for the tap-a-column breakdown. Mirror of web
/// `components/nutrition/sections/bucket-detail-utils.ts` (keep in sync).
library;

import 'package:intl/intl.dart';

import '../../../models/nutrition.dart';

/// Charted macros, in the order the detail panel lists them.
const List<String> kDetailMacros = [
  'calories',
  'protein',
  'carbohydrate',
  'fat',
];

class BucketMetric {
  const BucketMetric({
    required this.metric,
    required this.labelKey,
    required this.unit,
    required this.value,
    required this.target,
    required this.percentOfTarget,
  });

  final String metric;
  final String labelKey;
  final String unit;
  final double value;
  final double? target;

  /// `ratioOfTarget` as a percentage, or null when the metric has no target.
  final double? percentOfTarget;
}

class BucketDetailData {
  const BucketDetailData({
    required this.index,
    required this.startDate,
    required this.endDate,
    required this.macros,
    required this.nutrients,
  });

  final int index;
  final String startDate;
  final String endDate;
  final List<BucketMetric> macros;
  final List<BucketMetric> nutrients;

  bool get isWeekBucket => startDate != endDate;
}

/// Everything the overview already knows about one bucket.
///
/// No refetch: `daySeries` already carries a per-bucket series for the four
/// macros AND the eight default micronutrients, so a day's breakdown is a read
/// of data that shipped with the page. The extended `moreNutrients` set has no
/// per-bucket series, so it is deliberately absent — a day view shows the
/// headline eight, not a second full grid.
///
/// Returns null for a bucket with nothing logged, so the caller can ignore taps
/// on an empty column.
BucketDetailData? buildBucketDetail(NutritionDaySeries daySeries, int index) {
  if (daySeries.series.isEmpty) return null;
  final bounds = _bucketAt(daySeries.series.first, index);
  if (bounds == null) return null;

  final macros = <BucketMetric>[];
  final nutrients = <BucketMetric>[];
  for (final series in daySeries.series) {
    final bucket = _bucketAt(series, index);
    final value = bucket?.value;
    if (value == null) continue;
    final metric = BucketMetric(
      metric: series.metric,
      labelKey: series.labelKey,
      unit: series.unit,
      value: value,
      target: series.target,
      percentOfTarget: bucket!.ratioOfTarget == null
          ? null
          : bucket.ratioOfTarget! * 100,
    );
    if (kDetailMacros.contains(series.metric)) {
      macros.add(metric);
    } else {
      nutrients.add(metric);
    }
  }

  if (macros.isEmpty && nutrients.isEmpty) return null;

  // Keep the macro order stable regardless of the series order on the wire.
  macros.sort((a, b) =>
      kDetailMacros.indexOf(a.metric).compareTo(kDetailMacros.indexOf(b.metric)));

  return BucketDetailData(
    index: index,
    startDate: bounds.startDate,
    endDate: bounds.endDate,
    macros: macros,
    nutrients: nutrients,
  );
}

DaySeriesBucket? _bucketAt(NutrientDaySeries series, int index) =>
    index >= 0 && index < series.buckets.length ? series.buckets[index] : null;

/// The panel's heading: a weekday + date for a day bucket, a `start – end` span
/// for a week one.
String formatBucketRange(String startDate, String endDate, String locale) {
  final start = DateTime.tryParse(startDate);
  if (start == null) return '';
  final short = DateFormat.MMMd(locale);
  if (startDate == endDate) {
    return '${DateFormat.EEEE(locale).format(start)}, ${short.format(start)}';
  }
  final end = DateTime.tryParse(endDate);
  if (end == null) return short.format(start);
  return '${short.format(start)} – ${short.format(end)}';
}

/// Today as a local `yyyy-MM-dd`, matching the server's local-date bucketing.
String localIsoDate([DateTime? now]) {
  final d = now ?? DateTime.now();
  final month = d.month.toString().padLeft(2, '0');
  final day = d.day.toString().padLeft(2, '0');
  return '${d.year}-$month-$day';
}

/// Index of the bucket holding [today], or -1. Day buckets match exactly; week
/// buckets match the week it falls in, so the current week reads as current.
int findTodayIndex(List<DaySeriesBucket> buckets, String today) {
  for (var i = 0; i < buckets.length; i++) {
    if (today.compareTo(buckets[i].startDate) >= 0 &&
        today.compareTo(buckets[i].endDate) <= 0) {
      return i;
    }
  }
  return -1;
}
