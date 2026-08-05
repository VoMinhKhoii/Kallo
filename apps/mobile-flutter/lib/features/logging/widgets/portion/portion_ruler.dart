import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../models/vessel.dart';
import '../../logic/portion/portion_anchors.dart';
import '../../logic/portion/ruler_scale.dart';
import '../../logic/portion/vessel_data.dart';
import 'portion_glyph_row.dart';
import 'portion_ruler_face.dart';
import 'portion_ruler_strip.dart';

/// Integrated piece ruler: one continuous track with equal-spaced anchors. Each
/// anchor carries a bottom-aligned silhouette above the track, a 1px tick on
/// it, and a gram label below — all sharing one column.
///
/// The silhouettes sit in n equal columns rather than being absolutely
/// positioned, because n equal columns have their centres at exactly
/// `anchorPositions(n)`: the glyphs line up with the ticks and labels for free,
/// and a glyph physically cannot spill into its neighbour.
///
/// The slider runs in position space (0–[positionMax]); grams map to/from it
/// piecewise-linearly over (0, min) (anchor positions, anchor values) (100%,
/// max), so anchors sit at fixed positions while grams stay continuous between
/// them. Position is held here so a drag never snaps back through the lossy
/// grams round-trip; it resyncs whenever grams change from outside (e.g. an
/// anchor tap).
///
/// Ported from `components/logging/feed/meal-entry/portion/portion-ruler.tsx`.
class PortionRuler extends StatefulWidget {
  const PortionRuler({
    super.key,
    required this.anchors,
    required this.countPrefix,
    required this.claimedTier,
    required this.grams,
    required this.min,
    required this.max,
    required this.kind,
    required this.sliderLabel,
    required this.sliderValueText,
    required this.onChanged,
  });

  final List<PortionAnchor> anchors;

  /// `"N × "` prefix (blank for a single piece).
  final String countPrefix;

  /// Tier claimed by the claim band, or null when the portion is custom.
  final int? claimedTier;

  final int grams;
  final int min;
  final int max;
  final PieceKind kind;
  final String sliderLabel;
  final String sliderValueText;
  final ValueChanged<int> onChanged;

  @override
  State<PortionRuler> createState() => _PortionRulerState();
}

class _PortionRulerState extends State<PortionRuler> {
  late RulerScale _scale = _buildScale();

  /// Mirrors the grams this widget last emitted, so an outside change (anchor
  /// tap, re-open) resyncs the held position but a drag does not.
  late int _ownGrams = widget.grams;

  RulerScale _buildScale() =>
      RulerScale(widget.anchors, widget.min, widget.max);

  @override
  void didUpdateWidget(PortionRuler oldWidget) {
    super.didUpdateWidget(oldWidget);
    final next = _buildScale();
    if (next.differsFrom(_scale)) {
      _scale = next;
      _ownGrams = widget.grams;
      return;
    }
    if (widget.grams != _ownGrams) _ownGrams = widget.grams;
  }

  void _handlePosition(double next) {
    final grams = _scale.toGrams(next);
    setState(() => _ownGrams = grams);
    widget.onChanged(grams);
  }

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 360),
      child: Semantics(
        slider: true,
        label: widget.sliderLabel,
        value: widget.sliderValueText,
        // The strip is a scroll view, so a screen reader gets scroll actions
        // rather than slider ones. These restate it as the control it is.
        onIncrease: () => _nudge(1),
        onDecrease: () => _nudge(-1),
        // Flutter asserts these accompany `value` whenever the actions exist —
        // a screen reader announces where a swipe WOULD land.
        increasedValue: '${_gramsAfter(1)} g',
        decreasedValue: '${_gramsAfter(-1)} g',
        child: PortionRulerStrip(
          majors: anchorPositions(widget.anchors.length),
          position: _scale.toPosition(_ownGrams) / positionMax,
          graduations: portionGraduationCount(widget.anchors.length),
          glyphBandAspect: glyphRowAspect(widget.anchors.length) /
              widget.anchors.length,
          glyphBuilder: (index, column) => PortionGlyph(
            tier: pieceTiers[widget.anchors[index].tier - 1],
            kind: widget.kind,
            columnWidth: column,
            label: '${widget.countPrefix}${widget.anchors[index].label}',
            selected: widget.anchors[index].tier == widget.claimedTier,
            onTap: () => _jumpTo(widget.anchors[index]),
          ),
          // PER PIECE, not the multiplied total. The silhouette above is ONE
          // piece, so its label is that piece's weight; the count lives in the
          // "3 x slice" line and the total in the readout. Showing 450 g under
          // a single fillet read as the fillet weighing 450 g.
          labelFor: (index) =>
              '${pieceTiers[widget.anchors[index].tier - 1].grams} g',
          onChanged: (fraction) =>
              _handlePosition(fraction * positionMax),
        ),
      ),
    );
  }

  /// The position one graduation away, clamped to the scale.
  double _positionAfter(int direction) {
    final step = positionMax / portionGraduationCount(widget.anchors.length);
    return (_scale.toPosition(_ownGrams) + direction * step)
        .clamp(0.0, positionMax.toDouble());
  }

  int _gramsAfter(int direction) => _scale.toGrams(_positionAfter(direction));

  /// One graduation of travel, for assistive technology.
  void _nudge(int direction) => _handlePosition(_positionAfter(direction));

  void _jumpTo(PortionAnchor anchor) {
    HapticFeedback.selectionClick();
    final grams = anchor.value.round();
    setState(() => _ownGrams = grams);
    widget.onChanged(grams);
  }
}
