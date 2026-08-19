/// Vendored verbatim from web `lib/domain/onboarding/progress.ts`
/// (keep in sync).
/// Pure resume-logic helpers; depend only on the vendored constants + the loose
/// profile row.
library;

import 'dart:math' as math;

import '../data/constants.dart';
import '../data/profile_row.dart';

const List<String> _personalizationFields = [
  'weightKg',
  'heightCm',
  'age',
  'biologicalSex',
  'activityLevel',
  'tdeeKcal',
  'goal',
  'aggression',
  'calorieTarget',
  'proteinTargetG',
  'carbsTargetG',
  'fatTargetG',
  'carbSplit',
  'countryOfOrigin',
  'countryOfResidence',
  'oilUsage',
  'defaultRicePortion',
  'sugarBraised',
  'defaultProteinPortion',
  'brothConsumption',
];

bool _hasValue(Object? value) {
  if (value is String) return value.trim().isNotEmpty;
  return value != null;
}

bool hasSavedOnboardingProfileData(ProfileRow? profile) {
  if (profile == null) return false;
  return _personalizationFields.any((f) => _hasValue(profile.field(f)));
}

bool shouldShowOnboardingResume(ProfileRow? profile, int onboardingStep) {
  return onboardingStep < kOnboardingTotalSteps ||
      !hasSavedOnboardingProfileData(profile);
}

int getOnboardingResumeStep(ProfileRow? profile, int onboardingStep) {
  if (!hasSavedOnboardingProfileData(profile)) {
    return 1;
  }
  return math.min(math.max(onboardingStep, 0) + 1, kOnboardingTotalSteps);
}
