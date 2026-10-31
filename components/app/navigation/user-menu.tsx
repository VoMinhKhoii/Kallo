'use client';

import { LogOut, Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { ThemeMenuRadio } from '@/components/settings/appearance/theme-menu-radio';
import { ProfileAvatar } from '@/components/shared/profile-avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSignOut } from '@/hooks/auth/use-sign-out';
import { useSettingsLink } from '@/hooks/settings/use-settings-dialog';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/core/ui/cn';
import type { SidebarExpandMode } from '@/lib/sidebar/types';
import { deriveLabel } from './mobile/mobile-user-label';
import {
  ExpandModeMenuItem,
  MENU_ROW,
  MENU_ROW_ICON,
} from './sidebar/expand-mode-menu-item';

export interface UserMenuUser {
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

/**
 * Avatar trigger + dropdown menu. Replaces the hardcoded user row + standalone
 * sign-out icon in the previous sidebar.
 *
 * - On desktop expanded: avatar + name + email row.
 * - On desktop collapsed: avatar only; menu opens to the right.
 * - On mobile: rendered as a list of action rows inside the bottom Sheet.
 *
 * Sign-out flow mirrors the previous behavior: clear locale cookie, hard-nav
 * to "/" so the proxy re-evaluates auth state.
 */
export function UserMenu({
  user,
  collapsed = false,
  showOnboardingDot = false,
  open: openProp,
  onOpenChange,
  expandMode,
  onExpandModeChange,
}: {
  user: UserMenuUser;
  collapsed?: boolean;
  showOnboardingDot?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  expandMode?: SidebarExpandMode;
  onExpandModeChange?: (mode: SidebarExpandMode) => void;
}) {
  const t = useTranslations('app.userMenu');
  const [internalOpen, setInternalOpen] = useState(false);
  const { signOut: handleSignOut, signingOut } = useSignOut();
  const open = openProp ?? internalOpen;
  const handleOpenChange = (next: boolean) => {
    if (openProp === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };
  // The link cancels its click to open the dialog in place, which Radix
  // reads as "keep the menu open": close it ourselves.
  const settingsLink = useSettingsLink(() => handleOpenChange(false));
  const label = deriveLabel(user);

  // Show the hover-mode toggle only on fine-pointer devices. On touch the
  // option is meaningless (no hover state), so we hide it to avoid clutter.
  const [isFinePointer, setIsFinePointer] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(pointer: fine)');
    setIsFinePointer(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsFinePointer(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  const showModeToggle =
    isFinePointer &&
    expandMode !== undefined &&
    onExpandModeChange !== undefined;

  const triggerButton = (
    <button
      type="button"
      aria-label={t('openMenu')}
      aria-haspopup="menu"
      aria-expanded={open}
      className={cn(
        'group/usermenu relative flex w-full items-center rounded-lg text-left transition-colors hover:bg-kallo-ink/[0.04] focus-visible:bg-kallo-ink/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent',
        collapsed ? 'justify-center gap-0 p-1' : 'gap-3 p-1.5'
      )}
    >
      <span className="relative flex shrink-0">
        <ProfileAvatar avatarUrl={user.avatarUrl} label={label} />
        {showOnboardingDot && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 animate-pulse-dot rounded-full bg-kallo-ink ring-2 ring-kallo-surface"
          />
        )}
      </span>
      {!collapsed && (
        <span className="min-w-0 flex-1 overflow-hidden">
          <span className="block truncate font-medium font-sans-display text-[13px] text-kallo-text">
            {label}
          </span>
          {user.email && (
            <span className="block truncate font-sans-display text-[11.5px] text-kallo-text-muted">
              {user.email}
            </span>
          )}
        </span>
      )}
    </button>
  );

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>{triggerButton}</DropdownMenuTrigger>
      <DropdownMenuContent
        side={collapsed ? 'right' : 'top'}
        align={collapsed ? 'end' : 'start'}
        sideOffset={collapsed ? 12 : 8}
        className={cn(
          'rounded-xl border border-kallo-text/10 bg-card p-1.5 font-sans-display shadow-lg',
          // Expanded, the menu is exactly as wide as the account row it opens
          // from; collapsed, that row is just the avatar.
          collapsed
            ? 'w-64'
            : 'w-(--radix-dropdown-menu-trigger-width) min-w-60'
        )}
      >
        {/* Who is signed in, when the collapsed rail shows only the avatar;
            expanded, the row the menu opens from already says it. */}
        {collapsed && label && (
          <>
            <DropdownMenuLabel className="px-2 py-1.5">
              <span className="block truncate font-medium text-[14px] text-kallo-text">
                {label}
              </span>
              {user.email && (
                <span className="block truncate font-normal text-[12px] text-kallo-text-muted">
                  {user.email}
                </span>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-kallo-ink/10" />
          </>
        )}

        <DropdownMenuItem asChild className={MENU_ROW}>
          <Link href={settingsLink.href} onClick={settingsLink.onClick}>
            <Settings className={MENU_ROW_ICON} />
            {t('settings')}
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-kallo-ink/10" />

        <ThemeMenuRadio />

        {showModeToggle && (
          <ExpandModeMenuItem
            label={t('expandOnHover')}
            mode={expandMode}
            onModeChange={onExpandModeChange}
          />
        )}

        <DropdownMenuSeparator className="bg-kallo-ink/10" />

        <DropdownMenuItem
          onClick={handleSignOut}
          disabled={signingOut}
          aria-busy={signingOut}
          className={cn(
            MENU_ROW,
            'text-kallo-danger focus:bg-kallo-danger/10 focus:text-kallo-danger data-[highlighted]:bg-kallo-danger/10'
          )}
        >
          <LogOut className="size-4 shrink-0" />
          {t('signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
