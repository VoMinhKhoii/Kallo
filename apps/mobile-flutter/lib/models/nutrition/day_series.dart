/// The overview's time axis: one bucket, one metric's series of buckets, and
/// the set of series shipped with an overview.
///
/// Split from `nutrition.dart` for the file-size gate; re-exported from there,
/// so callers keep the one import.
library;

/// One bucket (a day for 7d, a week for 30d) of a metric's time series.
class DaySeriesBucket {
  final String startDate;
  final String endDate;
  final double? value;
  final double? ratioOfTarget;

  /// Logged, but set aside by the current day scope — `value` covers its logged
  /// days and it is not part of the headline. Drawn in the muted pigment.
  final bool excluded;

  const DaySeriesBucket({
    required this.startDate,
    required this.endDate,
    required this.value,
    required this.ratioOfTarget,
    this.excluded = false,
  });

  factory DaySeriesBucket.fromJson(Map<String, dynamic> json) =>
      DaySeriesBucket(
        startDate: json['startDate'] as String,
        endDate: json['endDate'] as String,
        value: (json['value'] as num?)?.toDouble(),
        ratioOfTarget: (json['ratioOfTarget'] as num?)?.toDouble(),
        excluded: json['excluded'] as bool? ?? false,
      );

  Map<String, dynamic> toJson() => {
    'startDate': startDate,
    'endDate': endDate,
    'value': value,
    'ratioOfTarget': ratioOfTarget,
    'excluded': excluded,
  };
}

/// A single metric's per-bucket series (macro or micronutrient).
class NutrientDaySeries {
  final String
  metric; // DaySeriesMetricKey: calories/protein/carbohydrate/fat/<nutrient>
  final String labelKey;
  final String unit;
  final double? target;
  final List<DaySeriesBucket> buckets;
  final double? min;
  final double? max;

  const NutrientDaySeries({
    required this.metric,
    required this.labelKey,
    required this.unit,
    required this.target,
    required this.buckets,
    required this.min,
    required this.max,
  });

  factory NutrientDaySeries.fromJson(Map<String, dynamic> json) =>
      NutrientDaySeries(
        metric: json['metric'] as String,
        labelKey: json['labelKey'] as String,
        unit: json['unit'] as String,
        target: (json['target'] as num?)?.toDouble(),
        buckets:
            (json['buckets'] as List<dynamic>)
                .map((e) => DaySeriesBucket.fromJson(e as Map<String, dynamic>))
                .toList(),
        min: (json['min'] as num?)?.toDouble(),
        max: (json['max'] as num?)?.toDouble(),
      );

  Map<String, dynamic> toJson() => {
    'metric': metric,
    'labelKey': labelKey,
    'unit': unit,
    'target': target,
    'buckets': buckets.map((e) => e.toJson()).toList(),
    'min': min,
    'max': max,
  };
}

/// The overview's per-bucket time axis (macros + displayed micronutrients).
class NutritionDaySeries {
  final String unit; // 'day' | 'week'
  final List<NutrientDaySeries> series;

  const NutritionDaySeries({required this.unit, required this.series});

  factory NutritionDaySeries.fromJson(Map<String, dynamic> json) =>
      NutritionDaySeries(
        unit: json['unit'] as String,
        series:
            (json['series'] as List<dynamic>)
                .map(
                  (e) => NutrientDaySeries.fromJson(e as Map<String, dynamic>),
                )
                .toList(),
      );

  Map<String, dynamic> toJson() => {
    'unit': unit,
    'series': series.map((e) => e.toJson()).toList(),
  };
}
