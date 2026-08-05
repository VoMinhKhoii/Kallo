import 'package:flutter/material.dart';

import '../../../logic/portion/portion_anchors.dart';
import '../../../logic/portion/ruler_scale.dart';
import 'portion_ruler_face.dart';
import 'portion_ruler_strip.dart';

/// The portion ruler, for BOTH vessel families.
///
/// Everything that decides what the control does — the gram/position scale, the
/// held value, the resync when the value changes from outside, the
/// screen-reader nudge, the graduation count — lives here once. The two
/// branches supply only what differs: which silhouette to draw, what to write
/// under it, and how tall the art band is.
///
/// It was duplicated across `PortionRuler` and `PortionContainerBody`, which is
/// how they drifted into disagreeing about the tier a portion was in. Two
/// copies of state logic is two places to fix every future bug in it.
class PortionRulerControl extends StatefulWidget {
  const PortionRulerControl({
    super.key,
    required this.anchors,
    required this.grams,
    required this.min,
    required this.max,
    required this.sliderLabel,
    required this.valueTextFor,
    required this.glyphBuilder,
    required this.labelFor,
    required this.glyphBandAspect,
    required this.onChanged,
  });

  final List<PortionAnchor> anchors;
  final int grams;
  final int min;
  final int max;

  final String sliderLabel;

  /// Spoken value at [grams] — each family words its own tier claim.
  final String Function(int grams) valueTextFor;

  /// Silhouette for anchor [index] in a slot [column] wide.
  final Widget Function(int index, double column) glyphBuilder;

  /// Text under anchor [index].
  final String Function(int index) labelFor;

  /// width / height of the silhouette band, in column widths.
  final double glyphBandAspect;

  final ValueChanged<int> onChanged;

  @override
  State<PortionRulerControl> createState() => PortionRulerControlState();
}

class PortionRulerControlState extends State<PortionRulerControl> {
  late RulerScale _scale = _buildScale();

  /// The grams this control last emitted. An OUTSIDE change (an anchor tap, a
  /// re-open) resyncs the scroll position; the value we just emitted ourselves
  /// must not, or it fights the drag.
  late int _ownGrams = widget.grams;

  RulerScale _buildScale() =>
      RulerScale(widget.anchors, widget.min, widget.max);

  int get graduations => portionGraduationCount(widget.anchors.length);

  @override
  void didUpdateWidget(PortionRulerControl oldWidget) {
    super.didUpdateWidget(oldWidget);
    final next = _buildScale();
    if (next.differsFrom(_scale)) {
      _scale = next;
      _ownGrams = widget.grams;
      return;
    }
    if (widget.grams != _ownGrams) _ownGrams = widget.grams;
  }

  void _emit(int grams) {
    setState(() => _ownGrams = grams);
    widget.onChanged(grams);
  }

  /// Jump to an anchor — the tap target under each silhouette.
  void jumpTo(PortionAnchor anchor) => _emit(anchor.value.round());

  /// Grams one graduation away, clamped to the scale.
  int gramsAfter(int direction) => _scale.toGrams(
    (_scale.toPosition(_ownGrams) +
            direction * (positionMax / graduations))
        .clamp(0.0, positionMax.toDouble()),
  );

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 360),
      child: Semantics(
        slider: true,
        label: widget.sliderLabel,
        value: widget.valueTextFor(_ownGrams),
        // Flutter asserts these accompany `value` whenever the actions exist.
        // The strip is a scroll view, so without them a screen reader gets
        // scroll actions instead of the slider it actually is.
        increasedValue: '${gramsAfter(1)} g',
        decreasedValue: '${gramsAfter(-1)} g',
        onIncrease: () => _emit(gramsAfter(1)),
        onDecrease: () => _emit(gramsAfter(-1)),
        child: PortionRulerStrip(
          majors: anchorPositions(widget.anchors.length),
          position: _scale.toPosition(_ownGrams) / positionMax,
          graduations: graduations,
          glyphBandAspect: widget.glyphBandAspect,
          glyphBuilder: widget.glyphBuilder,
          labelFor: widget.labelFor,
          onChanged: (fraction) =>
              _emit(_scale.toGrams(fraction * positionMax)),
        ),
      ),
    );
  }
}
