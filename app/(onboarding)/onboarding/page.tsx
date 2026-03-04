import { redirect } from 'next/navigation';
import { getOnboardingProfile } from '@/lib/onboarding/actions';
import { ONBOARDING_REQUIRED_STEP } from '@/lib/onboarding/constants';
import { WizardShell } from '@/components/onboarding/wizard-shell';

export default async function OnboardingPage() {
  const profile = await getOnboardingProfile();

  // Completion redirect — uses step number, not timestamp
  if (
    (profile?.onboardingStep ?? 0) >=
    ONBOARDING_REQUIRED_STEP
  ) {
    redirect('/logging');
  }

  // Resume at highest completed step + 1
  const startStep = Math.min(
    (profile?.onboardingStep ?? 0) + 1,
    4,
  );

  return (
    <WizardShell
      initialStep={startStep}
      initialProfile={profile}
    />
  );
}
