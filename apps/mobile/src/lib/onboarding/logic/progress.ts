/**
 * Vendored verbatim from web `lib/onboarding/progress.ts` (keep in sync).
 * Pure resume-logic helpers; depend only on the vendored constants.
 */
import { ONBOARDING_TOTAL_STEPS } from '~/lib/onboarding/data/constants';

const PERSONALIZATION_FIELDS = [
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

function hasValue(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  return value !== null && value !== undefined;
}

function getFieldValue(profile: object, field: string): unknown {
  return (profile as Record<string, unknown>)[field];
}

export function hasSavedOnboardingProfileData(
  profile: object | null | undefined
): boolean {
  if (!profile) return false;
  return PERSONALIZATION_FIELDS.some((field) =>
    hasValue(getFieldValue(profile, field))
  );
}

export function shouldShowOnboardingResume(
  profile: object | null | undefined,
  onboardingStep: number
): boolean {
  return (
    onboardingStep < ONBOARDING_TOTAL_STEPS ||
    !hasSavedOnboardingProfileData(profile)
  );
}

export function getOnboardingResumeStep(
  profile: object | null | undefined,
  onboardingStep: number
): number {
  if (!hasSavedOnboardingProfileData(profile)) {
    return 1;
  }
  return Math.min(Math.max(onboardingStep, 0) + 1, ONBOARDING_TOTAL_STEPS);
}
