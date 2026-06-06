/// WeightChart — RN port of the web ProgressStory
/// (`components/dashboard/weight-chart.tsx`). A single card nesting, in order:
///   [1] trend / delta callout
///   [2] TODAY'S WEIGHT input (CompactWeightLog)
///   [3] the area chart (here drawn with fl_chart).
///
/// Self-contained: reads the weight summary slice off the dashboard bundle and
/// renders its own loading / error states. The chart fixes at the 30-day range.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/dashboard.dart';
import '../../../models/weight.dart';
import '../../../shared/widgets/widgets.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import '../data/dashboard_providers.dart';
import '../logic/weight_chart_utils.dart';
import '../logic/weight_trend.dart';
import 'compact_weight_log.dart';
import 'dashboard_tokens.dart';

const double _chartH = 200; // RN min-h-[200px]
const double _yGutter = 36; // RN YAxis width=36
const double _xAxisH = 16; // room for x-tick labels

class WeightChart extends ConsumerWidget {
  const WeightChart({super.key, required this.todayDate, required this.args});

  final String todayDate;
  final DashboardArgs args;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(weightSummaryProvider(args));

    return Container(
      padding: const EdgeInsets.all(10), // p-2.5
      decoration: BoxDecoration(
        color: NhamColors.elev,
        borderRadius: BorderRadius.circular(kCardRadius24), // rounded-[1.5rem]
        border: Border.all(color: NhamColors.borderSoft), // /60
        boxShadow: const [kCardShadow], // shadow-[0_10px_32px_…/0.05]
      ),
      child: async.when(
        loading: () => _MinHeight(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const CircularProgressIndicator(
                  color: NhamColors.accent, strokeWidth: 3),
              const SizedBox(height: NhamSpacing.sp2),
              NhamText(
                tr('dashboard.loadingWeightTrend'),
                variant: NhamTextVariant.small,
                textAlign: TextAlign.center,
                style: const TextStyle(color: NhamColors.stone),
              ),
            ],
          ),
        ),
        error: (_, __) => _MinHeight(
          child: NhamText(
            tr('dashboard.progressLoadError'),
            variant: NhamTextVariant.small,
            textAlign: TextAlign.center,
            style: const TextStyle(color: NhamColors.stone),
          ),
        ),
        data: (data) =>
            _Body(data: data, todayDate: todayDate, args: args),
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
    final pillColor = behind ? NhamColors.danger : NhamColors.accent;
    final kg = tr('dashboard.units.kg');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // [1] Trend / delta callout.
        Container(
          padding: const EdgeInsets.all(10), // p-2.5
          decoration: BoxDecoration(
            color: NhamColors.surface80,
            borderRadius: BorderRadius.circular(NhamRadii.xxxl), // rounded-3xl
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Status pill (self-start).
              Align(
                alignment: Alignment.centerLeft,
                child: Container(
                  margin: const EdgeInsets.only(bottom: NhamSpacing.sp2),
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: NhamSpacing.sp1),
                  decoration: BoxDecoration(
                    color: behind
                        ? const Color(0x1AD37B69) // rgba(211,123,105,0.1)
                        : NhamColors.accentSelectedFill,
                    borderRadius: BorderRadius.circular(NhamRadii.pill),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        trendDown
                            ? Icons.trending_down
                            : Icons.trending_up,
                        size: 14,
                        color: pillColor,
                      ),
                      const SizedBox(width: NhamSpacing.sp2),
                      Text(
                        label,
                        style: NhamTextStyles.sansSemiBold(
                                fontSize: NhamFontSize.xs)
                            .copyWith(color: pillColor),
                      ),
                    ],
                  ),
                ),
              ),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Flexible(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          isInsufficient
                              ? '${summary.currentWeight.toStringAsFixed(1)} $kg'
                              : '${delta > 0 ? '+' : ''}${delta.toStringAsFixed(1)} $kg',
                          // text-3xl(30) font-semibold Lora tracking-[-0.04em].
                          style: NhamTextStyles.serifSemiBold(fontSize: 30)
                              .copyWith(
                            letterSpacing: -1.2,
                            color: NhamColors.text,
                            fontFeatures: const [FontFeature.tabularFigures()],
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.only(top: NhamSpacing.sp1),
                          child: Text(
                            detail,
                            style: NhamTextStyles.sansRegular(
                                    fontSize: NhamFontSize.xs, height: 16 / 12)
                                .copyWith(color: NhamColors.stone),
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (!isInsufficient) ...[
                    const SizedBox(width: NhamSpacing.sp3),
                    Row(
                      children: [
                        _Stat(
                            label: tr('dashboard.now'),
                            value:
                                '${summary.currentWeight.toStringAsFixed(1)} $kg'),
                        if (summary.canProject) ...[
                          const SizedBox(width: NhamSpacing.sp2),
                          _Stat(
                              label: tr('dashboard.projected'),
                              value:
                                  '${summary.projectedEndWeight.toStringAsFixed(1)} $kg'),
                        ],
                      ],
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: NhamSpacing.sp2),

        // [2] TODAY'S WEIGHT input.
        CompactWeightLog(
          currentWeight: data.currentWeight,
          todayWeight: data.todayWeight,
          todayDate: todayDate,
          args: args,
        ),
        const SizedBox(height: NhamSpacing.sp2),

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
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: NhamColors.elevTranslucent,
        borderRadius: BorderRadius.circular(NhamRadii.buttonXl), // rounded-xl
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            // text-[9px] uppercase tracking-[0.14em] (= 1.26px @ 9px) stone.
            style: NhamTextStyles.sansBold(fontSize: 9)
                .copyWith(letterSpacing: 1.26, color: NhamColors.stone),
          ),
          const SizedBox(height: 2),
          // font-mono text-xs(12) text-nham-text.
          Text(
            value,
            style: dashMono(fontSize: NhamFontSize.xs)
                .copyWith(color: NhamColors.text),
          ),
        ],
      ),
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
        constraints: const BoxConstraints(minHeight: 200),
        alignment: Alignment.center,
        child: NhamText(
          tr('dashboard.noWeightData'),
          variant: NhamTextVariant.small,
          textAlign: TextAlign.center,
          style: const TextStyle(color: NhamColors.stone),
        ),
      );
    }

    final locale = context.locale.languageCode;
    final isSinglePoint = weights.length == 1;
    final rangeDays = range == WeightRange.d30 ? 30 : 90;

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
            padding: const EdgeInsets.only(bottom: 2), // mb-0.5
            child: Row(
              children: [
                Container(
                  width: 12, // w-3
                  height: 8, // h-2
                  decoration: BoxDecoration(
                    color: NhamColors.danger.withValues(alpha: 0.5),
                    borderRadius: BorderRadius.circular(4), // rounded-sm
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  tr('dashboard.offTrack'),
                  style: NhamTextStyles.sansRegular(
                          fontSize: NhamFontSize.eyebrow)
                      .copyWith(color: NhamColors.stone),
                ),
              ],
            ),
          ),
        SizedBox(
          height: _chartH,
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
                  left: BorderSide(color: NhamColors.border, width: 1),
                  bottom: BorderSide(color: NhamColors.border, width: 1),
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
                    reservedSize: _yGutter,
                    getTitlesWidget: (value, meta) {
                      // Only render the two goal ticks.
                      for (final t in yTicks) {
                        if ((value - t).abs() < 0.0001) {
                          return SideTitleWidget(
                            meta: meta,
                            child: Text(
                              t.toStringAsFixed(1),
                              style: NhamTextStyles.sansRegular(fontSize: 9)
                                  .copyWith(
                                color: NhamColors.stone,
                                fontFeatures: const [
                                  FontFeature.tabularFigures()
                                ],
                              ),
                            ),
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
                    reservedSize: _xAxisH,
                    getTitlesWidget: (value, meta) {
                      for (var i = 0; i < xTicks.length; i++) {
                        if ((value - xTicks[i]).abs() < 0.0001) {
                          return SideTitleWidget(
                            meta: meta,
                            child: Text(
                              xTicksData.formatter(xTicks[i], i),
                              style: NhamTextStyles.sansRegular(fontSize: 9)
                                  .copyWith(color: NhamColors.stone),
                            ),
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
                  getTooltipColor: (_) => NhamColors.elev,
                  tooltipBorder: const BorderSide(color: NhamColors.borderSoft),
                  tooltipRoundedRadius: NhamRadii.md,
                  getTooltipItems: (touchedSpots) => touchedSpots
                      .map(
                        (s) => LineTooltipItem(
                          '${s.y.toStringAsFixed(1)} ${tr('dashboard.units.kg')}',
                          NhamTextStyles.sansMedium(fontSize: NhamFontSize.xs)
                              .copyWith(
                            color: NhamColors.text,
                            fontFeatures: const [FontFeature.tabularFigures()],
                          ),
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
