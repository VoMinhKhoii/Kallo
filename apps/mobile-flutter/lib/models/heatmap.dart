/// Heatmap models for the dashboard's consistency card — the day grid, its
/// per-day cells and the month strip above it.
///
/// Split out of `dashboard.dart`, which had grown past its budget; these are
/// the one cohesive group in that file with no ties to the rest of it.
library;

import 'package:intl/intl.dart';

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
  /// The server's English short name. Kept as the fallback only — [monthIndex]
  /// is what the app renders, because this string is built with a hardcoded
  /// `en-US` locale and showed "May / Jun / Jul" to Vietnamese users.
  final String month;

  /// 1-12, or null on a server that predates the field.
  final int? monthIndex;
  final int startColumn;
  final int span;

  const HeatmapMonthHeader({
    required this.month,
    required this.startColumn,
    required this.span,
    this.monthIndex,
  });

  factory HeatmapMonthHeader.fromJson(Map<String, dynamic> json) =>
      HeatmapMonthHeader(
        month: json['month'] as String,
        monthIndex: (json['monthIndex'] as num?)?.toInt(),
        startColumn: json['startColumn'] as int,
        span: json['span'] as int,
      );

  /// The month name in [locale]; falls back to the server's English string.
  String label(String locale) {
    final index = monthIndex;
    if (index == null || index < 1 || index > 12) return month;
    return DateFormat.MMM(locale).format(DateTime(2024, index));
  }

  Map<String, dynamic> toJson() => {
        'month': month,
        if (monthIndex != null) 'monthIndex': monthIndex,
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
