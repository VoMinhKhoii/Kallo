/// Cheat-meal slider → nutrition math.
///
/// Dart port of the client subset of `lib/cheat/slider-nutrition.ts` — the
/// single source of truth for turning chosen slider levels into nutrition.
/// The server recomputes authoritatively on confirm with the same math, so
/// this only drives the live preview; keep the two in lockstep.
/// (`canonicalizeAnchors`/`withLevelsAsDefaults` are server-side only and are
/// deliberately not ported.)
library;

import '../../../models/cheat.dart';

/// The six canonical, evenly-spaced stops every slider's anchors resolve to.
/// Levels 0 and 10 are the endpoints; the odd levels between are the
/// meaningful "between two stops" positions the user can still drag to.
const List<double> kCanonicalStopLevels = [0, 2, 4, 6, 8, 10];

/// Clamp a slider level into the valid 0..10 range.
double clampLevel(double level) {
  if (!level.isFinite) return 0;
  return level.clamp(0, 10).toDouble();
}

/// The AI's default position per slider — what an untouched card resolves to.
CheatSliderLevels defaultLevels(CheatSliderSpec spec) => {
  for (final slider in spec.sliders) slider.key: clampLevel(slider.defaultLevel),
};

enum _NutrientKey { proteinG, carbohydrateG, fatG, alcoholG }

double? _nutrient(CheatSliderAnchor anchor, _NutrientKey key) =>
    switch (key) {
      _NutrientKey.proteinG => anchor.proteinG,
      _NutrientKey.carbohydrateG => anchor.carbohydrateG,
      _NutrientKey.fatG => anchor.fatG,
      _NutrientKey.alcoholG => anchor.alcoholG,
    };

/// Piecewise-linear interpolation of one nutrient's grams for a slider at
/// `level`, using its sparse anchors. Anchors should include level 0 and 10;
/// defensively sorts and clamps to the edge values outside the anchor span.
double _interpolateNutrient(
  List<CheatSliderAnchor> anchors,
  double level,
  _NutrientKey nutrient,
) {
  if (anchors.isEmpty) return 0;
  final target = clampLevel(level);
  final sorted = [...anchors]..sort((a, b) => a.level.compareTo(b.level));

  final first = sorted.first;
  final last = sorted.last;
  if (target <= first.level) return _nutrient(first, nutrient) ?? 0;
  if (target >= last.level) return _nutrient(last, nutrient) ?? 0;

  for (var i = 0; i < sorted.length - 1; i++) {
    final lo = sorted[i];
    final hi = sorted[i + 1];
    if (target >= lo.level && target <= hi.level) {
      final span = hi.level - lo.level;
      if (span <= 0) {
        return _nutrient(hi, nutrient) ?? _nutrient(lo, nutrient) ?? 0;
      }
      final t = (target - lo.level) / span;
      final loVal = _nutrient(lo, nutrient) ?? 0;
      final hiVal = _nutrient(hi, nutrient) ?? 0;
      return loVal + (hiVal - loVal) * t;
    }
  }
  return _nutrient(last, nutrient) ?? 0;
}

double _round1(double value) => (value * 10).roundToDouble() / 10;

/// Resolved totals for a spec at chosen levels.
class ResolvedCheatNutrition {
  final double proteinG;
  final double carbohydrateG;
  final double fatG;
  final double alcoholG;
  final int caloriesKcal;

  const ResolvedCheatNutrition({
    required this.proteinG,
    required this.carbohydrateG,
    required this.fatG,
    required this.alcoholG,
    required this.caloriesKcal,
  });
}

/// Resolve total nutrition from chosen slider levels.
/// - Macro sliders contribute only their own nutrient (orthogonal dials).
/// - The drinks slider contributes carbs (sugar) + fat (creamy) + alcohol.
/// - Calories derive from the macro identity 4·P + 4·C + 9·F + 7·alcohol so
///   the number always agrees with the sliders the user actually set.
ResolvedCheatNutrition resolveSliderNutrition(
  CheatSliderSpec spec,
  CheatSliderLevels levels,
) {
  var proteinG = 0.0;
  var carbohydrateG = 0.0;
  var fatG = 0.0;
  var alcoholG = 0.0;

  for (final slider in spec.sliders) {
    final level = levels[slider.key] ?? slider.defaultLevel;
    proteinG += _interpolateNutrient(
      slider.anchors,
      level,
      _NutrientKey.proteinG,
    );
    carbohydrateG += _interpolateNutrient(
      slider.anchors,
      level,
      _NutrientKey.carbohydrateG,
    );
    fatG += _interpolateNutrient(slider.anchors, level, _NutrientKey.fatG);
    alcoholG += _interpolateNutrient(
      slider.anchors,
      level,
      _NutrientKey.alcoholG,
    );
  }

  proteinG = _round1(proteinG);
  carbohydrateG = _round1(carbohydrateG);
  fatG = _round1(fatG);
  alcoholG = _round1(alcoholG);

  final caloriesKcal =
      (4 * proteinG + 4 * carbohydrateG + 9 * fatG + 7 * alcoholG).round();

  return ResolvedCheatNutrition(
    proteinG: proteinG,
    carbohydrateG: carbohydrateG,
    fatG: fatG,
    alcoholG: alcoholG,
    caloriesKcal: caloriesKcal,
  );
}

/// The active anchor label for a slider at a given level — the nearest anchor
/// at or below the current position. Drives the "you're here" text on the card.
String activeAnchorLabel(CheatSlider slider, double level) {
  if (slider.anchors.isEmpty) return '';
  final target = clampLevel(level);
  final sorted = [...slider.anchors]
    ..sort((a, b) => a.level.compareTo(b.level));
  var label = sorted.first.label;
  for (final anchor in sorted) {
    if (anchor.level <= target) {
      label = anchor.label;
    } else {
      break;
    }
  }
  return label;
}
