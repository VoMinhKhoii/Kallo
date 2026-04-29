import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import {
  type DashboardProfile,
  DashboardShell,
} from '@/components/dashboard/dashboard-shell';
import { getOnboardingProfile } from '@/lib/onboarding/actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata.dashboard');

  return {
    title: t('title'),
  };
}

export default async function DashboardPage() {
  const profileRow = await getOnboardingProfile();

  if (
    !profileRow ||
    profileRow.calorieTarget === null ||
    profileRow.proteinTargetG === null ||
    profileRow.carbsTargetG === null ||
    profileRow.fatTargetG === null
  ) {
    redirect('/onboarding');
  }

  const profile: DashboardProfile = {
    calorieTarget: profileRow.calorieTarget,
    proteinTargetG: profileRow.proteinTargetG,
    carbsTargetG: profileRow.carbsTargetG,
    fatTargetG: profileRow.fatTargetG,
  };

  return <DashboardShell profile={profile} />;
}
