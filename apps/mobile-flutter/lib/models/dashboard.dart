/// Dashboard-related data models.
///
/// Ported from `lib/types/dashboard.ts`.
library;

import 'weight.dart';

enum WeightRange { d30, d90 }

extension WeightRangeValue on WeightRange {
  String get value => switch (this) {
        WeightRange.d30 => '30d',
        WeightRange.d90 => '90d',
      };
}

enum HeatmapRange { d30, d90, year }

extension HeatmapRangeValue on HeatmapRange {
  String get value => switch (this) {
        HeatmapRange.d30 => '30d',
        HeatmapRange.d90 => '90d',
        HeatmapRange.year => 'year',
      };
}

enum HeatmapCellStatus { logged, partial, unlogged, future, outside }

class HeatmapCell {
  final String date;

  /// Adherence ratio (gated — null for partial days) used by the consistency
  /// grid's colour grading.
  final double? ratio;

  /// Raw calories ÷ target, ungated — drives the dashboard's per-day calorie
  /// ring. Null only when the day has no logged calories (or no target).
  final double? consumedRatio;
  final HeatmapCellStatus status;

  /// Day had a cheat meal — rendered neutrally (neither hit nor miss) and
  /// excluded from the adherence rate, matching the web heatmap.
  final bool hasCheatMeal;

  const HeatmapCell({
    required this.date,
    required this.ratio,
    required this.consumedRatio,
    required this.status,
    this.hasCheatMeal = false,
  });

  factory HeatmapCell.fromJson(Map<String, dynamic> json) => HeatmapCell(
        date: json['date'] as String,
        ratio: (json['ratio'] as num?)?.toDouble(),
        consumedRatio: (json['consumedRatio'] as num?)?.toDouble(),
        status: HeatmapCellStatus.values.byName(json['status'] as String),
        hasCheatMeal: json['hasCheatMeal'] as bool? ?? false,
      );

  Map<String, dynamic> toJson() => {
        'date': date,
        'ratio': ratio,
        'consumedRatio': consumedRatio,
        'status': status.name,
        'hasCheatMeal': hasCheatMeal,
      };

  HeatmapCell copyWith({
    String? date,
    double? Function()? ratio,
    double? Function()? consumedRatio,
    HeatmapCellStatus? status,
    bool? hasCheatMeal,
  }) =>
      HeatmapCell(
        date: date ?? this.date,
        ratio: ratio != null ? ratio() : this.ratio,
        consumedRatio:
            consumedRatio != null ? consumedRatio() : this.consumedRatio,
        status: status ?? this.status,
        hasCheatMeal: hasCheatMeal ?? this.hasCheatMeal,
      );
}

class HeatmapMonthHeader {
  final String month;
  final int startColumn;
  final int span;

  const HeatmapMonthHeader({
    required this.month,
    required this.startColumn,
    required this.span,
  });

  factory HeatmapMonthHeader.fromJson(Map<String, dynamic> json) =>
      HeatmapMonthHeader(
        month: json['month'] as String,
        startColumn: json['startColumn'] as int,
        span: json['span'] as int,
      );

  Map<String, dynamic> toJson() => {
        'month': month,
        'startColumn': startColumn,
        'span': span,
      };

  HeatmapMonthHeader copyWith({
    String? month,
    int? startColumn,
    int? span,
  }) =>
      HeatmapMonthHeader(
        month: month ?? this.month,
        startColumn: startColumn ?? this.startColumn,
        span: span ?? this.span,
      );
}

class HeatmapData {
  final List<List<HeatmapCell>> cells;
  final List<HeatmapMonthHeader> monthHeaders;

  const HeatmapData({
    required this.cells,
    required this.monthHeaders,
  });

  factory HeatmapData.fromJson(Map<String, dynamic> json) => HeatmapData(
        cells: (json['cells'] as List<dynamic>)
            .map((row) => (row as List<dynamic>)
                .map((e) => HeatmapCell.fromJson(e as Map<String, dynamic>))
                .toList())
            .toList(),
        monthHeaders: (json['monthHeaders'] as List<dynamic>)
            .map(
                (e) => HeatmapMonthHeader.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  Map<String, dynamic> toJson() => {
        'cells': cells
            .map((row) => row.map((e) => e.toJson()).toList())
            .toList(),
        'monthHeaders': monthHeaders.map((e) => e.toJson()).toList(),
      };

  HeatmapData copyWith({
    List<List<HeatmapCell>>? cells,
    List<HeatmapMonthHeader>? monthHeaders,
  }) =>
      HeatmapData(
        cells: cells ?? this.cells,
        monthHeaders: monthHeaders ?? this.monthHeaders,
      );
}

class MealEntry {
  final String id;
  final String label;
  final double calories;

  const MealEntry({
    required this.id,
    required this.label,
    required this.calories,
  });

  factory MealEntry.fromJson(Map<String, dynamic> json) => MealEntry(
        id: json['id'] as String,
        label: json['label'] as String,
        calories: (json['calories'] as num).toDouble(),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'label': label,
        'calories': calories,
      };

  MealEntry copyWith({
    String? id,
    String? label,
    double? calories,
  }) =>
      MealEntry(
        id: id ?? this.id,
        label: label ?? this.label,
        calories: calories ?? this.calories,
      );
}

enum PaceStatus { onPace, ahead, behind, tooEarly }

PaceStatus paceStatusFromString(String s) => switch (s) {
      'on_pace' => PaceStatus.onPace,
      'ahead' => PaceStatus.ahead,
      'behind' => PaceStatus.behind,
      'too_early' => PaceStatus.tooEarly,
      _ => throw ArgumentError('Unknown PaceStatus: $s'),
    };

String paceStatusToString(PaceStatus s) => switch (s) {
      PaceStatus.onPace => 'on_pace',
      PaceStatus.ahead => 'ahead',
      PaceStatus.behind => 'behind',
      PaceStatus.tooEarly => 'too_early',
    };

class VerdictData {
  final double weeklyRate;
  final double totalDelta;
  final String planStartDate;
  final PaceStatus status;
  final ({double start, double end}) rollingAvg;
  final double currentWeight;
  final List<bool> proteinDays;

  const VerdictData({
    required this.weeklyRate,
    required this.totalDelta,
    required this.planStartDate,
    required this.status,
    required this.rollingAvg,
    required this.currentWeight,
    required this.proteinDays,
  });

  factory VerdictData.fromJson(Map<String, dynamic> json) {
    final ra = json['rollingAvg'] as Map<String, dynamic>;
    final pd = json['proteinDays'] as List<dynamic>;
    return VerdictData(
      weeklyRate: (json['weeklyRate'] as num).toDouble(),
      totalDelta: (json['totalDelta'] as num).toDouble(),
      planStartDate: json['planStartDate'] as String,
      status: paceStatusFromString(json['status'] as String),
      rollingAvg: (
        start: (ra['start'] as num).toDouble(),
        end: (ra['end'] as num).toDouble(),
      ),
      currentWeight: (json['currentWeight'] as num).toDouble(),
      proteinDays: pd.map((e) => e as bool).toList(),
    );
  }

  Map<String, dynamic> toJson() => {
        'weeklyRate': weeklyRate,
        'totalDelta': totalDelta,
        'planStartDate': planStartDate,
        'status': paceStatusToString(status),
        'rollingAvg': {'start': rollingAvg.start, 'end': rollingAvg.end},
        'currentWeight': currentWeight,
        'proteinDays': proteinDays,
      };

  VerdictData copyWith({
    double? weeklyRate,
    double? totalDelta,
    String? planStartDate,
    PaceStatus? status,
    ({double start, double end})? rollingAvg,
    double? currentWeight,
    List<bool>? proteinDays,
  }) =>
      VerdictData(
        weeklyRate: weeklyRate ?? this.weeklyRate,
        totalDelta: totalDelta ?? this.totalDelta,
        planStartDate: planStartDate ?? this.planStartDate,
        status: status ?? this.status,
        rollingAvg: rollingAvg ?? this.rollingAvg,
        currentWeight: currentWeight ?? this.currentWeight,
        proteinDays: proteinDays ?? this.proteinDays,
      );
}

class NutritionData {
  final ({double current, double target}) calories;
  final ({double current, double target}) protein;
  final ({double current, double target}) carbs;
  final ({double current, double target}) fat;

  const NutritionData({
    required this.calories,
    required this.protein,
    required this.carbs,
    required this.fat,
  });

  factory NutritionData.fromJson(Map<String, dynamic> json) {
    ({double current, double target}) parse(Map<String, dynamic> m) => (
          current: (m['current'] as num).toDouble(),
          target: (m['target'] as num).toDouble(),
        );
    return NutritionData(
      calories: parse(json['calories'] as Map<String, dynamic>),
      protein: parse(json['protein'] as Map<String, dynamic>),
      carbs: parse(json['carbs'] as Map<String, dynamic>),
      fat: parse(json['fat'] as Map<String, dynamic>),
    );
  }

  Map<String, dynamic> toJson() => {
        'calories': {'current': calories.current, 'target': calories.target},
        'protein': {'current': protein.current, 'target': protein.target},
        'carbs': {'current': carbs.current, 'target': carbs.target},
        'fat': {'current': fat.current, 'target': fat.target},
      };

  NutritionData copyWith({
    ({double current, double target})? calories,
    ({double current, double target})? protein,
    ({double current, double target})? carbs,
    ({double current, double target})? fat,
  }) =>
      NutritionData(
        calories: calories ?? this.calories,
        protein: protein ?? this.protein,
        carbs: carbs ?? this.carbs,
        fat: fat ?? this.fat,
      );
}

class DashboardProfile {
  final double calorieTarget;
  final double proteinTargetG;
  final double carbsTargetG;
  final double fatTargetG;

  const DashboardProfile({
    required this.calorieTarget,
    required this.proteinTargetG,
    required this.carbsTargetG,
    required this.fatTargetG,
  });

  factory DashboardProfile.fromJson(Map<String, dynamic> json) =>
      DashboardProfile(
        // Null targets (incomplete onboarding) fall back to the same defaults
        // the RN dashboard uses (`profile?.calorieTarget ?? 2000`, etc.).
        calorieTarget: (json['calorieTarget'] as num?)?.toDouble() ?? 2000,
        proteinTargetG: (json['proteinTargetG'] as num?)?.toDouble() ?? 150,
        carbsTargetG: (json['carbsTargetG'] as num?)?.toDouble() ?? 250,
        fatTargetG: (json['fatTargetG'] as num?)?.toDouble() ?? 65,
      );

  Map<String, dynamic> toJson() => {
        'calorieTarget': calorieTarget,
        'proteinTargetG': proteinTargetG,
        'carbsTargetG': carbsTargetG,
        'fatTargetG': fatTargetG,
      };

  DashboardProfile copyWith({
    double? calorieTarget,
    double? proteinTargetG,
    double? carbsTargetG,
    double? fatTargetG,
  }) =>
      DashboardProfile(
        calorieTarget: calorieTarget ?? this.calorieTarget,
        proteinTargetG: proteinTargetG ?? this.proteinTargetG,
        carbsTargetG: carbsTargetG ?? this.carbsTargetG,
        fatTargetG: fatTargetG ?? this.fatTargetG,
      );
}

class DashboardSnapshot {
  final VerdictData verdict;
  final NutritionData nutrition;
  final List<MealEntry> meals;
  final HeatmapData heatmap;
  final WeightSummaryData weightSummary;

  const DashboardSnapshot({
    required this.verdict,
    required this.nutrition,
    required this.meals,
    required this.heatmap,
    required this.weightSummary,
  });

  factory DashboardSnapshot.fromJson(Map<String, dynamic> json) =>
      DashboardSnapshot(
        verdict:
            VerdictData.fromJson(json['verdict'] as Map<String, dynamic>),
        nutrition:
            NutritionData.fromJson(json['nutrition'] as Map<String, dynamic>),
        meals: (json['meals'] as List<dynamic>)
            .map((e) => MealEntry.fromJson(e as Map<String, dynamic>))
            .toList(),
        heatmap:
            HeatmapData.fromJson(json['heatmap'] as Map<String, dynamic>),
        weightSummary: WeightSummaryData.fromJson(
            json['weightSummary'] as Map<String, dynamic>),
      );

  Map<String, dynamic> toJson() => {
        'verdict': verdict.toJson(),
        'nutrition': nutrition.toJson(),
        'meals': meals.map((e) => e.toJson()).toList(),
        'heatmap': heatmap.toJson(),
        'weightSummary': weightSummary.toJson(),
      };

  DashboardSnapshot copyWith({
    VerdictData? verdict,
    NutritionData? nutrition,
    List<MealEntry>? meals,
    HeatmapData? heatmap,
    WeightSummaryData? weightSummary,
  }) =>
      DashboardSnapshot(
        verdict: verdict ?? this.verdict,
        nutrition: nutrition ?? this.nutrition,
        meals: meals ?? this.meals,
        heatmap: heatmap ?? this.heatmap,
        weightSummary: weightSummary ?? this.weightSummary,
      );
}

class Micronutrient {
  final String key;
  final String name;
  final String unit;
  final double current;
  final double target;
  final String group; // 'mineral' | 'vitamin' | 'other'

  const Micronutrient({
    required this.key,
    required this.name,
    required this.unit,
    required this.current,
    required this.target,
    required this.group,
  });

  factory Micronutrient.fromJson(Map<String, dynamic> json) => Micronutrient(
        key: json['key'] as String,
        name: json['name'] as String,
        unit: json['unit'] as String,
        current: (json['current'] as num).toDouble(),
        target: (json['target'] as num).toDouble(),
        group: json['group'] as String,
      );

  Map<String, dynamic> toJson() => {
        'key': key,
        'name': name,
        'unit': unit,
        'current': current,
        'target': target,
        'group': group,
      };

  Micronutrient copyWith({
    String? key,
    String? name,
    String? unit,
    double? current,
    double? target,
    String? group,
  }) =>
      Micronutrient(
        key: key ?? this.key,
        name: name ?? this.name,
        unit: unit ?? this.unit,
        current: current ?? this.current,
        target: target ?? this.target,
        group: group ?? this.group,
      );
}
