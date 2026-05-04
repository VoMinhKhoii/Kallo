import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { getOnboardingProfile } from '@/lib/onboarding/actions';
import type { DashboardProfile } from '@/lib/types/dashboard';

const DEFAULT_PROFILE: DashboardProfile = {
  calorieTarget: 2000,
  proteinTargetG: 150,
  carbsTargetG: 250,
  fatTargetG: 65,
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata.dashboard');

  return {
    title: t('title'),
  };
}

export default async function DashboardPage() {
  const profileRow = await getOnboardingProfile();

  const profile: DashboardProfile = {
    calorieTarget: profileRow?.calorieTarget ?? DEFAULT_PROFILE.calorieTarget,
    proteinTargetG:
      profileRow?.proteinTargetG ?? DEFAULT_PROFILE.proteinTargetG,
    carbsTargetG: profileRow?.carbsTargetG ?? DEFAULT_PROFILE.carbsTargetG,
    fatTargetG: profileRow?.fatTargetG ?? DEFAULT_PROFILE.fatTargetG,
  };

  return <DashboardShell profile={profile} />;
}
