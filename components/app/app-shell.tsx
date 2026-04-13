'use client';

import { Menu, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
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
  const pathname = usePathname();
  const isIncomplete = onboardingStep < ONBOARDING_REQUIRED_STEP;
  const [showOnboarding, setShowOnboarding] = useState(isIncomplete);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally re-run on pathname change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

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
            onboardingIncomplete={isIncomplete && !showOnboarding}
            onResumeOnboarding={() => setShowOnboarding(true)}
          />
        </div>

        {/* Mobile sidebar overlay */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"
              onClick={() => setMobileMenuOpen(false)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setMobileMenuOpen(false);
              }}
            />
            <div className="relative h-full w-64 p-3">
              <MainSidebar
                onboardingIncomplete={isIncomplete && !showOnboarding}
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
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-nham-text-muted transition-colors hover:bg-nham-hover/60"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? (
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
          initialStep={Math.min(onboardingStep + 1, 4)}
          initialProfile={initialProfile}
          onClose={handleClose}
          onComplete={handleComplete}
        />
      )}
    </div>
  );
}
