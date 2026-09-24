import { ONBOARDING_TOTAL_STEPS } from '@/lib/domain/onboarding/constants';
import { hasSavedOnboardingProfileData } from '@/lib/domain/onboarding/progress';

export interface ScreenUpdateOptions {
  /**
   * Whether this save moves the user through onboarding. The wizard's saves
   * do: they raise `onboardingStep` and stamp `onboardingCompletedAt` once the
   * last screen lands. An edit from Settings does NOT — it writes the step's
   * fields only, or saving cooking habits on a skipped onboarding would mark
   * it complete with no body metrics or targets behind it.
   */
  advance: boolean;
}

/**
 * The column update for one `POST /api/v1/onboarding/screen`: the step's own
 * fields (none for an empty "Skip" payload), plus — when [advance] — the
 * progress bump and the completion stamp. Pure, so the progress rules are
 * testable without a database.
 */
export function buildScreenUpdate(
  existing: Record<string, unknown> | null | undefined,
  step: number,
  data: Record<string, unknown>,
  { advance }: ScreenUpdateOptions
): Record<string, unknown> {
  const updateObj: Record<string, unknown> = {};

  // Step-specific field mapping (skip when data is empty — e.g. "Skip" button)
  const hasData = Object.keys(data).length > 0;
  if (step === 1 && hasData) {
    updateObj.countryOfOrigin = data.countryOfOrigin;
    updateObj.countryOfResidence = data.countryOfResidence;
    updateObj.preferredLocale = data.preferredLocale;
  } else if (step === 2 && hasData) {
    updateObj.weightKg = data.weightKg;
    updateObj.heightCm = data.heightCm;
    updateObj.age = data.age;
    updateObj.biologicalSex = data.biologicalSex;
    updateObj.activityLevel = data.activityLevel;
    updateObj.tdeeKcal = data.tdeeKcal;
    updateObj.goal = data.goal;
    updateObj.aggression =
      data.aggression != null ? String(data.aggression) : null;
    updateObj.carbSplit = data.carbSplit;
    updateObj.calorieTarget = Math.max(Number(data.calorieTarget) || 0, 500);
    updateObj.proteinTargetG = data.proteinTargetG;
    updateObj.carbsTargetG = data.carbsTargetG;
    updateObj.fatTargetG = data.fatTargetG;
  } else if (step === 3 && hasData) {
    updateObj.oilUsage = data.oilUsage;
    updateObj.defaultRicePortion = data.defaultRicePortion;
    updateObj.defaultProteinPortion = data.defaultProteinPortion;
    updateObj.brothConsumption = data.brothConsumption;
  }

  if (!advance) return updateObj;

  const existingStep = Number(existing?.onboardingStep ?? 0) || 0;
  const newStep = Math.max(existingStep, step);
  updateObj.onboardingStep = newStep;

  // Mark completion when all screens done
  const nextProfile = { ...existing, ...updateObj };
  if (
    newStep >= ONBOARDING_TOTAL_STEPS &&
    hasSavedOnboardingProfileData(nextProfile) &&
    !existing?.onboardingCompletedAt
  ) {
    updateObj.onboardingCompletedAt = new Date();
  }

  return updateObj;
}
