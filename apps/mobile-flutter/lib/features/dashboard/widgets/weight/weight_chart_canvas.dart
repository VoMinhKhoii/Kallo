/// WeightChartCanvas — the weight card's trend chart.
///
/// Native pass (2026-08-31): an unframed plot the inner width of the card
/// (334 on a 390pt phone), dashed hairline gridlines, the Y domain's two
/// bounds in a narrow LEFT gutter (2026-09-01, back from the right), date
/// ticks below ("2/8" … "Now"), a short dotted forecast tail, a faint "today"
/// marker, and a dot at every logged point with the most recent emphasized.
///
/// The forecast (`projectedEndWeight` / `canProject`) is computed once
/// server-side and passed in as data — the chart only positions and draws it.
/// Axis maths (Y domain + x tick labels) lives in `logic/weight_chart_axis.dart`.
library;

import 'dart:math' as math;

import 'package:easy_localization/easy_localization.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../../theme/calm_tokens.dart';
import '../../logic/weight_chart_axis.dart';
import 'weight_chart_titles.dart';
import 'weight_chart_dot_painter.dart';

/// Canvas width : height — 334 × ~139 on a 390pt phone, of which the date row
/// takes the measured date-row height and the plot keeps the artboard's ~120.
const double _chartAspect = 2.4;
const int _rangeDays = 30; // mobile resolves the weight window to 30 days

class WeightChartCanvas extends StatelessWidget {
  const WeightChartCanvas({
    super.key,
    required this.weights,
    required this.weightDates,
    required this.periodElapsedDays,
    required this.projectedEndWeight,
    required this.canProject,
  });

  final List<double> weights;

  /// `YYYY-MM-DD` strings parallel to [weights]; empty on an older server, in
  /// which case the x axis degrades to "Start"/"Now".
  final List<String> weightDates;
  final int? periodElapsedDays;
  final double projectedEndWeight;
  final bool canProject;

  @override
  Widget build(BuildContext context) {
    if (weights.isEmpty) {
      return Container(
        constraints: const BoxConstraints(minHeight: 120),
        alignment: Alignment.center,
        child: Text(
          tr('dashboard.noWeightData'),
          textAlign: TextAlign.center,
          style: dashMeta(color: kInkMuted),
        ),
      );
    }

    final kg = tr('dashboard.units.kg');
    final isSinglePoint = weights.length == 1;
    final lastIndex = weights.length - 1;
    final currentW = weights.last;
    // `canProject` already implies ≥3 logged points (computed server-side in
    // buildWeightTrendSummary), so it alone gates the forecast tail.
    final showForecast = canProject;

    // Forecast x-position. The proportional projection can run far past the data
    // when the period is early; cap it so the logged data always spans at least
    // ~80% of the width (a short dotted tail) instead of being squashed.
    final hasElapsed = periodElapsedDays != null && periodElapsedDays! > 0;
    final elapsed =
        hasElapsed ? periodElapsedDays! : (lastIndex > 0 ? lastIndex : 1);
    final naturalForecastDay =
        lastIndex + (lastIndex * (_rangeDays - elapsed)) / elapsed;
    final forecastDay = showForecast
        ? math.min(naturalForecastDay, lastIndex / 0.8)
        : lastIndex.toDouble();

    final axis =
        niceYAxis([...weights, if (showForecast) projectedEndWeight]);
    final yStep = axis.step;
    // One point: centre it. The lone spot sits at x = 0, so a 0…1 domain
    // pinned it (and its tick label) against the plot's left edge with the
    // label's own width hanging outside; a symmetric −0.5…0.5 puts both in the
    // middle. The "today" VerticalLine at lastIndex (= 0) stays inside it.
    final minX = isSinglePoint ? -0.5 : 0.0;
    final maxX = isSinglePoint ? 0.5 : forecastDay;

    final actualSpots = <FlSpot>[
      for (var i = 0; i < weights.length; i++) FlSpot(i.toDouble(), weights[i]),
    ];

    // Meta 12, not a bespoke 9 — the tick thinning below measures each label
    // and drops ticks until they fit, so the axis adapts instead of needing
    // its own size.
    final axisLabel = dashMeta(color: kInkMuted);
    // Dashed, at full hairline weight: the plot carries no frame any more, so
    // the gridlines are the only structure and a 50%-alpha solid rule read as
    // a smudge rather than a scale.
    const gridLine = FlLine(
      color: kHairline,
      strokeWidth: 1,
      dashArray: [3, 4],
    );

    final maxLabel = weightBoundLabel(axis.max, yStep);
    final minLabel = weightBoundLabel(axis.min, yStep);

    return AspectRatio(
      aspectRatio: _chartAspect,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final scaler = MediaQuery.textScalerOf(context);
          // Measured, not assumed — see [weightDateAxisHeight].
          final dateAxisHeight = weightDateAxisHeight(axisLabel, scaler);
          final gutter = weightYAxisGutter(maxLabel, minLabel, axisLabel, scaler);
          final plotWidth = math.max(constraints.maxWidth - gutter, 1.0);
          final xLabels = weightXTickLabels(
            pointCount: weights.length,
            dates: weightDates,
            locale: context.locale.toString(),
            plotWidth: plotWidth,
            style: axisLabel,
            textScaler: scaler,
          );
          final chart = LineChart(
            LineChartData(
              minX: minX,
              maxX: maxX,
              minY: axis.min,
              maxY: axis.max,
              clipData: const FlClipData.all(),
              backgroundColor: Colors.transparent,
              // Uniform gridline at every round-number Y step, spanning the
              // plot — which now starts just inside the axis gutter.
              gridData: FlGridData(
                show: true,
                drawVerticalLine: false,
                horizontalInterval: yStep,
                getDrawingHorizontalLine: (_) => gridLine,
              ),
              // No frame: the dashed gridlines carry the scale, and an axis box
              // around a card-width plot reads as a second card edge.
              borderData: FlBorderData(show: false),
              titlesData: weightChartTitles(
                labels: xLabels,
                style: axisLabel,
                dateAxisHeight: dateAxisHeight,
              ),
              // "Today" marker at the most recent logged weight.
              extraLinesData: ExtraLinesData(
                verticalLines: [
                  VerticalLine(
                    x: lastIndex.toDouble(),
                    color: KalloColors.accent.withValues(alpha: 0.35),
                    strokeWidth: 1,
                  ),
                ],
              ),
              lineTouchData: LineTouchData(
                handleBuiltInTouches: true,
                getTouchedSpotIndicator: (barData, indexes) => indexes
                    .map(
                      (i) => TouchedSpotIndicatorData(
                        const FlLine(color: Colors.transparent),
                        FlDotData(
                          getDotPainter: (spot, pct, bar, idx) =>
                              FlDotCirclePainter(
                            radius: 4,
                            color: KalloColors.accent,
                            strokeWidth: 2,
                            strokeColor: Colors.white,
                          ),
                        ),
                      ),
                    )
                    .toList(),
                touchTooltipData: LineTouchTooltipData(
                  getTooltipColor: (_) => kCardSurface,
                  tooltipBorder: const BorderSide(color: kHairline),
                  tooltipRoundedRadius: KalloRadii.md,
                  getTooltipItems: (touchedSpots) => touchedSpots.map((s) {
                    // Skip the dotted forecast bar (drawn first when present).
                    if (showForecast && s.barIndex == 0) return null;
                    return LineTooltipItem(
                      '${s.y.toStringAsFixed(1)} $kg',
                      dashMeta(color: kInk, tabular: true),
                    );
                  }).toList(),
                ),
              ),
              lineBarsData: [
                // Forecast (dotted) — drawn first so the solid line sits on top.
                if (showForecast)
                  LineChartBarData(
                    spots: [
                      FlSpot(lastIndex.toDouble(), currentW),
                      FlSpot(forecastDay, projectedEndWeight),
                    ],
                    isCurved: false,
                    color: KalloColors.accent.withValues(alpha: 0.6),
                    barWidth: 2,
                    dashArray: const [3, 3],
                    dotData: const FlDotData(show: false),
                  ),
                // Actual — straight segments, a dot at every point, today emphasized.
                LineChartBarData(
                  spots: actualSpots,
                  isCurved: false,
                  color: KalloColors.accent,
                  barWidth: 2,
                  isStrokeCapRound: false,
                  isStrokeJoinRound: false,
                  dotData: FlDotData(
                    show: true,
                    getDotPainter: (spot, pct, bar, idx) => idx == lastIndex
                        ? const TodayDotPainter(color: KalloColors.accent)
                        : FlDotCirclePainter(
                            radius: 3,
                            color: KalloColors.accent,
                            strokeColor: Colors.white,
                            strokeWidth: 1.5,
                          ),
                  ),
                ),
              ],
            ),
            duration: const Duration(milliseconds: 1500),
            curve: Curves.easeInOut,
          );

          // The bounds sit in the gutter, level with the plot's top and
          // bottom; plot, gridlines and date row share one left edge.
          return Stack(
            children: [
              Positioned.fill(left: gutter, child: chart),
              Positioned(top: 0, left: 0, child: Text(maxLabel, style: axisLabel)),
              Positioned(
                bottom: dateAxisHeight,
                left: 0,
                child: Text(minLabel, style: axisLabel),
              ),
            ],
          );
        },
      ),
    );
  }
}
