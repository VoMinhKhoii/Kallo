/// Vendored VERBATIM from the RN `lib/dashboard/logic/weight-trend.ts` — keep
/// in sync. Produces the weight-chart callout (status / delta / projection).
library;

import '../../../models/dashboard.dart';
import '../../../models/weight.dart';

/// Pace/trend status — drives the callout label, detail copy, and color.
/// String values match the `dashboard.progressStatus.*` i18n keys.
enum WeightTrendStatus {
  insufficient,
  onPace,
  ahead,
  behind,
  stable;

  /// i18n key segment (e.g. `on_pace`) under `dashboard.progressStatus`.
  String get key => switch (this) {
        WeightTrendStatus.insufficient => 'insufficient',
        WeightTrendStatus.onPace => 'on_pace',
        WeightTrendStatus.ahead => 'ahead',
        WeightTrendStatus.behind => 'behind',
        WeightTrendStatus.stable => 'stable',
      };
}

/// The computed trend summary nested in the progress card.
class WeightTrendSummary {
  const WeightTrendSummary({
    required this.status,
    required this.startWeight,
    required this.currentWeight,
    required this.expectedEndWeight,
    required this.projectedEndWeight,
    required this.actualWeeklyRate,
    required this.expectedWeeklyRate,
    required this.rangeDays,
    required this.canProject,
  });

  final WeightTrendStatus status;
  final double startWeight;
  final double currentWeight;
  final double expectedEndWeight;
  final double projectedEndWeight;
  final double actualWeeklyRate;
  final double expectedWeeklyRate;
  final int rangeDays;
  final bool canProject;
}

const Map<WeightRange, int> _rangeDays = {
  WeightRange.d30: 30,
  WeightRange.d90: 90,
};

bool _isMovingWithGoal(
  double actualWeeklyRate,
  double expectedWeeklyRate,
  double tolerance,
) =>
    (actualWeeklyRate - expectedWeeklyRate).abs() <= tolerance;

/// Builds the weight-chart callout summary. Mirrors web
/// `buildWeightTrendSummary` exactly.
WeightTrendSummary buildWeightTrendSummary({
  required List<double> weights,
  required double periodStartWeight,
  required double expectedEndWeight,
  required WeightGoalDirection goalDirection,
  required WeightRange range,
  int? elapsedDays,
}) {
  final rangeDays = _rangeDays[range]!;
  final startWeight = weights.isNotEmpty ? weights.first : periodStartWeight;
  final currentWeight = weights.isNotEmpty ? weights.last : startWeight;
  final expectedWeeklyRate =
      ((expectedEndWeight - periodStartWeight) / rangeDays) * 7;
  final hasElapsedDays = elapsedDays != null && elapsedDays > 0;
  final actualWeeklyRate = ((currentWeight - startWeight) /
          (hasElapsedDays ? elapsedDays : rangeDays)) *
      7;
  final canProject =
      weights.length >= 3 && hasElapsedDays && elapsedDays < rangeDays;
  final projectedEndWeight = canProject
      ? currentWeight + actualWeeklyRate * ((rangeDays - elapsedDays) / 7)
      : currentWeight;
  final tolerance = (expectedWeeklyRate.abs() * 0.2).clamp(0.1, double.infinity);

  final WeightTrendStatus status;
  if (weights.length < 2) {
    status = WeightTrendStatus.insufficient;
  } else if (goalDirection == WeightGoalDirection.flat) {
    status = actualWeeklyRate.abs() <= 0.1
        ? WeightTrendStatus.stable
        : WeightTrendStatus.behind;
  } else if (_isMovingWithGoal(actualWeeklyRate, expectedWeeklyRate, tolerance)) {
    status = WeightTrendStatus.onPace;
  } else if ((goalDirection == WeightGoalDirection.down &&
          actualWeeklyRate < expectedWeeklyRate) ||
      (goalDirection == WeightGoalDirection.up &&
          actualWeeklyRate > expectedWeeklyRate)) {
    status = WeightTrendStatus.ahead;
  } else {
    status = WeightTrendStatus.behind;
  }

  return WeightTrendSummary(
    status: status,
    startWeight: startWeight,
    currentWeight: currentWeight,
    expectedEndWeight: expectedEndWeight,
    projectedEndWeight: projectedEndWeight,
    actualWeeklyRate: actualWeeklyRate,
    expectedWeeklyRate: expectedWeeklyRate,
    rangeDays: rangeDays,
    canProject: canProject,
  );
}
