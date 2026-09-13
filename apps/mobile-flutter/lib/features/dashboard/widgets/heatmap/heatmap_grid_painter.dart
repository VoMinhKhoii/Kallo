/// The adherence heatmap's cell grid, painted as one [CustomPainter] (the web
/// SVG `<Rect>` grid) with the per-cell wave reveal baked in.
///
/// Split out of `adherence_heatmap.dart` so the card widget stays about layout
/// and the painting rules live on their own.
library;

import 'package:flutter/material.dart';

import '../../../../models/profile/dashboard.dart';
import '../../logic/heatmap_colors.dart';

/// Which kind of cell this is. The APPEARANCE of each kind lives in
/// `logic/heatmap_colors.dart`, where the legend reads the same definitions —
/// this function only classifies.
HeatmapCellPaint _cellRectProps(HeatmapCell? cell) {
  final ratio = cell?.ratio;
  if (cell?.status == HeatmapCellStatus.logged && ratio != null) {
    return cell!.hasCheatMeal
        ? HeatmapCellPaints.cheat
        : HeatmapCellPaints.tier(heatmapTierFor(ratio));
  }
  if (cell?.status == HeatmapCellStatus.partial) {
    return HeatmapCellPaints.awaiting;
  }
  return HeatmapCellPaints.empty;
}

class HeatmapGridPainter extends CustomPainter {
  HeatmapGridPainter({
    required this.data,
    required this.numWeeks,
    required this.sq,
    required this.step,
    required this.reveal,
    required this.totalMs,
  });

  final HeatmapData? data;
  final int numWeeks;
  final double sq;
  final double step;

  /// Global reveal progress 0→1 across the whole stagger timeline.
  final double reveal;
  final int totalMs;

  // Per-cell tween window (web: duration 0.16s) and stagger increments.
  static const double _cellMs = 160;
  static const double _weekStaggerMs = 10; // wi * 0.01s
  static const double _dayStaggerMs = 5; // di * 0.005s

  @override
  void paint(Canvas canvas, Size size) {
    final fillPaint = Paint()..style = PaintingStyle.fill;
    final strokePaint =
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1;

    final elapsed = reveal * totalMs;

    for (var wi = 0; wi < numWeeks; wi++) {
      for (var di = 0; di < 7; di++) {
        // Local progress for this cell, eased.
        final delay = wi * _weekStaggerMs + di * _dayStaggerMs;
        final raw = ((elapsed - delay) / _cellMs).clamp(0.0, 1.0);
        final p = Curves.easeOut.transform(raw);
        if (p <= 0) continue;
        final scale = 0.6 + 0.4 * p; // scale 0.6 → 1
        final cellAlpha = p; // opacity 0 → 1

        final cell =
            (data != null &&
                    di < data!.cells.length &&
                    wi < data!.cells[di].length)
                ? data!.cells[di][wi]
                : null;
        final props = _cellRectProps(cell);

        // Scale about the cell center.
        final cx = wi * step + sq / 2;
        final cy = di * step + sq / 2;
        final half = (sq * scale) / 2;
        final rect = Rect.fromLTWH(
          cx - half,
          cy - half,
          sq * scale,
          sq * scale,
        );
        final rrect = RRect.fromRectAndRadius(
          rect,
          const Radius.circular(heatmapCellRadius),
        );

        // One pass. cellAlpha is only the per-cell reveal fade (→ 1); the
        // cheat day's wash is pre-composited into its gradient (see
        // HeatmapCellPaints.cheat), so there is no warm base to lay down first
        // and the fade applies to one layer rather than compounding across two.
        final gradient = props.gradient;
        fillPaint.shader = gradient?.createShader(rect);
        fillPaint.color =
            gradient == null
                ? props.fill.withValues(alpha: props.fill.a * cellAlpha)
                : Colors.white.withValues(alpha: cellAlpha);
        canvas.drawRRect(rrect, fillPaint);
        fillPaint.shader = null;

        if (props.stroke != null) {
          strokePaint.color = props.stroke!.withValues(alpha: cellAlpha);
          canvas.drawRRect(rrect, strokePaint);
        }
      }
    }
  }

  @override
  bool shouldRepaint(HeatmapGridPainter old) =>
      old.data != data ||
      old.numWeeks != numWeeks ||
      old.sq != sq ||
      old.step != step ||
      old.reveal != reveal ||
      old.totalMs != totalMs;
}
