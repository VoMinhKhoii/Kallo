import 'dart:math' as math;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../../../models/nutrition/vessel.dart';
import '../../../../logic/manual/manual_amount.dart';
import '../../../../logic/portion/portion_anchors.dart';
import '../../../../logic/portion/vessel_data.dart';
import '../../../../logic/portion/vessel_glyph_scale.dart';
import '../../../portion/portion_glyphs.dart';
import '../../../portion/ruler/portion_ruler_control.dart';

/// A food's vessels on the scan sheet's tape — pieces for meat, poultry and
/// fish; bowls, plates or cups for what is served in one — so "about a medium
/// cut" is a drag instead of a guess at grams. The tape scrolls under a fixed
/// needle; tapping a silhouette jumps to it. Every label is in grams, the unit
/// the food is logged in.
class ManualVesselRuler extends StatelessWidget {
  const ManualVesselRuler({
    super.key,
    required this.vessel,
    required this.anchors,
    required this.grams,
    required this.onChanged,
  });

  final ClientVessel vessel;
  final List<PortionAnchor> anchors;
  final int grams;
  final ValueChanged<int> onChanged;

  /// The approved canvas's silhouette band (E4: a medium cut ~73pt tall,
  /// bowls 58–84pt wide). Pieces and bowls draw at the portion picker's own
  /// size inside it; an upright family whose tallest glyph would overrun it
  /// (cups, ~150pt at full size) shrinks to fit, so every tape is one height.
  static const double _maxBand = 76;

  /// One vessel's column: the strip's 11pt pitch × 8 graduations.
  static const double _column = 88;

  @override
  Widget build(BuildContext context) {
    final range = manualRulerRange(anchors);
    final claimed = claimedAnchor(anchors, grams);
    void jump(int index) {
      HapticFeedback.selectionClick();
      onChanged(anchors[index].value.round());
    }

    final tiers = switch (vessel) {
      ContainerVessel(:final family) => [
        for (final a in anchors) vesselFamilies[family]![a.tier]!,
      ],
      PieceVessel() => const <VesselTierData>[],
    };
    final ratios = tiers.isEmpty ? const <double>[] : vesselWidthRatios(tiers);
    // Width / height of the band, in column widths, at full size.
    final aspect =
        tiers.isEmpty
            ? glyphRowAspect(anchors.length) / anchors.length
            : vesselBandAspect(tiers, ratios);
    final scale = math.min(1.0, _maxBand * aspect / _column);

    Widget glyph(int i, double column) => switch (vessel) {
      PieceVessel(:final kind) => PortionGlyph(
        tier: pieceTiers[anchors[i].tier - 1],
        kind: kind,
        columnWidth: column * scale,
        label: anchors[i].label,
        selected: anchors[i].tier == claimed?.tier,
        onTap: () => jump(i),
      ),
      ContainerVessel() => PortionVesselGlyph(
        asset: tiers[i].asset,
        width: column * ratios[i] * scale,
        label: '${anchors[i].label} (${tiers[i].sizeLabel})',
        selected: anchors[i].tier == claimed?.tier,
        onTap: () => jump(i),
      ),
    };

    // The approved canvas fades the tape into the card at both ends (16% each
    // side), so the vessels scrolling off read as more tape, not a clipped edge.
    return ShaderMask(
      blendMode: BlendMode.dstIn,
      shaderCallback:
          (bounds) => const LinearGradient(
            colors: [
              Color(0x00000000),
              Color(0xFF000000),
              Color(0xFF000000),
              Color(0x00000000),
            ],
            stops: [0, 0.16, 0.84, 1],
          ).createShader(bounds),
      child: PortionRulerControl(
        anchors: anchors,
        grams: grams,
        min: range.min,
        max: range.max,
        sliderLabel: 'logging.manualLogging.amountSlider'.tr(),
        valueTextFor: (g) {
          final at = claimedAnchor(anchors, g);
          return at == null ? '$g g' : '$g g — ${at.label}';
        },
        glyphBandAspect: aspect / scale,
        glyphBuilder: glyph,
        labelFor:
            (i) => '${formatAnchorGrams(anchors[i].value.roundToDouble())} g',
        onChanged: onChanged,
      ),
    );
  }
}
