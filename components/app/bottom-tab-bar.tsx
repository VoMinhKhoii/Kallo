'use client';

import {
  Activity,
  LayoutDashboard,
  LogOut,
  Settings,
  Users2,
  UtensilsCrossed,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { LanguageToggle } from '@/components/onboarding/language-toggle';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useKeyboardOpen } from '@/hooks/use-keyboard-open';
import { useLocaleSwitch } from '@/hooks/use-locale-switch';
import type { Locale } from '@/i18n/config';
import { Link, usePathname } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { isActiveRoute } from './nav-items';
import { OnboardingDot } from './onboarding-nudge';
import type { UserMenuUser } from './user-menu';

interface TabConfig {
  id: string;
  href: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
}

// The three primary destinations. "You" is rendered separately as an avatar
// disc, not from this list. Mirrors the rail nav order (Today / Meals /
// Patterns), dropping Groups into the "You" sheet to keep the bar to four
// thumb-reachable targets.
const PRIMARY_TABS: readonly TabConfig[] = [
  {
    id: 'dashboard',
    href: '/dashboard',
    labelKey: 'dashboard',
    icon: LayoutDashboard,
  },
  {
    id: 'logging',
    href: '/logging',
    labelKey: 'logging',
    icon: UtensilsCrossed,
  },
  {
    id: 'nutrition',
    href: '/nutrition',
    labelKey: 'nutrition',
    icon: Activity,
  },
] as const;

interface BottomTabBarProps {
  user: UserMenuUser;
  onboardingIncomplete?: boolean;
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
 * Mobile-web bottom tab bar — primary navigation for the installed PWA and
 * narrow screens. Cream surface, hairline top border, no elevation, safe-area
 * inset bottom padding. Hides when the keyboard is open so it never floats
 * over the composer. Replaces the hamburger drawer for primary destinations.
 *
 * Tabs: Today / Meals / Patterns / You. "You" is an avatar disc carrying the
 * onboarding pulse-dot; it opens a sheet with account, Groups, Settings,
 * language, and sign out.
 */
export function BottomTabBar({
  user,
  onboardingIncomplete = false,
}: BottomTabBarProps) {
  const pathname = usePathname();
  const tNav = useTranslations('app.mainSidebar');
  const tBottom = useTranslations('app.bottomNav');
  const tMenu = useTranslations('app.userMenu');
  const locale = useLocale();
  const switchLocale = useLocaleSwitch();
  const keyboardOpen = useKeyboardOpen();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const initial = deriveInitial(user);
  const label = deriveLabel(user);
  const youActive = isActiveRoute(pathname, '/groups') || sheetOpen;

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
    <>
      <nav
        aria-label={tBottom('label')}
        data-keyboard-open={keyboardOpen ? 'true' : undefined}
        className={cn(
          'z-40 shrink-0 border-nham-border/60 border-t bg-nham-surface md:hidden',
          'pb-[env(safe-area-inset-bottom)]',
          keyboardOpen && 'hidden'
        )}
      >
        <ul className="flex items-stretch">
          {PRIMARY_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = isActiveRoute(pathname, tab.href);
            return (
              <li key={tab.id} className="flex-1">
                <Link
                  href={tab.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1 px-1 pt-2 pb-1.5 transition-colors',
                    active ? 'text-nham-text' : 'text-nham-text-muted'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-[22px] w-[22px]',
                      active ? 'text-nham-btn' : 'text-nham-stone'
                    )}
                    aria-hidden="true"
                  />
                  <span className="font-medium font-sans-display text-[10px] leading-none">
                    {tNav(tab.labelKey)}
                  </span>
                </Link>
              </li>
            );
          })}

          <li className="flex-1">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={sheetOpen}
              aria-current={youActive ? 'page' : undefined}
              className={cn(
                'flex w-full flex-col items-center justify-center gap-1 px-1 pt-2 pb-1.5 transition-colors',
                youActive ? 'text-nham-text' : 'text-nham-text-muted'
              )}
            >
              <span className="relative flex h-[22px] w-[22px] items-center justify-center rounded-full bg-gradient-to-br from-nham-accent/40 to-nham-border/55 ring-1 ring-nham-accent/25">
                <span className="font-bold font-sans-display text-[10px] text-nham-btn">
                  {initial}
                </span>
                {onboardingIncomplete ? (
                  <OnboardingDot className="-top-0.5 -right-0.5" />
                ) : null}
              </span>
              <span className="font-medium font-sans-display text-[10px] leading-none">
                {tBottom('you')}
              </span>
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="bottom"
          className="gap-0 rounded-t-[1.5rem] border-nham-border/60 bg-nham-surface px-0 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]"
        >
          <SheetHeader className="px-5 pt-5 pb-2 text-left">
            <SheetTitle className="font-sans-display text-[15px] text-nham-text">
              {label || tMenu('account')}
            </SheetTitle>
            {user.email ? (
              <SheetDescription className="font-sans-display text-[12px] text-nham-text-muted">
                {user.email}
              </SheetDescription>
            ) : (
              <SheetDescription className="sr-only">
                {tBottom('youSheetLabel')}
              </SheetDescription>
            )}
          </SheetHeader>

          <div className="flex flex-col px-3 pt-1 pb-2">
            <Link
              href="/groups"
              onClick={() => setSheetOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-nham-text transition-colors hover:bg-nham-hover/60"
            >
              <Users2 className="h-[18px] w-[18px] text-nham-stone" />
              <span className="font-medium font-sans-display text-[14px]">
                {tNav('groups')}
              </span>
            </Link>
            <Link
              href="/settings"
              onClick={() => setSheetOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-nham-text transition-colors hover:bg-nham-hover/60"
            >
              <Settings className="h-[18px] w-[18px] text-nham-stone" />
              <span className="font-medium font-sans-display text-[14px]">
                {tNav('settings')}
              </span>
            </Link>
          </div>

          <div className="border-nham-border/40 border-t px-5 pt-4 pb-3">
            <p className="mb-2.5 font-medium font-sans-display text-[12px] text-nham-text-muted">
              {tBottom('language')}
            </p>
            <LanguageToggle
              value={locale}
              onChange={(next) => switchLocale(next as Locale)}
            />
          </div>

          <div className="border-nham-border/40 border-t px-3 pt-2">
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              aria-busy={signingOut}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-nham-danger transition-colors hover:bg-nham-danger/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogOut className="h-[18px] w-[18px]" />
              <span className="font-medium font-sans-display text-[14px]">
                {tMenu('signOut')}
              </span>
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
