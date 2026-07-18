'use client';

import {
  LogOut,
  MousePointerClick,
  Settings,
  User as UserIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { UserAvatarDisc } from '@/components/app/navigation/user-avatar-disc';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Link } from '@/i18n/navigation';
import type { SidebarExpandMode } from '@/lib/sidebar/types';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

export interface UserMenuUser {
  email: string | null;
  displayName: string | null;
  /** Public URL of the uploaded avatar photo; absent = initials disc. */
  avatarUrl?: string | null;
}

function deriveInitial(user: UserMenuUser): string {
  const source = user.displayName || user.email || '';
  const trimmed = source.trim();
  if (!trimmed) return '·';
  return trimmed.charAt(0).toUpperCase();
}

function deriveLabel(user: UserMenuUser): string {
  if (user.displayName?.trim()) return user.displayName.trim();
  if (user.email) return user.email.split('@')[0] ?? user.email;
  return '';
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
 * to "/" so middleware re-evaluates auth state.
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
  const [signingOut, setSigningOut] = useState(false);
  const open = openProp ?? internalOpen;
  const handleOpenChange = (next: boolean) => {
    if (openProp === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };
  const initial = deriveInitial(user);
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
      toast.error(t('signOutError'));
      setSigningOut(false);
    }
  };

  const triggerButton = (
    <button
      type="button"
      aria-label={t('openMenu')}
      aria-haspopup="menu"
      aria-expanded={open}
      className={cn(
        'group/usermenu relative flex w-full items-center rounded-lg text-left transition-colors hover:bg-nham-hover/55 focus-visible:bg-nham-hover/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent',
        collapsed ? 'justify-center gap-0 p-1' : 'gap-3 p-1.5'
      )}
    >
      <UserAvatarDisc initial={initial} avatarUrl={user.avatarUrl}>
        {showOnboardingDot && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 animate-pulse-dot rounded-full bg-nham-accent ring-2 ring-nham-surface"
          />
        )}
      </UserAvatarDisc>
      {!collapsed && (
        <span className="min-w-0 flex-1 overflow-hidden">
          <span className="block truncate font-medium font-sans-display text-[12px] text-nham-text">
            {label}
          </span>
          {user.email && (
            <span className="block truncate font-sans-display text-[10.5px] text-nham-text-muted">
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
        className="min-w-[12rem] border border-nham-border/60 bg-nham-surface font-sans-display"
      >
        {label && (
          <>
            <DropdownMenuLabel className="px-2 py-1.5 text-[11px] text-nham-text-muted">
              <span className="block truncate font-medium text-nham-text">
                {label}
              </span>
              {user.email && (
                <span className="block truncate font-normal text-[10.5px]">
                  {user.email}
                </span>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-nham-border/60" />
          </>
        )}

        {showModeToggle && (
          <>
            <DropdownMenuCheckboxItem
              checked={expandMode === 'hover'}
              onCheckedChange={(checked) =>
                onExpandModeChange?.(checked ? 'hover' : 'click')
              }
              className="gap-2 text-[12px] text-nham-text focus:bg-nham-hover/70 focus:text-nham-text"
            >
              <MousePointerClick className="h-3.5 w-3.5 text-nham-text-muted" />
              {t('expandOnHover')}
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator className="bg-nham-border/60" />
          </>
        )}

        <DropdownMenuItem asChild>
          <Link
            href="/settings"
            className="flex items-center gap-2 text-[12px] text-nham-text focus:bg-nham-hover/70 focus:text-nham-text"
          >
            <UserIcon className="h-3.5 w-3.5" />
            {t('profile')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            href="/settings"
            className="flex items-center gap-2 text-[12px] text-nham-text focus:bg-nham-hover/70 focus:text-nham-text"
          >
            <Settings className="h-3.5 w-3.5" />
            {t('settings')}
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-nham-border/60" />

        <DropdownMenuItem
          onClick={handleSignOut}
          disabled={signingOut}
          aria-busy={signingOut}
          className="flex items-center gap-2 text-[12px] text-nham-danger focus:bg-nham-danger/10 focus:text-nham-danger"
        >
          <LogOut className="h-3.5 w-3.5" />
          {t('signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
