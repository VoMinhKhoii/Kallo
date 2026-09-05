import 'package:flutter/material.dart';

/// The warm sweep behind the signed-out start screen.
///
/// Three layers, all measured in FRACTIONS of the box so the sweep holds its
/// shape on every device: a vertical apricot→lilac gradient that has gone
/// fully transparent by 40% of the height, plus two wide elliptical glows
/// (ember low-left, violet high-right) sitting in the top tenth.
///
/// It is the only place in the app that paints colour behind the canvas, and
/// it is deliberately weak — 55% apricot at the very top, nothing at all below
/// the fold — so the wordmark and the device preview stay the subjects.
class StartAurora extends StatelessWidget {
  const StartAurora({super.key});

  @override
  Widget build(BuildContext context) => const IgnorePointer(
        child: CustomPaint(painter: _AuroraPainter(), size: Size.infinite),
      );
}

class _AuroraPainter extends CustomPainter {
  const _AuroraPainter();

  static const Color _apricot = Color(0xFFFFD2B0);
  static const Color _lilac = Color(0xFFDCC4FF);
  static const Color _ember = Color(0xFFE05A2B);
  static const Color _violet = Color(0xFF8A4FE0);

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;

    canvas.drawRect(
      rect,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            _apricot.withValues(alpha: 0.55),
            _apricot.withValues(alpha: 0.30),
            _lilac.withValues(alpha: 0.18),
            _lilac.withValues(alpha: 0), // gone by 40% of the height
          ],
          stops: const [0, 0.14, 0.26, 0.40],
        ).createShader(rect),
    );

    _glow(canvas, size, _ember, 0.16, const Offset(0.30, 0.06), 0.60, 0.24);
    _glow(canvas, size, _violet, 0.14, const Offset(0.80, 0.10), 0.50, 0.20);
  }

  /// One elliptical glow, drawn in a unit circle that the canvas then stretches
  /// to `radiusX × radiusY` — Flutter's [RadialGradient] is circular, so the
  /// ellipse has to come from the transform.
  void _glow(
    Canvas canvas,
    Size size,
    Color color,
    double opacity,
    Offset center,
    double radiusX,
    double radiusY,
  ) {
    const unit = Rect.fromLTRB(-1, -1, 1, 1);
    final paint = Paint()
      ..shader = RadialGradient(
        // `radius` is a fraction of the box's shortest side (2 units here), so
        // 0.5 is exactly the unit circle.
        radius: 0.5,
        colors: [color.withValues(alpha: opacity), color.withValues(alpha: 0)],
        stops: const [0, 0.7],
      ).createShader(unit);

    canvas.save();
    canvas.translate(center.dx * size.width, center.dy * size.height);
    canvas.scale(radiusX * size.width, radiusY * size.height);
    canvas.drawRect(unit, paint);
    canvas.restore();
  }

  @override
  bool shouldRepaint(_AuroraPainter oldDelegate) => false;
}
