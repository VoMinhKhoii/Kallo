import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';

/// The gold treatment the yearly plan row wears — the ONE loud surface in the
/// app, and the only place these hexes are allowed to exist. Deliberately
/// outside [KalloColors], which is a neutral canvas / ink / hairline system.
///
/// Muted copy on gold is [kGoldMuted], never `kInkMuted` — the neutral grey
/// reads dirty over a warm fill and drops under 3:1 against the lightest stop.
const Color kGoldMuted = Color(0xFF8B7A3A);
const Color kGoldBorder = Color(0xFFE2A81C);
const Color kGoldChipText = Color(0xFFF9D447);

/// The gold row: the gradient surface, the sparkle clipped to it, and the ink
/// chip hanging over its top-right edge.
class GoldPlanSurface extends StatelessWidget {
  const GoldPlanSurface({
    required this.radius,
    required this.child,
    this.chipLabel,
    super.key,
  });

  final double radius;

  /// "Best value · save 40%". Absent when the saving cannot be computed.
  final String? chipLabel;

  final Widget child;

  /// How far the chip hangs above the row's top edge.
  static const double chipOverlap = 12;

  @override
  Widget build(BuildContext context) {
    final Widget surface = DecoratedBox(
      decoration: _decoration(radius),
      child: Stack(
        children: [
          // Glitter under a diagonal shimmer. Purely decorative.
          Positioned.fill(
            child: IgnorePointer(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(radius),
                child: const CustomPaint(
                  painter: _GlitterPainter(),
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          Color(0x00FFFFFF),
                          Color(0x73FFFFFF), // white @ 45%
                          Color(0x00FFFFFF),
                        ],
                        stops: [0.35, 0.485, 0.62],
                      ),
                    ),
                    child: SizedBox.expand(),
                  ),
                ),
              ),
            ),
          ),
          child,
        ],
      ),
    );
    if (chipLabel == null) return surface;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        surface,
        // The ink pill overlapping the row's top-right edge.
        Positioned(
          top: -chipOverlap,
          right: KalloSpacing.sp3,
          child: Container(
            padding: const EdgeInsets.symmetric(
              horizontal: KalloSpacing.sp2,
              vertical: KalloSpacing.sp1,
            ),
            decoration: BoxDecoration(
              color: kInk,
              borderRadius: BorderRadius.circular(KalloRadii.pill),
            ),
            child: Text(chipLabel!, style: dashCaption(color: kGoldChipText)),
          ),
        ),
      ],
    );
  }
}

/// 135° top-left → bottom-right, with the mid stop pulled to 45% so the light
/// catch sits above the centre line rather than through the text.
BoxDecoration _decoration(double radius) => BoxDecoration(
      gradient: const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Color(0xFFFBE27A), Color(0xFFF9D447), Color(0xFFEDBF2F)],
        stops: [0, 0.45, 1],
      ),
      borderRadius: BorderRadius.circular(radius),
      border: Border.all(color: kGoldBorder),
      boxShadow: const [
        BoxShadow(
          color: Color(0x4DE9B62E), // gold @ 30%
          blurRadius: 28,
          offset: Offset(0, 10),
        ),
      ],
    );

/// Two layers of specks at co-prime-ish pitches so the eye reads scatter
/// rather than a grid. The jitter is a deterministic LCG — the same row
/// renders the same specks on every frame, which is what keeps the sparkle
/// from crawling when the row rebuilds.
class _GlitterPainter extends CustomPainter {
  const _GlitterPainter();

  static const Color _speck = Color(0xCCFFFFFF); // white @ 80%

  @override
  void paint(Canvas canvas, Size size) {
    _scatter(canvas, size, pitch: 25, radius: 0.5, seed: 1013904223);
    _scatter(canvas, size, pitch: 37, radius: 0.4, seed: 1664525);
  }

  void _scatter(
    Canvas canvas,
    Size size, {
    required double pitch,
    required double radius,
    required int seed,
  }) {
    final paint = Paint()..color = _speck;
    var state = seed;
    int next() => state = (state * 1103515245 + 12345) & 0x7fffffff;
    for (double y = 0; y < size.height; y += pitch) {
      for (double x = 0; x < size.width; x += pitch) {
        final dx = (next() % 1000) / 1000 * pitch;
        final dy = (next() % 1000) / 1000 * pitch;
        canvas.drawCircle(Offset(x + dx, y + dy), radius, paint);
      }
    }
  }

  @override
  bool shouldRepaint(_GlitterPainter oldDelegate) => false;
}
