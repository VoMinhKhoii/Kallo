/// Nutrition-related data models.
///
/// Ported from `lib/nutrition/types.ts`. The enums and their wire-value
/// extensions live in `nutrition_enums.dart` and are re-exported here, so the
/// single `models/nutrition.dart` import still reaches everything.
library;

// Imported for this file's own use AND re-exported, so callers keep the one
// `models/nutrition.dart` import.
import 'nutrition_enums.dart';

export 'nutrition_enums.dart';


class NutrientMeta {
  final NutritionNutrientKey key;
  final String dbColumn;
  final String labelKey;
  final String unit;
  final NutrientGroup group;

  const NutrientMeta({
    required this.key,
    required this.dbColumn,
    required this.labelKey,
    required this.unit,
    required this.group,
  });

  factory NutrientMeta.fromJson(Map<String, dynamic> json) => NutrientMeta(
        key: NutritionNutrientKey.values.byName(json['key'] as String),
        dbColumn: json['dbColumn'] as String,
        labelKey: json['labelKey'] as String,
        unit: json['unit'] as String,
        group: NutrientGroup.values.byName(json['group'] as String),
      );

  Map<String, dynamic> toJson() => {
        'key': key.name,
        'dbColumn': dbColumn,
        'labelKey': labelKey,
        'unit': unit,
        'group': group.name,
      };
}

class NutrientSummaryItem {
  final NutritionNutrientKey nutrient;
  final String labelKey;
  final double average;
  final String unit;
  final double? percentOfTarget;
  final double confidence;
  final NutritionStatus status;
  final String? applicability;
  final NutrientType nutrientType;

  const NutrientSummaryItem({
    required this.nutrient,
    required this.labelKey,
    required this.average,
    required this.unit,
    required this.percentOfTarget,
    required this.confidence,
    required this.status,
    this.applicability,
    required this.nutrientType,
  });

  factory NutrientSummaryItem.fromJson(Map<String, dynamic> json) =>
      NutrientSummaryItem(
        nutrient:
            NutritionNutrientKey.values.byName(json['nutrient'] as String),
        labelKey: json['labelKey'] as String,
        average: (json['average'] as num).toDouble(),
        unit: json['unit'] as String,
        percentOfTarget: (json['percentOfTarget'] as num?)?.toDouble(),
        confidence: (json['confidence'] as num).toDouble(),
        status: nutritionStatusFromString(json['status'] as String),
        applicability: json['applicability'] as String?,
        nutrientType:
            NutrientType.values.byName(json['nutrientType'] as String),
      );

  Map<String, dynamic> toJson() => {
        'nutrient': nutrient.name,
        'labelKey': labelKey,
        'average': average,
        'unit': unit,
        'percentOfTarget': percentOfTarget,
        'confidence': confidence,
        'status': nutritionStatusToString(status),
        'applicability': applicability,
        'nutrientType': nutrientType.name,
      };

  NutrientSummaryItem copyWith({
    NutritionNutrientKey? nutrient,
    String? labelKey,
    double? average,
    String? unit,
    double? Function()? percentOfTarget,
    double? confidence,
    NutritionStatus? status,
    String? Function()? applicability,
    NutrientType? nutrientType,
  }) =>
      NutrientSummaryItem(
        nutrient: nutrient ?? this.nutrient,
        labelKey: labelKey ?? this.labelKey,
        average: average ?? this.average,
        unit: unit ?? this.unit,
        percentOfTarget: percentOfTarget != null
            ? percentOfTarget()
            : this.percentOfTarget,
        confidence: confidence ?? this.confidence,
        status: status ?? this.status,
        applicability:
            applicability != null ? applicability() : this.applicability,
        nutrientType: nutrientType ?? this.nutrientType,
      );
}

class MacroConsistencySummary {
  final double averageConsistencyPct;
  final MacroKey? weakestMacro;

  const MacroConsistencySummary({
    required this.averageConsistencyPct,
    required this.weakestMacro,
  });

  factory MacroConsistencySummary.fromJson(Map<String, dynamic> json) =>
      MacroConsistencySummary(
        averageConsistencyPct:
            (json['averageConsistencyPct'] as num).toDouble(),
        weakestMacro: json['weakestMacro'] != null
            ? MacroKey.values.byName(json['weakestMacro'] as String)
            : null,
      );

  Map<String, dynamic> toJson() => {
        'averageConsistencyPct': averageConsistencyPct,
        'weakestMacro': weakestMacro?.name,
      };

  MacroConsistencySummary copyWith({
    double? averageConsistencyPct,
    MacroKey? Function()? weakestMacro,
  }) =>
      MacroConsistencySummary(
        averageConsistencyPct:
            averageConsistencyPct ?? this.averageConsistencyPct,
        weakestMacro:
            weakestMacro != null ? weakestMacro() : this.weakestMacro,
      );
}

class MacroPattern {
  final String key; // MacroKey name or 'fiber'
  final String labelKey;
  final double averagePerDay;
  final double? target;
  final String unit;
  final double? consistencyPct;
  final NutrientType nutrientType;

  const MacroPattern({
    required this.key,
    required this.labelKey,
    required this.averagePerDay,
    required this.target,
    required this.unit,
    required this.consistencyPct,
    required this.nutrientType,
  });

  factory MacroPattern.fromJson(Map<String, dynamic> json) => MacroPattern(
        key: json['key'] as String,
        labelKey: json['labelKey'] as String,
        averagePerDay: (json['averagePerDay'] as num).toDouble(),
        target: (json['target'] as num?)?.toDouble(),
        unit: json['unit'] as String,
        consistencyPct: (json['consistencyPct'] as num?)?.toDouble(),
        nutrientType:
            NutrientType.values.byName(json['nutrientType'] as String),
      );

  Map<String, dynamic> toJson() => {
        'key': key,
        'labelKey': labelKey,
        'averagePerDay': averagePerDay,
        'target': target,
        'unit': unit,
        'consistencyPct': consistencyPct,
        'nutrientType': nutrientType.name,
      };

  MacroPattern copyWith({
    String? key,
    String? labelKey,
    double? averagePerDay,
    double? Function()? target,
    String? unit,
    double? Function()? consistencyPct,
    NutrientType? nutrientType,
  }) =>
      MacroPattern(
        key: key ?? this.key,
        labelKey: labelKey ?? this.labelKey,
        averagePerDay: averagePerDay ?? this.averagePerDay,
        target: target != null ? target() : this.target,
        unit: unit ?? this.unit,
        consistencyPct:
            consistencyPct != null ? consistencyPct() : this.consistencyPct,
        nutrientType: nutrientType ?? this.nutrientType,
      );
}

class NutrientContextMetric {
  final NutritionNutrientKey key;
  final String labelKey;
  final double? averagePerDay;
  final String unit;

  const NutrientContextMetric({
    required this.key,
    required this.labelKey,
    required this.averagePerDay,
    required this.unit,
  });

  factory NutrientContextMetric.fromJson(Map<String, dynamic> json) =>
      NutrientContextMetric(
        key: NutritionNutrientKey.values.byName(json['key'] as String),
        labelKey: json['labelKey'] as String,
        averagePerDay: (json['averagePerDay'] as num?)?.toDouble(),
        unit: json['unit'] as String,
      );

  Map<String, dynamic> toJson() => {
        'key': key.name,
        'labelKey': labelKey,
        'averagePerDay': averagePerDay,
        'unit': unit,
      };
}

class SourceBreakdown {
  final double faoVietnamCalorieShare;
  final double? faoVietnamConfidence;
  final int? missingSodiumCondimentItems;

  const SourceBreakdown({
    required this.faoVietnamCalorieShare,
    required this.faoVietnamConfidence,
    this.missingSodiumCondimentItems,
  });

  factory SourceBreakdown.fromJson(Map<String, dynamic> json) =>
      SourceBreakdown(
        faoVietnamCalorieShare:
            (json['faoVietnamCalorieShare'] as num).toDouble(),
        faoVietnamConfidence:
            (json['faoVietnamConfidence'] as num?)?.toDouble(),
        missingSodiumCondimentItems:
            json['missingSodiumCondimentItems'] as int?,
      );

  Map<String, dynamic> toJson() => {
        'faoVietnamCalorieShare': faoVietnamCalorieShare,
        'faoVietnamConfidence': faoVietnamConfidence,
        'missingSodiumCondimentItems': missingSodiumCondimentItems,
      };
}

class NutrientCardData {
  final NutritionNutrientKey nutrient;
  final String labelKey;
  final NutrientGroup group;
  final double? averagePerDay;
  final double? target;
  final TargetSource targetSource;
  final String targetSourceLabelKey;
  final String unit;
  final double? percentOfTarget;
  final double confidence;
  final ConfidenceDisplayState displayState;
  final NutrientType nutrientType;
  final String? caveatKey;
  final List<NutrientContextMetric>? contextMetrics;
  final SourceBreakdown? sourceBreakdown;

  const NutrientCardData({
    required this.nutrient,
    required this.labelKey,
    required this.group,
    required this.averagePerDay,
    required this.target,
    required this.targetSource,
    required this.targetSourceLabelKey,
    required this.unit,
    required this.percentOfTarget,
    required this.confidence,
    required this.displayState,
    required this.nutrientType,
    this.caveatKey,
    this.contextMetrics,
    this.sourceBreakdown,
  });

  factory NutrientCardData.fromJson(Map<String, dynamic> json) =>
      NutrientCardData(
        nutrient:
            NutritionNutrientKey.values.byName(json['nutrient'] as String),
        labelKey: json['labelKey'] as String,
        group: NutrientGroup.values.byName(json['group'] as String),
        averagePerDay: (json['averagePerDay'] as num?)?.toDouble(),
        target: (json['target'] as num?)?.toDouble(),
        targetSource:
            targetSourceFromString(json['targetSource'] as String),
        targetSourceLabelKey: json['targetSourceLabelKey'] as String,
        unit: json['unit'] as String,
        percentOfTarget: (json['percentOfTarget'] as num?)?.toDouble(),
        confidence: (json['confidence'] as num).toDouble(),
        displayState: confidenceDisplayStateFromString(
            json['displayState'] as String),
        nutrientType:
            NutrientType.values.byName(json['nutrientType'] as String),
        caveatKey: json['caveatKey'] as String?,
        contextMetrics: (json['contextMetrics'] as List<dynamic>?)
            ?.map((e) =>
                NutrientContextMetric.fromJson(e as Map<String, dynamic>))
            .toList(),
        sourceBreakdown: json['sourceBreakdown'] != null
            ? SourceBreakdown.fromJson(
                json['sourceBreakdown'] as Map<String, dynamic>)
            : null,
      );

  Map<String, dynamic> toJson() => {
        'nutrient': nutrient.name,
        'labelKey': labelKey,
        'group': group.name,
        'averagePerDay': averagePerDay,
        'target': target,
        'targetSource': targetSourceToString(targetSource),
        'targetSourceLabelKey': targetSourceLabelKey,
        'unit': unit,
        'percentOfTarget': percentOfTarget,
        'confidence': confidence,
        'displayState': confidenceDisplayStateToString(displayState),
        'nutrientType': nutrientType.name,
        'caveatKey': caveatKey,
        'contextMetrics': contextMetrics?.map((e) => e.toJson()).toList(),
        'sourceBreakdown': sourceBreakdown?.toJson(),
      };

  NutrientCardData copyWith({
    NutritionNutrientKey? nutrient,
    String? labelKey,
    NutrientGroup? group,
    double? Function()? averagePerDay,
    double? Function()? target,
    TargetSource? targetSource,
    String? targetSourceLabelKey,
    String? unit,
    double? Function()? percentOfTarget,
    double? confidence,
    ConfidenceDisplayState? displayState,
    NutrientType? nutrientType,
    String? Function()? caveatKey,
    List<NutrientContextMetric>? Function()? contextMetrics,
    SourceBreakdown? Function()? sourceBreakdown,
  }) =>
      NutrientCardData(
        nutrient: nutrient ?? this.nutrient,
        labelKey: labelKey ?? this.labelKey,
        group: group ?? this.group,
        averagePerDay:
            averagePerDay != null ? averagePerDay() : this.averagePerDay,
        target: target != null ? target() : this.target,
        targetSource: targetSource ?? this.targetSource,
        targetSourceLabelKey:
            targetSourceLabelKey ?? this.targetSourceLabelKey,
        unit: unit ?? this.unit,
        percentOfTarget: percentOfTarget != null
            ? percentOfTarget()
            : this.percentOfTarget,
        confidence: confidence ?? this.confidence,
        displayState: displayState ?? this.displayState,
        nutrientType: nutrientType ?? this.nutrientType,
        caveatKey: caveatKey != null ? caveatKey() : this.caveatKey,
        contextMetrics:
            contextMetrics != null ? contextMetrics() : this.contextMetrics,
        sourceBreakdown: sourceBreakdown != null
            ? sourceBreakdown()
            : this.sourceBreakdown,
      );
}

class EducationCardData {
  final String id;
  final String titleKey;
  final String bodyKey;

  const EducationCardData({
    required this.id,
    required this.titleKey,
    required this.bodyKey,
  });

  factory EducationCardData.fromJson(Map<String, dynamic> json) =>
      EducationCardData(
        id: json['id'] as String,
        titleKey: json['titleKey'] as String,
        bodyKey: json['bodyKey'] as String,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'titleKey': titleKey,
        'bodyKey': bodyKey,
      };
}

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

  factory DaySeriesBucket.fromJson(Map<String, dynamic> json) => DaySeriesBucket(
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
  final String metric; // DaySeriesMetricKey: calories/protein/carbohydrate/fat/<nutrient>
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
        buckets: (json['buckets'] as List<dynamic>)
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

/// The overview's per-bucket time axis (macros + default micronutrients).
class NutritionDaySeries {
  final String unit; // 'day' | 'week'
  final List<NutrientDaySeries> series;

  const NutritionDaySeries({required this.unit, required this.series});

  factory NutritionDaySeries.fromJson(Map<String, dynamic> json) =>
      NutritionDaySeries(
        unit: json['unit'] as String,
        series: (json['series'] as List<dynamic>)
            .map((e) => NutrientDaySeries.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  Map<String, dynamic> toJson() => {
        'unit': unit,
        'series': series.map((e) => e.toJson()).toList(),
      };
}

class NutritionSummary {
  final List<NutrientSummaryItem> mostConsistent;
  final List<NutrientSummaryItem> needsAttention;
  final int limitedDataCount;
  final MacroConsistencySummary macroConsistency;

  const NutritionSummary({
    required this.mostConsistent,
    required this.needsAttention,
    required this.limitedDataCount,
    required this.macroConsistency,
  });

  factory NutritionSummary.fromJson(Map<String, dynamic> json) =>
      NutritionSummary(
        mostConsistent: (json['mostConsistent'] as List<dynamic>)
            .map((e) =>
                NutrientSummaryItem.fromJson(e as Map<String, dynamic>))
            .toList(),
        needsAttention: (json['needsAttention'] as List<dynamic>)
            .map((e) =>
                NutrientSummaryItem.fromJson(e as Map<String, dynamic>))
            .toList(),
        limitedDataCount: json['limitedDataCount'] as int,
        macroConsistency: MacroConsistencySummary.fromJson(
            json['macroConsistency'] as Map<String, dynamic>),
      );

  Map<String, dynamic> toJson() => {
        'mostConsistent': mostConsistent.map((e) => e.toJson()).toList(),
        'needsAttention': needsAttention.map((e) => e.toJson()).toList(),
        'limitedDataCount': limitedDataCount,
        'macroConsistency': macroConsistency.toJson(),
      };
}

/// One day-scope's calorie average and the day-count backing it.
class CalorieScopeAverage {
  final double? averagePerDay;
  final int days;

  const CalorieScopeAverage({required this.averagePerDay, required this.days});

  factory CalorieScopeAverage.fromJson(Map<String, dynamic> json) =>
      CalorieScopeAverage(
        averagePerDay: (json['averagePerDay'] as num?)?.toDouble(),
        days: json['days'] as int,
      );

  Map<String, dynamic> toJson() => {
        'averagePerDay': averagePerDay,
        'days': days,
      };
}

/// Both scopes' calorie averages, shipped together so the client can show one
/// as the hero figure and the other as a subtle secondary and swap them.
class CalorieAverages {
  final CalorieScopeAverage all;
  final CalorieScopeAverage complete;

  const CalorieAverages({required this.all, required this.complete});

  factory CalorieAverages.fromJson(Map<String, dynamic> json) => CalorieAverages(
        all: CalorieScopeAverage.fromJson(json['all'] as Map<String, dynamic>),
        complete: CalorieScopeAverage.fromJson(
            json['complete'] as Map<String, dynamic>),
      );

  Map<String, dynamic> toJson() => {
        'all': all.toJson(),
        'complete': complete.toJson(),
      };

  /// The average for the given scope.
  CalorieScopeAverage forScope(NutritionDayScope scope) =>
      scope == NutritionDayScope.complete ? complete : all;
}

class NutritionOverview {
  final String requestedRange;
  final String resolvedRange;
  final String bucketTimezone;
  final int loggedDays;
  final int completeDays;
  final int partialDays;
  final int loggedDaysLast30;
  final String trendStatus;
  final ({String startDate, String endDate}) period;
  final NutritionSummary summary;
  final CalorieAverages calorieAverages;

  /// The same two averages for the equal-length window immediately before this
  /// one — 7d against the previous seven days, 30d the previous thirty. Both
  /// scopes read null when nothing was logged back then.
  final CalorieAverages previousCalorieAverages;
  final List<MacroPattern> macros;
  final List<NutrientCardData> micronutrients;
  final List<NutrientCardData> spotlight;
  final List<NutrientCardData> steady;
  final List<NutrientCardData> moreNutrients;
  final List<EducationCardData> educationCards;
  final NutritionDaySeries daySeries;

  const NutritionOverview({
    required this.requestedRange,
    required this.resolvedRange,
    required this.bucketTimezone,
    required this.loggedDays,
    required this.completeDays,
    required this.partialDays,
    required this.loggedDaysLast30,
    required this.trendStatus,
    required this.period,
    required this.summary,
    required this.calorieAverages,
    required this.previousCalorieAverages,
    required this.macros,
    required this.micronutrients,
    required this.spotlight,
    required this.steady,
    required this.moreNutrients,
    required this.educationCards,
    required this.daySeries,
  });

  factory NutritionOverview.fromJson(Map<String, dynamic> json) {
    final p = json['period'] as Map<String, dynamic>;
    return NutritionOverview(
      requestedRange: json['requestedRange'] as String,
      resolvedRange: json['resolvedRange'] as String,
      bucketTimezone: json['bucketTimezone'] as String,
      loggedDays: json['loggedDays'] as int,
      completeDays: json['completeDays'] as int,
      partialDays: json['partialDays'] as int,
      loggedDaysLast30: json['loggedDaysLast30'] as int,
      trendStatus: json['trendStatus'] as String,
      period: (
        startDate: p['startDate'] as String,
        endDate: p['endDate'] as String,
      ),
      summary: NutritionSummary.fromJson(
          json['summary'] as Map<String, dynamic>),
      calorieAverages: CalorieAverages.fromJson(
          json['calorieAverages'] as Map<String, dynamic>),
      // Optional on the wire: a server that predates the comparison figure
      // omits it, and a hard cast there would fail the whole overview rather
      // than dropping one delta.
      previousCalorieAverages: switch (json['previousCalorieAverages']) {
        final Map<String, dynamic> j => CalorieAverages.fromJson(j),
        _ => const CalorieAverages(
            all: CalorieScopeAverage(averagePerDay: null, days: 0),
            complete: CalorieScopeAverage(averagePerDay: null, days: 0),
          ),
      },
      macros: (json['macros'] as List<dynamic>)
          .map((e) => MacroPattern.fromJson(e as Map<String, dynamic>))
          .toList(),
      micronutrients: (json['micronutrients'] as List<dynamic>)
          .map((e) => NutrientCardData.fromJson(e as Map<String, dynamic>))
          .toList(),
      spotlight: (json['spotlight'] as List<dynamic>)
          .map((e) => NutrientCardData.fromJson(e as Map<String, dynamic>))
          .toList(),
      steady: (json['steady'] as List<dynamic>)
          .map((e) => NutrientCardData.fromJson(e as Map<String, dynamic>))
          .toList(),
      moreNutrients: (json['moreNutrients'] as List<dynamic>)
          .map((e) => NutrientCardData.fromJson(e as Map<String, dynamic>))
          .toList(),
      educationCards: (json['educationCards'] as List<dynamic>)
          .map(
              (e) => EducationCardData.fromJson(e as Map<String, dynamic>))
          .toList(),
      daySeries: NutritionDaySeries.fromJson(
          json['daySeries'] as Map<String, dynamic>),
    );
  }

  Map<String, dynamic> toJson() => {
        'requestedRange': requestedRange,
        'resolvedRange': resolvedRange,
        'bucketTimezone': bucketTimezone,
        'loggedDays': loggedDays,
        'completeDays': completeDays,
        'partialDays': partialDays,
        'loggedDaysLast30': loggedDaysLast30,
        'trendStatus': trendStatus,
        'period': {
          'startDate': period.startDate,
          'endDate': period.endDate,
        },
        'summary': summary.toJson(),
        'calorieAverages': calorieAverages.toJson(),
        'previousCalorieAverages': previousCalorieAverages.toJson(),
        'macros': macros.map((e) => e.toJson()).toList(),
        'micronutrients': micronutrients.map((e) => e.toJson()).toList(),
        'spotlight': spotlight.map((e) => e.toJson()).toList(),
        'steady': steady.map((e) => e.toJson()).toList(),
        'moreNutrients': moreNutrients.map((e) => e.toJson()).toList(),
        'educationCards': educationCards.map((e) => e.toJson()).toList(),
        'daySeries': daySeries.toJson(),
      };

  NutritionOverview copyWith({
    String? requestedRange,
    String? resolvedRange,
    String? bucketTimezone,
    int? loggedDays,
    int? completeDays,
    int? partialDays,
    int? loggedDaysLast30,
    String? trendStatus,
    ({String startDate, String endDate})? period,
    NutritionSummary? summary,
    CalorieAverages? calorieAverages,
    CalorieAverages? previousCalorieAverages,
    List<MacroPattern>? macros,
    List<NutrientCardData>? micronutrients,
    List<NutrientCardData>? spotlight,
    List<NutrientCardData>? steady,
    List<NutrientCardData>? moreNutrients,
    List<EducationCardData>? educationCards,
    NutritionDaySeries? daySeries,
  }) =>
      NutritionOverview(
        requestedRange: requestedRange ?? this.requestedRange,
        resolvedRange: resolvedRange ?? this.resolvedRange,
        bucketTimezone: bucketTimezone ?? this.bucketTimezone,
        loggedDays: loggedDays ?? this.loggedDays,
        completeDays: completeDays ?? this.completeDays,
        partialDays: partialDays ?? this.partialDays,
        loggedDaysLast30: loggedDaysLast30 ?? this.loggedDaysLast30,
        trendStatus: trendStatus ?? this.trendStatus,
        period: period ?? this.period,
        summary: summary ?? this.summary,
        calorieAverages: calorieAverages ?? this.calorieAverages,
        previousCalorieAverages:
            previousCalorieAverages ?? this.previousCalorieAverages,
        macros: macros ?? this.macros,
        micronutrients: micronutrients ?? this.micronutrients,
        spotlight: spotlight ?? this.spotlight,
        steady: steady ?? this.steady,
        moreNutrients: moreNutrients ?? this.moreNutrients,
        educationCards: educationCards ?? this.educationCards,
        daySeries: daySeries ?? this.daySeries,
      );
}
