/// The weight chart's fl_chart title widgets.
///
/// Split out of `weight_chart_canvas.dart` (2026-09-03): the canvas is about
/// what the trend LOOKS like — line, dots, forecast tail, marker — and this is
/// how the date row's ticks are built and clamped. They changed for different
/// reasons and the file had outgrown its budget.
///
/// Only the bottom (date) axis is fl_chart's. The Y bounds are drawn by the
/// canvas as a two-label overlay in a reserved gutter, because fl_chart's left
/// titles would number every gridline instead of just the domain's ends —
/// see `logic/weight_chart_axis.dart` for the maths behind both, including the
/// date row's own height.
library;

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../../logic/weight_chart_axis.dart';

/// The chart's titles: the date row, and three suppressed sides.
///
/// [labels] is keyed by point index (from `weightXTickLabels`); an index with
/// no entry draws nothing rather than an invented tick.
FlTitlesData weightChartTitles({
  required Map<int, String> labels,
  required TextStyle style,
  required double dateAxisHeight,
}) =>
    FlTitlesData(
      show: true,
      topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
      rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
      // Only the DOMAIN's two bounds are labelled, by the canvas's overlay —
      // fl_chart's left titles would number every gridline.
      leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
      bottomTitles: AxisTitles(
        sideTitles: SideTitles(
          showTitles: true,
          reservedSize: dateAxisHeight,
          interval: 1,
          getTitlesWidget: (value, meta) {
            final i = value.round();
            final label = labels[i];
            if (label == null || (value - i).abs() > 0.01) {
              return const SizedBox.shrink();
            }
            // SideTitleWidget, not a bare Padding: `fitInside` clamps the
            // first and last tick back inside the axis box instead of letting
            // half the label hang off the plot's edge — which is exactly what
            // a single-point chart's only tick did.
            return SideTitleWidget(
              meta: meta,
              space: kWeightDateTickLead,
              fitInside: SideTitleFitInsideData.fromTitleMeta(meta),
              child: Text(label, style: style),
            );
          },
        ),
      ),
    );
