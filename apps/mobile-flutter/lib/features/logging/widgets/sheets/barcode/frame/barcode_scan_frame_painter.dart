import 'package:flutter/material.dart';

/// Dimmed surround + white corner brackets around the scan window.
///
/// White, not the signature tan (native pass, 2026-08-31): the brackets sit on
/// the `#1C1C1E` camera stage, where tan reads muddy and stops looking like a
/// camera affordance. Tan survives on light surfaces.
class ScanFramePainter extends CustomPainter {
  const ScanFramePainter({required this.scanWindow});

  final Rect scanWindow;

  @override
  void paint(Canvas canvas, Size size) {
    // Dim everything outside the window.
    final dim =
        Paint()..color = const Color(0xFF141413).withValues(alpha: 0.35);
    final frame = RRect.fromRectAndRadius(
      scanWindow,
      const Radius.circular(12),
    );
    canvas.drawPath(
      Path.combine(
        PathOperation.difference,
        Path()..addRect(Offset.zero & size),
        Path()..addRRect(frame),
      ),
      dim,
    );

    // Corner brackets, white on the dark stage.
    final bracket =
        Paint()
          ..color = const Color(0xFFFFFFFF)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 3
          ..strokeCap = StrokeCap.round;
    const len = 22.0;
    const r = 12.0;
    final w = scanWindow;

    // Simple L-brackets: two straight strokes + a rounded elbow per corner,
    // hugging the rounded frame.
    void lBracket(Offset cornerPoint, double dxSign, double dySign) {
      canvas.drawLine(
        cornerPoint + Offset(dxSign * r, 0),
        cornerPoint + Offset(dxSign * len, 0),
        bracket,
      );
      canvas.drawLine(
        cornerPoint + Offset(0, dySign * r),
        cornerPoint + Offset(0, dySign * len),
        bracket,
      );
      // The rounded elbow.
      canvas.drawArc(
        Rect.fromCircle(
          center: cornerPoint + Offset(dxSign * r, dySign * r),
          radius: r,
        ),
        _arcStart(dxSign, dySign),
        1.5707963, // 90°
        false,
        bracket,
      );
    }

    lBracket(w.topLeft, 1, 1);
    lBracket(w.topRight, -1, 1);
    lBracket(w.bottomLeft, 1, -1);
    lBracket(w.bottomRight, -1, -1);
  }

  double _arcStart(double dxSign, double dySign) {
    if (dxSign > 0 && dySign > 0) return 3.1415926; // top-left: 180°
    if (dxSign < 0 && dySign > 0) return -1.5707963; // top-right: 270°
    if (dxSign > 0 && dySign < 0) return 1.5707963; // bottom-left: 90°
    return 0; // bottom-right: 0°
  }

  @override
  bool shouldRepaint(ScanFramePainter oldDelegate) =>
      oldDelegate.scanWindow != scanWindow;
}
