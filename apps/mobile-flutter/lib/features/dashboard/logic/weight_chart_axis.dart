/// Axis maths for the dashboard weight chart ([WeightChartCanvas]).
///
/// Pure: no widgets, no providers — just the Y domain and the x tick labels,
/// so both can be reasoned about (and eyeballed) without a chart on screen.
library;

import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/painting.dart';

/// A tight, uniform, round-number Y axis fitted to [values].
///
/// The series is padded *before* the bounds are snapped, so it lands roughly
/// mid-band with headroom above and below. That matters: the newest point is
/// drawn with a 9px halo and the plot is clipped (`FlClipData.all`), so a
/// series sitting exactly on `maxY` gets its emphasis dot sliced in half.
/// Widening happens in whole steps, which keeps the gridline interval and the
/// left gutter labels on round numbers.
///
/// Deliberately more generous than the web chart's axis (which has no clipped
/// halo to protect); both still bucket on the same round-number steps.
({double min, double max, double step}) niceYAxis(List<double> values) {
  final rawMin = values.reduce(math.min);
  final rawMax = values.reduce(math.max);
  final rawSpan = math.max(rawMax - rawMin, 0.5);
  // Pick the step from the *padded* span so the extra headroom doesn't double
  // the gridline count on a wide series.
  final paddedSpan = rawSpan * 1.5;
  final step = paddedSpan <= 2
      ? 0.5
      : paddedSpan <= 5
          ? 1.0
          : paddedSpan <= 12
              ? 2.0
              : 5.0;
  final pad = math.max((paddedSpan - rawSpan) / 2, step);
  var min = ((rawMin - pad) / step).floorToDouble() * step;
  var max = ((rawMax + pad) / step).ceilToDouble() * step;
  // Floor of three steps: a flat or two-point series still reads as a band
  // rather than a line pinned to an edge.
  while (max - min < step * 3 - 1e-9) {
    min -= step;
    max += step;
  }
  return (min: min, max: max, step: step);
}

/// Short numeric x tick labels keyed by point index — e.g. `6/7` … `Now`.
///
/// [dates] are the `YYYY-MM-DD` strings parallel to the plotted weights; when
/// they are missing (older server, see `WeightSummaryData.weightDates`) the
/// labels degrade to just "Start" and "Now" rather than inventing week
/// numbers. Ticks are dropped — never overlapped — until the widest label
/// fits [plotWidth] at every remaining tick.
Map<int, String> weightXTickLabels({
  required int pointCount,
  required List<String> dates,
  required String locale,
  required double plotWidth,
  required TextStyle style,
  required TextScaler textScaler,
}) {
  if (pointCount <= 0) return const {};
  if (pointCount == 1) return {0: tr('dashboard.start')};

  final hasDates = dates.length == pointCount;
  final lastIndex = pointCount - 1;

  // Numeric day/month, every locale. `DateFormat.MMMd` renders Vietnamese as
  // "6 thg 7" — three tokens for one tick, which both reads badly and eats the
  // width four ticks need. "6/7" is unambiguous at a glance and the same size
  // in every language.
  final format = DateFormat('d/M', locale);

  Map<int, String> labelsFor(int wanted) {
    final labels = <int, String>{};
    for (var i = 0; i < wanted; i++) {
      final index = (lastIndex * i / (wanted - 1)).round();
      if (labels.containsKey(index)) continue;
      if (index == lastIndex) {
        labels[index] = tr('dashboard.now');
      } else if (!hasDates) {
        if (index == 0) labels[index] = tr('dashboard.start');
      } else {
        final parsed = DateTime.tryParse(dates[index]);
        if (parsed != null) labels[index] = format.format(parsed);
      }
    }
    return labels;
  }

  bool fits(Map<int, String> labels) {
    final widest = labels.values
        .map((label) => _measure(label, style, textScaler))
        .reduce(math.max);
    // 6px of breathing room between neighbouring labels.
    return (widest + 6) * labels.length <= plotWidth;
  }

  // Without dates there is nothing to tick but the two ends.
  if (!hasDates) {
    final ends = labelsFor(2);
    return ends.length >= 2 ? ends : {lastIndex: tr('dashboard.now')};
  }

  // Aim for 5, thin only when the labels genuinely will not fit.
  for (var wanted = 5; wanted >= 2; wanted--) {
    final labels = labelsFor(wanted);
    if (labels.length < 2) continue;
    if (fits(labels) || labels.length == 2) return labels;
  }
  return {lastIndex: tr('dashboard.now')};
}

double _measure(String text, TextStyle style, TextScaler textScaler) {
  final painter = TextPainter(
    text: TextSpan(text: text, style: style),
    // `dart:ui`'s TextDirection — easy_localization re-exports intl's
    // same-named enum, which does not have `ltr`.
    textDirection: ui.TextDirection.ltr,
    textScaler: textScaler,
    maxLines: 1,
  )..layout();
  final width = painter.width;
  painter.dispose();
  return width;
}
