import 'package:easy_localization/easy_localization.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../models/nutrition.dart';
import '../../../theme/nham_colors.dart';
import '../logic/format_date.dart';
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
  const MacroTrendChart({super.key, required this.daySeries});

  final NutritionDaySeries daySeries;

  NutrientDaySeries? _seriesFor(String metric) =>
      daySeries.series.where((s) => s.metric == metric).firstOrNull;

  @override
  Widget build(BuildContext context) {
    final p = _seriesFor('protein');
    final c = _seriesFor('carbohydrate');
    final f = _seriesFor('fat');

    // All metrics share the same bucket axis; fall back to whichever exists.
    final buckets = (p ?? c ?? f)?.buckets ?? const <DaySeriesBucket>[];
    if (buckets.length < 2) return const SizedBox.shrink();

    double? raw(NutrientDaySeries? s, int i) =>
        s != null && i < s.buckets.length ? s.buckets[i].value : null;

    final protein = kCompositionColors['protein']!;
    final carbs = kCompositionColors['carbohydrate']!;
    final fat = kCompositionColors['fat']!;

    // Fewer, fatter columns for the 7-day view; slimmer ones for the busier
    // weekly axes (5 buckets at 30d, 13 at 90d) so they don't crowd.
    final barWidth = buckets.length <= 7 ? 18.0 : 10.0;

    final groups = <BarChartGroupData>[];
    var maxY = 0.0;
    for (var i = 0; i < buckets.length; i++) {
      final rp = raw(p, i);
      final rc = raw(c, i);
      final rf = raw(f, i);

      // Null on all three = the bucket held no in-scope days, because the day
      // was set aside as partial under the "complete days" scope. That is "no
      // data", not "ate nothing": no stack bands, and it must not pull `maxY`.
      //
      // The group keeps a zero rod rather than an empty rod list. An empty list
      // reports `BarChartGroupData.width == 0`, and `spaceBetween` lays groups
      // out from their widths — so a gap would shift every column after it off
      // the grid its axis labels sit on. A zero-height rod paints nothing and
      // holds the slot.
      if (rp == null && rc == null && rf == null) {
        groups.add(
          BarChartGroupData(
            x: i,
            barRods: [BarChartRodData(toY: 0, width: barWidth)],
          ),
        );
        continue;
      }

      // A null on only SOME macros inside a bucket that does have days is a
      // genuine zero for that macro.
      final pk = (rp ?? 0) * kKcalPerGram['protein']!;
      final ck = (rc ?? 0) * kKcalPerGram['carbohydrate']!;
      final fk = (rf ?? 0) * kKcalPerGram['fat']!;
      final total = pk + ck + fk;
      if (total > maxY) maxY = total;
      groups.add(
        BarChartGroupData(
          x: i,
          barRods: [
            BarChartRodData(
              toY: total,
              width: barWidth,
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(4)),
              // Stacked P/C/F kcal bands, matching the legend order & colors.
              rodStackItems: [
                BarChartRodStackItem(0, pk, protein),
                BarChartRodStackItem(pk, pk + ck, carbs),
                BarChartRodStackItem(pk + ck, total, fat),
              ],
            ),
          ],
        ),
      );
    }
    if (maxY <= 0) return const SizedBox.shrink();

    final tickLabels = buildBucketTickLabels(
      [for (final b in buckets) b.startDate],
      daySeries.unit,
      context.locale.toString(),
    );

    // Axis always reaches at least 3000 kcal so the 2500 / 3000 guides show,
    // and grows past that if intake exceeds it.
    final axisTarget = maxY > 3000 ? maxY : 3000.0;
    final step = _niceStep(axisTarget);
    final maxLabel = (axisTarget / step).ceil() * step;
    final topY = maxLabel + step * 0.35; // headroom so the top label isn't clipped

    return SizedBox(
      height: 248,
      child: BarChart(
        BarChartData(
          minY: 0,
          maxY: topY,
          alignment: BarChartAlignment.spaceBetween,
          barTouchData: BarTouchData(enabled: false),
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
                  return Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text(
                      label,
                      style: dashEyebrow(color: kInkMuted)
                          .copyWith(letterSpacing: 0.4),
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

  /// A round kcal gridline step giving ~3–5 lines across the data range.
  static double _niceStep(double maxV) {
    const steps = [250.0, 500.0, 1000.0, 1500.0, 2000.0];
    // <= 6 so a ~3000 axis keeps a 500 step (shows 2500 and 3000), not 1000.
    for (final s in steps) {
      if (maxV / s <= 6) return s;
    }
    return 2500;
  }

}
