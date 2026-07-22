import 'package:easy_localization/easy_localization.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../models/nutrition.dart';
import '../../../theme/nham_colors.dart';
import '../logic/rhythm_logic.dart';

/// A stacked **bar** chart of macro **calories** per bucket (day for 7d, week
/// for 30d): total bar height = that bucket's calories, each stacked segment =
/// the energy from protein / carbs / fat. Reads the overview `daySeries` directly.
///
/// One rounded column per bucket, split into three regions filled with the warm
/// macro tokens that match the `DaySummary` legend.
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

    double g(NutrientDaySeries? s, int i) =>
        (s != null && i < s.buckets.length ? s.buckets[i].value : null) ?? 0;

    final protein = kCompositionColors['protein']!;
    final carbs = kCompositionColors['carbohydrate']!;
    final fat = kCompositionColors['fat']!;

    // Fewer, fatter columns for the 7-day view; slimmer ones for the busier
    // 30-day (weekly) axis so they don't crowd.
    final barWidth = buckets.length <= 7 ? 18.0 : 10.0;

    final groups = <BarChartGroupData>[];
    var maxY = 0.0;
    for (var i = 0; i < buckets.length; i++) {
      final pk = g(p, i) * kKcalPerGram['protein']!;
      final ck = g(c, i) * kKcalPerGram['carbohydrate']!;
      final fk = g(f, i) * kKcalPerGram['fat']!;
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
                  if (i < 0 || i >= buckets.length) {
                    return const SizedBox.shrink();
                  }
                  return Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text(
                      _label(buckets[i].startDate, daySeries.unit,
                          context.locale.toString()),
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

  /// Day buckets → weekday initial; week buckets → "d/M" of the week start.
  static String _label(String startDate, String unit, String locale) {
    final d = DateTime.tryParse(startDate);
    if (d == null) return '';
    if (unit == 'week') return DateFormat('d/M', locale).format(d);
    // Vietnamese convention: weekday number for Mon–Sat, "CN" for Sunday.
    // The first grapheme of vi short weekdays ("Th 2".."Th 7"/"CN") yields six
    // indistinct "T"s, so use the numeric scheme instead (matches the web chart).
    if (locale.startsWith('vi')) {
      return d.weekday == DateTime.sunday ? 'CN' : (d.weekday + 1).toString();
    }
    return DateFormat('E', locale).format(d).characters.first;
  }
}
