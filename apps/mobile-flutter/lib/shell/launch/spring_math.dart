/// The vocabulary the launch intro is written in: clamped windows, a few
/// polynomial eases and a spring, all as pure functions of time.
///
/// Time is in milliseconds throughout, the unit the choreography is timed in,
/// so a beat reads `interval(t, 60, 200)` rather than a Duration dance. The
/// curves are the exact polynomials of the design preview the direction was
/// picked from (https://claude.ai/artifact/EfTRoQiPwTf5JXYpHvuAB9), not
/// Flutter's `Curves` cubic-bezier approximations of them, so the app moves
/// the way the preview does.
library;

import 'dart:math' as math;

/// Progress through the window that opens at [start] and lasts [length],
/// clamped to 0..1.
double interval(double t, double start, double length) =>
    ((t - start) / length).clamp(0.0, 1.0).toDouble();

double easeOutCubic(double p) => 1 - math.pow(1 - p, 3).toDouble();

double easeInCubic(double p) => p * p * p;

double easeInOutCubic(double p) =>
    p < 0.5 ? 4 * p * p * p : 1 - math.pow(-2 * p + 2, 3).toDouble() / 2;

double easeInQuad(double p) => p * p;

/// A spring released [t] ms ago, travelling from 0 to 1: [hz] is its natural
/// frequency, [zeta] its damping ratio. Under 1 it overshoots before it
/// settles (0.62 overshoots about 8%, 0.78 about 2%); 0 before release.
double springStep(double t, double hz, double zeta) {
  if (t <= 0) return 0;
  final w = 2 * math.pi * hz / 1000;
  final wd = w * math.sqrt(1 - zeta * zeta);
  return 1 -
      math.exp(-zeta * w * t) *
          (math.cos(wd * t) + zeta * w / wd * math.sin(wd * t));
}
