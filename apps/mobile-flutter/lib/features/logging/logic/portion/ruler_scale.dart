/// The ruler's grams ↔ track-position mapping.
///
/// Pulled out of the widget because it is arithmetic, not layout: the ruler's
/// slider runs in integer position space (0–[positionMax]) while the value the
/// user is choosing is grams, and the two are related piecewise-linearly
/// through `[min, ...anchorValues, max]`. Keeping anchors at fixed positions
/// while grams stay continuous between them is the whole trick of an
/// "integrated" ruler, and it is worth being able to test it without pumping a
/// widget.
library;

import 'portion_anchors.dart';

class RulerScale {
  /// Position-space breakpoints: track start, each anchor, track end.
  final List<double> positions;

  /// The gram value at each of those breakpoints.
  final List<num> grams;

  RulerScale._(this.positions, this.grams);

  factory RulerScale(List<PortionAnchor> anchors, int min, int max) {
    return RulerScale._(positionBreaks(anchors.length), [
      min,
      ...anchors.map((a) => a.value),
      max,
    ]);
  }

  int toGrams(double position) =>
      interpolate(position, positions, grams).round();

  double toPosition(int value) =>
      interpolate(value.toDouble(), grams, positions);

  /// One step is worth at least 1 g in every segment — see [rulerStep].
  int get step => rulerStep(grams, positions);

  /// Divisions for the Material slider, which is also the increment an
  /// assistive-technology swipe moves by.
  int get divisions => positionMax ~/ step;

  /// True when [other] describes a different mapping — the ruler resyncs on it.
  /// Compares the VALUES, not just the length: a same-length reshuffle of the
  /// middle anchors would otherwise leave a stale scale behind.
  bool differsFrom(RulerScale other) {
    if (grams.length != other.grams.length) return true;
    for (var i = 0; i < grams.length; i += 1) {
      if (grams[i] != other.grams[i]) return true;
    }
    return false;
  }
}
