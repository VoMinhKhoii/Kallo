import 'package:flutter/widgets.dart';

import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_palette.dart';

/// Aurora's glow behind the top of a main page: apricot centred on the
/// top-left corner, lilac on the top-right, both gone by [reach].
///
/// Painted UNDER [child], on the page background, and only in Aurora — Light
/// and Dark get the bare child's paint. The widget stays in the tree in every
/// palette, so switching palettes repaints the page instead of remounting it.
class AuroraGlow extends StatelessWidget {
  const AuroraGlow({super.key, required this.child});

  final Widget child;

  /// How far down the page the glow fades out.
  static const double reach = 440;

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
    const reach = AuroraGlow.reach;
    void glow(Offset centre, Color color) {
      final rect = Rect.fromCircle(center: centre, radius: reach);
      final paint =
          Paint()
            ..shader = RadialGradient(
              colors: [color, color.withAlpha(0)],
            ).createShader(rect);
      canvas.drawRect(Offset.zero & Size(size.width, reach), paint);
    }

    glow(Offset.zero, KalloColors.brandApricot.withAlpha(0x4D)); // 30%
    glow(Offset(size.width, 0), KalloColors.brandLilac.withAlpha(0x42)); // 26%
  }

  @override
  bool shouldRepaint(_GlowPainter old) => old.on != on;
}
