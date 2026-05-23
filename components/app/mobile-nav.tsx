'use client';

import { LogOut, Menu, Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Link, usePathname } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { isActiveRoute, visibleNavItems } from './nav-items';
import { OnboardingDot, OnboardingNudge } from './onboarding-nudge';
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
  const initial = deriveInitial(user);
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
          <button
            type="button"
            aria-label={tShell('openMenu')}
            aria-haspopup="dialog"
            aria-expanded={open}
            className="relative inline-flex size-11 shrink-0 items-center justify-center rounded-md text-nham-text transition-colors hover:bg-nham-hover/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent group-has-[[data-strip-mode=true]]/mobileheader:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
            {onboardingIncomplete ? (
              <OnboardingDot className="top-1.5 right-1.5" />
            ) : null}
          </button>
        </SheetTrigger>

        <SheetContent
          side="left"
          showCloseButton={false}
          className="flex h-full w-[88vw] max-w-[320px] flex-col gap-0 border-nham-border/60 bg-nham-surface p-0"
        >
          <SheetHeader className="gap-1 border-nham-border/40 border-b px-4 py-4 text-left">
            <SheetTitle className="font-sans-display text-[15px] text-nham-text">
              {label || tMenu('account')}
            </SheetTitle>
            {user.email ? (
              <SheetDescription className="font-sans-display text-[11.5px] text-nham-text-muted">
                {user.email}
              </SheetDescription>
            ) : null}
          </SheetHeader>

          <nav
            aria-label={tShell('navigationMenu')}
            className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-3"
          >
            <ul className="flex flex-col gap-1">
              {items.map((item) => {
                const Icon = item.icon;
                const active = isActiveRoute(pathname, item.href);
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
                        active
                          ? 'bg-nham-btn text-white shadow-nham-btn/20 shadow-sm'
                          : 'text-nham-text hover:bg-nham-hover/60'
                      )}
                    >
                      <Icon className="h-5 w-5" aria-hidden="true" />
                      <span className="font-medium font-sans-display text-[14px]">
                        {tNav(item.labelKey)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="shrink-0 border-nham-border/40 border-t bg-white/40 px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
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
              <span className="relative flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-nham-accent/40 to-nham-border/55 ring-1 ring-nham-accent/25">
                <span className="font-bold font-sans-display text-[13px] text-nham-btn">
                  {initial}
                </span>
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium font-sans-display text-[13px] text-nham-text">
                  {label || tMenu('account')}
                </span>
                {user.email ? (
                  <span className="truncate font-sans-display text-[11px] text-nham-text-muted">
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
                  ? 'bg-nham-btn text-white'
                  : 'text-nham-text hover:bg-nham-hover/60'
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
              className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-nham-danger transition-colors hover:bg-nham-danger/10 disabled:cursor-not-allowed disabled:opacity-60"
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
