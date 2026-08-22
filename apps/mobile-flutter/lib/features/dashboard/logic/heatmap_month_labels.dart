/// Month-strip layout for the adherence heatmap.
///
/// The server emits one header per month with a `startColumn`/`span` in week
/// columns. Those are *not* safe to position blindly: a Monday-anchored week
/// column straddles the month boundary, so a 1–2 day sliver month shares its
/// `startColumn` with the next month and the two labels paint on top of each
/// other. A week column is only ~10–20px wide while a month name is ~22–40px,
/// so even non-colliding slivers overflow their span.
///
/// This resolves both: headers are walked in calendar order, each one is
/// shifted right past the previous label, and any header too narrow to carry
/// its name (or pushed off the end of the grid) is dropped instead of drawn.
library;

import 'dart:math' as math;

import 'package:flutter/painting.dart';

import '../../../models/profile/dashboard.dart';

/// A month header with a resolved, collision-free position.
class MonthLabelBox {
  const MonthLabelBox({
    required this.month,
    required this.left,
    required this.width,
  });

  final String month;
  final double left; // grid-local x of the label's left edge
  final double width; // painted width (never wider than the grid's remainder)
}

/// A month must own at least this many week columns to be worth labelling.
const int kMinLabelColumns = 2;

/// Minimum breathing room between two neighbouring month labels.
const double _labelGapPx = 6;

List<MonthLabelBox> layoutMonthLabels({
  required List<HeatmapMonthHeader> headers,
  required double cellSize,
  required double gap,
  required double gridWidth,
  required TextStyle style,
  required String locale,
  required TextScaler textScaler,
}) {
  if (headers.isEmpty || gridWidth <= 0) return const [];

  final step = cellSize + gap;
  final boxes = <MonthLabelBox>[];
  var freeColumn = 0;
  var freeX = 0.0;

  for (final header in headers) {
    // Clip the header against the columns the previous label already claimed.
    final startColumn = math.max(header.startColumn, freeColumn);
    final columns = header.startColumn + header.span - startColumn;
    if (columns < kMinLabelColumns) continue;

    final label = header.label(locale);
    final textWidth = _measure(label, style, textScaler);
    final spanWidth = columns * cellSize + (columns - 1) * gap;
    // Too narrow to label: the name would spill more than one column past the
    // month's own columns and read as belonging to its neighbour.
    if (textWidth > spanWidth + step) continue;

    final left = math.max(startColumn * step, freeX);
    if (left + textWidth > gridWidth) continue; // would run off the grid

    boxes.add(
      MonthLabelBox(
        month: label,
        left: left,
        // +1px so the measured text never ellipsizes on a rounding edge.
        width: math.min(textWidth + 1, gridWidth - left),
      ),
    );
    freeColumn = startColumn + columns;
    freeX = left + textWidth + _labelGapPx;
  }

  return boxes;
}

double _measure(String text, TextStyle style, TextScaler textScaler) {
  final painter = TextPainter(
    text: TextSpan(text: text, style: style),
    textDirection: TextDirection.ltr,
    textScaler: textScaler,
    maxLines: 1,
  )..layout();
  final width = painter.width;
  painter.dispose();
  return width;
}
