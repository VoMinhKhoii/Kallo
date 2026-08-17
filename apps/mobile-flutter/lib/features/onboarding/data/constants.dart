/// Vendored verbatim from RN `lib/onboarding/data/constants.ts` (keep in sync).
///
/// Pure consts used by the TDEE/progress logic and the wizard defaults.
library;

import '../../../models/profile/onboarding.dart';

/// The TDEE tables that used to live here — `kActivityMultipliers`,
/// `kCarbSplitRatios` and `kAggressionKcalPerKg` — moved to
/// `lib/shared/logic/tdee.dart` beside the maths that reads them, so settings
/// and onboarding no longer keep separate copies.
const int kOnboardingTotalSteps = 3;

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
