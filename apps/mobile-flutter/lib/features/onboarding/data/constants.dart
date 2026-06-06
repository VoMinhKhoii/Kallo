/// Vendored verbatim from RN `lib/onboarding/data/constants.ts` (keep in sync).
///
/// Pure consts used by the TDEE/progress logic and the wizard defaults.
library;

import '../../../models/onboarding.dart';

const int kOnboardingTotalSteps = 3;

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

const CookingHabits kNeutralCookingDefaults = CookingHabits(
  oilUsage: OilUsage.normal,
  defaultRicePortion: RicePortion.medium,
  sugarBraised: SugarBraised.medium,
  defaultProteinPortion: ProteinPortion.medium,
  brothConsumption: BrothConsumption.some,
);

/// `WIZARD_DEFAULTS` — step-2 fallbacks when the profile has no saved values.
abstract final class WizardDefaults {
  static const ActivityLevel activityLevel = ActivityLevel.light;
  static const Goal goal = Goal.maintaining;
  static const double aggression = 0.5;
  static const CarbSplit carbSplit = CarbSplit.moderateCarb;
  static const double? deficitOverride = null;
}
