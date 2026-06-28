/// WeightChart — the dashboard's weight-trend card.
///
/// 2026 redesign (round 2): a flat white card with NO trend interpretation —
/// the current weight as the bold hero number, the today's-weight input, and an
/// integrated minimal line (no axis frame, no off-track band; a dotted goal line
/// + tiny start/now end-labels). The line bleeds to the card edges so it reads
/// as part of the card, not a pasted-in chart.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../models/weight.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../data/dashboard_providers.dart';
import 'compact_weight_log.dart';
import 'dashboard_tokens.dart';
import 'skeleton.dart';

const double _chartAspect = 2.2; // canvas width : height (minimal band)

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
        boxShadow: kCardShadows, // shadow only, no border
      ),
      child: async.when(
        // Skeleton of the card body (no spinner) — the card is already drawn,
        // so only its inner rows shimmer.
        loading: () => Shimmer(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: weightCardSkeletonChildren(),
          ),
        ),
        error: (_, __) => _MinHeight(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(LucideIcons.cloudOff, size: 22, color: NhamColors.stone),
              const SizedBox(height: NhamSpacing.sp2),
              Text(
                tr('dashboard.progressLoadError'),
                textAlign: TextAlign.center,
                style: dashMeta(color: kInkSecondary),
              ),
            ],
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
    final kg = tr('dashboard.units.kg');

    // Net change over the window (current − period start). The top-right stat
    // that fills what used to be an empty corner — a SaaS-style metric pair.
    final delta = data.currentWeight - data.periodStartWeight;
    final hasTrend = data.weights.length > 1 && delta.abs() >= 0.05;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Hero — current weight (left) + net-change stat (right) so the corner
        // never reads empty.
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text(data.currentWeight.toStringAsFixed(1),
                      style: dashHero()),
                  const SizedBox(width: 6),
                  Text(kg, style: dashBody(color: kInkSecondary)),
                ],
              ),
            ),
            _TrendStat(delta: delta, hasTrend: hasTrend, kg: kg),
          ],
        ),
        const SizedBox(height: NhamSpacing.sp4),

        // Today's-weight input.
        CompactWeightLog(
          currentWeight: data.currentWeight,
          todayWeight: data.todayWeight,
          todayDate: todayDate,
          args: args,
        ),
        const SizedBox(height: NhamSpacing.sp4),

        // Integrated minimal chart.
        _ChartCanvas(
          weights: data.weights,
          periodStartWeight: data.periodStartWeight,
          expectedEndWeight: data.expectedEndWeight,
        ),
      ],
    );
  }
}

/// The top-right net-change metric. A signed delta + kg with a small eyebrow,
/// turning the empty corner into a SaaS-style metric pair. No trend-arrow icon
/// (a SaaS trope per the brand drift-watchlist) — the sign carries direction.
class _TrendStat extends StatelessWidget {
  const _TrendStat({
    required this.delta,
    required this.hasTrend,
    required this.kg,
  });

  final double delta;
  final bool hasTrend;
  final String kg;

  @override
  Widget build(BuildContext context) {
    // No history yet → a plain "steady" word (no number, no label).
    if (!hasTrend) {
      return Padding(
        padding: const EdgeInsets.only(top: 6),
        child: Text(
          tr('dashboard.weightCard.steady'),
          style: dashMeta(color: kInkSecondary),
        ),
      );
    }

    // The net-change stat — arrow + value + kg, no caption label.
    final value = delta.abs().toStringAsFixed(1);
    final arrow = delta > 0 ? LucideIcons.arrowUp : LucideIcons.arrowDown;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(arrow, size: 18, color: kInk),
        const SizedBox(width: 1),
        Text(value, style: dashValue(color: kInk)),
        const SizedBox(width: 3),
        Padding(
          padding: const EdgeInsets.only(bottom: 1),
          child: Text(kg, style: dashMeta(color: kInkDisabled)),
        ),
      ],
    );
  }
}

/// A frameless area line that bleeds to the card edges, with a dotted goal line
/// and tiny start/now end-labels — no axes, no band, no interpretation.
class _ChartCanvas extends StatelessWidget {
  const _ChartCanvas({
    required this.weights,
    required this.periodStartWeight,
    required this.expectedEndWeight,
  });

  final List<double> weights;
  final double periodStartWeight;
  final double expectedEndWeight;

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
    final xMax = (isSinglePoint ? 1 : weights.length - 1).toDouble();

    final spots = <FlSpot>[
      for (var i = 0; i < weights.length; i++) FlSpot(i.toDouble(), weights[i]),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AspectRatio(
          aspectRatio: _chartAspect,
          child: LineChart(
            LineChartData(
              minX: 0,
              maxX: xMax,
              minY: yMin,
              maxY: yMax,
              clipData: const FlClipData.all(),
              backgroundColor: Colors.transparent,
              gridData: const FlGridData(show: false),
              borderData: FlBorderData(show: false), // no frame
              titlesData: const FlTitlesData(show: false), // no gutter / axes
              // Dotted goal line.
              extraLinesData: ExtraLinesData(
                horizontalLines: [
                  HorizontalLine(
                    y: expectedEndWeight,
                    color: NhamColors.accent.withValues(alpha: 0.45),
                    strokeWidth: 1,
                    dashArray: const [4, 3],
                    label: HorizontalLineLabel(
                      show: true,
                      alignment: Alignment.topRight,
                      padding: const EdgeInsets.only(right: 2, bottom: 2),
                      style: dashMeta(color: kInkDisabled),
                      labelResolver: (_) =>
                          '${tr('dashboard.goal')} ${expectedEndWeight.toStringAsFixed(1)}',
                    ),
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
                  getTooltipItems: (touchedSpots) => touchedSpots
                      .map(
                        (s) => LineTooltipItem(
                          '${s.y.toStringAsFixed(1)} $kg',
                          dashMeta(color: kInk, tabular: true),
                        ),
                      )
                      .toList(),
                ),
              ),
              lineBarsData: [
                LineChartBarData(
                  spots: spots,
                  // Sharp, angular line — no smoothing (was a rounded curve).
                  isCurved: false,
                  color: NhamColors.accent,
                  barWidth: 2,
                  isStrokeCapRound: false,
                  isStrokeJoinRound: false,
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
            duration: const Duration(milliseconds: 1500),
            curve: Curves.easeInOut,
          ),
        ),
        const SizedBox(height: NhamSpacing.sp1),
        // Tiny start / now end-labels (in place of an axis).
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('${weights.first.toStringAsFixed(1)} $kg',
                style: dashMeta(color: kInkDisabled, tabular: true)),
            Text('${weights.last.toStringAsFixed(1)} $kg',
                style: dashMeta(color: kInkSecondary, tabular: true)),
          ],
        ),
      ],
    );
  }
}
