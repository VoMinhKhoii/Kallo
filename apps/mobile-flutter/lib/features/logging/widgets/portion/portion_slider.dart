import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../theme/nham_colors.dart';

/// The portion picker's track, shared by the container's plain gram slider and
/// the ruler's position-space one.
///
/// Ports the web's Radix slider styling (`portion-slider.tsx` /
/// `portion-ruler.tsx`): a 6px rounded track on the border hairline at 50%, and
/// a 16px thumb that is a RING — surface fill with a coloured border — not a
/// solid dot. Material has no bordered-thumb shape, hence [_RingThumbShape].
///
/// [ticks] are fractional positions (0–1) painted onto the track for the
/// ruler's anchors; the container slider passes none.
class PortionSlider extends StatelessWidget {
  const PortionSlider({
    super.key,
    required this.value,
    required this.min,
    required this.max,
    required this.semanticLabel,
    required this.semanticValue,
    required this.onChanged,
    this.accent = true,
    this.ticks = const [],
    this.divisions,
  });

  final double value;
  final double min;
  final double max;
  final String semanticLabel;
  final String semanticValue;
  final ValueChanged<double> onChanged;

  /// Accent for the container branch; neutral ink for the ruler.
  final bool accent;

  final List<double> ticks;

  /// Quantizes the track, and — the reason it exists — sets the increment a
  /// screen-reader swipe moves by. The ruler derives it so one step is worth at
  /// least 1 g in even its flattest segment; the container slider is already in
  /// grams and passes none.
  final int? divisions;

  static const double _trackHeight = 6;
  static const double _thumbRadius = 8;

  /// How far the track is inset from the widget's edges on each side.
  ///
  /// Material insets the track by `max(thumb, overlay) / 2` so the thumb never
  /// overflows; with the overlay suppressed that is exactly the thumb radius.
  /// The ruler pads its glyph row and gram labels by the SAME amount, so a
  /// silhouette, its tick and the thumb position it selects all land on one
  /// vertical line — which is the entire premise of an "integrated" ruler.
  static const double trackInset = _thumbRadius;

  @override
  Widget build(BuildContext context) {
    final active = accent ? NhamColors.accent : NhamColors.text30;

    return Semantics(
      slider: true,
      label: semanticLabel,
      value: semanticValue,
      excludeSemantics: true,
      child: SliderTheme(
        data: SliderThemeData(
          trackHeight: _trackHeight,
          activeTrackColor: active,
          inactiveTrackColor: NhamColors.borderHalf,
          trackShape: _TickedTrackShape(
            ticks: ticks,
            tickColor: NhamColors.text30,
          ),
          thumbShape: const _RingThumbShape(radius: _thumbRadius),
          // No press halo: it would widen the track inset to 18 per side and
          // pull the ticks off the silhouettes above them. The web control has
          // no touch-state halo either — its ring is hover/focus only.
          overlayShape: SliderComponentShape.noOverlay,
          // The anchor ticks are painted by the track shape; Material's own
          // division dots would add a second, denser set on top of them.
          tickMarkShape: SliderTickMarkShape.noTickMark,
          showValueIndicator: ShowValueIndicator.never,
        ),
        child: Slider(
          min: min,
          max: max,
          divisions: divisions,
          value: value.clamp(min, max),
          // Thumb colour is read by [_RingThumbShape] for the ring.
          activeColor: active,
          onChanged: (next) {
            HapticFeedback.selectionClick();
            onChanged(next);
          },
        ),
      ),
    );
  }
}

/// Rounded track plus 1px anchor ticks, so the ruler's stops are visible on the
/// track itself and not only in the silhouette row above it.
class _TickedTrackShape extends RoundedRectSliderTrackShape {
  const _TickedTrackShape({required this.ticks, required this.tickColor});

  final List<double> ticks;
  final Color tickColor;

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
class _RingThumbShape extends SliderComponentShape {
  const _RingThumbShape({required this.radius});

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
