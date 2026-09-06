/// Axis maths for the dashboard weight chart ([WeightChartCanvas]).
///
/// Pure: no widgets, no providers — just the Y domain and the x tick labels,
/// so both can be reasoned about (and eyeballed) without a chart on screen.
library;

import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/painting.dart';

import '../../../theme/text_metrics.dart';

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
  // No series, no domain — `reduce` below would throw on an empty list. The
  // chart guards the empty case before it paints, but this is a public pure
  // function that exists to be called (and tested) on its own, so it answers
  // for itself: the same band a single point at zero would get.
  if (values.isEmpty) return niceYAxis(const [0]);
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

  // One logged weight: that day IS the axis, so label it with its own date
  // rather than the placeholder "Start" — which named a range the chart does
  // not have. Falling back to "Now" keeps the single tick meaningful on an
  // older server that sends no dates. It runs the same width guard as every
  // other tick count: a label the plot cannot hold is dropped, not clipped.
  if (pointCount == 1) {
    final parsed = hasDates ? DateTime.tryParse(dates[0]) : null;
    final labels = {
      0: parsed != null ? format.format(parsed) : tr('dashboard.now'),
    };
    return fits(labels) ? labels : const {};
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

/// Between a Y bound label and the plot it scales — the same breathing room
/// the x tick thinning keeps between neighbouring date labels.
const double kWeightAxisGap = 6;

/// The width the Y axis needs on the LEFT: the wider of the domain's two bound
/// labels, plus [kWeightAxisGap].
///
/// Reserved rather than overlaid. The bounds used to sit against the RIGHT
/// edge precisely so they would not land on the line, which is drawn from the
/// left — but a Y axis on the right is not where a reader looks for it, and
/// that trade was the wrong way round. The plot gives up the width instead.
double weightYAxisGutter(
  String maxLabel,
  String minLabel,
  TextStyle style,
  TextScaler textScaler,
) =>
    math.max(
      _measure(maxLabel, style, textScaler),
      _measure(minLabel, style, textScaler),
    ) +
    kWeightAxisGap;

/// One Y bound, at the precision the domain's [step] warrants.
String weightBoundLabel(double value, double step) =>
    step >= 1 ? value.toStringAsFixed(0) : value.toStringAsFixed(1);

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

/// Floor for the date row: the ticks' lead plus a 12pt line box. It is a FLOOR
/// only — [weightDateAxisHeight] measures the real one, because this constant
/// was sized for the retired 12pt meta tier and silently clipped the current
/// 14 × 1.25 line box (and every scaled-up variant of it).
const double _minDateAxisHeight = 22;

/// Between a tick label and the plot above it. fl_chart's own default is 8,
/// which pushed the row past the artboard's date band.
const double kWeightDateTickLead = 4;

/// The height the date row needs for [style] at [scaler]: the label's own line
/// box plus its lead, never below [_minDateAxisHeight].
double weightDateAxisHeight(TextStyle style, TextScaler scaler) => math.max(
  _minDateAxisHeight,
  kWeightDateTickLead + lineBoxHeight(style, scaler),
);
