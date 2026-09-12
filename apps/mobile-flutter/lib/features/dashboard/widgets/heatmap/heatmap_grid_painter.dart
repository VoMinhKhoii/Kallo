/// The adherence heatmap's cell grid, painted as one [CustomPainter] (the web
/// SVG `<Rect>` grid) with the per-cell wave reveal baked in.
///
/// Split out of `adherence_heatmap.dart` so the card widget stays about layout
/// and the painting rules live on their own.
library;

import 'package:flutter/material.dart';

import '../../../../models/profile/dashboard.dart';
import '../../../../theme/kallo_colors.dart';
import '../../logic/heatmap_colors.dart';

const double _cellRadius = 3; // rounded-[3px]

/// The cheat day's fill: the onboarding aurora's two hues, poured VERTICALLY
/// and washed to 0.92.
///
/// Deliberately not `KalloGradients.brandSweep` — that is diagonal at full
/// opacity and belongs to the tab bar's `+`, the app's one always-present
/// create affordance. Sharing it would put the create gesture's signature on a
/// history cell. Same family, different axis and weight.
///
/// Being the only gradient on the grid is what lets the cheat cell drop the
/// ring and the centre dot it used to need: nothing else here shimmers, so
/// nothing else can be mistaken for it.
const LinearGradient _cheatGradient = LinearGradient(
  begin: Alignment.topCenter,
  end: Alignment.bottomCenter,
  colors: [Color(0xEBFFD2B0), Color(0xEBDCC4FF)],
);

/// One cell's paint: a flat fill, or a gradient, plus an optional ring.
///
/// Four kinds of cell, and only one of them carries a ring — the day that is
/// waiting on the user. Everything else is fill alone, which is what keeps the
/// grid readable at the 15px cell an iPhone SE draws.
({Color? fill, Gradient? gradient, Color? stroke}) _cellRectProps(
  HeatmapCell? cell,
) {
  final ratio = cell?.ratio;
  final isLogged = cell?.status == HeatmapCellStatus.logged && ratio != null;

  if (isLogged) {
    if (cell!.hasCheatMeal) {
      return (fill: HeatmapColors.cheatFill, gradient: _cheatGradient, stroke: null);
    }
    return (
      fill: getHeatmapColor(ratio).bg ?? HeatmapColors.scaleAt(HeatmapColors.empty),
      gradient: null,
      stroke: null,
    );
  }

  // Logged but under the gate and not yet attested: the one actionable cell, so
  // the one with a ring. Its wash is above `empty` because at 15px a 1px ring
  // on an 8% interior is the only thing separating it from a blank day.
  if (cell?.status == HeatmapCellStatus.partial) {
    return (
      fill: HeatmapColors.scaleAt(HeatmapColors.awaiting),
      gradient: null,
      stroke: KalloColors.textMuted,
    );
  }

  // Unlogged, future and out-of-range all land here. The user does not need to
  // tell them apart on the grid — none of them is a reading — and collapsing
  // them keeps the empty state one material instead of two greys.
  return (
    fill: HeatmapColors.scaleAt(HeatmapColors.empty),
    gradient: null,
    stroke: null,
  );
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

        // Solid fill; cellAlpha is only the per-cell reveal fade (→ 1). A
        // gradient cell paints its flat base first so the wash has something
        // warm underneath rather than compositing onto the card.
        fillPaint.shader = null;
        if (props.fill != null) {
          fillPaint.color = props.fill!.withValues(
            alpha: props.fill!.a * cellAlpha,
          );
          canvas.drawRRect(rrect, fillPaint);
        }
        if (props.gradient != null) {
          fillPaint.color = Colors.white.withValues(alpha: cellAlpha);
          fillPaint.shader = props.gradient!.createShader(rect);
          canvas.drawRRect(rrect, fillPaint);
          fillPaint.shader = null;
        }

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
