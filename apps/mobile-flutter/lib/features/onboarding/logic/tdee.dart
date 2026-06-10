/// Vendored verbatim from RN `lib/onboarding/logic/tdee.ts` (keep in sync).
/// Pure Mifflin–St Jeor calc; no rounding in BMR (rounding in TDEE/macros).
library;

import '../../../models/onboarding.dart';
import '../data/constants.dart';

double calcBMR(BodyMetrics metrics) {
  final base =
      10 * metrics.weightKg + 6.25 * metrics.heightCm - 5 * metrics.age;
  return metrics.biologicalSex == BiologicalSex.male ? base + 5 : base - 161;
}

int calcTDEE(double bmr, ActivityLevel activityLevel) {
  return (bmr * kActivityMultipliers[activityLevel]!).round();
}

MacroTargets calcMacroGrams(double calories, CarbSplit carbSplit) {
  final ratio = kCarbSplitRatios[carbSplit]!;
  return MacroTargets(
    calories: calories.round().toDouble(),
    proteinG: (calories * ratio.protein / 100 / 4).round().toDouble(),
    carbsG: (calories * ratio.carbs / 100 / 4).round().toDouble(),
    fatG: (calories * ratio.fat / 100 / 9).round().toDouble(),
  );
}

MacroTargets calcDailyTargets(
  int tdee,
  Goal goal,
  double? aggression,
  CarbSplit carbSplit, [
  double? deficitOverride,
]) {
  double calories;

  if (goal == Goal.maintaining) {
    calories = tdee.toDouble();
  } else {
    final safeAggression = aggression ?? 0;
    final adjustment =
        deficitOverride ?? (safeAggression * kAggressionKcalPerKg).round();
    calories = goal == Goal.cutting
        ? tdee - adjustment.toDouble()
        : tdee + adjustment.toDouble();
  }

  // calories may go negative if deficitOverride > tdee; the server clamps
  // calorieTarget = max(., 500) before persisting.
  return calcMacroGrams(calories, carbSplit);
}
