/// Anchor + layout arithmetic for the portion picker.
///
/// Vendored 1:1 from the web's
/// `components/logging/feed/meal-entry/portion/portion-anchors.ts`. The numbers
/// here decide what the picker may claim and how big each silhouette draws, so
/// they must stay identical to web — a divergence would let the two clients
/// commit different tiers for the same grams.
library;

import 'dart:math' as math;

import '../../../../models/vessel.dart';
import 'vessel_data.dart';

class PortionAnchor {
  /// 1–4 for containers, 1–5 for pieces.
  final int tier;
  final int value;
  final String label;

  const PortionAnchor({
    required this.tier,
    required this.value,
    required this.label,
  });
}

/// Gram envelope around the anchors the picker lets the user roam in.
const double envelopeMinFactor = 0.6;
const double envelopeMaxFactor = 1.2;

/// A piece portion may claim a tier's label only within ±10% of its grams.
const double claimBand = 0.1;

/// The ruler's slider runs in integer position space, not grams.
const int positionMax = 1000;

class GramEnvelope {
  final int min;
  final int max;

  const GramEnvelope(this.min, this.max);
}

GramEnvelope gramEnvelope(List<PortionAnchor> anchors) => GramEnvelope(
  (anchors.first.value * envelopeMinFactor).round(),
  (anchors.last.value * envelopeMaxFactor).round(),
);

List<PortionAnchor> buildContainerAnchors(
  ContainerVessel vessel,
  String locale,
) {
  return [
    for (var tier = 1; tier <= 4; tier++)
      PortionAnchor(
        tier: tier,
        value: midG(vessel.family, tier, vessel.dishClass),
        label: vesselFamilies[vessel.family]![tier]!.label(locale),
      ),
  ];
}

List<PortionAnchor> buildPieceAnchors(PieceVessel vessel, String locale) {
  return [
    for (final (index, tier) in pieceTiers.indexed)
      PortionAnchor(
        tier: index + 1,
        value: vessel.count * tier.grams,
        label: tier.label(locale),
      ),
  ];
}

/// The anchors for whichever family this vessel belongs to.
List<PortionAnchor> buildAnchors(ClientVessel vessel, String locale) =>
    switch (vessel) {
      ContainerVessel() => buildContainerAnchors(vessel, locale),
      PieceVessel() => buildPieceAnchors(vessel, locale),
    };

/// Nearest anchor by absolute gram distance — always returns one.
PortionAnchor nearestAnchor(List<PortionAnchor> anchors, int grams) {
  return anchors.reduce(
    (best, anchor) =>
        (anchor.value - grams).abs() < (best.value - grams).abs()
            ? anchor
            : best,
  );
}

/// The anchor a portion may honestly claim: the nearest one, but only when the
/// grams sit within [claimBand] of its value. `null` means "custom portion" —
/// the single source of truth for display, commit, and the assumption line.
PortionAnchor? claimedAnchor(List<PortionAnchor> anchors, int grams) {
  final nearest = nearestAnchor(anchors, grams);
  return (grams - nearest.value).abs() <= nearest.value * claimBand
      ? nearest
      : null;
}

/// The tier a piece portion may be committed with: the claimed one, or the
/// current tier left untouched when the portion is custom — never a tier the
/// picker refused to display.
int committedPieceTier(int current, List<PortionAnchor> anchors, int grams) {
  return claimedAnchor(anchors, grams)?.tier ?? current;
}

/// The vessel to commit alongside [grams]. Containers re-point to the nearest
/// anchor (which is what they display); pieces only re-point to a tier the UI
/// actually claimed, and otherwise leave the tier untouched.
ClientVessel repointVessel(
  ClientVessel vessel,
  List<PortionAnchor> anchors,
  int grams,
) => switch (vessel) {
  PieceVessel() => vessel.copyWith(
    tier: committedPieceTier(vessel.tier, anchors, grams),
  ),
  ContainerVessel() => vessel.copyWith(tier: nearestAnchor(anchors, grams).tier),
};

/// Equal-spaced track positions (as a 0–1 fraction) — one per anchor, centred
/// in its slot. Web returns percentages; a fraction is what Flutter's layout
/// maths wants, and every call site multiplies by a width anyway.
List<double> anchorPositions(int count) => [
  for (var i = 0; i < count; i++) (i + 0.5) / count,
];

/// Position-space breakpoints: track start, each anchor, track end.
List<double> positionBreaks(int count) => [
  0,
  ...anchorPositions(count).map((p) => p * positionMax),
  positionMax.toDouble(),
];

/// Slider step in position space. Taken from the flattest segment (the largest
/// position-per-gram slope), so one arrow press moves at least 1 g in every
/// segment — the coarse segments simply move more.
int rulerStep(List<num> gramBreaks, List<double> positions) {
  var steepest = 0.0;
  for (var i = 0; i < positions.length - 1; i += 1) {
    final dGrams = gramBreaks[i + 1] - gramBreaks[i];
    if (dGrams <= 0) continue;
    steepest = math.max(steepest, (positions[i + 1] - positions[i]) / dGrams);
  }
  return math.max(1, steepest.ceil());
}

final int _largestPieceGrams = pieceTiers.last.grams;

/// Relative visual area of a piece portion. A silhouette is a 2D projection of
/// a 3D amount, so its *area* — not its height — is what has to scale as
/// `grams^(2/3)` for twice the food to look twice as big. Sizing height alone
/// (as the ruler used to) only holds if every asset shares an aspect ratio: at
/// aspect 2.17 a tier-5 fish came out 130px wide in a ~54px column, overlapping
/// its neighbour and spilling off the row.
double _pieceAreaRatio(int grams) =>
    math.pow(grams / _largestPieceGrams, 2 / 3).toDouble();

/// Widest unnormalised glyph across every piece asset. Dividing by it makes the
/// single widest silhouette exactly fill its column and every other one
/// narrower, so no glyph can overflow its column whatever the art's aspect
/// ratios are.
final double _widestPieceGlyph = pieceTiers
    .expand(
      (tier) => tier.assets.map(
        (asset) => math.sqrt(_pieceAreaRatio(tier.grams) * asset.aspect),
      ),
    )
    .reduce(math.max);

/// Ruler glyph width as a fraction (0–1] of its grid column, for art of the
/// given aspect at the given per-piece grams. Height follows from the aspect,
/// so the pair encodes area while staying resolution-independent — the row
/// scales with the picker instead of hard-coding pixels. Count-independent by
/// design.
double glyphWidthRatio(int grams, double aspect) =>
    math.sqrt(_pieceAreaRatio(grams) * aspect) / _widestPieceGlyph;

/// Tallest glyph any kind can produce, in column widths.
final double _tallestPieceGlyph = pieceTiers
    .expand(
      (tier) => tier.assets.map(
        (asset) => glyphWidthRatio(tier.grams, asset.aspect) / asset.aspect,
      ),
    )
    .reduce(math.max);

/// Aspect ratio (width / height) for the glyph row, so its height is always the
/// tallest glyph the tallest kind can produce. Without it the row would size to
/// its own content and the picker would change height between a flat fillet and
/// an upright drumstick; pinning it keeps one silhouette baseline for every meal.
double glyphRowAspect(int columnCount) => columnCount / _tallestPieceGlyph;

/// Piecewise-linear interpolation of [x] from the [xs] domain onto [ys].
double interpolate(double x, List<num> xs, List<num> ys) {
  if (x <= xs.first) return ys.first.toDouble();
  if (x >= xs.last) return ys.last.toDouble();
  for (var i = 0; i < xs.length - 1; i += 1) {
    if (x <= xs[i + 1]) {
      final f = (x - xs[i]) / (xs[i + 1] - xs[i]);
      return (ys[i] + f * (ys[i + 1] - ys[i])).toDouble();
    }
  }
  return ys.last.toDouble();
}
