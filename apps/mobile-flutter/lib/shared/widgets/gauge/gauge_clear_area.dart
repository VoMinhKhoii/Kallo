/// How much CLEAR room a dial's readout has inside its own arc.
///
/// Separate from the arc's path maths next door: that file draws the band,
/// this one answers "how wide may a line be here", which is what
/// [GaugeReadoutLine] needs and nothing that paints needs at all.
library;

import 'dart:math' as math;

import 'gauge_arc_geometry.dart';

const double _deg = math.pi / 180;

/// Half the CLEAR width available [depth] below the dial's centre (negative is
/// above it), i.e. how far a readout line may run each side before it touches
/// the band.
///
/// Two things open the space up, and the larger wins:
///
///  * the **ring** — inside the band's inner circle, the chord shrinks as a
///    line sits further from the centre: `√(inner² − depth²)`;
///  * the **mouth** — the sweep stops 60° either side of straight down, so
///    below the tips the band is simply absent and the clear area widens again
///    along that wedge: `depth · tan 60°`.
///
/// Added for the 3-digit collision found on device (2026-09-01): `202g` and
/// `547g` ran straight across the stroke on both sides, because the readout
/// `Text`s are `softWrap: false` with visible overflow and nothing had ever
/// bounded them.
double gaugeClearHalfWidth(double outerRadius, double depth) {
  final inner = gaugeInnerRadius(outerRadius);
  final ring = depth.abs() < inner
      ? math.sqrt(inner * inner - depth * depth)
      : 0.0;
  final mouth = depth > 0 ? depth * math.tan(60 * _deg) : 0.0;
  return math.max(ring, mouth);
}

/// The clear half-width guaranteed across a whole line box spanning [depthTop]
/// to [depthBottom] below the centre.
///
/// A safe LOWER bound rather than a sample: the ring term only shrinks as a
/// point moves away from the centre and the mouth term only grows as it moves
/// down, so evaluating the ring at the deeper edge and the mouth at the
/// shallower one bounds the true clearance everywhere between them. Sampling a
/// few points instead could step over the crossing where the two terms swap
/// and report more room than the line actually has.
double gaugeClearHalfWidthForBand(
  double outerRadius,
  double depthTop,
  double depthBottom,
) {
  final inner = gaugeInnerRadius(outerRadius);
  final deepest = math.max(depthTop.abs(), depthBottom.abs());
  final ring = deepest < inner
      ? math.sqrt(inner * inner - deepest * deepest)
      : 0.0;
  final shallowest = math.min(depthTop, depthBottom);
  final mouth = shallowest > 0 ? shallowest * math.tan(60 * _deg) : 0.0;
  return math.max(ring, mouth);
}
