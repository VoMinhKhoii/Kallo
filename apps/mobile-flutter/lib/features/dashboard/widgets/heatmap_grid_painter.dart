/// The adherence heatmap's cell grid, painted as one [CustomPainter] (the web
/// SVG `<Rect>` grid) with the per-cell wave reveal baked in.
///
/// Split out of `adherence_heatmap.dart` so the card widget stays about layout
/// and the painting rules live on their own.
library;

import 'package:flutter/material.dart';

import '../../../models/dashboard.dart';
import '../../../theme/calm_tokens.dart';
import '../logic/heatmap_colors.dart';

const double _cellRadius = 3; // rounded-[3px]

/// One cell's solid fill + optional stroke (+ centered dot for cheat days).
/// Three solid states (no fractional opacity multipliers): logged = scale
/// colour, unlogged/partial = neutral track (partial gets a hairline ring),
/// out-of-range = barely-there cream. A cheat day replaces its intensity
/// colour with the calm warm ring + fill + accent dot (web parity, never red).
({Color fill, Color? stroke, bool dot}) _cellRectProps(HeatmapCell? cell) {
  final ratio = cell?.ratio;
  final isLogged = cell?.status == HeatmapCellStatus.logged && ratio != null;
  if (isLogged) {
    if (cell!.hasCheatMeal) {
      return (
        fill: HeatmapColors.cheatFill,
        stroke: HeatmapColors.cheat,
        dot: true,
      );
    }
    return (fill: getHeatmapColor(ratio).bg ?? kTrack, stroke: null, dot: false);
  }
  final isMuted =
      cell?.status == HeatmapCellStatus.future ||
      cell?.status == HeatmapCellStatus.outside;
  if (isMuted) {
    return (fill: kPage, stroke: null, dot: false); // out-of-range
  }
  final isPartial = cell?.status == HeatmapCellStatus.partial;
  return (fill: kTrack, stroke: isPartial ? kHairline : null, dot: false);
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
          const Radius.circular(_cellRadius),
        );

        // Solid fill; cellAlpha is only the per-cell reveal fade (→ 1).
        fillPaint.color = props.fill.withValues(alpha: cellAlpha);
        canvas.drawRRect(rrect, fillPaint);

        if (props.stroke != null) {
          strokePaint.color = props.stroke!.withValues(alpha: cellAlpha);
          canvas.drawRRect(rrect, strokePaint);
        }

        // Cheat-day marker: a small centered accent dot (web's ● overlay).
        if (props.dot) {
          fillPaint.color = HeatmapColors.cheat.withValues(alpha: cellAlpha);
          canvas.drawCircle(Offset(cx, cy), (sq * scale) * 0.12, fillPaint);
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
