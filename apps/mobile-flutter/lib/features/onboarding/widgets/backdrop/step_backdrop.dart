import 'package:flutter/material.dart';

/// The four soft gradient blobs the canvas paints behind every onboarding
/// STEP and behind `/save-plan`.
///
/// Not on `/start` — that has its own warm sweep ([StartAurora]) — and not on
/// the paywall, which carries its own art. This is the quiet colour that keeps
/// a wizard of white cards on a neutral canvas from reading as a form.
///
/// Every number is a FRACTION of the box, so the four blobs hold their
/// composition on any phone: an apricot one high-right, sage low-left, violet
/// low-right and a cool blue tucked into the bottom-left corner. Each fades to
/// nothing by 70% of its own ellipse, which is what keeps them as light rather
/// than as shapes.
///
/// Painted once and never again: the painter's [CustomPainter.shouldRepaint]
/// is `false` and a [RepaintBoundary] keeps the layer off the content's
/// repaints (an onboarding step animates its mascot every frame).
class StepBackdrop extends StatelessWidget {
  const StepBackdrop({super.key});

  @override
  Widget build(BuildContext context) => const RepaintBoundary(
    child: IgnorePointer(
      child: CustomPaint(painter: _StepBackdropPainter(), size: Size.infinite),
    ),
  );
}

/// One blob: `radial-gradient(rx ry at cx cy, color 0%, transparent 70%)`,
/// every value a fraction of the box.
@immutable
class _Blob {
  const _Blob(
    this.color,
    this.opacity,
    this.center,
    this.radiusX,
    this.radiusY,
  );

  final Color color;
  final double opacity;
  final Offset center;
  final double radiusX;
  final double radiusY;
}

class _StepBackdropPainter extends CustomPainter {
  const _StepBackdropPainter();

  static const List<_Blob> _blobs = [
    _Blob(Color(0xFFE2966E), 0.30, Offset(0.84, 0.10), 0.34, 0.22),
    _Blob(Color(0xFF8FAE74), 0.22, Offset(0.08, 0.44), 0.30, 0.20),
    _Blob(Color(0xFF9E76C0), 0.18, Offset(0.86, 0.74), 0.26, 0.18),
    _Blob(Color(0xFF92B6CF), 0.18, Offset(0.22, 0.92), 0.18, 0.12),
  ];

  @override
  void paint(Canvas canvas, Size size) {
    for (final blob in _blobs) {
      // Flutter's RadialGradient is circular, so the ellipse comes from the
      // transform: paint the unit circle, then stretch it to rx × ry.
      const unit = Rect.fromLTRB(-1, -1, 1, 1);
      final paint =
          Paint()
            ..shader = RadialGradient(
              // `radius` is a fraction of the shortest side (2 units here), so
              // 0.5 is exactly the unit circle.
              radius: 0.5,
              colors: [
                blob.color.withValues(alpha: blob.opacity),
                blob.color.withValues(alpha: 0),
              ],
              stops: const [0, 0.7],
            ).createShader(unit);

      canvas.save();
      canvas.translate(
        blob.center.dx * size.width,
        blob.center.dy * size.height,
      );
      canvas.scale(blob.radiusX * size.width, blob.radiusY * size.height);
      canvas.drawRect(unit, paint);
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(_StepBackdropPainter oldDelegate) => false;
}
