/// Body-mass index and the goal it implies.
///
/// Kept OUT of `tdee.dart`: that file turns a complete body into calories and
/// macros, while this one only reads a shape and suggests a direction. The
/// wizard uses it to preselect a goal on screen 4 so the user confirms a
/// sensible default instead of answering from nothing.
library;

import '../../models/profile/onboarding.dart';

/// Below this the WHO calls it underweight, everywhere in the world.
const double kUnderweightCutoff = 18.5;

/// The overweight action point for the general population (WHO standard).
const double kOverweightCutoff = 25.0;

/// The overweight action point for Asian populations.
///
/// WHO expert consultation, *Appropriate body-mass index for Asian populations
/// and its implications for policy and intervention strategies*, Lancet 2004;
/// 363:157–163 — Asian populations carry a higher body-fat percentage and a
/// higher cardiovascular risk at the same BMI, so 23 is named as a public
/// health action point rather than 25.
const double kOverweightCutoffAsian = 23.0;

/// kg / m². Null unless both metrics are present and positive.
double? bmi({double? weightKg, int? heightCm}) {
  if (weightKg == null || heightCm == null) return null;
  if (weightKg <= 0 || heightCm <= 0) return null;
  final metres = heightCm / 100;
  return weightKg / (metres * metres);
}

/// The goal a body of this [bmiValue] opens on. [asianOrigin] swaps the
/// overweight action point for [kOverweightCutoffAsian].
Goal defaultGoalForBmi(double bmiValue, {required bool asianOrigin}) {
  if (bmiValue < kUnderweightCutoff) return Goal.bulking;
  final cutoff = asianOrigin ? kOverweightCutoffAsian : kOverweightCutoff;
  return bmiValue >= cutoff ? Goal.cutting : Goal.maintaining;
}
