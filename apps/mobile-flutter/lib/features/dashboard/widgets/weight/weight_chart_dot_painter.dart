import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';

/// The most-recent-weight dot: a faint accent halo behind an accent dot ringed
/// in the card it sits on (mirrors the web chart's emphasized "today" point).
class TodayDotPainter extends FlDotPainter {
  const TodayDotPainter({required this.color});

  final Color color;

  @override
  void draw(Canvas canvas, FlSpot spot, Offset offset) {
    canvas.drawCircle(
      offset,
      9,
      Paint()..color = color.withValues(alpha: 0.18),
    );
    canvas.drawCircle(offset, 5, Paint()..color = color);
    canvas.drawCircle(
      offset,
      5,
      Paint()
        ..color = kCardSurface
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );
  }

  @override
  Size getSize(FlSpot spot) => const Size(18, 18);

  @override
  Color get mainColor => color;

  @override
  FlDotPainter lerp(FlDotPainter a, FlDotPainter b, double t) => b;

  @override
  List<Object?> get props => [color];
}
