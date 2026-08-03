import 'package:flutter/material.dart';

import '../../../../theme/nham_colors.dart';

/// The custom Slider shapes behind [PortionSlider] — track, thumb and the
/// invisible touch-target overlay.
///
/// Split out for the same reason Flutter keeps `slider_parts.dart` beside
/// `slider.dart`: these are render-level shape implementations, a different
/// concern from the widget that themes and composes them.

/// Track height. The web control's `h-1.5`.
const double portionTrackHeight = 6;

/// Thumb radius. The web control's `size-4`, halved.
const double portionThumbRadius = 8;

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

/// Rounded track plus 1px anchor ticks, so the ruler's stops are visible on the
/// track itself and not only in the silhouette row above it.
class PortionTickedTrack extends RoundedRectSliderTrackShape {
  const PortionTickedTrack({required this.ticks, required this.tickColor});

  final List<double> ticks;
  final Color tickColor;

  /// Reports a square track purely to fix the DISCRETE thumb's position.
  /// `_calcThumbCenter` is the only reader of this flag (slider.dart:1908): for
  /// a rounded track it lays the thumb out over `width - trackHeight` and
  /// re-centres, which parks the thumb up to 3px inside the tick it just
  /// snapped to — visible at the outer anchors, and the exact thing the glyph /
  /// tick / thumb alignment is supposed to guarantee. The track still PAINTS
  /// rounded; only the thumb arithmetic changes.
  @override
  bool get isRounded => false;

  @override
  void paint(
    PaintingContext context,
    Offset offset, {
    required RenderBox parentBox,
    required SliderThemeData sliderTheme,
    required Animation<double> enableAnimation,
    required Offset thumbCenter,
    required TextDirection textDirection,
    Offset? secondaryOffset,
    bool isDiscrete = false,
    bool isEnabled = false,
    double additionalActiveTrackHeight = 2,
  }) {
    super.paint(
      context,
      offset,
      parentBox: parentBox,
      sliderTheme: sliderTheme,
      enableAnimation: enableAnimation,
      thumbCenter: thumbCenter,
      textDirection: textDirection,
      secondaryOffset: secondaryOffset,
      isDiscrete: isDiscrete,
      isEnabled: isEnabled,
      // The active side must not grow taller than the inactive side, or the
      // ticks stop lining up with the track edges they are drawn against.
      additionalActiveTrackHeight: 0,
    );
    if (ticks.isEmpty) return;

    final rect = getPreferredRect(
      parentBox: parentBox,
      offset: offset,
      sliderTheme: sliderTheme,
      isEnabled: isEnabled,
      isDiscrete: isDiscrete,
    );
    final paint = Paint()..color = tickColor;
    for (final tick in ticks) {
      final dx = rect.left + rect.width * tick;
      context.canvas.drawRect(
        Rect.fromLTWH(dx - 0.5, rect.top, 1, rect.height),
        paint,
      );
    }
  }
}

/// A ring thumb: surface fill, coloured hairline border. Material's stock
/// [RoundSliderThumbShape] only paints a solid disc.
class PortionRingThumb extends SliderComponentShape {
  const PortionRingThumb({required this.radius});

  final double radius;

  @override
  Size getPreferredSize(bool isEnabled, bool isDiscrete) =>
      Size.fromRadius(radius);

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
  }) {
    final canvas = context.canvas;
    canvas.drawCircle(center, radius, Paint()..color = NhamColors.elev);
    canvas.drawCircle(
      center,
      radius - 0.5,
      Paint()
        ..color = sliderTheme.activeTrackColor ?? NhamColors.text30
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1,
    );
  }
}
