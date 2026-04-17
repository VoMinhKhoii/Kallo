'use client';

import { Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { WizardShell } from '@/components/onboarding/wizard-shell';
import { usePathname, useRouter } from '@/i18n/navigation';
import type { getOnboardingProfile } from '@/lib/onboarding/actions';
import {
  getOnboardingResumeStep,
  shouldShowOnboardingResume,
} from '@/lib/onboarding/progress';
import { MainSidebar } from './main-sidebar';

type ProfileRow = NonNullable<Awaited<ReturnType<typeof getOnboardingProfile>>>;

interface AppShellProps {
  onboardingStep: number;
  initialProfile: ProfileRow | null;
  isFirstSession: boolean;
  children: React.ReactNode;
}

export function AppShell({
  onboardingStep,
  initialProfile,
  isFirstSession,
  children,
}: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const showResumeOnboarding = shouldShowOnboardingResume(
    initialProfile,
    onboardingStep
  );
  const resumeStep = getOnboardingResumeStep(initialProfile, onboardingStep);
  const [showOnboarding, setShowOnboarding] = useState(
    onboardingStep === 0 && isFirstSession
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileMenuPath, setMobileMenuPath] = useState(pathname);
  const overlayRef = useRef<HTMLDivElement>(null);
  const isMobileMenuVisible = mobileMenuOpen && mobileMenuPath === pathname;

  // Focus the overlay dialog when it opens for keyboard accessibility
  useEffect(() => {
    if (isMobileMenuVisible) {
      overlayRef.current?.focus();
    }
  }, [isMobileMenuVisible]);

  const handleClose = () => {
    setShowOnboarding(false);
  };

  const handleComplete = () => {
    setShowOnboarding(false);
    router.refresh();
  };

  return (
    <div className="flex h-screen bg-nham-surface">
      <div className="flex min-h-0 flex-1 gap-3 p-3">
        {/* Desktop sidebar */}
        <div className="hidden md:block">
          <MainSidebar
            onboardingIncomplete={showResumeOnboarding && !showOnboarding}
            onResumeOnboarding={() => setShowOnboarding(true)}
          />
        </div>

        {/* Mobile sidebar overlay */}
        {isMobileMenuVisible && (
          <div
            ref={overlayRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            id="mobile-menu"
            tabIndex={-1}
            className="fixed inset-0 z-50 outline-none md:hidden"
            onKeyDown={(e) => {
              if (e.key === 'Escape') setMobileMenuOpen(false);
            }}
          >
            <div
              className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />
            <div className="relative h-full w-64 p-3">
              <MainSidebar
                onboardingIncomplete={showResumeOnboarding && !showOnboarding}
                onResumeOnboarding={() => setShowOnboarding(true)}
              />
            </div>
          </div>
        )}

        {/* Main content area */}
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Mobile header bar */}
          <div className="flex items-center py-2 md:hidden">
            <button
              type="button"
              onClick={() => {
                if (isMobileMenuVisible) {
                  setMobileMenuOpen(false);
                  return;
                }

                setMobileMenuPath(pathname);
                setMobileMenuOpen(true);
              }}
              aria-label={isMobileMenuVisible ? 'Close menu' : 'Open menu'}
              aria-expanded={isMobileMenuVisible}
              aria-controls="mobile-menu"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-nham-text-muted transition-colors hover:bg-nham-hover/60"
            >
              {isMobileMenuVisible ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>

          {/* Page content */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {children}
          </div>
        </div>
      </div>

      {showOnboarding && (
        <WizardShell
          initialStep={resumeStep}
          initialProfile={initialProfile}
          onClose={handleClose}
          onComplete={handleComplete}
        />
      )}
    </div>
  );
}
