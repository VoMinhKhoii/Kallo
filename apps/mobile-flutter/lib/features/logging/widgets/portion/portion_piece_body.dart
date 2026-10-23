import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../models/nutrition/vessel.dart';
import '../../logic/portion/portion_anchors.dart';
import '../../logic/portion/portion_display.dart';
import '../../logic/portion/vessel_data.dart';
import 'portion_glyphs.dart';
import 'ruler/portion_ruler_control.dart';

/// The piece branch: readout above the ruler (the silhouettes are the labels),
/// and the claimed tier name — or "Custom portion" — beneath it.
class PortionPieceBody extends StatelessWidget {
  const PortionPieceBody({
    super.key,
    required this.vessel,
    required this.anchors,
    required this.grams,
    required this.min,
    required this.max,
    required this.sliderLabel,
    required this.onChanged,
  });

  final PieceVessel vessel;
  final List<PortionAnchor> anchors;
  final int grams;
  final int min;
  final int max;
  final String sliderLabel;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final claimed = claimedAnchor(anchors, grams);
    final prefix = countPrefixFor(vessel);

    return PortionRulerControl(
      anchors: anchors,
      grams: grams,
      min: min,
      max: max,
      sliderLabel: sliderLabel,
      valueTextFor: (g) {
        final at = claimedAnchor(anchors, g);
        return at == null ? '$g g' : '$g g — $prefix${at.label}';
      },
      // One column of the row's aspect — the row is `anchors.length`
      // columns wide, pinned to the tallest silhouette any tier can draw so
      // the sheet doesn't change height between a flat fillet and an
      // upright drumstick.
      glyphBandAspect: glyphRowAspect(anchors.length) / anchors.length,
      glyphBuilder:
          (index, column) => PortionGlyph(
            tier: pieceTiers[anchors[index].tier - 1],
            kind: vessel.kind,
            columnWidth: column,
            label: '$prefix${anchors[index].label}',
            selected: anchors[index].tier == claimed?.tier,
            onTap: () {
              HapticFeedback.selectionClick();
              onChanged(anchors[index].value.round());
            },
          ),
      // PER PIECE, not the multiplied total. The silhouette above is ONE
      // piece, so its label is that piece's weight; the count lives in the
      // "3 × slice" line and the total in the readout. "450 g" under a
      // single fillet read as that fillet weighing 450 g.
      labelFor: (index) => '${pieceTiers[anchors[index].tier - 1].grams} g',
      onChanged: onChanged,
    );
  }
}
