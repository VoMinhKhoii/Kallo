import { userProfiles } from '@/lib/db/schema';

export const compatibleUserProfileSelection = {
  userId: userProfiles.userId,
  weightKg: userProfiles.weightKg,
  heightCm: userProfiles.heightCm,
  age: userProfiles.age,
  biologicalSex: userProfiles.biologicalSex,
  activityLevel: userProfiles.activityLevel,
  tdeeKcal: userProfiles.tdeeKcal,
  goal: userProfiles.goal,
  aggression: userProfiles.aggression,
  calorieTarget: userProfiles.calorieTarget,
  proteinTargetG: userProfiles.proteinTargetG,
  carbsTargetG: userProfiles.carbsTargetG,
  fatTargetG: userProfiles.fatTargetG,
  carbSplit: userProfiles.carbSplit,
  countryOfOrigin: userProfiles.countryOfOrigin,
  countryOfResidence: userProfiles.countryOfResidence,
  preferredLocale: userProfiles.preferredLocale,
  oilUsage: userProfiles.oilUsage,
  defaultRicePortion: userProfiles.defaultRicePortion,
  sugarBraised: userProfiles.sugarBraised,
  defaultProteinPortion: userProfiles.defaultProteinPortion,
  brothConsumption: userProfiles.brothConsumption,
  onboardingStep: userProfiles.onboardingStep,
  onboardingCompletedAt: userProfiles.onboardingCompletedAt,
  createdAt: userProfiles.createdAt,
  updatedAt: userProfiles.updatedAt,
};

type CompatibleUserProfileRow = typeof userProfiles.$inferSelect;

export function withCompatibleUserProfileFields(
  profile: Omit<CompatibleUserProfileRow, 'onboardingMinimizedAt'>
): CompatibleUserProfileRow {
  return {
    ...profile,
    onboardingMinimizedAt: null,
  };
}
