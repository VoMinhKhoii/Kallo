'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { FloatingMealTrigger } from '@/components/dashboard/today/meal-trigger';
import { WizardShell } from '@/components/onboarding/wizard-shell';
import { useRouter } from '@/i18n/navigation';
import {
  type getOnboardingProfile,
  minimizeOnboardingNudge,
  restoreOnboardingNudge,
} from '@/lib/onboarding/actions';
import {
  getOnboardingResumeStep,
  shouldShowOnboardingResume,
} from '@/lib/onboarding/progress';
import { readStepOneLocaleDraft } from '@/lib/onboarding/step-one-locale-draft';
import { BottomTabBar } from './bottom-tab-bar';
import { DesktopSidebar } from './desktop-sidebar';
import { MobileNav } from './mobile-nav';
import type { UserMenuUser } from './user-menu';

type ProfileRow = NonNullable<Awaited<ReturnType<typeof getOnboardingProfile>>>;

interface AppShellProps {
  onboardingStep: number;
  initialProfile: ProfileRow | null;
  isFirstSession: boolean;
  isAdmin?: boolean;
  user?: UserMenuUser;
  initialSidebarState?: 'closed' | 'open';
  initialSidebarExpandMode?: 'click' | 'hover';
  children: React.ReactNode;
}

const FALLBACK_USER: UserMenuUser = { email: null, displayName: null };

export function AppShell({
  onboardingStep,
  initialProfile,
  isFirstSession,
  isAdmin = false,
  user = FALLBACK_USER,
  initialSidebarState,
  initialSidebarExpandMode,
  children,
}: AppShellProps) {
  const tNudge = useTranslations('app.onboardingNudge');
  const hasStepOneLocaleDraft = readStepOneLocaleDraft() !== null;
  const router = useRouter();
  const showResumeOnboarding = shouldShowOnboardingResume(
    initialProfile,
    onboardingStep
  );
  const resumeStep = getOnboardingResumeStep(initialProfile, onboardingStep);
  const [showOnboarding, setShowOnboarding] = useState(
    (onboardingStep === 0 && isFirstSession) || hasStepOneLocaleDraft
  );

  const handleClose = () => {
    setShowOnboarding(false);
  };

  const handleComplete = () => {
    setShowOnboarding(false);
    router.refresh();
  };

  const handleResume = () => setShowOnboarding(true);
  const showOnboardingNudge = showResumeOnboarding && !showOnboarding;

  // Onboarding minimized state: server-truth from `initialProfile`, with
  // optimistic local override so the UI is snappy. The server actions
  // persist the choice in `user_profiles.onboarding_minimized_at`. We
  // intentionally don't use localStorage — the choice should sync across
  // the user's devices and the server should know about it for SSR.
  const [isOnboardingMinimized, setOnboardingMinimized] = useState(
    Boolean(initialProfile?.onboardingMinimizedAt)
  );

  const handleMinimizeNudge = async () => {
    setOnboardingMinimized(true);
    try {
      await minimizeOnboardingNudge();
    } catch (error) {
      // Roll back on failure — user sees the full nudge again, which is
      // the safer default than a UI-only minimize that the server doesn't
      // know about.
      console.error('Failed to minimize onboarding nudge:', error);
      toast.error(tNudge('saveError'));
      setOnboardingMinimized(false);
    }
  };

  const handleRestoreNudge = async () => {
    setOnboardingMinimized(false);
    try {
      await restoreOnboardingNudge();
    } catch (error) {
      console.error('Failed to restore onboarding nudge:', error);
      toast.error(tNudge('saveError'));
      setOnboardingMinimized(true);
    }
  };

  return (
    <div className="flex h-dvh min-w-0 flex-col overflow-hidden bg-nham-surface pt-[env(safe-area-inset-top)] md:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 gap-3 overflow-x-hidden p-3">
        {/* Desktop sidebar — hidden on mobile */}
        <div className="hidden md:block">
          <DesktopSidebar
            user={user}
            isAdmin={isAdmin}
            onboardingIncomplete={showOnboardingNudge}
            onboardingStep={onboardingStep}
            onResumeOnboarding={handleResume}
            isOnboardingMinimized={isOnboardingMinimized}
            onMinimizeOnboarding={handleMinimizeNudge}
            onRestoreOnboarding={handleRestoreNudge}
            initialState={initialSidebarState}
            initialExpandMode={initialSidebarExpandMode}
          />
        </div>

        {/* Page content (mobile reserves a header strip for the date-chip slot) */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden">
          <MobileNav />
          {children}
        </div>
      </div>

      {/* Mobile-web primary navigation — in-flow on mobile so it reserves its
          own height (no per-page bottom padding needed); the desktop rail
          covers ≥ md. Replaces the retired hamburger drawer. */}
      <BottomTabBar user={user} onboardingIncomplete={showOnboardingNudge} />
      {/* Shell-level log action — promoted from the dashboard so quick-logging
          is reachable from every mobile surface. */}
      <FloatingMealTrigger />

      {showOnboarding && (
        <WizardShell
          initialStep={hasStepOneLocaleDraft ? 1 : resumeStep}
          initialProfile={initialProfile}
          onClose={handleClose}
          onComplete={handleComplete}
        />
      )}
    </div>
  );
}
