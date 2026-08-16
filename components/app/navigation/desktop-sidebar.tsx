'use client';

import { Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type * as React from 'react';
import { useState } from 'react';
import { useMealShareInviteCount } from '@/hooks/social/use-meal-share-invites';
import { useSidebarState } from '@/hooks/ui/use-sidebar-state';
import { usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/ui/cn';
import { isActiveRoute, visibleNavItems } from './nav-items';
import { OnboardingNudge } from './onboarding-nudge';
import {
  type SidebarNavItem,
  SidebarNavLink,
} from './sidebar/sidebar-nav-link';
import { SidebarBrandHeader } from './sidebar-brand-header';
import { UserMenu, type UserMenuUser } from './user-menu';

export interface DesktopSidebarProps {
  user: UserMenuUser;
  isAdmin?: boolean;
  onboardingIncomplete?: boolean;
  onboardingStep?: number;
  onResumeOnboarding?: () => void;
  isOnboardingMinimized?: boolean;
  onMinimizeOnboarding?: () => Promise<void> | void;
  onRestoreOnboarding?: () => Promise<void> | void;
  initialState?: 'closed' | 'open';
  initialExpandMode?: 'click' | 'hover';
}

const EXPANDED_WIDTH = 'w-[260px]';
const COLLAPSED_WIDTH = 'w-[68px]';

function SectionHeader({
  label,
  collapsed,
}: {
  label: string;
  collapsed: boolean;
}) {
  return (
    <div className="relative flex h-5 items-center px-3">
      <span
        className={cn(
          'overflow-hidden whitespace-nowrap font-medium font-sans-display text-[10px] text-kallo-text-muted uppercase tracking-[0.06em] transition-all duration-300',
          collapsed ? 'max-w-0 opacity-0' : 'max-w-32 opacity-100'
        )}
      >
        {label}
      </span>
      <div
        aria-hidden="true"
        className={cn(
          'absolute inset-x-1 top-1/2 h-px bg-gradient-to-r from-transparent via-kallo-border/60 to-transparent transition-opacity duration-300',
          collapsed ? 'opacity-100' : 'opacity-0'
        )}
      />
    </div>
  );
}

/**
 * Desktop sidebar — production-ready replacement for `MainSidebar`.
 *
 * Design notes:
 * - Width animation is an intentional documented exception to the project's
 *   "don't animate layout properties" rule. A single isolated element resizes,
 *   no children re-layout heavily, and the pattern is industry-standard
 *   (Linear, Notion, Vercel, Raycast). 220ms ease-out.
 * - Width is fixed (`w-[260px]` / `w-[68px]`) so labels can't reflow the rail.
 * - Sticky positioning + inner scroll keeps the rail anchored while the
 *   middle nav scrolls when content exceeds the viewport.
 * - Hover-peek and ⌘B come from `useSidebarState`. Pinned-collapsed persists.
 * - Native browser `title` tooltips are gone — replaced by the brand-styled
 *   `SidebarTooltip` (shadcn) in collapsed-only mode.
 */
export function DesktopSidebar({
  user,
  isAdmin = false,
  onboardingIncomplete = false,
  onboardingStep = 0,
  onResumeOnboarding,
  isOnboardingMinimized = false,
  onMinimizeOnboarding,
  onRestoreOnboarding,
  initialState,
  initialExpandMode,
}: DesktopSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations('app.mainSidebar');
  const inviteCount = useMealShareInviteCount();
  const {
    pinnedCollapsed,
    effectiveCollapsed: collapsed,
    expandMode,
    setExpandMode,
    togglePinned,
    onPointerEnter,
    onPointerLeave,
    onFocusEnter,
    onFocusLeave,
  } = useSidebarState({ initialState, initialExpandMode });
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Click on the rail's blank space (anything that isn't an interactive
  // descendant) expands when collapsed in click mode. In hover mode, the
  // hover-in gesture already handles expansion, so whitespace click is a
  // no-op there — otherwise it would pin the rail open and create the
  // hybrid "open-in-hover" state where hover-out can no longer collapse it.
  const handleAsideClick = (event: React.MouseEvent<HTMLElement>) => {
    if (expandMode !== 'click') return;
    if (!pinnedCollapsed) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (
      target.closest(
        'a, button, [role="menu"], [role="menuitem"], input, select, textarea'
      )
    ) {
      return;
    }
    togglePinned();
  };

  // Avatar dropdown opens in a portal, so the cursor moving onto it fires
  // pointerleave on the aside and collapses the peek mid-click. Suppress
  // pointer-leave while the menu is open.
  const handlePointerLeave = () => {
    if (userMenuOpen) return;
    onPointerLeave();
  };

  const handleFocusEnter = (event: React.FocusEvent<HTMLElement>) => {
    const previousTarget = event.relatedTarget;
    if (
      previousTarget instanceof Node &&
      event.currentTarget.contains(previousTarget)
    ) {
      return;
    }
    onFocusEnter();
  };

  const handleFocusLeave = (event: React.FocusEvent<HTMLElement>) => {
    if (userMenuOpen) return;
    const nextTarget = event.relatedTarget;
    if (
      nextTarget instanceof Node &&
      event.currentTarget.contains(nextTarget)
    ) {
      return;
    }
    onFocusLeave();
  };

  const navItems: SidebarNavItem[] = visibleNavItems(isAdmin).map((item) => {
    const Icon = item.icon;
    return {
      id: item.id,
      label: t(item.labelKey),
      href: item.href,
      icon: <Icon className="h-5 w-5" />,
    };
  });

  return (
    <aside
      aria-label={t('navigationLabel')}
      data-app-sidebar=""
      data-collapsed={collapsed ? 'true' : 'false'}
      onPointerEnter={onPointerEnter}
      onPointerLeave={handlePointerLeave}
      onFocusCapture={handleFocusEnter}
      onBlurCapture={handleFocusLeave}
      onClick={handleAsideClick}
      className={cn(
        'sticky top-3 flex h-full shrink-0 flex-col rounded-xl border border-kallo-border/60 bg-white shadow-kallo-text/[0.03] shadow-sm transition-[width,opacity,filter] duration-[220ms] ease-out',
        collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
        pinnedCollapsed && collapsed && 'cursor-pointer'
      )}
    >
      <SidebarBrandHeader
        collapsed={collapsed}
        pinnedCollapsed={pinnedCollapsed}
        onTogglePinned={togglePinned}
      />

      {/* Scroll region: nav + onboarding + settings */}
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain p-3">
        <nav className="flex flex-col gap-3">
          <SectionHeader label={t('sectionLabel')} collapsed={collapsed} />
          <ul className="flex flex-col gap-1.5">
            {navItems.map((item) => (
              <li key={item.id}>
                <SidebarNavLink
                  item={item}
                  collapsed={collapsed}
                  isActive={isActiveRoute(pathname, item.href)}
                  showBadge={item.id === 'groups' && inviteCount > 0}
                />
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col gap-3">
          <SectionHeader label={t('settings')} collapsed={collapsed} />
          <SidebarNavLink
            item={{
              id: 'settings',
              label: t('settings'),
              href: '/settings',
              icon: <Settings className="h-5 w-5" />,
            }}
            collapsed={collapsed}
            isActive={isActiveRoute(pathname, '/settings')}
          />
        </div>
      </div>

      {/* Footer — onboarding nudge + user menu, pinned to bottom.
          Onboarding lives here (not in the scroll region) so toggling
          collapse/expand never reflows nav items. */}
      <div className="shrink-0 border-kallo-border/40 border-t bg-white/40 p-2.5">
        {onboardingIncomplete && onResumeOnboarding && !collapsed && (
          <div className="mb-2.5">
            <OnboardingNudge
              step={onboardingStep}
              onResume={onResumeOnboarding}
              isMinimized={isOnboardingMinimized}
              onMinimize={onMinimizeOnboarding ?? (() => {})}
              onRestore={onRestoreOnboarding ?? (() => {})}
            />
          </div>
        )}
        <UserMenu
          user={user}
          collapsed={collapsed}
          showOnboardingDot={collapsed && onboardingIncomplete}
          open={userMenuOpen}
          onOpenChange={setUserMenuOpen}
          expandMode={expandMode}
          onExpandModeChange={setExpandMode}
        />
      </div>
    </aside>
  );
}
