import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../models/vessel.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/nham_theme.dart';
import '../../logic/portion/portion_anchors.dart';
import '../../logic/portion/vessel_data.dart';
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

  /// Glyph widths as a fraction of a column, normalised so the largest vessel
  /// exactly fills its slot. Volume enters as a cube root — a bowl twice the
  /// volume reads ~26% wider, not twice as wide — and the aspect turns that
  /// height-like scale into the width the row lays out on.
  List<double> get _widthRatios {
    final largestMl = _tiers.last.ml;
    final weights = [
      for (final tier in _tiers)
        (math.pow(tier.ml / largestMl, 1 / 3) * tier.asset.aspect).toDouble(),
    ];
    final widest = weights.reduce(math.max);
    return [for (final w in weights) w / widest];
  }

  /// Nearest tier to the CURRENT grams — the same rule the assumption line
  /// uses, so the card and this sheet can never name different vessels.
  PortionAnchor get _nearest => nearestAnchor(anchors, grams);

  @override
  Widget build(BuildContext context) {
    final ratios = _widthRatios;
    final tiers = _tiers;
    final nearest = _nearest;
    final nearestTier = tiers[anchors.indexWhere((a) => a.tier == nearest.tier)];
    // Tallest glyph in column widths — pins the band so the sheet doesn't
    // change height between a flat platter and an upright cup.
    final tallest = [
      for (final (i, tier) in tiers.indexed) ratios[i] / tier.asset.aspect,
    ].reduce(math.max);

    return Column(
      children: [
        PortionReadout(grams: grams, kcal: kcal),
        const SizedBox(height: NhamSpacing.sp3),
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
          glyphBandAspect: 1 / tallest,
          glyphBuilder: (index, column) => PortionVesselGlyph(
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
        const SizedBox(height: NhamSpacing.sp2),
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
