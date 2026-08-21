/// Nutrition-related data models.
///
/// Ported from `lib/nutrition/types.ts`. This file owns the aggregate the
/// nutrition screen reads — [NutritionOverview] and the calorie averages that
/// only it uses. Its DTO clusters live in siblings and are re-exported here, so
/// the single `models/nutrition/nutrition.dart` import still reaches
/// everything.
library;

// Imported for this file's own use AND re-exported, so callers keep the one
// `models/nutrition/nutrition.dart` import.
import 'day_series.dart';
import 'macro_pattern.dart';
import 'nutrient.dart';
import 'nutrient_card.dart';
import 'nutrition_enums.dart';

export 'day_series.dart';
export 'macro_pattern.dart';
export 'nutrient.dart';
export 'nutrient_card.dart';
export 'nutrition_enums.dart';

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

  factory CalorieAverages.fromJson(Map<String, dynamic> json) =>
      CalorieAverages(
        all: CalorieScopeAverage.fromJson(json['all'] as Map<String, dynamic>),
        complete: CalorieScopeAverage.fromJson(
          json['complete'] as Map<String, dynamic>,
        ),
      );

  Map<String, dynamic> toJson() => {
    'all': all.toJson(),
    'complete': complete.toJson(),
  };

  /// The average for the given scope.
  CalorieScopeAverage forScope(NutritionDayScope scope) =>
      scope == NutritionDayScope.complete ? complete : all;
}

/// Decodes one of the overview's homogeneous DTO arrays. Every list field on
/// the wire has the same shape, so they share one reader rather than repeating
/// the cast-map-toList dance per field.
List<T> _parseList<T>(dynamic raw, T Function(Map<String, dynamic>) fromJson) =>
    (raw as List<dynamic>)
        .map((e) => fromJson(e as Map<String, dynamic>))
        .toList();

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

  /// True when the account is not entitled to micronutrients AND the server is
  /// enforcing that gate. The server has already emptied every premium section
  /// on this response, so the screen shows an upsell in their place; calories
  /// and macros stay visible either way.
  final bool micronutrientsLocked;

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
    this.micronutrientsLocked = false,
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
        json['summary'] as Map<String, dynamic>,
      ),
      calorieAverages: CalorieAverages.fromJson(
        json['calorieAverages'] as Map<String, dynamic>,
      ),
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
      macros: _parseList(json['macros'], MacroPattern.fromJson),
      micronutrients: _parseList(
        json['micronutrients'],
        NutrientCardData.fromJson,
      ),
      spotlight: _parseList(json['spotlight'], NutrientCardData.fromJson),
      steady: _parseList(json['steady'], NutrientCardData.fromJson),
      moreNutrients: _parseList(
        json['moreNutrients'],
        NutrientCardData.fromJson,
      ),
      educationCards: _parseList(
        json['educationCards'],
        EducationCardData.fromJson,
      ),
      daySeries: NutritionDaySeries.fromJson(
        json['daySeries'] as Map<String, dynamic>,
      ),
      // Absent on a server that predates the gate: false, so an old payload
      // renders exactly as it always did.
      micronutrientsLocked: json['micronutrientsLocked'] == true,
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
    'period': {'startDate': period.startDate, 'endDate': period.endDate},
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
    'micronutrientsLocked': micronutrientsLocked,
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
    bool? micronutrientsLocked,
  }) => NutritionOverview(
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
    micronutrientsLocked: micronutrientsLocked ?? this.micronutrientsLocked,
  );
}
