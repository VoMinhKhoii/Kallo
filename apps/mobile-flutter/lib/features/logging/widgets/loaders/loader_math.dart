import 'package:flutter/animation.dart';

/// SMIL sampling helpers shared by every loader painter.
///
/// The loaders are ports of SMIL `<animate>` elements, where each element runs
/// on its OWN duration and may pre-roll with a negative `begin`. These helpers
/// reproduce that per-element timing from one monotonic clock, so a loader with
/// four differently-timed bars needs no common period.

/// Fraction through [dur] for an element that started at [begin] seconds.
///
/// A negative [begin] pre-rolls, exactly as SMIL does. Always in `[0, 1)`.
double loaderPhase(double seconds, double dur, {double begin = 0}) {
  if (dur <= 0) return 0;
  final t = (seconds - begin) % dur;
  return (t < 0 ? t + dur : t) / dur;
}

/// `calcMode="linear"` sampling of a SMIL `values` list, whose keyframes are
/// evenly spaced across the duration.
double sampleLinear(List<double> values, double phase) {
  if (values.isEmpty) return 0;
  if (values.length == 1) return values.first;
  final p = phase.clamp(0.0, 1.0);
  final segments = values.length - 1;
  final x = p * segments;
  final i = x.floor().clamp(0, segments - 1);
  return values[i] + (values[i + 1] - values[i]) * (x - i);
}

/// `calcMode="spline"` with a single keySplines segment. SVG keySplines and CSS
/// cubic-beziers are the same curve, so Flutter's [Cubic] is exact.
double sampleSpline(double from, double to, double phase, Cubic ease) =>
    from + (to - from) * ease.transform(phase.clamp(0.0, 1.0));
