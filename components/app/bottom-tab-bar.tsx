'use client';

import {
  Activity,
  LayoutDashboard,
  LogOut,
  Settings,
  UtensilsCrossed,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type * as React from 'react';
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
import { useScrollDirection } from '@/hooks/use-scroll-direction';
import { Link, usePathname } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { OnboardingDot, OnboardingNudge } from './onboarding-nudge';
import type { UserMenuUser } from './user-menu';

interface TabItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
}

function isActiveRoute(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
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
 * Mobile bottom tab bar — sticky, safe-area-aware, three primary destinations
 * plus an avatar tab that opens a bottom sheet for the rest (settings,
 * onboarding nudge, sign-out). Hides on scroll-down, returns on scroll-up.
 */
export function BottomTabBar({
  user,
  onboardingIncomplete = false,
  onboardingStep = 0,
  onResumeOnboarding,
  isOnboardingMinimized = false,
  onMinimizeOnboarding,
  onRestoreOnboarding,
}: {
  user: UserMenuUser;
  onboardingIncomplete?: boolean;
  onboardingStep?: number;
  onResumeOnboarding?: () => void;
  isOnboardingMinimized?: boolean;
  onMinimizeOnboarding?: () => Promise<void> | void;
  onRestoreOnboarding?: () => Promise<void> | void;
}) {
  const pathname = usePathname();
  const t = useTranslations('app.bottomTabs');
  const tNav = useTranslations('app.mainSidebar');
  const tMenu = useTranslations('app.userMenu');
  const direction = useScrollDirection();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const tabs: TabItem[] = [
    {
      id: 'dashboard',
      label: tNav('dashboard'),
      href: '/dashboard',
      icon: <LayoutDashboard className="h-5 w-5" aria-hidden="true" />,
    },
    {
      id: 'nutrition',
      label: tNav('nutrition'),
      href: '/nutrition',
      icon: <Activity className="h-5 w-5" aria-hidden="true" />,
    },
    {
      id: 'logging',
      label: tNav('logging'),
      href: '/logging',
      icon: <UtensilsCrossed className="h-5 w-5" aria-hidden="true" />,
    },
  ];

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

  const hidden = direction === 'down' && !focusWithin && !sheetOpen;

  return (
    <nav
      aria-label={t('label')}
      data-hidden={hidden ? 'true' : 'false'}
      onFocusCapture={() => setFocusWithin(true)}
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node)) {
          setFocusWithin(false);
          return;
        }
        setFocusWithin(event.currentTarget.contains(nextTarget));
      }}
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-nham-border/60 border-t bg-nham-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur transition-transform duration-300 ease-out supports-[backdrop-filter]:bg-nham-surface/85 md:hidden',
        hidden ? 'translate-y-full' : 'translate-y-0'
      )}
    >
      <ul className="grid grid-cols-4">
        {tabs.map((tab) => {
          const active = isActiveRoute(pathname, tab.href);
          return (
            <li key={tab.id}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                aria-label={tab.label}
                className={cn(
                  'relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-2 pt-2 pb-1.5 transition-colors',
                  active
                    ? 'text-nham-btn'
                    : 'text-nham-text-muted hover:text-nham-text'
                )}
              >
                <span
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-xl transition-colors',
                    active && 'bg-nham-btn/10'
                  )}
                >
                  {tab.icon}
                </span>
                <span
                  className={cn(
                    'font-medium font-sans-display text-[10px] tracking-tight',
                    active && 'text-nham-btn'
                  )}
                >
                  {tab.label}
                </span>
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute top-0 left-1/2 h-[3px] w-8 -translate-x-1/2 rounded-b-full bg-nham-btn"
                  />
                )}
              </Link>
            </li>
          );
        })}

        <li>
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label={tMenu('openMenu')}
                aria-haspopup="dialog"
                aria-expanded={sheetOpen}
                className="relative flex min-h-[56px] w-full flex-col items-center justify-center gap-0.5 px-2 pt-2 pb-1.5 text-nham-text-muted transition-colors hover:text-nham-text"
              >
                <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-nham-accent/40 to-nham-border/55 ring-1 ring-nham-accent/25">
                  <span className="font-bold font-sans-display text-[12px] text-nham-btn">
                    {initial}
                  </span>
                  {onboardingIncomplete && (
                    <OnboardingDot className="-top-0.5 -right-0.5" />
                  )}
                </span>
                <span className="font-medium font-sans-display text-[10px] tracking-tight">
                  {tMenu('account')}
                </span>
              </button>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="rounded-t-2xl border-nham-border/60 border-t bg-nham-surface px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-nham-border/60" />
              <SheetHeader className="px-0 pt-0 text-left">
                <SheetTitle className="font-sans-display text-[15px] text-nham-text">
                  {label || tMenu('account')}
                </SheetTitle>
                {user.email && (
                  <SheetDescription className="font-sans-display text-[11.5px] text-nham-text-muted">
                    {user.email}
                  </SheetDescription>
                )}
              </SheetHeader>

              <div className="mt-4 flex flex-col gap-3">
                {onboardingIncomplete && onResumeOnboarding && (
                  <OnboardingNudge
                    step={onboardingStep}
                    variant="mobile"
                    isMinimized={isOnboardingMinimized}
                    onMinimize={onMinimizeOnboarding ?? (() => {})}
                    onRestore={onRestoreOnboarding ?? (() => {})}
                    onResume={() => {
                      setSheetOpen(false);
                      onResumeOnboarding();
                    }}
                  />
                )}

                <Link
                  href="/settings"
                  onClick={() => setSheetOpen(false)}
                  aria-current={settingsActive ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-3 transition-colors',
                    settingsActive
                      ? 'bg-nham-btn text-white'
                      : 'bg-white text-nham-text hover:bg-nham-hover/60'
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
                  className="flex items-center gap-3 rounded-xl bg-white px-3 py-3 text-left text-nham-danger transition-colors hover:bg-nham-danger/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  <span className="font-medium font-sans-display text-[13px]">
                    {tMenu('signOut')}
                  </span>
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}
