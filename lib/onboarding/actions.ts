'use server';

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { userProfiles } from '@/lib/db/schema';
import {
  ONBOARDING_REQUIRED_STEP,
  SKIP_FALLBACK_DEFAULTS,
} from '@/lib/onboarding/constants';
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

  // Fetch current row for max-step logic + fallback defaults
  const [existing] = await db
    .select({
      onboardingStep: userProfiles.onboardingStep,
      onboardingCompletedAt: userProfiles.onboardingCompletedAt,
      handSpanCm: userProfiles.handSpanCm,
      knuckleDepthCm: userProfiles.knuckleDepthCm,
    })
    .from(userProfiles)
    .where(eq(userProfiles.userId, user.id))
    .limit(1);

  const newStep = Math.max(existing?.onboardingStep ?? 0, step);
  const updateObj: Record<string, unknown> = {
    onboardingStep: newStep,
  };

  // Step-specific field mapping
  if (step === 1) {
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
  } else if (step === 2) {
    updateObj.regionalProfile = data.regionalProfile;
  } else if (step === 3) {
    updateObj.oilUsage = data.oilUsage;
    // Single fatTrim → all 3 columns
    updateObj.fatTrimPork = data.fatTrim;
    updateObj.fatTrimChicken = data.fatTrim;
    updateObj.fatTrimFish = data.fatTrim;
    updateObj.boneAwareness = data.boneAwareness;
    updateObj.defaultRicePortion = data.defaultRicePortion;
    updateObj.sugarBraised = data.sugarBraised;
  } else if (step === 4) {
    updateObj.handSpanCm = data.handSpanCm;
    updateObj.knuckleDepthCm = data.knuckleDepthCm;
    updateObj.bowlSizeMl = data.bowlSizeMl;
    updateObj.plateSizeMl = data.plateSizeMl;
  }

  // Completion + fallback defaults
  if (newStep >= ONBOARDING_REQUIRED_STEP) {
    if (!existing?.onboardingCompletedAt) {
      updateObj.onboardingCompletedAt = new Date();
    }
    // Apply SKIP_FALLBACK_DEFAULTS for Screen 4 fields
    // still null
    if (!existing?.handSpanCm) {
      updateObj.handSpanCm = SKIP_FALLBACK_DEFAULTS.handSpanCm;
    }
    if (!existing?.knuckleDepthCm) {
      updateObj.knuckleDepthCm = SKIP_FALLBACK_DEFAULTS.knuckleDepthCm;
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
    regionalProfile: data.regionalProfile as string,
    oilUsage: data.oilUsage as string,
    fatTrimPork: data.fatTrimPork as string,
    fatTrimChicken: data.fatTrimChicken as string,
    fatTrimFish: data.fatTrimFish as string,
    boneAwareness: data.boneAwareness as boolean,
    defaultRicePortion: data.defaultRicePortion as string,
    sugarBraised: data.sugarBraised as string,
    // Null guard: if user clears hand measurements, apply SKIP_FALLBACK_DEFAULTS
    handSpanCm: String(data.handSpanCm ?? SKIP_FALLBACK_DEFAULTS.handSpanCm),
    knuckleDepthCm: String(
      data.knuckleDepthCm ?? SKIP_FALLBACK_DEFAULTS.knuckleDepthCm
    ),
    bowlSizeMl: (data.bowlSizeMl ??
      SKIP_FALLBACK_DEFAULTS.bowlSizeMl) as number,
    plateSizeMl: (data.plateSizeMl ??
      SKIP_FALLBACK_DEFAULTS.plateSizeMl) as number,
  };

  // Does NOT touch onboardingStep or onboardingCompletedAt
  await db
    .update(userProfiles)
    .set(updateObj)
    .where(eq(userProfiles.userId, user.id));

  return { success: true };
}
