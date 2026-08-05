import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../models/vessel.dart';
import '../../logic/portion/portion_anchors.dart';
import '../../logic/portion/vessel_data.dart';
import 'portion_glyphs.dart';
import 'portion_ruler_control.dart';

/// The piece branch of the ruler: fish / meat / poultry cuts on the tape.
///
/// Only the art and the labels live here — the scale, the held value and the
/// screen-reader wiring are [PortionRulerControl]'s, shared with the container
/// branch so the two cannot drift apart again.
///
/// Ported from `components/logging/feed/meal-entry/portion/portion-ruler.tsx`.
class PortionRuler extends StatelessWidget {
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
  Widget build(BuildContext context) {
    return PortionRulerControl(
      anchors: anchors,
      grams: grams,
      min: min,
      max: max,
      sliderLabel: sliderLabel,
      valueTextFor: (_) => sliderValueText,
      glyphBandAspect: glyphRowAspect(anchors.length) / anchors.length,
      glyphBuilder: (index, column) => PortionGlyph(
        tier: pieceTiers[anchors[index].tier - 1],
        kind: kind,
        columnWidth: column,
        label: '$countPrefix${anchors[index].label}',
        selected: anchors[index].tier == claimedTier,
        onTap: () {
          HapticFeedback.selectionClick();
          onChanged(anchors[index].value.round());
        },
      ),
      // PER PIECE, not the multiplied total. The silhouette above is ONE piece,
      // so its label is that piece's weight; the count lives in the "3 x slice"
      // line and the total in the readout. "450 g" under a single fillet read
      // as that fillet weighing 450 g.
      labelFor: (index) => '${pieceTiers[anchors[index].tier - 1].grams} g',
      onChanged: onChanged,
    );
  }
}
