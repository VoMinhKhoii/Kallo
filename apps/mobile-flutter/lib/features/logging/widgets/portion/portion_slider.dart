import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../theme/nham_colors.dart';
import 'portion_ruler_face.dart';
import 'portion_slider_parts.dart';

/// The portion picker's control: an accent needle travelling a graduated ruler.
///
/// Shared by both vessel families so one sheet never shows two slider styles.
/// The scale itself is drawn by [PortionRulerTrack] — see that file for why
/// this diverges from the web's plain Radix slider.
class PortionSlider extends StatefulWidget {
  const PortionSlider({
    super.key,
    required this.value,
    required this.min,
    required this.max,
    required this.semanticLabel,
    required this.semanticValue,
    required this.majors,
    required this.onChanged,
    this.divisions,
  });

  final double value;
  final double min;
  final double max;
  final String semanticLabel;
  final String semanticValue;

  /// Anchor positions as 0–1 fractions — the ruler's tall graduations.
  final List<double> majors;

  final ValueChanged<double> onChanged;

  /// Quantizes the track, and — the reason it exists — sets the increment a
  /// screen-reader swipe moves by. The ruler derives it so one step is worth at
  /// least 1 g in even its flattest segment; the container slider is in grams
  /// and passes one division per gram.
  final int? divisions;

  /// How far the track is inset from the widget's edges on each side.
  ///
  /// Material insets the track by `max(thumb, overlay) / 2`; with the overlay
  /// reserving only the thumb's width that is exactly the thumb radius. The
  /// ruler pads its glyph row and gram labels by the SAME amount, so a
  /// silhouette, its graduation and the amount the needle selects all land on
  /// one vertical line — the entire premise of an "integrated" ruler.
  static const double trackInset = portionThumbRadius;

  @override
  State<PortionSlider> createState() => _PortionSliderState();
}

class _PortionSliderState extends State<PortionSlider> {
  /// The graduation the needle last sat on. A drag fires one tick per
  /// graduation crossed — the feel of a detent — instead of the continuous
  /// buzz that firing on every value change produced (with per-gram divisions
  /// that was hundreds of impulses across one swipe).
  int? _lastGraduation;

  int _graduationAt(double value) {
    final span = widget.max - widget.min;
    if (span <= 0 || widget.majors.isEmpty) return 0;
    final fraction = (value - widget.min) / span;
    return (fraction * _graduationCount).round();
  }

  int get _graduationCount => portionGraduationCount(widget.majors.length);

  void _handleChanged(double next) {
    final graduation = _graduationAt(next);
    if (graduation != _lastGraduation) {
      _lastGraduation = graduation;
      HapticFeedback.selectionClick();
    }
    widget.onChanged(next);
  }

  @override
  Widget build(BuildContext context) {
    // NOT `excludeSemantics: true`. That drops the child Slider's entire
    // semantics subtree — including its increase/decrease actions — leaving a
    // control a screen reader can read ("300 g") but cannot operate. The label
    // rides on this node; the value and the actions stay on the Slider's own
    // node underneath.
    return Semantics(
      label: widget.semanticLabel,
      child: SliderTheme(
        data: SliderThemeData(
          trackHeight: portionRulerHeight,
          // The ruler paints its own graduations from these; Material's track
          // colours are unused, but `getPreferredRect` shrinks the track to
          // nothing if BOTH read transparent, so they stay opaque.
          activeTrackColor: NhamColors.text,
          inactiveTrackColor: NhamColors.border,
          trackShape: PortionRulerTrack(majors: widget.majors),
          thumbShape: const PortionNeedleThumb(color: NhamColors.accentDark),
          overlayShape: const PortionTouchTargetOverlay(),
          tickMarkShape: SliderTickMarkShape.noTickMark,
          showValueIndicator: ShowValueIndicator.never,
        ),
        child: Slider(
          min: widget.min,
          max: widget.max,
          divisions: widget.divisions,
          value: widget.value.clamp(widget.min, widget.max),
          semanticFormatterCallback: (_) => widget.semanticValue,
          onChanged: _handleChanged,
        ),
      ),
    );
  }
}
