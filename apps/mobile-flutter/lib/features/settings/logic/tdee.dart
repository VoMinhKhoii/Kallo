/// TDEE / macro math for the settings profile form.
///
/// Vendored verbatim from RN `lib/onboarding/logic/tdee.ts` +
/// `lib/onboarding/data/constants.ts` (keep in sync). Pure Mifflin–St Jeor;
/// no rounding in BMR (rounding happens in TDEE / macros).
library;

import '../../../models/onboarding.dart';

// ── Constants ────────────────────────────────────────────────────────────

const Map<ActivityLevel, double> activityMultipliers = {
  ActivityLevel.sedentary: 1.2,
  ActivityLevel.light: 1.375,
  ActivityLevel.moderate: 1.55,
  ActivityLevel.veryActive: 1.725,
};

/// Ratios as protein% / fat% / carbs% (must sum to 100).
const Map<CarbSplit, ({int protein, int fat, int carbs})> carbSplitRatios = {
  CarbSplit.moderateCarb: (protein: 30, fat: 35, carbs: 35),
  CarbSplit.lowerCarb: (protein: 40, fat: 40, carbs: 20),
  CarbSplit.higherCarb: (protein: 30, fat: 20, carbs: 50),
};

/// 1 kg fat ≈ 7,700 kcal → daily kcal = kg/week × 1100.
const int aggressionKcalPerKg = 1100;

// ── Calculations ─────────────────────────────────────────────────────────

double calcBMR({
  required BiologicalSex biologicalSex,
  required double weightKg,
  required int heightCm,
  required int age,
}) {
  final base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return biologicalSex == BiologicalSex.male ? base + 5 : base - 161;
}

int calcTDEE(double bmr, ActivityLevel activityLevel) =>
    (bmr * activityMultipliers[activityLevel]!).round();

/// Returns rounded macro grams + calories for a given calorie budget.
MacroTargets calcMacroGrams(double calories, CarbSplit carbSplit) {
  final ratio = carbSplitRatios[carbSplit]!;
  return MacroTargets(
    calories: calories.roundToDouble(),
    proteinG: (calories * ratio.protein / 100 / 4).roundToDouble(),
    carbsG: (calories * ratio.carbs / 100 / 4).roundToDouble(),
    fatG: (calories * ratio.fat / 100 / 9).roundToDouble(),
  );
}

/// Computes the daily calorie/macro targets for a goal + pace + split.
///
/// `calories` may go negative if a deficit exceeds the TDEE; the server clamps
/// `calorieTarget = max(., 500)` before persisting (mirrored by the caller).
MacroTargets calcDailyTargets(
  int tdee,
  Goal goal,
  double? aggression,
  CarbSplit carbSplit, [
  int? deficitOverride,
]) {
  double calories;
  if (goal == Goal.maintaining) {
    calories = tdee.toDouble();
  } else {
    final safeAggression = aggression ?? 0;
    final adjustment =
        deficitOverride ?? (safeAggression * aggressionKcalPerKg).round();
    calories =
        goal == Goal.cutting ? (tdee - adjustment).toDouble() : (tdee + adjustment).toDouble();
  }
  return calcMacroGrams(calories, carbSplit);
}
