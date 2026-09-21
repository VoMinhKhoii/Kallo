/// The weight chart's two series and the touch behaviour that reads them.
///
/// Split out of `weight_chart_canvas.dart` (2026-09-20): the canvas is about
/// where the plot sits — aspect, gutter, overlaid bounds — and this is what is
/// drawn inside it. They changed for different reasons and the file had
/// outgrown its budget.
///
/// The look follows the web chart: straight 3px segments with round caps and
/// joins, a dashed tail for the projection, and a dot at every reading ringed
/// in the card it sits on.
library;

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import 'weight_chart_dot_painter.dart';

class WeightSeries {
  const WeightSeries({required this.bars, required this.touch});

  final List<LineChartBarData> bars;
  final LineTouchData touch;
}

/// [forecast] is the two-point dotted tail, or null when there is nothing to
/// project. With no [spots] there is nothing to draw or touch.
WeightSeries buildWeightSeries({
  required List<FlSpot> spots,
  required List<FlSpot>? forecast,
  required String kg,
}) {
  if (spots.isEmpty) {
    return const WeightSeries(bars: [], touch: LineTouchData(enabled: false));
  }
  final lastIndex = spots.length - 1;

  final forecastBar =
      forecast == null
          ? null
          : LineChartBarData(
            spots: forecast,
            isCurved: false,
            color: KalloColors.accent.withValues(alpha: 0.6),
            barWidth: 2,
            dashArray: const [4, 4],
            isStrokeCapRound: true,
            dotData: const FlDotData(show: false),
          );

  final bars = <LineChartBarData>[
    // Forecast first, so the solid line draws on top of it.
    if (forecastBar != null) forecastBar,
    LineChartBarData(
      spots: spots,
      isCurved: false,
      color: KalloColors.accent,
      barWidth: 3,
      isStrokeCapRound: true,
      isStrokeJoinRound: true,
      dotData: FlDotData(
        show: true,
        getDotPainter:
            (spot, pct, bar, idx) =>
                idx == lastIndex
                    ? const TodayDotPainter(color: KalloColors.accent)
                    : FlDotCirclePainter(
                      radius: 4,
                      color: KalloColors.accent,
                      strokeColor: kCardSurface,
                      strokeWidth: 2,
                    ),
      ),
    ),
  ];

  return WeightSeries(
    bars: bars,
    touch: LineTouchData(
      handleBuiltInTouches: true,
      getTouchedSpotIndicator:
          (barData, indexes) =>
              indexes
                  .map(
                    (i) => TouchedSpotIndicatorData(
                      const FlLine(color: Colors.transparent),
                      FlDotData(
                        getDotPainter:
                            (spot, pct, bar, idx) => FlDotCirclePainter(
                              radius: 6,
                              color: KalloColors.accent,
                              strokeWidth: 2,
                              strokeColor: kCardSurface,
                            ),
                      ),
                    ),
                  )
                  .toList(),
      touchTooltipData: LineTouchTooltipData(
        getTooltipColor: (_) => kCardSurface,
        tooltipBorder: const BorderSide(color: kHairline),
        tooltipRoundedRadius: KalloRadii.md,
        getTooltipItems:
            (touchedSpots) =>
                touchedSpots.map((s) {
                  // The projection is not a reading, so it gets no tooltip. Compared
                  // by identity: a bar index means different things depending on
                  // whether the forecast is present, and `dashArray` is a style any
                  // future bar could share.
                  if (forecastBar != null && identical(s.bar, forecastBar)) {
                    return null;
                  }
                  return LineTooltipItem(
                    '${s.y.toStringAsFixed(1)} $kg',
                    dashMeta(color: kInk, tabular: true),
                  );
                }).toList(),
      ),
    ),
  );
}
