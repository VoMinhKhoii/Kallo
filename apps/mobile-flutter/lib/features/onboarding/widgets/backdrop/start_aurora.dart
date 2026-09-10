import 'package:flutter/material.dart';

import '../../../../theme/kallo_colors.dart';

/// How hard the sweep is turned up, and how far down the page it reaches.
///
/// Two knobs, because the two are not the same thing: the signed-out start
/// screen wants a warm wash that carries past the wordmark, while a wizard step
/// wants the same colour to be gone before the title so the rows sit on clean
/// canvas. Scaling only the alphas would leave a pale film across the whole
/// upper half; scaling only the reach would leave it just as loud.
@immutable
class AuroraSpec {
  const AuroraSpec({required this.strength, required this.reach});

  /// The signed-out start screen: the sweep at full strength, gone by 40% of
  /// the height.
  static const start = AuroraSpec(strength: 1, reach: 0.40);

  /// Onboarding steps and `/save-plan`: the same sweep at 45%, gone by 29% —
  /// above where a step's title lands.
  static const step = AuroraSpec(strength: 0.45, reach: 0.29);

  /// Multiplies every alpha — the gradient's and both glows'.
  final double strength;

  /// The fraction of the height at which the vertical gradient hits zero. The
  /// inner stops ride along, keeping their spacing.
  final double reach;
}

/// The warm sweep behind the signed-out start screen, and — at [AuroraSpec.step]
/// — the top of every onboarding step under [StepBackdrop]'s blobs.
///
/// Three layers, all measured in FRACTIONS of the box so the sweep holds its
/// shape on every device: a vertical apricot→lilac gradient that has gone fully
/// transparent by [AuroraSpec.reach] of the height, plus two wide elliptical
/// glows (ember low-left, violet high-right) sitting in the top tenth.
///
/// It is deliberately weak — 55% apricot at the very top of the start screen,
/// nothing at all below the fold — so the wordmark and the device preview stay
/// the subjects.
class StartAurora extends StatelessWidget {
  const StartAurora({super.key, this.spec = AuroraSpec.start});

  final AuroraSpec spec;

  @override
  Widget build(BuildContext context) => IgnorePointer(
    child: CustomPaint(painter: _AuroraPainter(spec), size: Size.infinite),
  );
}

class _AuroraPainter extends CustomPainter {
  const _AuroraPainter(this.spec);

  final AuroraSpec spec;

  static const Color _apricot = KalloColors.brandApricot;
  static const Color _lilac = KalloColors.brandLilac;
  static const Color _ember = Color(0xFFE05A2B);
  static const Color _violet = Color(0xFF8A4FE0);

  /// The gradient at full strength, its stops given as fractions of [reach] so
  /// the ramp keeps its shape however far down the sweep is allowed to go.
  static const List<double> _alphas = [0.55, 0.30, 0.18, 0];
  static const List<double> _stops = [0, 0.35, 0.65, 1];

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
            _apricot.withValues(alpha: _alphas[0] * spec.strength),
            _apricot.withValues(alpha: _alphas[1] * spec.strength),
            _lilac.withValues(alpha: _alphas[2] * spec.strength),
            _lilac.withValues(alpha: 0), // gone by `reach` of the height
          ],
          stops: [for (final stop in _stops) stop * spec.reach],
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
        colors: [
          color.withValues(alpha: opacity * spec.strength),
          color.withValues(alpha: 0),
        ],
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
