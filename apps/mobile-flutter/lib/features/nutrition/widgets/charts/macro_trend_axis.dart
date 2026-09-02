/// The macro trend chart's two labelled axes.
///
/// Split out from `MacroTrendChart` because labelling an axis and building the
/// bars are separate jobs: these two functions decide which ticks get text and
/// how it reads, and never touch the data. Mirrors the web chart's `renderTick`
/// and `YAxis` config (keep in sync).
library;

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';

/// kcal gridline labels, right-aligned in the gutter. Ticks at or below zero
/// and above the top labelled line stay bare — the axis line itself carries no
/// number, and `topY` sits above `maxLabel` purely as headroom.
AxisTitles kcalAxisTitles({required double step, required double maxLabel}) {
  return AxisTitles(
    sideTitles: SideTitles(
      showTitles: true,
      interval: step,
      // Four digits at 12pt plus the 6pt gap. Sized generously on purpose: at
      // 28 "3000" wrapped to two lines, which is far uglier than a slightly
      // wide gutter.
      reservedSize: 38,
      getTitlesWidget: (value, meta) {
        if (value <= 0 || value > maxLabel) return const SizedBox.shrink();
        return Padding(
          padding: const EdgeInsets.only(right: 6),
          child: Text(
            value.round().toString(),
            textAlign: TextAlign.right,
            // Belt and braces: a five-digit tick would otherwise wrap too.
            maxLines: 1,
            softWrap: false,
            overflow: TextOverflow.visible,
            // Meta 12, like every other caption on the page — 10 was below
            // the ramp's floor and the axis read as fine print.
            style: dashMeta(),
          ),
        );
      },
    ),
  );
}

/// Bucket labels, one slot per column. `labels` is already thinned — an empty
/// string means the axis stays bare there — so this only has to render.
AxisTitles bucketAxisTitles({
  required List<String> labels,
  required int todayIndex,
  required int? selectedIndex,
}) {
  return AxisTitles(
    sideTitles: SideTitles(
      showTitles: true,
      reservedSize: 22,
      interval: 1,
      getTitlesWidget: (value, meta) {
        final i = value.round();
        if (i < 0 || i >= labels.length) return const SizedBox.shrink();
        final label = labels[i];
        if (label.isEmpty) return const SizedBox.shrink();
        // 500 is this palette's weight ceiling — today reads heavier than its
        // neighbours without becoming a second heading.
        final emphasised = i == todayIndex || i == selectedIndex;
        return Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Text(
            label,
            style: dashMeta(
              color: emphasised ? kInk : kInkMuted,
            ),
          ),
        );
      },
    ),
  );
}
