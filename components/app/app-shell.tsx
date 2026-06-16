'use client';

import { useTranslations } from 'next-intl';
import { useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
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

function subscribeToStepOneLocaleDraft() {
  return () => {};
}

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
  const router = useRouter();
  const showResumeOnboarding = shouldShowOnboardingResume(
    initialProfile,
    onboardingStep
  );
  const resumeStep = getOnboardingResumeStep(initialProfile, onboardingStep);
  const hasStepOneLocaleDraft = useSyncExternalStore(
    subscribeToStepOneLocaleDraft,
    () => readStepOneLocaleDraft() !== null,
    () => false
  );
  const [draftAutoOpenDismissed, setDraftAutoOpenDismissed] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(
    onboardingStep === 0 && isFirstSession
  );
  const shouldAutoOpenFromDraft =
    hasStepOneLocaleDraft && !draftAutoOpenDismissed;
  const onboardingOpen = showOnboarding || shouldAutoOpenFromDraft;

  const handleClose = () => {
    setShowOnboarding(false);
    setDraftAutoOpenDismissed(true);
  };

  const handleComplete = () => {
    setShowOnboarding(false);
    setDraftAutoOpenDismissed(true);
    router.refresh();
  };

  const handleResume = () => setShowOnboarding(true);
  const showOnboardingNudge = showResumeOnboarding && !onboardingOpen;

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
    <div className="flex h-dvh min-w-0 overflow-hidden bg-nham-surface">
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

        {/* Page content (mobile gets a hamburger header reserving space above) */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden">
          <MobileNav
            user={user}
            isAdmin={isAdmin}
            onboardingIncomplete={showOnboardingNudge}
            onboardingStep={onboardingStep}
            onResumeOnboarding={handleResume}
            isOnboardingMinimized={isOnboardingMinimized}
            onMinimizeOnboarding={handleMinimizeNudge}
            onRestoreOnboarding={handleRestoreNudge}
          />
          {children}
        </div>
      </div>

      {onboardingOpen && (
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
