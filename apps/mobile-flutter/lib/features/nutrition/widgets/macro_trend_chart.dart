import 'package:easy_localization/easy_localization.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../models/nutrition.dart';
import '../../../theme/nham_colors.dart';
import '../logic/rhythm_logic.dart';

/// A stacked line-area chart of macro **calories** per bucket (day for 7d, week
/// for 30d): total height = that bucket's calories, each band's thickness = the
/// energy from protein / carbs / fat. Reads the overview `daySeries` directly.
///
/// Curved (line-area, never columns), filled with the warm macro tokens that
/// match the `DaySummary` legend.
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

    final zero = <FlSpot>[];
    final cum1 = <FlSpot>[]; // protein kcal
    final cum2 = <FlSpot>[]; // + carbs
    final cum3 = <FlSpot>[]; // + fat (total)
    var maxY = 0.0;
    for (var i = 0; i < buckets.length; i++) {
      final pk = g(p, i) * kKcalPerGram['protein']!;
      final ck = g(c, i) * kKcalPerGram['carbohydrate']!;
      final fk = g(f, i) * kKcalPerGram['fat']!;
      final x = i.toDouble();
      zero.add(FlSpot(x, 0));
      cum1.add(FlSpot(x, pk));
      cum2.add(FlSpot(x, pk + ck));
      cum3.add(FlSpot(x, pk + ck + fk));
      if (pk + ck + fk > maxY) maxY = pk + ck + fk;
    }
    if (maxY <= 0) return const SizedBox.shrink();

    LineChartBarData band(List<FlSpot> spots, {Color? stroke}) =>
        LineChartBarData(
          spots: spots,
          isCurved: true,
          curveSmoothness: 0.28,
          preventCurveOverShooting: true,
          barWidth: stroke == null ? 0 : 1.5,
          color: stroke ?? Colors.transparent,
          dotData: const FlDotData(show: false),
        );

    final protein = kCompositionColors['protein']!;
    final carbs = kCompositionColors['carbohydrate']!;
    final fat = kCompositionColors['fat']!;

    // Axis always reaches at least 3000 kcal so the 2500 / 3000 guides show,
    // and grows past that if intake exceeds it.
    final axisTarget = maxY > 3000 ? maxY : 3000.0;
    final step = _niceStep(axisTarget);
    final maxLabel = (axisTarget / step).ceil() * step;
    final topY = maxLabel + step * 0.35; // headroom so the top label isn't clipped

    return SizedBox(
      height: 248,
      child: LineChart(
        LineChartData(
          minX: 0,
          maxX: (buckets.length - 1).toDouble(),
          minY: 0,
          maxY: topY,
          lineTouchData: const LineTouchData(enabled: false),
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
          // Fills between the stacked cumulative lines.
          betweenBarsData: [
            BetweenBarsData(fromIndex: 0, toIndex: 1, color: protein.withValues(alpha: 0.85)),
            BetweenBarsData(fromIndex: 1, toIndex: 2, color: carbs.withValues(alpha: 0.85)),
            BetweenBarsData(fromIndex: 2, toIndex: 3, color: fat.withValues(alpha: 0.85)),
          ],
          lineBarsData: [
            band(zero),
            band(cum1),
            band(cum2),
            band(cum3, stroke: NhamColors.text.withValues(alpha: 0.28)),
          ],
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
    return DateFormat('E', locale).format(d).characters.first;
  }
}
