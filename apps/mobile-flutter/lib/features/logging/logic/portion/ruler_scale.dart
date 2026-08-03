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
  ///
  /// Must be a multiple of `2 * anchorCount`, and that is not cosmetic.
  /// Material treats `divisions` as N EQUAL intervals of `positionMax /
  /// divisions` — it does not step by our `step`. Anchor i sits at
  /// `(i + 0.5) / n * positionMax`, so the grid contains the anchors only when
  /// `divisions * (2i + 1) / (2n)` is a whole number for every i, i.e. when
  /// divisions is a multiple of `2n`.
  ///
  /// `positionMax ~/ step` was not: with the ordinary count-1 ruler that gave
  /// 111 divisions of 9.009, so tapping the 70 g anchor painted the thumb 2.7
  /// units off its own tick and the first touch snapped the portion to 69 g
  /// before the user moved a finger.
  ///
  /// Rounding UP to the next multiple keeps intervals no coarser than [step],
  /// preserving the "one press moves at least 1 g" guarantee.
  int get divisions {
    final anchorCount = grams.length - 2; // grams = [min, ...anchors, max]
    final unit = 2 * anchorCount;
    final atLeast = (positionMax / step).ceil();
    return ((atLeast + unit - 1) ~/ unit) * unit;
  }

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
