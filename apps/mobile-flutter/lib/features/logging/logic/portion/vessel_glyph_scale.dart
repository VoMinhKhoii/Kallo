/// How a row of vessel silhouettes is sized on a portion ruler — shared by the
/// meal card's portion picker and the scan sheet's cup ruler, so one cup never
/// draws two sizes.
library;

import 'dart:math' as math;

import 'vessel_data.dart';

/// Glyph widths as a fraction of a column, normalised so the largest vessel
/// exactly fills its slot. Volume enters as a cube root — a bowl twice the
/// volume reads ~26% wider, not twice as wide — and the aspect turns that
/// height-like scale into the width the row lays out on.
List<double> vesselWidthRatios(List<VesselTierData> tiers) {
  final largestMl = tiers.last.ml;
  final weights = [
    for (final tier in tiers)
      (math.pow(tier.ml / largestMl, 1 / 3) * tier.asset.aspect).toDouble(),
  ];
  final widest = weights.reduce(math.max);
  return [for (final w in weights) w / widest];
}

/// The silhouette band's width / height in column widths: pinned to the
/// TALLEST glyph, so the band doesn't change height between a flat platter
/// and an upright cup.
double vesselBandAspect(List<VesselTierData> tiers, List<double> ratios) =>
    1 /
    [
      for (final (i, tier) in tiers.indexed) ratios[i] / tier.asset.aspect,
    ].reduce(math.max);
