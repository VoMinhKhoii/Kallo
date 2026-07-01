/// WeightChartCanvas — the weight card's trend chart.
///
/// A clean, uniform line chart: round-number weight values in a left gutter with
/// a subtle gridline at each step, the plot filling from the gutter to the right
/// edge; week ticks (W1..Now), a short dotted forecast tail, a faint "today"
/// marker, and a dot at every logged point with the most recent emphasized.
///
/// The forecast (`projectedEndWeight` / `canProject`) is computed once
/// server-side and passed in as data — the chart only positions and draws it.
library;

import 'dart:math' as math;

import 'package:easy_localization/easy_localization.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import 'dashboard_tokens.dart';

const double _chartAspect = 1.95; // canvas width : height (framed chart)
const int _rangeDays = 30; // mobile resolves the weight window to 30 days

/// A tight, uniform, round-number Y axis fitted to [values]: pick a step that
/// yields a handful of evenly spaced gridlines, snap the bounds outward to whole
/// steps, and widen to at least ~two steps so a flat series still reads. Mirrors
/// the web chart's axis so both platforms bucket identically.
({double min, double max, double step}) _niceYAxis(List<double> values) {
  final rawMin = values.reduce(math.min);
  final rawMax = values.reduce(math.max);
  final span = math.max(rawMax - rawMin, 0.5);
  final step = span <= 2
      ? 0.5
      : span <= 5
          ? 1.0
          : span <= 12
              ? 2.0
              : 5.0;
  var min = (rawMin / step).floorToDouble() * step;
  var max = (rawMax / step).ceilToDouble() * step;
  if (max - min < step * 1.5) {
    min -= step;
    max += step;
  }
  return (min: min, max: max, step: step);
}

/// W1..W4 + Now tick labels over the 30-day window, keyed by point index.
/// Positional (a quarter of the logged points each), matching the web
/// `buildXTicks` — not calendar weeks.
Map<int, String> _xTickLabels(List<double> weights) {
  if (weights.length == 1) return {0: tr('dashboard.start')};
  final count = weights.length;
  final step = count ~/ 4;
  final ticks = <int>[];
  for (final t in [0, step, step * 2, step * 3, count - 1]) {
    if (!ticks.contains(t)) ticks.add(t);
  }
  return {
    for (var i = 0; i < ticks.length; i++)
      ticks[i]: i == ticks.length - 1
          ? tr('dashboard.now')
          : '${tr('dashboard.weekPrefix')}${i + 1}',
  };
}

class WeightChartCanvas extends StatelessWidget {
  const WeightChartCanvas({
    super.key,
    required this.weights,
    required this.periodElapsedDays,
    required this.projectedEndWeight,
    required this.canProject,
  });

  final List<double> weights;
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
          style: dashMeta(color: kInkDisabled),
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
        _niceYAxis([...weights, if (showForecast) projectedEndWeight]);
    final yStep = axis.step;
    final maxX = isSinglePoint ? 1.0 : forecastDay;

    final xLabels = _xTickLabels(weights);
    final actualSpots = <FlSpot>[
      for (var i = 0; i < weights.length; i++) FlSpot(i.toDouble(), weights[i]),
    ];

    final axisLabel = dashMeta(color: kInkDisabled).copyWith(fontSize: 9);
    final gridLine = FlLine(
      color: NhamColors.border.withValues(alpha: 0.5),
      strokeWidth: 1,
    );

    return AspectRatio(
      aspectRatio: _chartAspect,
      child: LineChart(
        LineChartData(
          minX: 0,
          maxX: maxX,
          minY: axis.min,
          maxY: axis.max,
          clipData: const FlClipData.all(),
          backgroundColor: Colors.transparent,
          // Uniform gridline at every round-number Y step (spans the plot,
          // which fills from the label gutter to the right edge).
          gridData: FlGridData(
            show: true,
            drawVerticalLine: false,
            horizontalInterval: yStep,
            getDrawingHorizontalLine: (_) => gridLine,
          ),
          borderData: FlBorderData(
            show: true,
            border: Border.all(color: NhamColors.border.withValues(alpha: 0.5)),
          ),
          titlesData: FlTitlesData(
            show: true,
            topTitles:
                const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            rightTitles:
                const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            // Round-number weight values in a left gutter — outside the plot,
            // so they never sit on top of the line.
            leftTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 28,
                interval: yStep,
                getTitlesWidget: (value, meta) => SideTitleWidget(
                  meta: meta,
                  child: Text(
                    yStep >= 1
                        ? value.toStringAsFixed(0)
                        : value.toStringAsFixed(1),
                    style: axisLabel,
                  ),
                ),
              ),
            ),
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 18,
                interval: 1,
                getTitlesWidget: (value, meta) {
                  final i = value.round();
                  final label = xLabels[i];
                  if (label == null || (value - i).abs() > 0.01) {
                    return const SizedBox.shrink();
                  }
                  return Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(label, style: axisLabel),
                  );
                },
              ),
            ),
          ),
          // "Today" marker at the most recent logged weight.
          extraLinesData: ExtraLinesData(
            verticalLines: [
              VerticalLine(
                x: lastIndex.toDouble(),
                color: NhamColors.accent.withValues(alpha: 0.35),
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
                        color: NhamColors.accent,
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
              tooltipRoundedRadius: NhamRadii.md,
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
                color: NhamColors.accent.withValues(alpha: 0.6),
                barWidth: 2,
                dashArray: const [3, 3],
                dotData: const FlDotData(show: false),
              ),
            // Actual — straight segments, a dot at every point, today emphasized.
            LineChartBarData(
              spots: actualSpots,
              isCurved: false,
              color: NhamColors.accent,
              barWidth: 2,
              isStrokeCapRound: false,
              isStrokeJoinRound: false,
              dotData: FlDotData(
                show: true,
                getDotPainter: (spot, pct, bar, idx) => idx == lastIndex
                    ? const _TodayDotPainter(color: NhamColors.accent)
                    : FlDotCirclePainter(
                        radius: 3,
                        color: NhamColors.accent,
                        strokeColor: Colors.white,
                        strokeWidth: 1.5,
                      ),
              ),
            ),
          ],
        ),
        duration: const Duration(milliseconds: 1500),
        curve: Curves.easeInOut,
      ),
    );
  }
}

/// The most-recent-weight dot: a faint accent halo behind a white-ringed accent
/// dot (mirrors the web chart's emphasized "today" point).
class _TodayDotPainter extends FlDotPainter {
  const _TodayDotPainter({required this.color});

  final Color color;

  @override
  void draw(Canvas canvas, FlSpot spot, Offset offset) {
    canvas.drawCircle(
      offset,
      9,
      Paint()..color = color.withValues(alpha: 0.18),
    );
    canvas.drawCircle(offset, 4.5, Paint()..color = color);
    canvas.drawCircle(
      offset,
      4.5,
      Paint()
        ..color = Colors.white
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );
  }

  @override
  Size getSize(FlSpot spot) => const Size(18, 18);

  @override
  Color get mainColor => color;

  @override
  FlDotPainter lerp(FlDotPainter a, FlDotPainter b, double t) => b;

  @override
  List<Object?> get props => [color];
}
