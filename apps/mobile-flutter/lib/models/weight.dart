/// Weight-related data models.
///
/// Ported from `lib/types/weight.ts`.
library;

enum WeightGoalDirection { up, down, flat }

class WeightSummaryData {
  final String range; // '30d' | '90d'
  final List<double> weights;
  final double currentWeight;
  final double? todayWeight;
  final double weightPlaceholder;
  final int daysLogged;
  final double periodStartWeight;
  final double expectedEndWeight;
  final WeightGoalDirection goalDirection;
  final int? periodElapsedDays;

  /// Forecast, computed server-side (see `buildWeightTrendSummary`) so the chart
  /// renders the projection from the same numbers as web instead of re-deriving.
  final double projectedEndWeight;
  final bool canProject;

  const WeightSummaryData({
    required this.range,
    required this.weights,
    required this.currentWeight,
    required this.todayWeight,
    required this.weightPlaceholder,
    required this.daysLogged,
    required this.periodStartWeight,
    required this.expectedEndWeight,
    required this.goalDirection,
    required this.periodElapsedDays,
    required this.projectedEndWeight,
    required this.canProject,
  });

  factory WeightSummaryData.fromJson(Map<String, dynamic> json) =>
      WeightSummaryData(
        range: json['range'] as String,
        weights: (json['weights'] as List<dynamic>)
            .map((e) => (e as num).toDouble())
            .toList(),
        currentWeight: (json['currentWeight'] as num).toDouble(),
        todayWeight: (json['todayWeight'] as num?)?.toDouble(),
        weightPlaceholder: (json['weightPlaceholder'] as num).toDouble(),
        daysLogged: json['daysLogged'] as int,
        periodStartWeight: (json['periodStartWeight'] as num).toDouble(),
        expectedEndWeight: (json['expectedEndWeight'] as num).toDouble(),
        goalDirection: WeightGoalDirection.values
            .byName(json['goalDirection'] as String),
        periodElapsedDays: json['periodElapsedDays'] as int?,
        projectedEndWeight: (json['projectedEndWeight'] as num).toDouble(),
        canProject: json['canProject'] as bool,
      );

  Map<String, dynamic> toJson() => {
        'range': range,
        'weights': weights,
        'currentWeight': currentWeight,
        'todayWeight': todayWeight,
        'weightPlaceholder': weightPlaceholder,
        'daysLogged': daysLogged,
        'periodStartWeight': periodStartWeight,
        'expectedEndWeight': expectedEndWeight,
        'goalDirection': goalDirection.name,
        'periodElapsedDays': periodElapsedDays,
        'projectedEndWeight': projectedEndWeight,
        'canProject': canProject,
      };

  WeightSummaryData copyWith({
    String? range,
    List<double>? weights,
    double? currentWeight,
    double? Function()? todayWeight,
    double? weightPlaceholder,
    int? daysLogged,
    double? periodStartWeight,
    double? expectedEndWeight,
    WeightGoalDirection? goalDirection,
    int? Function()? periodElapsedDays,
    double? projectedEndWeight,
    bool? canProject,
  }) =>
      WeightSummaryData(
        range: range ?? this.range,
        weights: weights ?? this.weights,
        currentWeight: currentWeight ?? this.currentWeight,
        todayWeight:
            todayWeight != null ? todayWeight() : this.todayWeight,
        weightPlaceholder: weightPlaceholder ?? this.weightPlaceholder,
        daysLogged: daysLogged ?? this.daysLogged,
        periodStartWeight: periodStartWeight ?? this.periodStartWeight,
        expectedEndWeight: expectedEndWeight ?? this.expectedEndWeight,
        goalDirection: goalDirection ?? this.goalDirection,
        periodElapsedDays: periodElapsedDays != null
            ? periodElapsedDays()
            : this.periodElapsedDays,
        projectedEndWeight: projectedEndWeight ?? this.projectedEndWeight,
        canProject: canProject ?? this.canProject,
      );
}
