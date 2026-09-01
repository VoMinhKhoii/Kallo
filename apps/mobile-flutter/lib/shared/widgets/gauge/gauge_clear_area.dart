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
/// to [depthBottom] below the centre — the TIGHT bound, i.e. the true minimum
/// of [gaugeClearHalfWidth] over that band.
///
/// It is worth being exact here rather than merely safe. The first version
/// took the ring at the band's deeper edge and the mouth at its shallower one
/// and returned the larger: a valid lower bound, but a badly loose one for any
/// line that straddles the tips, because it credits neither term with the
/// width it actually has where the other is at its worst. On the Log header's
/// compact dial that bound read 24pt for a line with 39pt of real clearance,
/// so `/138g` was scaled to ~0.67 and shipped at an effective 8.7pt against
/// the 12 it asks for — the "goals too small" the device QA reported
/// (2026-09-01).
///
/// The exact minimum is cheap because the shape of the function is known:
/// above the centre only the shrinking ring is in play, below it the ring
/// keeps shrinking while the mouth opens, so the two cross exactly once — at
/// `depth = inner / 2`, where both equal `inner·√3/2`. That crossing is the
/// only interior minimum, which makes three samples exhaustive: the two edges,
/// plus the crossing when the band contains it.
double gaugeClearHalfWidthForBand(
  double outerRadius,
  double depthTop,
  double depthBottom,
) {
  var narrowest = math.min(
    gaugeClearHalfWidth(outerRadius, depthTop),
    gaugeClearHalfWidth(outerRadius, depthBottom),
  );
  final crossing = gaugeInnerRadius(outerRadius) / 2;
  if (crossing > depthTop && crossing < depthBottom) {
    narrowest = math.min(
      narrowest,
      gaugeClearHalfWidth(outerRadius, crossing),
    );
  }
  return narrowest;
}
