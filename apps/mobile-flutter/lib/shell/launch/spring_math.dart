/// The vocabulary the launch intro is written in: clamped windows, a few
/// polynomial eases and a struck spring, all as pure functions of time.
///
/// Time is in milliseconds throughout, the unit the choreography is timed in,
/// so a beat reads `interval(t, 470, 62)` rather than a Duration dance. The
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

double easeInOutCubic(double p) =>
    p < 0.5 ? 4 * p * p * p : 1 - math.pow(-2 * p + 2, 3).toDouble() / 2;

double easeInQuad(double p) => p * p;

/// A spring struck from rest, tracing its displacement: 0 at [t] = 0, out to
/// a first peak of about 0.55 to 0.75 (lower damping, higher peak), then
/// ringing down to 0. [hz] is the natural frequency, [zeta] the damping
/// ratio, which must be under 1.
///
/// The shape of every reaction in the intro: the chain a car shoves rocking
/// back, a car's top leaning on, the ripple while the app loads.
double springKick(double t, double hz, double zeta) {
  if (t <= 0) return 0;
  final w = 2 * math.pi * hz / 1000;
  final wd = w * math.sqrt(1 - zeta * zeta);
  return math.exp(-zeta * w * t) * math.sin(wd * t);
}

/// The displacement of a spring-mass that meets a stop at [speed] (units per
/// millisecond), [t] ms after contact: [springKick] scaled so its starting
/// velocity is the speed it arrived with. A faster letter presses harder into
/// the one ahead, with no jump at contact.
double impactDisplacement(double t, double speed, double hz, double zeta) {
  final w = 2 * math.pi * hz / 1000;
  return speed / (w * math.sqrt(1 - zeta * zeta)) * springKick(t, hz, zeta);
}
