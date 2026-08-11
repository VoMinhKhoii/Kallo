import 'package:easy_localization/easy_localization.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../models/nutrition.dart';
import '../../../theme/nham_colors.dart';
import '../logic/chart_axis.dart';
import '../logic/format_date.dart';
import '../logic/macro_trend_bars.dart';
import '../logic/rhythm_logic.dart';

/// A stacked **bar** chart of macro **calories** per bucket (day for 7d, week
/// for 30d/90d): total bar height = that bucket's calories, each stacked
/// segment = the energy from protein / carbs / fat. Reads the overview
/// `daySeries` directly — which is built over every logged day, so a bar's
/// height does not move when the day-scope toggle flips.
///
/// One rounded column per bucket, split into three regions filled with the
/// nutrition chart pigments that match the `DaySummary` legend.
class MacroTrendChart extends StatelessWidget {
  const MacroTrendChart({
    super.key,
    required this.daySeries,
    required this.todayIndex,
    required this.selectedIndex,
    required this.onSelect,
  });

  final NutritionDaySeries daySeries;

  /// Index of the bucket holding today, or -1. Drawn heavier on the axis.
  final int todayIndex;
  final int? selectedIndex;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    final data = buildMacroTrendBars(daySeries);
    if (data == null) return const SizedBox.shrink();
    final bars = data.bars;

    // A selected column keeps its macro colours; the rest collapse to one flat
    // grey. Fading them instead only washed them toward the page and left three
    // pale bands still competing for attention — greying makes each unselected
    // column read as a single quiet block.
    Color shade(Color base, int i) =>
        selectedIndex == null || selectedIndex == i
            ? base
            : NhamColors.chartMuted;

    // Fewer, fatter columns for the 7-day view; slimmer ones for the busier
    // weekly axes (5 buckets at 30d, 13 at 90d) so they don't crowd.
    final barWidth = bars.length <= 7 ? 18.0 : 10.0;

    final groups = [
      for (final bar in bars)
        BarChartGroupData(
          x: bar.index,
          barRods: [
            // A gap keeps a zero rod rather than an empty rod list. An empty
            // list reports `BarChartGroupData.width == 0`, and `spaceBetween`
            // lays groups out from their widths — so a gap would shift every
            // column after it off the grid its axis labels sit on. A
            // zero-height rod paints nothing and holds the slot.
            if (bar.isGap)
              BarChartRodData(toY: 0, width: barWidth)
            else
              BarChartRodData(
                toY: bar.total,
                width: barWidth,
                borderRadius:
                    const BorderRadius.vertical(top: Radius.circular(4)),
                // Stacked P/C/F kcal bands, matching the legend order & colors.
                rodStackItems: [
                  BarChartRodStackItem(0, bar.proteinKcal,
                      shade(kCompositionColors['protein']!, bar.index)),
                  BarChartRodStackItem(
                      bar.proteinKcal,
                      bar.proteinKcal + bar.carbsKcal,
                      shade(kCompositionColors['carbohydrate']!, bar.index)),
                  BarChartRodStackItem(bar.proteinKcal + bar.carbsKcal,
                      bar.total, shade(kCompositionColors['fat']!, bar.index)),
                ],
              ),
          ],
        ),
    ];

    final tickLabels = buildBucketTickLabels(
      [for (final bar in bars) bar.startDate],
      daySeries.unit,
      context.locale.toString(),
    );

    final axis = buildMacroTrendAxis(data.maxY);
    final step = axis.step;
    final maxLabel = axis.maxLabel;

    return SizedBox(
      height: 248,
      child: BarChart(
        BarChartData(
          minY: 0,
          maxY: axis.topY,
          alignment: BarChartAlignment.spaceBetween,
          // Tap-to-select, not hover-to-peek: no tooltip, the tapped index is
          // handed up and the breakdown renders below the chart.
          barTouchData: BarTouchData(
            enabled: true,
            handleBuiltInTouches: false,
            touchCallback: (event, response) {
              if (event is! FlTapUpEvent) return;
              final index = response?.spot?.touchedBarGroupIndex;
              if (index != null) onSelect(index);
            },
          ),
          gridData: FlGridData(
            show: true,
            drawVerticalLine: false,
            horizontalInterval: step,
            getDrawingHorizontalLine: (value) => const FlLine(
              color: NhamColors.borderBiscotti40,
              strokeWidth: 1,
              dashArray: [4, 4],
            ),
          ),
          borderData: FlBorderData(show: false),
          titlesData: FlTitlesData(
            topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            rightTitles:
                const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            leftTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                interval: step,
                reservedSize: 36,
                getTitlesWidget: (value, meta) {
                  if (value <= 0 || value > maxLabel) {
                    return const SizedBox.shrink();
                  }
                  return Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: Text(
                      value.round().toString(),
                      textAlign: TextAlign.right,
                      style: dashMeta(color: kInkMuted).copyWith(fontSize: 10),
                    ),
                  );
                },
              ),
            ),
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 22,
                interval: 1,
                getTitlesWidget: (value, meta) {
                  final i = value.round();
                  if (i < 0 || i >= tickLabels.length) {
                    return const SizedBox.shrink();
                  }
                  final label = tickLabels[i];
                  if (label.isEmpty) return const SizedBox.shrink();
                  // 500 is this palette's weight ceiling — today reads heavier
                  // than its neighbours without becoming a second heading.
                  final emphasised = i == todayIndex || i == selectedIndex;
                  return Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text(
                      label,
                      style: dashEyebrow(color: emphasised ? kInk : kInkMuted)
                          .copyWith(
                        letterSpacing: 0.4,
                        fontWeight:
                            emphasised ? FontWeight.w500 : FontWeight.w400,
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
          barGroups: groups,
        ),
      ),
    );
  }
}
