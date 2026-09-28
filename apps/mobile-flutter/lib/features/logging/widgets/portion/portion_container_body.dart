import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../models/nutrition/vessel.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/portion/portion_anchors.dart';
import '../../logic/portion/vessel_data.dart';
import '../../logic/portion/vessel_glyph_scale.dart';
import 'portion_glyphs.dart';
import 'portion_readout.dart';
import 'ruler/portion_ruler_control.dart';

/// Container layout: the SAME tape ruler the piece branch uses, with bowl /
/// plate / cup silhouettes on it.
///
/// It used to be a separate control — a flex-weighted glyph row over a plain
/// gram slider — which meant one sheet showed two different sliders depending
/// on what you ate. The scale is shared now; only the art and the tier labels
/// differ.
class PortionContainerBody extends StatelessWidget {
  const PortionContainerBody({
    super.key,
    required this.family,
    required this.anchors,
    required this.grams,
    required this.min,
    required this.max,
    required this.kcal,
    required this.sliderLabel,
    required this.onChanged,
  });

  final ContainerFamily family;
  final List<PortionAnchor> anchors;
  final int grams;
  final int min;
  final int max;
  final double kcal;
  final String sliderLabel;
  final ValueChanged<int> onChanged;

  List<VesselTierData> get _tiers => [
    for (final a in anchors) vesselFamilies[family]![a.tier]!,
  ];

  /// Nearest tier to the CURRENT grams — the same rule the assumption line
  /// uses, so the card and this sheet can never name different vessels.
  PortionAnchor get _nearest => nearestAnchor(anchors, grams);

  @override
  Widget build(BuildContext context) {
    final tiers = _tiers;
    final ratios = vesselWidthRatios(tiers);
    final nearest = _nearest;
    final nearestTier =
        tiers[anchors.indexWhere((a) => a.tier == nearest.tier)];

    return Column(
      children: [
        PortionReadout(grams: grams, kcal: kcal),
        const SizedBox(height: KalloSpacing.sp3),
        PortionRulerControl(
          anchors: anchors,
          grams: grams,
          min: min,
          max: max,
          sliderLabel: sliderLabel,
          // Resolve the tier from the CANDIDATE grams, not from the committed
          // ones. Reading `nearestTier` here paired the anchor nearest `g` with
          // the size of the tier nearest `grams`, so dragging across a tier
          // boundary announced "250 g — đĩa lớn (16 cm)" — this class exists to
          // stop the sheet naming a vessel the card wouldn't.
          valueTextFor: (g) {
            final at = nearestAnchor(anchors, g);
            final tier = tiers[anchors.indexWhere((a) => a.tier == at.tier)];
            return '$g g — ${at.label} (${tier.sizeLabel})';
          },
          glyphBandAspect: vesselBandAspect(tiers, ratios),
          glyphBuilder:
              (index, column) => PortionVesselGlyph(
                asset: tiers[index].asset,
                width: column * ratios[index],
                label: '${anchors[index].label} (${tiers[index].sizeLabel})',
                selected: anchors[index].tier == nearest.tier,
                onTap: () {
                  HapticFeedback.selectionClick();
                  onChanged(anchors[index].value.round());
                },
              ),
          labelFor: (index) => tiers[index].sizeLabel,
          onChanged: onChanged,
        ),
        const SizedBox(height: KalloSpacing.sp2),
        Text(
          '${nearest.label} · ${nearestTier.sizeLabel}',
          textAlign: TextAlign.center,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: dashMeta(),
        ),
      ],
    );
  }
}
