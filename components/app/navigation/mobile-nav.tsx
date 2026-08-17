'use client';

import { LogOut, Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { KalloWordmark } from '@/components/brand/kallo-wordmark';
import { ProfileAvatar } from '@/components/shared/profile-avatar';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useMealShareInviteCount } from '@/hooks/social/sharing/use-meal-share-invites';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/core/ui/cn';
import { createClient } from '@/lib/infra/supabase/client';
import { MobileMenuButton } from './mobile/mobile-menu-button';
import { MobileNavList } from './mobile/mobile-nav-list';
import { deriveLabel } from './mobile/mobile-user-label';
import { isActiveRoute, visibleNavItems } from './nav-items';
import { OnboardingNudge } from './onboarding-nudge';
import type { UserMenuUser } from './user-menu';

interface MobileNavProps {
  user: UserMenuUser;
  isAdmin?: boolean;
  onboardingIncomplete?: boolean;
  onboardingStep?: number;
  onResumeOnboarding?: () => void;
  isOnboardingMinimized?: boolean;
  onMinimizeOnboarding?: () => Promise<void> | void;
  onRestoreOnboarding?: () => Promise<void> | void;
}

/**
 * Mobile primary navigation — small in-flow header with a hamburger icon
 * button that opens a left-side slide-in drawer. Reserves layout space above
 * the page content so it never overlaps page titles. Hidden on `md` and up;
 * the desktop sidebar takes over there.
 */
export function MobileNav({
  user,
  isAdmin = false,
  onboardingIncomplete = false,
  onboardingStep = 0,
  onResumeOnboarding,
  isOnboardingMinimized = false,
  onMinimizeOnboarding,
  onRestoreOnboarding,
}: MobileNavProps) {
  const pathname = usePathname();
  const tShell = useTranslations('app.shell');
  const tNav = useTranslations('app.mainSidebar');
  const tMenu = useTranslations('app.userMenu');
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const items = visibleNavItems(isAdmin);
  const inviteCount = useMealShareInviteCount();
  const label = deriveLabel(user);
  const settingsActive = isActiveRoute(pathname, '/settings');

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      document.cookie = 'NEXT_LOCALE=; Path=/; Max-Age=0; SameSite=Lax';
      window.location.assign('/');
    } catch (error) {
      console.error('Failed to sign out:', error);
      toast.error(tMenu('signOutError'));
      setSigningOut(false);
    }
  };

  return (
    <header className="group/mobileheader mb-1 flex items-center gap-2 md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <MobileMenuButton
            open={open}
            label={tShell('openMenu')}
            onboardingIncomplete={onboardingIncomplete}
            inviteCount={inviteCount}
          />
        </SheetTrigger>

        <SheetContent
          side="left"
          showCloseButton={false}
          className="flex h-full w-[88vw] max-w-[320px] flex-col gap-0 border-kallo-border/60 bg-kallo-surface p-0"
        >
          <SheetHeader className="gap-1 border-kallo-border/40 border-b px-4 py-4 text-left">
            <KalloWordmark className="mb-2 h-4 w-auto text-kallo-text" />
            <SheetTitle className="font-sans-display text-[15px] text-kallo-text">
              {label || tMenu('account')}
            </SheetTitle>
            {user.email ? (
              <SheetDescription className="font-sans-display text-[11.5px] text-kallo-text-muted">
                {user.email}
              </SheetDescription>
            ) : null}
          </SheetHeader>

          <nav
            aria-label={tShell('navigationMenu')}
            className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3 py-3"
          >
            <MobileNavList
              items={items}
              pathname={pathname}
              inviteCount={inviteCount}
              onNavigate={() => setOpen(false)}
            />
          </nav>

          <div className="shrink-0 border-kallo-border/40 border-t bg-white/40 px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
            {onboardingIncomplete && onResumeOnboarding ? (
              <div className="mb-3">
                <OnboardingNudge
                  step={onboardingStep}
                  variant="mobile"
                  isMinimized={isOnboardingMinimized}
                  onMinimize={onMinimizeOnboarding ?? (() => {})}
                  onRestore={onRestoreOnboarding ?? (() => {})}
                  onResume={() => {
                    setOpen(false);
                    onResumeOnboarding();
                  }}
                />
              </div>
            ) : null}

            <div className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5">
              <ProfileAvatar avatarUrl={user.avatarUrl} label={label} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium font-sans-display text-[13px] text-kallo-text">
                  {label || tMenu('account')}
                </span>
                {user.email ? (
                  <span className="truncate font-sans-display text-[11px] text-kallo-text-muted">
                    {user.email}
                  </span>
                ) : null}
              </div>
            </div>

            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              aria-current={settingsActive ? 'page' : undefined}
              className={cn(
                'mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors',
                settingsActive
                  ? 'bg-kallo-hover text-[#141413]'
                  : 'text-[#6E6D66] hover:bg-kallo-hover hover:text-[#141413]'
              )}
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
              <span className="font-medium font-sans-display text-[13px]">
                {tNav('settings')}
              </span>
            </Link>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              aria-busy={signingOut}
              className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-kallo-danger transition-colors hover:bg-kallo-danger/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="font-medium font-sans-display text-[13px]">
                {tMenu('signOut')}
              </span>
            </button>
          </div>
        </SheetContent>
      </Sheet>
      {/* Mobile header right-slot. Currently filled (single filler) by
          MobileTimelinePicker via React portal — see mobile-timeline-picker.tsx.
          Strip-mode contract: when the picker enters strip mode it sets
          `data-strip-mode="true"` on its portaled root, and the hamburger +
          spacer below match via `group-has-[[data-strip-mode=true]]/mobileheader`
          to drop out so the strip can use the full row width. */}
      <div
        id="app-mobile-header-slot"
        className="flex min-w-0 flex-1 items-center justify-center"
      />
      {/* Mirror the hamburger width so the slot's center aligns with the
          screen center in chip mode. Hidden in strip mode (paired with the
          hamburger) so the strip can use the full row width. */}
      <div
        aria-hidden="true"
        className="size-11 shrink-0 group-has-[[data-strip-mode=true]]/mobileheader:hidden"
      />
    </header>
  );
}
