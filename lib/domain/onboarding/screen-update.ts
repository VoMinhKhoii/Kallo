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
 * fields that the payload carries (none for an empty "Skip"), plus — when [advance] — the
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
  // Only the keys the payload CARRIES are written: the wizard posts a whole
  // step, a Settings page posts just the fields it shows (body metrics
  // without a goal it never asked about), and an empty "Skip" writes none.
  const has = (key: string) => Object.hasOwn(data, key);
  const copy = (...keys: string[]) => {
    for (const key of keys) if (has(key)) updateObj[key] = data[key];
  };

  if (step === 1) {
    copy('countryOfOrigin', 'countryOfResidence', 'preferredLocale');
  } else if (step === 2) {
    copy(
      'weightKg',
      'heightCm',
      'age',
      'biologicalSex',
      'activityLevel',
      'tdeeKcal',
      'goal',
      'carbSplit',
      'proteinTargetG',
      'carbsTargetG',
      'fatTargetG'
    );
    if (has('aggression')) {
      updateObj.aggression =
        data.aggression != null ? String(data.aggression) : null;
    }
    if (has('calorieTarget')) {
      updateObj.calorieTarget = Math.max(Number(data.calorieTarget) || 0, 500);
    }
  } else if (step === 3) {
    copy(
      'oilUsage',
      'defaultRicePortion',
      'defaultProteinPortion',
      'brothConsumption'
    );
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
