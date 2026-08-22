import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

/// The most-recent-weight dot: a faint accent halo behind a white-ringed accent
/// dot (mirrors the web chart's emphasized "today" point).
class TodayDotPainter extends FlDotPainter {
  const TodayDotPainter({required this.color});

  final Color color;

  @override
  void draw(Canvas canvas, FlSpot spot, Offset offset) {
    canvas.drawCircle(offset, 9, Paint()..color = color.withValues(alpha: 0.18));
    canvas.drawCircle(offset, 4.5, Paint()..color = color);
    canvas.drawCircle(
      offset,
      4.5,
      Paint()
        ..color = Colors.white
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
