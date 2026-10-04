'use client';

import { useTranslations } from 'next-intl';
import { MobileActivityButton } from '@/components/activity/mobile-activity-button';
import { KalloWordmark } from '@/components/brand/kallo-wordmark';
import { ProfileAvatar } from '@/components/shared/profile-avatar';
import { usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/core/ui/cn';
import {
  MobileAccountSheet,
  type MobileOnboardingProps,
} from './mobile/mobile-account-sheet';
import { deriveLabel } from './mobile/mobile-user-label';
import { isActiveRoute } from './nav-items';
import { OnboardingDot } from './onboarding-nudge';
import type { UserMenuUser } from './user-menu';

interface MobileHeaderProps extends MobileOnboardingProps {
  user: UserMenuUser;
  isAdmin?: boolean;
}

const SIDE = 'flex flex-1 basis-0 items-center';
// Strip mode: the picker's full-width week strip owns the whole row.
const STRIP_HIDDEN = 'group-has-[[data-strip-mode=true]]/mobileheader:hidden';

/**
 * The mobile header row above every app page, laid out like the Flutter
 * `AppHeader`: the Kallo wordmark on Today, a centered slot pages portal into
 * (the logging date chip), and on the right the activity heart and the
 * account avatar, which opens the account sheet (Settings, Admin, sign-out).
 * Navigation itself lives on the bottom tab bar. Hidden on `md` and up, where
 * the desktop sidebar takes over.
 */
export function MobileHeader({
  user,
  isAdmin = false,
  ...onboarding
}: MobileHeaderProps) {
  const pathname = usePathname();
  const tMenu = useTranslations('app.userMenu');
  const accountActive =
    isActiveRoute(pathname, '/settings') || isActiveRoute(pathname, '/admin');

  return (
    <header className="group/mobileheader flex h-12 shrink-0 items-center gap-2 px-3 md:hidden">
      <div className={cn(SIDE, 'justify-start', STRIP_HIDDEN)}>
        {isActiveRoute(pathname, '/dashboard') ? (
          <KalloWordmark className="h-[22px] w-auto text-kallo-text" />
        ) : null}
      </div>
      {/* Mobile header center slot. Currently filled (single filler) by
          MobileTimelinePicker via React portal — see mobile-timeline-picker.tsx.
          Strip-mode contract: when the picker enters strip mode it sets
          `data-strip-mode="true"` on its portaled root, and both sides match
          via `group-has-[[data-strip-mode=true]]/mobileheader` to drop out so
          the strip can use the full row width. */}
      <div
        id="app-mobile-header-slot"
        className="flex min-w-0 shrink items-center justify-center group-has-[[data-strip-mode=true]]/mobileheader:flex-1"
      />
      <div className={cn(SIDE, 'justify-end gap-1', STRIP_HIDDEN)}>
        <MobileActivityButton />
        <MobileAccountSheet
          user={user}
          isAdmin={isAdmin}
          {...onboarding}
          trigger={
            <button
              type="button"
              aria-label={tMenu('openMenu')}
              className="relative flex size-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent"
            >
              <ProfileAvatar
                avatarUrl={user.avatarUrl}
                label={deriveLabel(user)}
                className={cn(
                  'size-9',
                  accountActive && 'ring-2 ring-kallo-text ring-offset-2'
                )}
              />
              {onboarding.onboardingIncomplete ? (
                <OnboardingDot className="top-1 right-1" />
              ) : null}
            </button>
          }
        />
      </div>
    </header>
  );
}
