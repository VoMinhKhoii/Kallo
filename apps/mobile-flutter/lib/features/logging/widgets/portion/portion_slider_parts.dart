import 'package:flutter/material.dart';

import 'portion_ruler_face.dart';

/// The invisible overlay that gives the portion slider a real touch target.
/// The visible shapes live in `portion_ruler_face.dart`.

/// An overlay that paints NOTHING but reserves a 44pt-tall touch target.
///
/// Material derives the slider's whole render-box height from the overlay's
/// preferred size, and the render box is what bounds pointer hit-testing — so
/// `noOverlay` (which is what keeps the track inset at the thumb radius, and
/// therefore the ticks under their silhouettes) collapsed the drag target to
/// 16pt. Only the WIDTH feeds the track inset (`max(overlayWidth, thumbWidth)`),
/// so declaring 16x44 buys the full target back and leaves alignment untouched.
/// Nothing is painted because the web control has no touch-state halo either.
class PortionTouchTargetOverlay extends SliderComponentShape {
  const PortionTouchTargetOverlay();

  static const double height = 44;

  @override
  Size getPreferredSize(bool isEnabled, bool isDiscrete) =>
      const Size(2 * portionThumbRadius, height);

  @override
  void paint(
    PaintingContext context,
    Offset center, {
    required Animation<double> activationAnimation,
    required Animation<double> enableAnimation,
    required bool isDiscrete,
    required TextPainter labelPainter,
    required RenderBox parentBox,
    required SliderThemeData sliderTheme,
    required TextDirection textDirection,
    required double value,
    required double textScaleFactor,
    required Size sizeWithOverflow,
  }) {}
}
