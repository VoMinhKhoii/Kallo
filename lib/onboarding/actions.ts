'use server';

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { userProfiles } from '@/lib/db/schema';
import { ONBOARDING_TOTAL_STEPS } from '@/lib/onboarding/constants';
import { createClient } from '@/lib/supabase/server';

async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user;
}

export async function getOnboardingProfile() {
  const user = await getAuthUser();
  const rows = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, user.id))
    .limit(1);
  return rows[0] ?? null;
}

export async function saveOnboardingScreen(
  step: number,
  data: Record<string, unknown>
) {
  const user = await getAuthUser();

  const [existing] = await db
    .select({
      onboardingStep: userProfiles.onboardingStep,
      onboardingCompletedAt: userProfiles.onboardingCompletedAt,
    })
    .from(userProfiles)
    .where(eq(userProfiles.userId, user.id))
    .limit(1);

  const newStep = Math.max(existing?.onboardingStep ?? 0, step);
  const updateObj: Record<string, unknown> = {
    onboardingStep: newStep,
  };

  // Step-specific field mapping (skip when data is empty — e.g. "Skip" button)
  const hasData = Object.keys(data).length > 0;
  if (step === 1 && hasData) {
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
  } else if (step === 2 && hasData) {
    updateObj.countryOfOrigin = data.countryOfOrigin;
    updateObj.countryOfResidence = data.countryOfResidence;
  } else if (step === 3 && hasData) {
    updateObj.oilUsage = data.oilUsage;
    updateObj.defaultRicePortion = data.defaultRicePortion;
    updateObj.sugarBraised = data.sugarBraised;
    updateObj.defaultProteinPortion = data.defaultProteinPortion;
    updateObj.brothConsumption = data.brothConsumption;
  }

  // Mark completion when all screens done
  if (newStep >= ONBOARDING_TOTAL_STEPS) {
    if (!existing?.onboardingCompletedAt) {
      updateObj.onboardingCompletedAt = new Date();
    }
  }

  await db
    .update(userProfiles)
    .set(updateObj)
    .where(eq(userProfiles.userId, user.id));

  return { success: true };
}

export async function saveProfileSettings(data: Record<string, unknown>) {
  const user = await getAuthUser();

  const updateObj = {
    weightKg: String(data.weightKg),
    heightCm: data.heightCm as number,
    age: data.age as number,
    biologicalSex: data.biologicalSex as string,
    activityLevel: data.activityLevel as string,
    tdeeKcal: data.tdeeKcal as number,
    goal: data.goal as string,
    aggression:
      data.aggression != null
        ? String(data.aggression)
        : (null as string | null),
    carbSplit: data.carbSplit as string,
    calorieTarget: Math.max(Number(data.calorieTarget) || 0, 500),
    proteinTargetG: data.proteinTargetG as number,
    carbsTargetG: data.carbsTargetG as number,
    fatTargetG: data.fatTargetG as number,
    countryOfOrigin: (data.countryOfOrigin as string) ?? null,
    countryOfResidence: (data.countryOfResidence as string) ?? null,
    oilUsage: data.oilUsage as string,
    defaultRicePortion: data.defaultRicePortion as string,
    sugarBraised: data.sugarBraised as string,
    defaultProteinPortion: data.defaultProteinPortion as string,
    brothConsumption: data.brothConsumption as string,
  };

  // Does NOT touch onboardingStep or onboardingCompletedAt
  await db
    .update(userProfiles)
    .set(updateObj)
    .where(eq(userProfiles.userId, user.id));

  return { success: true };
}
