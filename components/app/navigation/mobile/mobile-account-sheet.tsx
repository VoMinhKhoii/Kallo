'use client';

import { LogOut, Settings, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';
import { ProfileAvatar } from '@/components/shared/profile-avatar';
import { ResponsiveSheet } from '@/components/shared/responsive-sheet';
import { ResponsiveSheetHeader } from '@/components/shared/responsive-sheet-header';
import { useSignOut } from '@/hooks/auth/use-sign-out';
import { cn } from '@/lib/core/ui/cn';
import { OnboardingNudge } from '../onboarding-nudge';
import type { UserMenuUser } from '../user-menu';
import { ACCOUNT_ROW, AccountSheetRow } from './account-sheet-row';
import { deriveLabel } from './mobile-user-label';

export interface MobileOnboardingProps {
  onboardingIncomplete?: boolean;
  onboardingStep?: number;
  onResumeOnboarding?: () => void;
  isOnboardingMinimized?: boolean;
  onMinimizeOnboarding?: () => Promise<void> | void;
  onRestoreOnboarding?: () => Promise<void> | void;
}

interface MobileAccountSheetProps extends MobileOnboardingProps {
  /** The header avatar that opens the sheet, registered as its trigger so
   *  focus returns to it on close. */
  trigger: ReactNode;
  user: UserMenuUser;
  isAdmin?: boolean;
}

/**
 * The account surface behind the header avatar — a bottom sheet in the
 * shape of an iOS grouped settings list: who you are, the off-bar
 * destinations (Settings, Admin), and sign-out on its own row. It replaces the
 * retired left drawer, which carried these alongside the primary destinations
 * that now live on the tab bar.
 */
export function MobileAccountSheet({
  trigger,
  user,
  isAdmin = false,
  onboardingIncomplete = false,
  onboardingStep = 0,
  onResumeOnboarding,
  isOnboardingMinimized = false,
  onMinimizeOnboarding,
  onRestoreOnboarding,
}: MobileAccountSheetProps) {
  const tShell = useTranslations('app.shell');
  const tNav = useTranslations('app.mainSidebar');
  const tMenu = useTranslations('app.userMenu');
  const { signOut, signingOut } = useSignOut();
  const label = deriveLabel(user) || tMenu('account');
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={setOpen}
      title={tMenu('account')}
      trigger={trigger}
    >
      <ResponsiveSheetHeader
        title={tMenu('account')}
        closeLabel={tShell('closeMenu')}
        onClose={close}
      />
      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain px-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
        <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3">
          <ProfileAvatar
            avatarUrl={user.avatarUrl}
            label={label}
            className="size-11"
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-semibold text-[15px] text-kallo-text">
              {label}
            </span>
            {user.email ? (
              <span className="truncate text-[13px] text-kallo-text-muted">
                {user.email}
              </span>
            ) : null}
          </div>
        </div>

        {onboardingIncomplete && onResumeOnboarding ? (
          <OnboardingNudge
            step={onboardingStep}
            variant="mobile"
            isMinimized={isOnboardingMinimized}
            onMinimize={onMinimizeOnboarding ?? (() => {})}
            onRestore={onRestoreOnboarding ?? (() => {})}
            onResume={() => {
              close();
              onResumeOnboarding();
            }}
          />
        ) : null}

        <ul className="divide-y divide-kallo-border/70 overflow-hidden rounded-2xl bg-white">
          <AccountSheetRow
            href="/settings"
            icon={<Settings className="size-[18px]" aria-hidden="true" />}
            label={tNav('settings')}
            onNavigate={close}
          />
          {isAdmin ? (
            <AccountSheetRow
              href="/admin"
              icon={<ShieldCheck className="size-[18px]" aria-hidden="true" />}
              label={tNav('admin')}
              onNavigate={close}
            />
          ) : null}
        </ul>

        <div className="overflow-hidden rounded-2xl bg-white">
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            aria-busy={signingOut}
            className={cn(ACCOUNT_ROW, 'text-kallo-danger disabled:opacity-60')}
          >
            <LogOut className="size-[18px]" aria-hidden="true" />
            <span className="font-medium text-[15px]">{tMenu('signOut')}</span>
          </button>
        </div>
      </div>
    </ResponsiveSheet>
  );
}
