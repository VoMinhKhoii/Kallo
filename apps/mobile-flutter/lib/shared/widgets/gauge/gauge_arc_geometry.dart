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
/// The sector itself lives in `rounded_sector_path.dart`; this file is only
/// how a dial arranges two of them. Angles are DEGREES in the maths convention
/// (counter-clockwise positive, y up), and the dial sweeps CLOCKWISE from
/// [kGaugeStartAngle] down to [kGaugeEndAngle].
library;

import 'dart:ui';

import 'rounded_sector_path.dart';

/// 210° → −30°: a 240° sweep with the 60° gap centred at the bottom.
const double kGaugeStartAngle = 210;
const double kGaugeEndAngle = -30;

/// The gap between the filled segment and the remainder.
const double kGaugePadAngle = 4;

/// The thinnest sliver a dial will draw for a real, non-zero value. Below this
/// the mark would be sub-pixel on the small dials and read as nothing at all,
/// which is the thing being fixed; exact 0 and exact 1 stay absolute.
const double kGaugeMinSweep = 3.5;

const double _bandRatio = 0.25;
const double _cornerRatio = 4 / 9;

/// The two halves of a dial at [progress] (0–1): what has been used, and what
/// is left. Over 1 the fill takes the whole sweep and [remainder] is empty.
///
/// Strictly between the two, BOTH halves are held to [kGaugeMinSweep], so a
/// barely-started day still shows its fill and a nearly-finished one still
/// shows the track it has left. Only an exact 0 or an exact 1 empties a half.
({Path filled, Path remainder}) gaugePaths({
  required Offset center,
  required double outerRadius,
  required double progress,
}) {
  final band = outerRadius * _bandRatio;
  final innerRadius = outerRadius - band;
  final cornerRadius = band * _cornerRatio;
  final span = (kGaugeStartAngle - kGaugeEndAngle) - kGaugePadAngle;
  // NaN (0 eaten / 0 target) survives clamp in Dart and would poison every
  // angle downstream, so it reads as an untouched dial, the same way
  // [gaugeOverCapPath] refuses it.
  final p = progress.isNaN ? 0.0 : progress.clamp(0.0, 1.0);
  final minShare = kGaugeMinSweep / span;
  final shown = p <= 0
      ? 0.0
      : p >= 1
      ? 1.0
      : p.clamp(minShare, 1 - minShare);
  final mid = kGaugeStartAngle - span * shown;

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

/// The over-target cap: the tail of a FULL dial repainted in the off-target
/// colour, sized to the share of consumption past the target (consumed 2,485
/// of 1,844 → the last ~26% of the sweep). Native pass, 2026-08-31 — "over"
/// is information, not an alarm, so the cap is terracotta, never red, and a
/// tiny overshoot still gets a legible 8° sliver.
Path gaugeOverCapPath({
  required Offset center,
  required double outerRadius,
  required double progress,
}) {
  // `> 1` rather than `!(<= 1)`: a NaN progress (0 eaten / 0 target) fails
  // both comparisons, and must fall out here instead of poisoning the path.
  if (!(progress > 1)) return Path();
  final band = outerRadius * _bandRatio;
  final innerRadius = outerRadius - band;
  final cornerRadius = band * _cornerRatio;
  final span = (kGaugeStartAngle - kGaugeEndAngle) - kGaugePadAngle;
  final overShare = (1 - 1 / progress).clamp(8 / span, 1.0);
  return roundedSectorPath(
    center: center,
    innerRadius: innerRadius,
    outerRadius: outerRadius,
    startAngle: kGaugeStartAngle - span * (1 - overShare),
    endAngle: kGaugeStartAngle - span,
    cornerRadius: cornerRadius,
  );
}

/// Where the dial's two tips sit below its centre — the line the readout's
/// secondary text is centred on, so type and dial share one baseline.
double gaugeTipOffset(double outerRadius) => outerRadius / 2;

/// The inner edge of the band — the radius of the dial's clear middle.
double gaugeInnerRadius(double outerRadius) =>
    outerRadius - outerRadius * _bandRatio;
