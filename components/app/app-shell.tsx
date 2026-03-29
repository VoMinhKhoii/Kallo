'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { WizardShell } from '@/components/onboarding/wizard-shell';
import type { getOnboardingProfile } from '@/lib/onboarding/actions';
import { ONBOARDING_REQUIRED_STEP } from '@/lib/onboarding/constants';
import { MainSidebar } from './main-sidebar';

type ProfileRow = NonNullable<Awaited<ReturnType<typeof getOnboardingProfile>>>;

interface AppShellProps {
  onboardingStep: number;
  initialProfile: ProfileRow | null;
  children: React.ReactNode;
}

export function AppShell({
  onboardingStep,
  initialProfile,
  children,
}: AppShellProps) {
  const router = useRouter();
  const isIncomplete = onboardingStep < ONBOARDING_REQUIRED_STEP;
  const [showOnboarding, setShowOnboarding] = useState(isIncomplete);

  const handleClose = () => {
    setShowOnboarding(false);
  };

  const handleComplete = () => {
    setShowOnboarding(false);
    router.refresh();
  };

  return (
    <div className="flex h-screen bg-nham-surface">
      <div className="mx-3 my-3 flex flex-1 gap-3">
        <MainSidebar
          onboardingIncomplete={isIncomplete && !showOnboarding}
          onResumeOnboarding={() => setShowOnboarding(true)}
        />
        {children}
      </div>

      {showOnboarding && (
        <WizardShell
          initialStep={Math.min(onboardingStep + 1, 4)}
          initialProfile={initialProfile}
          onClose={handleClose}
          onComplete={handleComplete}
        />
      )}
    </div>
  );
}
