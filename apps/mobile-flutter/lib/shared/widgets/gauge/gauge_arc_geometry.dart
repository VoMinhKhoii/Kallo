/// The rounded 240° gauge dial's geometry — pure path maths, no widgets.
///
/// A sector with all four corners rounded, drawn as two segments (the filled
/// part and what is left) separated by a padding gap, so the remainder reads as
/// its own rounded pill rather than as a track running underneath the fill.
///
/// The proportions are fixed rather than free parameters: band = ¼ of the outer
/// radius and corner = 4⁄9 of the band. At the reference size (outer 72) those
/// resolve to the 54/72 radii and the corner radius of 8 that the dial was
/// drawn at, and they hold their look when the dial is scaled — the macro dials
/// are the same shape at 44.
///
/// Angles are DEGREES in the maths convention (counter-clockwise positive, y
/// up); [arcPoint] flips y for Flutter's screen space. The dial sweeps
/// CLOCKWISE from [kGaugeStartAngle] down to [kGaugeEndAngle].
library;

import 'dart:math' as math;
import 'dart:ui';

/// 210° → −30°: a 240° sweep with the 60° gap centred at the bottom.
const double kGaugeStartAngle = 210;
const double kGaugeEndAngle = -30;

/// The gap between the filled segment and the remainder.
const double kGaugePadAngle = 4;

const double _bandRatio = 0.25;
const double _cornerRatio = 4 / 9;

const double _deg = math.pi / 180;

/// A point at [radius] and [angle] (degrees, y-up) around [center].
Offset arcPoint(Offset center, double radius, double angle) => Offset(
  center.dx + radius * math.cos(angle * _deg),
  center.dy - radius * math.sin(angle * _deg),
);

/// One rounded sector, sweeping clockwise from [startAngle] down to [endAngle].
///
/// Returns an EMPTY path when the sweep is too narrow to hold its own corners —
/// below that the corner arcs would cross and the sector turns inside out, so a
/// sliver is dropped rather than drawn wrong. Callers get an empty path at 0%
/// and at 100% (where one of the two segments has no sweep left).
Path roundedSectorPath({
  required Offset center,
  required double innerRadius,
  required double outerRadius,
  required double startAngle,
  required double endAngle,
  required double cornerRadius,
}) {
  final path = Path();
  final outerInset = math.asin(cornerRadius / (outerRadius - cornerRadius)) /
      _deg;
  final innerInset = math.asin(cornerRadius / (innerRadius + cornerRadius)) /
      _deg;
  final sweep = startAngle - endAngle;
  if (sweep < 2 * math.max(outerInset, innerInset) + 0.5) return path;

  // Where each corner circle touches the sector's straight radial edge.
  final outerEdge = (outerRadius - cornerRadius) * math.cos(outerInset * _deg);
  final innerEdge = (innerRadius + cornerRadius) * math.cos(innerInset * _deg);
  final corner = Radius.circular(cornerRadius);

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

/// The two halves of a dial at [progress] (0–1): what has been used, and what
/// is left. Over 1 the fill takes the whole sweep and [remainder] is empty.
({Path filled, Path remainder}) gaugePaths({
  required Offset center,
  required double outerRadius,
  required double progress,
}) {
  final band = outerRadius * _bandRatio;
  final innerRadius = outerRadius - band;
  final cornerRadius = band * _cornerRatio;
  final span = (kGaugeStartAngle - kGaugeEndAngle) - kGaugePadAngle;
  final mid = kGaugeStartAngle - span * progress.clamp(0.0, 1.0);

  Path segment(double from, double to) => roundedSectorPath(
    center: center,
    innerRadius: innerRadius,
    outerRadius: outerRadius,
    startAngle: from,
    endAngle: to,
    cornerRadius: cornerRadius,
  );

  return (
    filled: segment(kGaugeStartAngle, mid),
    remainder: segment(mid - kGaugePadAngle, kGaugeEndAngle),
  );
}

/// Where the dial's two tips sit below its centre — the line the readout's
/// secondary text is centred on, so type and dial share one baseline.
double gaugeTipOffset(double outerRadius) => outerRadius / 2;
