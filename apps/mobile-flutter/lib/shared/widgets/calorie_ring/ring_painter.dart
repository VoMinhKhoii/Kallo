import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../theme/kallo_colors.dart';

/// Draws the track circle, the consumed arc and — past 1.0 — the overflow arc.
/// Public only so the test can read the swept [ratio] off the render tree.
@visibleForTesting
class CalorieRingPainter extends CustomPainter {
  CalorieRingPainter({required this.ratio, required this.strokeWidth});

  final double ratio;
  final double strokeWidth;

  static const double _start = -math.pi / 2; // 12 o'clock.

  @override
  void paint(Canvas canvas, Size size) {
    // RN: radius 46 in a 100-unit viewbox → scale to the rendered size.
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (46 / 100) * size.width;
    final rect = Rect.fromCircle(center: center, radius: radius);

    final track = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..color = KalloColors.track;
    canvas.drawCircle(center, radius, track);

    if (ratio <= 0) return;

    final base = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round
      ..color = KalloColors.accent;
    canvas.drawArc(
      rect,
      _start,
      2 * math.pi * ratio.clamp(0, 1).toDouble(),
      false,
      base,
    );

    // Over target — the overflow arc continues in offTarget @ ~40% alpha.
    if (ratio > 1) {
      final overflow = (ratio - 1).clamp(0, 1).toDouble();
      final over = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.round
        ..color = KalloColors.offTarget.withValues(alpha: 0.4);
      canvas.drawArc(rect, _start, 2 * math.pi * overflow, false, over);
    }
  }

  @override
  bool shouldRepaint(CalorieRingPainter old) =>
      old.ratio != ratio || old.strokeWidth != strokeWidth;
}
