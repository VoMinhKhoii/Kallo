import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../theme/nham_colors.dart';
import 'portion_slider_parts.dart';

/// The portion picker's track, shared by the container's plain gram slider and
/// the ruler's position-space one.
///
/// Ports the web's Radix slider styling (`portion-slider.tsx` /
/// `portion-ruler.tsx`): a 6px rounded track on the border hairline at 50%, and
/// a 16px thumb that is a RING — surface fill with a coloured border — not a
/// solid dot. Material has no bordered-thumb shape, hence [PortionRingThumb].
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

  /// How far the track is inset from the widget's edges on each side.
  ///
  /// Material insets the track by `max(thumb, overlay) / 2` so the thumb never
  /// overflows; with the overlay suppressed that is exactly the thumb radius.
  /// The ruler pads its glyph row and gram labels by the SAME amount, so a
  /// silhouette, its tick and the thumb position it selects all land on one
  /// vertical line — which is the entire premise of an "integrated" ruler.
  static const double trackInset = portionThumbRadius;

  @override
  Widget build(BuildContext context) {
    final active = accent ? NhamColors.accent : NhamColors.text30;

    // NOT `excludeSemantics: true`. That drops the child Slider's entire
    // semantics subtree — including its increase/decrease actions — leaving a
    // control a screen reader can read ("300 g") but cannot operate. The web
    // original is keyboard- and AT-adjustable, so dropping those actions loses
    // a whole interaction mode. The label rides on this node; the value and the
    // actions stay on the Slider's own node underneath.
    return Semantics(
      label: semanticLabel,
      child: SliderTheme(
        data: SliderThemeData(
          trackHeight: portionTrackHeight,
          activeTrackColor: active,
          inactiveTrackColor: NhamColors.borderHalf,
          trackShape: PortionTickedTrack(
            ticks: ticks,
            tickColor: NhamColors.text25,
          ),
          thumbShape: const PortionRingThumb(radius: portionThumbRadius),
          overlayShape: const PortionTouchTargetOverlay(),
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
          // Thumb colour is read by [PortionRingThumb] for the ring.
          activeColor: active,
          semanticFormatterCallback: (_) => semanticValue,
          onChanged: (next) {
            HapticFeedback.selectionClick();
            onChanged(next);
          },
        ),
      ),
    );
  }
}
