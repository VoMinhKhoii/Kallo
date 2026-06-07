/// WeightChart — the dashboard's weight-trend card.
///
/// 2026 redesign: a flat white card holding three whitespace-separated zones —
///   [1] trend / delta callout (delta is the bold-sans hero number)
///   [2] today's-weight input ([CompactWeightLog])
///   [3] the area chart (fl_chart), sized by AspectRatio with a width-responsive
///       y-gutter so it never overflows on narrow screens.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../models/dashboard.dart';
import '../../../models/weight.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../data/dashboard_providers.dart';
import '../logic/weight_chart_utils.dart';
import '../logic/weight_trend.dart';
import 'compact_weight_log.dart';
import 'dashboard_tokens.dart';

const double _chartAspect = 1.75; // canvas width : height

class WeightChart extends ConsumerWidget {
  const WeightChart({super.key, required this.todayDate, required this.args});

  final String todayDate;
  final DashboardArgs args;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(weightSummaryProvider(args));

    return Container(
      padding: const EdgeInsets.all(NhamSpacing.sp4),
      decoration: BoxDecoration(
        color: kCardSurface, // solid white
        borderRadius: BorderRadius.circular(kCardRadius),
        boxShadow: const [kCardShadow], // shadow only, no border
      ),
      child: async.when(
        loading: () => _MinHeight(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const CircularProgressIndicator(
                  color: NhamColors.accent, strokeWidth: 3),
              const SizedBox(height: NhamSpacing.sp2),
              Text(
                tr('dashboard.loadingWeightTrend'),
                textAlign: TextAlign.center,
                style: dashMeta(color: kInkDisabled),
              ),
            ],
          ),
        ),
        error: (_, __) => _MinHeight(
          child: Text(
            tr('dashboard.progressLoadError'),
            textAlign: TextAlign.center,
            style: dashMeta(color: kInkDisabled),
          ),
        ),
        data: (data) => _Body(data: data, todayDate: todayDate, args: args),
      ),
    );
  }
}

class _MinHeight extends StatelessWidget {
  const _MinHeight({required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => Container(
        constraints: const BoxConstraints(minHeight: 200),
        alignment: Alignment.center,
        child: child,
      );
}

class _Body extends StatelessWidget {
  const _Body({
    required this.data,
    required this.todayDate,
    required this.args,
  });

  final WeightSummaryData data;
  final String todayDate;
  final DashboardArgs args;

  @override
  Widget build(BuildContext context) {
    const range = WeightRange.d30;
    final summary = buildWeightTrendSummary(
      weights: data.weights,
      periodStartWeight: data.periodStartWeight,
      expectedEndWeight: data.expectedEndWeight,
      goalDirection: data.goalDirection,
      range: range,
      elapsedDays: data.periodElapsedDays,
    );

    final label = tr('dashboard.progressStatus.${summary.status.key}.label');
    final detail = tr('dashboard.progressStatus.${summary.status.key}.detail');
    final isInsufficient = summary.status == WeightTrendStatus.insufficient;
    final delta = summary.currentWeight - summary.startWeight;
    final behind = summary.status == WeightTrendStatus.behind;
    final trendDown = delta <= 0;
    // Status colour carries meaning: sage = on track, terracotta = behind.
    final statusColor = behind ? NhamColors.danger : NhamColors.success;
    final kg = tr('dashboard.units.kg');

    final deltaStr = isInsufficient
        ? summary.currentWeight.toStringAsFixed(1)
        : '${delta > 0 ? '+' : ''}${delta.toStringAsFixed(1)}';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // [1] Trend / delta callout — flat (no cream sub-block).
        // Status pill.
        Align(
          alignment: Alignment.centerLeft,
          child: Container(
            margin: const EdgeInsets.only(bottom: NhamSpacing.sp2),
            padding: const EdgeInsets.symmetric(
                horizontal: 10, vertical: NhamSpacing.sp1),
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(NhamRadii.pill),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  trendDown ? LucideIcons.trendingDown : LucideIcons.trendingUp,
                  size: 16,
                  color: statusColor,
                ),
                const SizedBox(width: NhamSpacing.sp2),
                Text(label, style: dashEyebrow(color: statusColor)),
              ],
            ),
          ),
        ),
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Text(deltaStr, style: dashHero()),
                      const SizedBox(width: 6),
                      Text(kg, style: dashBody(color: kInkSecondary)),
                    ],
                  ),
                  Padding(
                    padding: const EdgeInsets.only(top: NhamSpacing.sp1),
                    child: Text(detail, style: dashMeta(color: kInkDisabled)),
                  ),
                ],
              ),
            ),
            if (!isInsufficient) ...[
              const SizedBox(width: NhamSpacing.sp3),
              _Stat(
                  label: tr('dashboard.now'),
                  value: '${summary.currentWeight.toStringAsFixed(1)} $kg'),
              if (summary.canProject) ...[
                const SizedBox(width: NhamSpacing.sp4),
                _Stat(
                    label: tr('dashboard.projected'),
                    value:
                        '${summary.projectedEndWeight.toStringAsFixed(1)} $kg'),
              ],
            ],
          ],
        ),
        const SizedBox(height: NhamSpacing.sp4),

        // [2] TODAY'S WEIGHT input.
        CompactWeightLog(
          currentWeight: data.currentWeight,
          todayWeight: data.todayWeight,
          todayDate: todayDate,
          args: args,
        ),
        const SizedBox(height: NhamSpacing.sp4),

        // [3] Chart.
        _ChartCanvas(
          weights: data.weights,
          periodStartWeight: data.periodStartWeight,
          expectedEndWeight: data.expectedEndWeight,
          goalDirection: data.goalDirection,
          range: range,
        ),
      ],
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label.toUpperCase(), style: dashEyebrow()),
        const SizedBox(height: 2),
        Text(value, style: dashMeta(color: kInk, tabular: true)),
      ],
    );
  }
}

/// The fl_chart area chart. Y domain is clamped to the goal range, expanding to
/// fit the data. Off-track band, reference line, accent gradient area, curved
/// line, and a press tooltip mirror the RN SVG chart.
class _ChartCanvas extends StatelessWidget {
  const _ChartCanvas({
    required this.weights,
    required this.periodStartWeight,
    required this.expectedEndWeight,
    required this.goalDirection,
    required this.range,
  });

  final List<double> weights;
  final double periodStartWeight;
  final double expectedEndWeight;
  final WeightGoalDirection goalDirection;
  final WeightRange range;

  @override
  Widget build(BuildContext context) {
    if (weights.isEmpty) {
      return Container(
        constraints: const BoxConstraints(minHeight: 180),
        alignment: Alignment.center,
        child: Text(
          tr('dashboard.noWeightData'),
          textAlign: TextAlign.center,
          style: dashMeta(color: kInkDisabled),
        ),
      );
    }

    final locale = context.locale.languageCode;
    final isSinglePoint = weights.length == 1;
    final rangeDays = range == WeightRange.d30 ? 30 : 90;
    // Bug B fix: narrow screens get a tighter y-gutter so the plot keeps width.
    final yGutter = MediaQuery.of(context).size.width < 360 ? 28.0 : 36.0;

    final goalTop = periodStartWeight > expectedEndWeight
        ? periodStartWeight
        : expectedEndWeight;
    final goalBottom = periodStartWeight < expectedEndWeight
        ? periodStartWeight
        : expectedEndWeight;
    final dataMin = weights.reduce((a, b) => a < b ? a : b);
    final dataMax = weights.reduce((a, b) => a > b ? a : b);
    final yMin = (goalBottom < dataMin ? goalBottom : dataMin) - 0.3;
    final yMax = (goalTop > dataMax ? goalTop : dataMax) + 0.3;

    final xMax = (isSinglePoint ? rangeDays - 1 : weights.length - 1).toDouble();

    final spots = <FlSpot>[
      for (var i = 0; i < weights.length; i++) FlSpot(i.toDouble(), weights[i]),
    ];

    // Y ticks: periodStart + expectedEnd (deduped).
    final yTicks = <double>{periodStartWeight, expectedEndWeight}.toList();

    // X ticks + formatter.
    final XTicks xTicksData = isSinglePoint
        ? XTicks([0], (_, __) => tr('dashboard.start'))
        : buildXTicks(weights.length, range, locale, tr('dashboard.now'),
            tr('dashboard.weekPrefix'));
    final xTicks = xTicksData.ticks;

    final tickStyle = dashMeta(color: kInkSecondary, tabular: true);

    // Off-track band bounds.
    double? bandTop;
    double? bandBottom;
    if (goalDirection == WeightGoalDirection.down) {
      bandTop = yMax;
      bandBottom = periodStartWeight;
    } else if (goalDirection == WeightGoalDirection.up) {
      bandTop = periodStartWeight;
      bandBottom = yMin;
    }
    final showBand = bandTop != null && bandBottom != null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (goalDirection != WeightGoalDirection.flat)
          Padding(
            padding: const EdgeInsets.only(bottom: NhamSpacing.sp1),
            child: Row(
              children: [
                Container(
                  width: 12,
                  height: 8,
                  decoration: BoxDecoration(
                    color: NhamColors.danger.withValues(alpha: 0.5),
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
                const SizedBox(width: 6),
                Text(tr('dashboard.offTrack'),
                    style: dashMeta(color: kInkDisabled)),
              ],
            ),
          ),
        AspectRatio(
          aspectRatio: _chartAspect,
          child: LineChart(
            LineChartData(
              minX: 0,
              maxX: xMax == 0 ? 1 : xMax,
              minY: yMin,
              maxY: yMax,
              clipData: const FlClipData.all(),
              backgroundColor: Colors.transparent,
              gridData: const FlGridData(show: false),
              borderData: FlBorderData(
                show: true,
                border: const Border(
                  left: BorderSide(color: kHairline, width: 1),
                  bottom: BorderSide(color: kHairline, width: 1),
                ),
              ),
              rangeAnnotations: RangeAnnotations(
                horizontalRangeAnnotations: [
                  if (showBand)
                    HorizontalRangeAnnotation(
                      y1: bandBottom,
                      y2: bandTop,
                      color: NhamColors.danger.withValues(alpha: 0.08),
                    ),
                ],
              ),
              extraLinesData: ExtraLinesData(
                horizontalLines: [
                  HorizontalLine(
                    y: periodStartWeight,
                    color: NhamColors.danger.withValues(alpha: 0.25),
                    strokeWidth: 1,
                  ),
                ],
              ),
              titlesData: FlTitlesData(
                topTitles: const AxisTitles(
                    sideTitles: SideTitles(showTitles: false)),
                rightTitles: const AxisTitles(
                    sideTitles: SideTitles(showTitles: false)),
                leftTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: yGutter,
                    getTitlesWidget: (value, meta) {
                      for (final t in yTicks) {
                        if ((value - t).abs() < 0.0001) {
                          return SideTitleWidget(
                            meta: meta,
                            child: Text(t.toStringAsFixed(1), style: tickStyle),
                          );
                        }
                      }
                      return const SizedBox.shrink();
                    },
                  ),
                ),
                bottomTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: 18,
                    getTitlesWidget: (value, meta) {
                      for (var i = 0; i < xTicks.length; i++) {
                        if ((value - xTicks[i]).abs() < 0.0001) {
                          return SideTitleWidget(
                            meta: meta,
                            child: Text(xTicksData.formatter(xTicks[i], i),
                                style: tickStyle),
                          );
                        }
                      }
                      return const SizedBox.shrink();
                    },
                  ),
                ),
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
                  getTooltipItems: (touchedSpots) => touchedSpots
                      .map(
                        (s) => LineTooltipItem(
                          '${s.y.toStringAsFixed(1)} ${tr('dashboard.units.kg')}',
                          dashMeta(color: kInk, tabular: true),
                        ),
                      )
                      .toList(),
                ),
              ),
              lineBarsData: [
                LineChartBarData(
                  spots: spots,
                  isCurved: !isSinglePoint,
                  curveSmoothness: 0.35,
                  preventCurveOverShooting: true,
                  color: NhamColors.accent,
                  barWidth: 2,
                  isStrokeCapRound: true,
                  isStrokeJoinRound: true,
                  dotData: FlDotData(
                    show: isSinglePoint,
                    getDotPainter: (spot, pct, bar, idx) => FlDotCirclePainter(
                      radius: 4,
                      color: NhamColors.accent,
                      strokeWidth: 2,
                      strokeColor: Colors.white,
                    ),
                  ),
                  belowBarData: BarAreaData(
                    show: true,
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        NhamColors.accent.withValues(alpha: 0.18),
                        NhamColors.accent.withValues(alpha: 0),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            // recharts Area default ≈1.5s ease-in-out draw on mount.
            duration: const Duration(milliseconds: 1500),
            curve: Curves.easeInOut,
          ),
        ),
      ],
    );
  }
}
