import 'package:flutter/material.dart';

import '../../theme/nham_colors.dart';

/// The 56x56 sprouting-seed line mark (RN inline SVG → CustomPaint).
class SeedMark extends StatelessWidget {
  const SeedMark({super.key});

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      width: 56,
      height: 56,
      child: CustomPaint(painter: _SeedMarkPainter()),
    );
  }
}

class _SeedMarkPainter extends CustomPainter {
  const _SeedMarkPainter();

  @override
  void paint(Canvas canvas, Size size) {
    // Leaf outline.
    final outline = Path()
      ..moveTo(28, 8)
      ..cubicTo(36, 14, 40, 22, 40, 30)
      ..cubicTo(40, 40, 33, 48, 28, 48)
      ..cubicTo(23, 48, 16, 40, 16, 30)
      ..cubicTo(16, 22, 20, 14, 28, 8)
      ..close();
    final outlinePaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.25
      ..strokeJoin = StrokeJoin.round
      ..color = NhamColors.textMuted.withValues(alpha: 0.55);
    canvas.drawPath(outline, outlinePaint);

    // Dashed central vein.
    final veinPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1
      ..strokeCap = StrokeCap.round
      ..color = NhamColors.textMuted.withValues(alpha: 0.45);
    const dash = 2.0;
    const gap = 3.0;
    var y = 16.0;
    while (y < 46) {
      canvas.drawLine(Offset(28, y), Offset(28, (y + dash).clamp(0, 46)),
          veinPaint);
      y += dash + gap;
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
