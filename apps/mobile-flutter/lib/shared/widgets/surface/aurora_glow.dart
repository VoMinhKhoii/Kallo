import 'package:flutter/widgets.dart';

import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_palette.dart';

/// Aurora's glow behind the top of a main page: a small apricot light in the
/// top-left corner and a lilac one in the top-right, gone well before the
/// page's first card.
///
/// The design canvas's recipe, exactly: each light is an ellipse 80% of the
/// width across and 60% of a [band]-tall strip down, fading to nothing at 70%
/// of its radius (about 220 pt across and 190 pt down on a phone), so the
/// middle of the top stays dark between the two.
///
/// Painted UNDER [child], on the page background, and only in Aurora — Light
/// and Dark get the bare child's paint. The widget stays in the tree in every
/// palette, so switching palettes repaints the page instead of remounting it.
class AuroraGlow extends StatelessWidget {
  const AuroraGlow({super.key, required this.child});

  final Widget child;

  /// The strip the two lights are sized against.
  static const double band = 460;

  @override
  Widget build(BuildContext context) => CustomPaint(
    painter: _GlowPainter(on: KalloPalette.currentId == KalloPaletteId.aurora),
    child: child,
  );
}

class _GlowPainter extends CustomPainter {
  const _GlowPainter({required this.on});

  final bool on;

  @override
  void paint(Canvas canvas, Size size) {
    if (!on) return;
    const band = AuroraGlow.band;
    final radiusX = size.width * 0.8;
    const radiusY = band * 0.6;
    canvas.save();
    canvas.clipRect(Offset.zero & Size(size.width, band));
    void glow(double x, Color color) {
      // A circle of radiusY, stretched sideways into the ellipse.
      canvas.save();
      canvas.translate(x, 0);
      canvas.scale(radiusX / radiusY, 1);
      final circle = Rect.fromCircle(center: Offset.zero, radius: radiusY);
      canvas.drawRect(
        circle,
        Paint()
          ..shader = RadialGradient(
            colors: [color, color.withAlpha(0)],
            stops: const [0, 0.7],
          ).createShader(circle),
      );
      canvas.restore();
    }

    glow(0, KalloColors.brandApricot.withAlpha(0x4D)); // 30%
    glow(size.width, KalloColors.brandLilac.withAlpha(0x45)); // 27%
    canvas.restore();
  }

  @override
  bool shouldRepaint(_GlowPainter old) => old.on != on;
}
