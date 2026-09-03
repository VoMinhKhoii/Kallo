/// The week strip cell's calorie ring.
///
/// Its own file because `week_day_cell.dart` is one widget per file like every
/// other widget here — the cell composes this painter, it does not contain it.
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../theme/kallo_colors.dart';

/// A small progress ring: a faint track + a rounded arc swept clockwise from 12
/// o'clock for [fraction] of the circle, in the heatmap tier [arcColor].
class WeekDayRingPainter extends CustomPainter {
  WeekDayRingPainter({
    required this.fraction,
    required this.arcColor,
    required this.showTrack,
  });

  final double fraction;
  final Color? arcColor;
  final bool showTrack;

  static const double _stroke = 2.5;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (size.width - _stroke) / 2;

    if (showTrack) {
      canvas.drawCircle(
        center,
        radius,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = _stroke
          ..color = KalloColors.track, // same grey track as the calorie ring,
        // so the accent progress arc reads clearly
      );
    }

    if (arcColor != null && fraction > 0) {
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        -math.pi / 2, // 12 o'clock
        2 * math.pi * fraction,
        false,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = _stroke
          ..strokeCap = StrokeCap.round
          ..color = arcColor!,
      );
    }
  }

  @override
  bool shouldRepaint(WeekDayRingPainter old) =>
      old.fraction != fraction ||
      old.arcColor != arcColor ||
      old.showTrack != showTrack;
}
