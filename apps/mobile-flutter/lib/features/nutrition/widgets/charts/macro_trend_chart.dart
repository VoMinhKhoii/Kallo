import 'package:easy_localization/easy_localization.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../../../../models/nutrition/nutrition.dart';
import '../../../../theme/kallo_colors.dart';
import '../../logic/chart_axis.dart';
import '../../logic/format_date.dart';
import '../../logic/macro_trend_bars.dart';
import '../../logic/rhythm_logic.dart';
import 'macro_trend_axis.dart';

/// A stacked **bar** chart of macro **calories** per bucket (day for 7d, week
/// for 30d/90d): total bar height = that bucket's calories, each stacked
/// segment = the energy from protein / carbs / fat. Reads the overview
/// `daySeries` directly — which the server scopes by the same day set as the
/// headline above it, so on the day axis a complete day's column holds still
/// across a toggle and only the partial days come and go.
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

    // Grey means "not being counted" — see `isColumnDimmed` for which sense of
    // that applies. Fading instead only washed the columns toward the page and
    // left three pale bands still competing for attention; greying makes each
    // one read as a single quiet block.
    Color shade(Color base, MacroBar bar) =>
        isColumnDimmed(bar, selectedIndex) ? KalloColors.chartMuted : base;

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
            //
            // `color` is explicit on BOTH rods for a second reason: fl_chart
            // defaults an unset rod to cyan and animates between two
            // BarChartData on every range switch, and mid-lerp the stack items
            // don't cover the rod — so that default flashed blue across the
            // chart. Transparent leaves the stack bands as the only paint.
            if (bar.isGap)
              BarChartRodData(
                  toY: 0, width: barWidth, color: Colors.transparent)
            else
              BarChartRodData(
                toY: bar.total,
                width: barWidth,
                color: Colors.transparent,
                borderRadius:
                    const BorderRadius.vertical(top: Radius.circular(4)),
                // Stacked P/C/F kcal bands, matching the legend order & colors.
                rodStackItems: [
                  BarChartRodStackItem(0, bar.proteinKcal,
                      shade(kCompositionColors['protein']!, bar)),
                  BarChartRodStackItem(
                      bar.proteinKcal,
                      bar.proteinKcal + bar.carbsKcal,
                      shade(kCompositionColors['carbohydrate']!, bar)),
                  BarChartRodStackItem(bar.proteinKcal + bar.carbsKcal,
                      bar.total, shade(kCompositionColors['fat']!, bar)),
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

    // 140 of plot plus the bucket axis under it — the chart was 248, which on
    // a 390x844 phone pushed the vitamins below the fold and the page's last
    // card under the floating pill nav.
    return SizedBox(
      height: 170,
      // `spaceBetween` puts the last column flush against the right edge, so a
      // centred axis label under it ran off the card. The y-axis gutter had the
      // slack to pay for it — its widest label is four digits at 10pt.
      child: Padding(
        padding: const EdgeInsets.only(right: 14),
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
                color: KalloColors.borderBiscotti40,
                strokeWidth: 1,
                dashArray: [4, 4],
              ),
            ),
            borderData: FlBorderData(show: false),
            titlesData: FlTitlesData(
              topTitles:
                  const AxisTitles(sideTitles: SideTitles(showTitles: false)),
              rightTitles:
                  const AxisTitles(sideTitles: SideTitles(showTitles: false)),
              leftTitles: kcalAxisTitles(step: step, maxLabel: axis.maxLabel),
              bottomTitles: bucketAxisTitles(
                labels: tickLabels,
                todayIndex: todayIndex,
                selectedIndex: selectedIndex,
              ),
            ),
            barGroups: groups,
          ),
        ),
      ),
    );
  }
}
