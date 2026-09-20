/// WeightChartCanvas — the weight card's trend chart.
///
/// Native pass (2026-08-31): an unframed plot the inner width of the card
/// (334 on a 390pt phone), dashed hairline gridlines, the Y domain's two
/// bounds in a narrow LEFT gutter (2026-09-01, back from the right), date
/// ticks below ("2/8" … "Now"), a short dotted forecast tail, a faint "today"
/// marker, and a dot at every logged point with the most recent emphasized.
///
/// Readings are plotted at their CALENDAR DAY, not their list position, so a
/// week without a weigh-in draws as a week — see [weightDayOffsets].
///
/// The forecast (`projectedEndWeight` / `canProject`) is computed once
/// server-side and passed in as data — the chart only positions and draws it.
/// Axis maths (Y domain + x tick labels) lives in `logic/weight_chart_axis.dart`;
/// the line, dots and touch behaviour live in `weight_chart_series.dart`.
library;

import 'dart:math' as math;

import 'package:easy_localization/easy_localization.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../../../../theme/kallo_colors.dart';
import '../../../../theme/calm_tokens.dart';
import '../../logic/weight_chart_axis.dart';
import 'weight_chart_series.dart';
import 'weight_chart_titles.dart';

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
    this.emptyAnchor,
  });

  final List<double> weights;

  /// `YYYY-MM-DD` strings parallel to [weights]; empty on an older server, in
  /// which case the x axis degrades to "Start"/"Now".
  final List<String> weightDates;
  final int? periodElapsedDays;
  final double projectedEndWeight;
  final bool canProject;

  /// Centres the Y band when nothing is logged yet — the profile weight, which
  /// is a plausible scale to show an empty plot against but is NOT a reading.
  final double? emptyAnchor;

  @override
  Widget build(BuildContext context) {
    final isEmpty = weights.isEmpty;
    final kg = tr('dashboard.units.kg');
    final isSinglePoint = weights.length == 1;
    final lastIndex = weights.length - 1;
    // `canProject` already implies ≥3 logged points (computed server-side in
    // buildWeightTrendSummary), so it alone gates the forecast tail.
    final showForecast = canProject && !isEmpty;

    final offsets = weightDayOffsets(weightDates, weights.length);
    final lastOffset = isEmpty ? 0 : offsets[lastIndex];

    // Forecast x-position. The proportional projection can run far past the data
    // when the period is early; cap it so the logged data always spans at least
    // ~80% of the width (a short dotted tail) instead of being squashed.
    final hasElapsed = periodElapsedDays != null && periodElapsedDays! > 0;
    final elapsed =
        hasElapsed ? periodElapsedDays! : (lastOffset > 0 ? lastOffset : 1);
    final naturalForecastDay =
        lastOffset + (lastOffset * (_rangeDays - elapsed)) / elapsed;
    final forecastDay =
        showForecast
            ? math.min(naturalForecastDay, lastOffset / 0.8)
            : lastOffset.toDouble();

    // An empty chart still draws its frame — gridlines, both axes and a
    // plausible band — so the card reads as "nothing logged yet" rather than as
    // a component that failed to render. The message sits over it.
    final anchor = emptyAnchor ?? 70;
    final axis = niceYAxis(
      isEmpty
          ? [anchor - 1, anchor + 1]
          : [...weights, if (showForecast) projectedEndWeight],
    );
    final yStep = axis.step;
    // One point: centre it. The lone spot sits at x = 0, so a 0…1 domain
    // pinned it (and its tick label) against the plot's left edge with the
    // label's own width hanging outside; a symmetric −0.5…0.5 puts both in the
    // middle. The "today" VerticalLine at lastOffset (= 0) stays inside it.
    final minX = isSinglePoint ? -0.5 : 0.0;
    final maxX =
        isSinglePoint
            ? 0.5
            : (isEmpty ? (_rangeDays - 1).toDouble() : forecastDay);

    final series = buildWeightSeries(
      spots: [
        for (var i = 0; i < weights.length; i++)
          FlSpot(offsets[i].toDouble(), weights[i]),
      ],
      forecast:
          showForecast
              ? [
                FlSpot(lastOffset.toDouble(), weights.last),
                FlSpot(forecastDay, projectedEndWeight),
              ]
              : null,
      kg: kg,
    );

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
          final gutter = weightYAxisGutter(
            maxLabel,
            minLabel,
            axisLabel,
            scaler,
          );
          final plotWidth = math.max(constraints.maxWidth - gutter, 1.0);
          final xLabels =
              isEmpty
                  ? {
                    0: tr('dashboard.start'),
                    _rangeDays - 1: tr('dashboard.now'),
                  }
                  : weightXTickLabels(
                    pointCount: weights.length,
                    offsets: offsets,
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
                  if (!isEmpty)
                    VerticalLine(
                      x: lastOffset.toDouble(),
                      color: KalloColors.accent.withValues(alpha: 0.35),
                      strokeWidth: 1,
                    ),
                ],
              ),
              lineTouchData: series.touch,
              lineBarsData: series.bars,
            ),
            // Matches the web chart's 800ms; the old 1500 outlasted the card's
            // own entrance and made every widget test pumpAndSettle for it.
            duration: const Duration(milliseconds: 800),
            curve: Curves.easeInOut,
          );

          // The bounds sit in the gutter, level with the plot's top and
          // bottom; plot, gridlines and date row share one left edge.
          final plot = Stack(
            children: [
              Positioned.fill(left: gutter, child: chart),
              Positioned(
                top: 0,
                left: 0,
                child: Text(maxLabel, style: axisLabel),
              ),
              Positioned(
                bottom: dateAxisHeight,
                left: 0,
                child: Text(minLabel, style: axisLabel),
              ),
            ],
          );

          // The bare frame reads as "nothing logged yet" on sight. A screen
          // reader gets no frame, so the prompt becomes the plot's label
          // rather than a line of copy over it. `container` is what makes the
          // node exist — a label alone on non-semantic children is dropped.
          return isEmpty
              ? Semantics(
                container: true,
                label: tr('dashboard.noWeightData'),
                child: plot,
              )
              : plot;
        },
      ),
    );
  }
}
