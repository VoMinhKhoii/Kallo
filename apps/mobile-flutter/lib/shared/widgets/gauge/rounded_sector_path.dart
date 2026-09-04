/// The rounded sector the gauge dial is built from — one primitive, no widgets.
///
/// A band between two radii, swept through an angle, with all four corners
/// rounded. [gauge_arc_geometry.dart] composes two of these into a dial; this
/// file knows nothing about dials, only about the shape.
///
/// Angles are DEGREES in the maths convention (counter-clockwise positive, y
/// up); [arcPoint] flips y for Flutter's screen space.
///
/// The web draws the same dial from `lib/core/ui/gauge-arc-geometry.ts`, which
/// carries this shape too — same constants, same names, same corner fitting.
/// Change the maths here and change it there, or the two platforms drift.
library;

import 'dart:math' as math;
import 'dart:ui';

const double _deg = math.pi / 180;

/// A point at [radius] and [angle] (degrees, y-up) around [center].
Offset arcPoint(Offset center, double radius, double angle) => Offset(
  center.dx + radius * math.cos(angle * _deg),
  center.dy - radius * math.sin(angle * _deg),
);

/// A sweep at or below this holds nothing at all — the two segments of a dial
/// at exactly 0% and exactly 100% — and draws nothing.
const double _degenerateSweep = 0.01;

/// The largest corner radius a [sweep]-wide sector can hold without its corner
/// arcs crossing.
///
/// Each corner eats an angular inset, and the two on one edge must fit inside
/// the sweep (less the 0.5° of breathing room the shape has always kept). With
/// h the half-sweep left over and s = sin h, `asin(c / (R − c)) ≤ h` gives
/// `c ≤ sR / (1 + s)` on the outer edge and `asin(c / (r + c)) ≤ h` gives
/// `c ≤ sr / (1 − s)` on the inner; the tighter of the two wins.
double _cornerThatFits(double innerRadius, double outerRadius, double sweep) {
  final half = (sweep - 0.5) / 2 * _deg;
  if (half <= 0) return 0;
  final s = math.sin(half);
  final outerFit = s * outerRadius / (1 + s);
  final innerFit = s >= 1 ? double.infinity : s * innerRadius / (1 - s);
  return math.min(outerFit, innerFit);
}

/// One rounded sector, sweeping clockwise from [startAngle] down to [endAngle].
///
/// [cornerRadius] is a MAXIMUM, not a fixed size. A narrow sweep cannot hold the
/// nominal corners — the corner arcs would cross and the sector would turn
/// inside out — so the corner shrinks to the largest one that fits (see
/// [_cornerThatFits]) and the sliver is drawn at its true width. Above about a
/// 15° sweep the nominal radius always fits, so a dial at any ordinary value is
/// the exact shape it has always been.
///
/// Returns an EMPTY path only for a sweep with nothing in it, which is what 0%
/// and 100% give (one of the two segments has no sweep left).
Path roundedSectorPath({
  required Offset center,
  required double innerRadius,
  required double outerRadius,
  required double startAngle,
  required double endAngle,
  required double cornerRadius,
}) {
  final path = Path();
  final sweep = startAngle - endAngle;
  if (sweep <= _degenerateSweep) return path;

  final radius = math.min(
    cornerRadius,
    _cornerThatFits(innerRadius, outerRadius, sweep),
  );
  final outerInset = math.asin(radius / (outerRadius - radius)) / _deg;
  final innerInset = math.asin(radius / (innerRadius + radius)) / _deg;

  // Where each corner circle touches the sector's straight radial edge.
  final outerEdge = (outerRadius - radius) * math.cos(outerInset * _deg);
  final innerEdge = (innerRadius + radius) * math.cos(innerInset * _deg);
  final corner = Radius.circular(radius);

  final outerStart = arcPoint(center, outerEdge, startAngle);
  final innerEnd = arcPoint(center, innerEdge, endAngle);
  path
    ..moveTo(outerStart.dx, outerStart.dy)
    ..arcToPoint(
      arcPoint(center, outerRadius, startAngle - outerInset),
      radius: corner,
    )
    ..arcToPoint(
      arcPoint(center, outerRadius, endAngle + outerInset),
      radius: Radius.circular(outerRadius),
      largeArc: sweep - 2 * outerInset > 180,
    )
    ..arcToPoint(arcPoint(center, outerEdge, endAngle), radius: corner)
    ..lineTo(innerEnd.dx, innerEnd.dy)
    ..arcToPoint(
      arcPoint(center, innerRadius, endAngle + innerInset),
      radius: corner,
    )
    ..arcToPoint(
      arcPoint(center, innerRadius, startAngle - innerInset),
      radius: Radius.circular(innerRadius),
      largeArc: sweep - 2 * innerInset > 180,
      clockwise: false,
    )
    ..arcToPoint(arcPoint(center, innerEdge, startAngle), radius: corner)
    ..close();
  return path;
}
