/// TDEE / macro maths — the app's single copy.
///
/// Vendored from web `lib/domain/onboarding/tdee.ts` +
/// `lib/domain/onboarding/constants.ts`, which remain the source of truth.
/// `test/shared/logic/tdee_test.dart` reads that TypeScript off disk and fails
/// when the numbers here drift from it.
///
/// Pure Mifflin–St Jeor: no rounding in BMR, rounding in TDEE and the macros.
/// Both the onboarding wizard and the settings profile form call this; before
/// consolidation each had its own copy with its own inlined constant tables.
library;

import 'dart:math' as math;

import '../../models/profile/onboarding.dart';

// ── Constants ────────────────────────────────────────────────────────────

const Map<ActivityLevel, double> kActivityMultipliers = {
  ActivityLevel.sedentary: 1.2,
  ActivityLevel.light: 1.375,
  ActivityLevel.moderate: 1.55,
  ActivityLevel.veryActive: 1.725,
};

/// Ratios as protein% / fat% / carbs% (must sum to 100).
class CarbSplitRatio {
  final int protein;
  final int fat;
  final int carbs;
  const CarbSplitRatio({
    required this.protein,
    required this.fat,
    required this.carbs,
  });
}

const Map<CarbSplit, CarbSplitRatio> kCarbSplitRatios = {
  CarbSplit.moderateCarb: CarbSplitRatio(protein: 30, fat: 35, carbs: 35),
  CarbSplit.lowerCarb: CarbSplitRatio(protein: 40, fat: 40, carbs: 20),
  CarbSplit.higherCarb: CarbSplitRatio(protein: 30, fat: 20, carbs: 50),
};

/// 1 kg fat ≈ 7,700 kcal → daily kcal = kg/week × 1100.
const int kAggressionKcalPerKg = 1100;

/// Lowest daily target a cut may set: the common 1,200 kcal (women) /
/// 1,500 kcal (men) minimum, capped at maintenance ([calcCalorieFloor]).
const Map<BiologicalSex, int> kCalorieFloorKcal = {
  BiologicalSex.female: 1200,
  BiologicalSex.male: 1500,
};

/// Absolute backstop under a tiny TDEE, matching the server's.
const int kMinCalorieTargetKcal = 500;

// ── Calculations ─────────────────────────────────────────────────────────

/// Mifflin–St Jeor BMR. Raw, unrounded — [calcTDEE] does the rounding.
///
/// Web passes a whole `BodyMetrics` record; this takes only the four fields the
/// formula reads, because the Dart record also carries `activityLevel` and
/// handing that to a function that ignores it reads as a bug.
double calcBMR({
  required BiologicalSex biologicalSex,
  required double weightKg,
  required int heightCm,
  required int age,
}) {
  final base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return biologicalSex == BiologicalSex.male ? base + 5 : base - 161;
}

/// TDEE = BMR × activity multiplier, rounded.
int calcTDEE(double bmr, ActivityLevel activityLevel) =>
    (bmr * kActivityMultipliers[activityLevel]!).round();

/// Rounded macro grams + calories for a calorie budget.
/// Protein 4 kcal/g, carbs 4 kcal/g, fat 9 kcal/g.
MacroTargets calcMacroGrams(double calories, CarbSplit carbSplit) {
  final ratio = kCarbSplitRatios[carbSplit]!;
  return MacroTargets(
    calories: calories.round().toDouble(),
    proteinG: (calories * ratio.protein / 100 / 4).round().toDouble(),
    carbsG: (calories * ratio.carbs / 100 / 4).round().toDouble(),
    fatG: (calories * ratio.fat / 100 / 9).round().toDouble(),
  );
}

/// Lowest target a cut may reach: 1,200 kcal for women, 1,500 for men, or the
/// TDEE itself when maintenance is already below that, so a cut holds at
/// maintenance instead of turning into a surplus. Never under 500.
double calcCalorieFloor(BiologicalSex sex, int tdee) =>
    math
        .max(math.min(tdee, kCalorieFloorKcal[sex]!), kMinCalorieTargetKcal)
        .toDouble();

/// Daily calorie/macro targets for a goal + pace + split.
///
/// [aggression] is kg/week (0.1–0.8); [deficitOverride] replaces the derived
/// adjustment when given. `num?` because the two pre-consolidation copies typed
/// it differently (`double?` in onboarding, `int?` in settings) and neither
/// call site passes it today.
///
/// Calories never go below [calcCalorieFloor]; the grams are derived from the
/// floored number, so they always add up to it.
MacroTargets calcDailyTargets(
  int tdee,
  Goal goal,
  double? aggression,
  CarbSplit carbSplit,
  BiologicalSex biologicalSex, [
  num? deficitOverride,
]) {
  double calories;

  if (goal == Goal.maintaining) {
    calories = tdee.toDouble();
  } else {
    final safeAggression = aggression ?? 0;
    final adjustment =
        deficitOverride ?? (safeAggression * kAggressionKcalPerKg).round();
    calories =
        goal == Goal.cutting
            ? tdee - adjustment.toDouble()
            : tdee + adjustment.toDouble();
  }

  return calcMacroGrams(
    math.max(calories, calcCalorieFloor(biologicalSex, tdee)),
    carbSplit,
  );
}
