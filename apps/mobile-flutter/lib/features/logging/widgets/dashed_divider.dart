import 'package:flutter/material.dart';

/// A 1px horizontal dashed rule — the RN `borderTop` rows use
/// `borderStyle: 'dashed'`, which Flutter's [Border] cannot express, so this
/// paints the dashes directly.
class DashedDivider extends StatelessWidget {
  const DashedDivider({
    super.key,
    required this.color,
    this.dashWidth = 3,
    this.dashGap = 3,
    this.thickness = 1,
  });

  final Color color;
  final double dashWidth;
  final double dashGap;
  final double thickness;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: thickness,
      width: double.infinity,
      child: CustomPaint(
        painter: _DashedLinePainter(
          color: color,
          dashWidth: dashWidth,
          dashGap: dashGap,
          thickness: thickness,
        ),
      ),
    );
  }
}

class _DashedLinePainter extends CustomPainter {
  _DashedLinePainter({
    required this.color,
    required this.dashWidth,
    required this.dashGap,
    required this.thickness,
  });

  final Color color;
  final double dashWidth;
  final double dashGap;
  final double thickness;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = thickness;
    double x = 0;
    final y = size.height / 2;
    while (x < size.width) {
      canvas.drawLine(Offset(x, y), Offset(x + dashWidth, y), paint);
      x += dashWidth + dashGap;
    }
  }

  @override
  bool shouldRepaint(_DashedLinePainter old) =>
      old.color != color ||
      old.dashWidth != dashWidth ||
      old.dashGap != dashGap ||
      old.thickness != thickness;
}
