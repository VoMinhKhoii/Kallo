import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../models/vessel.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/nham_theme.dart';
import '../../logic/portion/portion_anchors.dart';
import '../../logic/portion/ruler_scale.dart';
import 'portion_glyph_row.dart';
import 'portion_slider.dart';

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
  late double _position = _scale.toPosition(widget.grams);

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
      _position = _scale.toPosition(widget.grams);
      return;
    }
    if (widget.grams != _ownGrams) {
      _ownGrams = widget.grams;
      _position = _scale.toPosition(widget.grams);
    }
  }

  void _handlePosition(double next) {
    final grams = _scale.toGrams(next);
    setState(() {
      _position = next;
      _ownGrams = grams;
    });
    widget.onChanged(grams);
  }

  @override
  Widget build(BuildContext context) {
    final positions = anchorPositions(widget.anchors.length);

    return ConstrainedBox(
      // Capped and centred so the glyphs stay a sensible size on a wide sheet.
      // The cap is on the whole ruler, not just the glyph row, so the row keeps
      // sharing its width — and therefore its column centres — with the track.
      constraints: const BoxConstraints(maxWidth: 360),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: PortionSlider.trackInset,
            ),
            child: AspectRatio(
              aspectRatio: glyphRowAspect(widget.anchors.length),
              child: PortionGlyphRow(
                anchors: widget.anchors,
                kind: widget.kind,
                countPrefix: widget.countPrefix,
                claimedTier: widget.claimedTier,
                onPick: (grams) {
                  HapticFeedback.selectionClick();
                  setState(() {
                    _ownGrams = grams;
                    _position = _scale.toPosition(grams);
                  });
                  widget.onChanged(grams);
                },
              ),
            ),
          ),
          const SizedBox(height: NhamSpacing.sp1), // mb-1
          PortionSlider(
            value: _position,
            min: 0,
            max: positionMax.toDouble(),
            majors: positions,
            divisions: _scale.divisions,
            semanticLabel: widget.sliderLabel,
            semanticValue: widget.sliderValueText,
            onChanged: _handlePosition,
          ),
          const SizedBox(height: NhamSpacing.sp2), // mt-2
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: PortionSlider.trackInset,
            ),
            child: Row(
              children: [
                // Equal columns put each label's centre on its tick, the same
                // way the glyph row does — no absolute positioning needed.
                for (final anchor in widget.anchors)
                  Expanded(
                    // scaleDown rather than clip: a many-piece portion at 1.3x
                    // Dynamic Type needs more than its column ("3000 g" wants
                    // 57pt in a 54pt column on a 320pt phone), and a silently
                    // truncated gram figure is worse than a slightly smaller
                    // one on the row whose whole job is stating the amount.
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Text(
                        // The value a TAP commits, not the raw anchor. This
                        // picker works in integer grams end to end, so a
                        // fractional count (1.25 pieces → a 37.5 g tier) would
                        // otherwise label a stop "37.5 g" and hand back 38 g.
                        // Label what the control actually does.
                        '${anchor.value.round()} g',
                        maxLines: 1,
                        style: dashMeta(tabular: true),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
