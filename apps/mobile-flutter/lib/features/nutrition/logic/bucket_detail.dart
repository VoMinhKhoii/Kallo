/// Pure helpers for the tap-a-column breakdown. Mirror of web
/// `lib/domain/nutrition/bucket-detail.ts` (keep in sync).
library;

import 'package:intl/intl.dart';

import '../../../models/nutrition/nutrition.dart';

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
/// macros and every displayed micronutrient, so a day's breakdown is a read of
/// data that shipped with the page.
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
      percentOfTarget:
          bucket!.ratioOfTarget == null ? null : bucket.ratioOfTarget! * 100,
    );
    if (kDetailMacros.contains(series.metric)) {
      macros.add(metric);
    } else {
      nutrients.add(metric);
    }
  }

  if (macros.isEmpty && nutrients.isEmpty) return null;

  // Keep the macro order stable regardless of the series order on the wire.
  macros.sort(
    (a, b) => kDetailMacros
        .indexOf(a.metric)
        .compareTo(kDetailMacros.indexOf(b.metric)),
  );

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

/// A day-first date span: "10 – 16 Aug 2026", or "28 Jul – 3 Aug 2026" when it
/// crosses a month. A single day collapses to "13 Aug 2026".
///
/// Day-first on purpose, and it happens to suit both languages this app ships:
/// Vietnamese writes the day before the month anyway, and the month token comes
/// from the locale ("Aug" / "thg 8"), so nothing is hand-translated. The month
/// and year are stated once when both ends share them. Mirror of web
/// `formatDateSpan` (keep in sync).
String formatDateSpan(String startDate, String endDate, String locale) {
  final start = DateTime.tryParse(startDate);
  if (start == null) return '';
  String monthOf(DateTime d) => DateFormat.MMM(locale).format(d);
  String full(DateTime d) => '${d.day} ${monthOf(d)} ${d.year}';

  if (startDate == endDate) return full(start);
  final end = DateTime.tryParse(endDate);
  if (end == null) return full(start);

  if (start.year != end.year) return '${full(start)} – ${full(end)}';
  if (start.month != end.month) {
    return '${start.day} ${monthOf(start)} – ${full(end)}';
  }
  return '${start.day} – ${full(end)}';
}

/// Re-point the macro figures at one bucket, so the calorie hero and the gram
/// legend read that column instead of the whole range. A macro the bucket has
/// no value for drops to 0 rather than carrying the range average forward,
/// which would silently mix two periods in one row.
List<MacroPattern> scopeMacrosToBucket(
  List<MacroPattern> macros,
  BucketDetailData detail,
) {
  final byMetric = {for (final m in detail.macros) m.metric: m};
  return [
    for (final macro in macros)
      macro.copyWith(
        averagePerDay: byMetric[macro.key]?.value ?? 0,
        // Consistency is a property of the range, not of one column in it.
        consistencyPct: () => null,
      ),
  ];
}

/// Re-point the nutrient cards at one bucket.
///
/// Every displayed micronutrient carries a per-bucket series. A missing series
/// still resolves to null so the card cannot carry a range average into a
/// single day's heading.
List<NutrientCardData> scopeCardsToBucket(
  List<NutrientCardData> cards,
  BucketDetailData detail,
) {
  final byMetric = {for (final n in detail.nutrients) n.metric: n};
  return [
    for (final card in cards)
      card.copyWith(
        averagePerDay: () => byMetric[card.nutrient.name]?.value,
        percentOfTarget: () => byMetric[card.nutrient.name]?.percentOfTarget,
        contextMetrics: () => null,
      ),
  ];
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
