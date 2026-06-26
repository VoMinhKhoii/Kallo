'use client';

import { PanelLeftClose, PanelLeftOpen, Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type * as React from 'react';
import { useState } from 'react';
import { useSidebarState } from '@/hooks/ui/use-sidebar-state';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { isActiveRoute, visibleNavItems } from './nav-items';
import { OnboardingNudge } from './onboarding-nudge';
import { SidebarTooltip } from './sidebar-tooltip';
import { UserMenu, type UserMenuUser } from './user-menu';

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
}

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
          'overflow-hidden whitespace-nowrap font-medium font-sans-display text-[10px] text-nham-text-muted uppercase tracking-[0.06em] transition-all duration-300',
          collapsed ? 'max-w-0 opacity-0' : 'max-w-32 opacity-100'
        )}
      >
        {label}
      </span>
      <div
        aria-hidden="true"
        className={cn(
          'absolute inset-x-1 top-1/2 h-px bg-gradient-to-r from-transparent via-nham-border/60 to-transparent transition-opacity duration-300',
          collapsed ? 'opacity-100' : 'opacity-0'
        )}
      />
    </div>
  );
}

function SidebarNavLink({
  item,
  collapsed,
  isActive,
}: {
  item: NavItem;
  collapsed: boolean;
  isActive: boolean;
}) {
  return (
    <SidebarTooltip enabled={collapsed} label={item.label}>
      <Link
        href={item.href}
        aria-current={isActive ? 'page' : undefined}
        aria-label={collapsed ? item.label : undefined}
        className={cn(
          'group/nav relative flex items-center rounded-lg px-3 py-2 transition-colors duration-200',
          isActive
            ? 'bg-nham-btn text-white shadow-nham-btn/20 shadow-sm'
            : 'text-nham-text-muted hover:bg-nham-hover/60 hover:text-nham-text'
        )}
      >
        <span
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center transition-colors',
            collapsed ? 'mx-auto' : ''
          )}
        >
          {item.icon}
        </span>
        <span
          className={cn(
            'overflow-hidden whitespace-nowrap font-medium font-sans-display text-[13px] tracking-tight transition-all duration-300',
            collapsed ? 'ml-0 max-w-0 opacity-0' : 'ml-3 max-w-40 opacity-100'
          )}
        >
          {item.label}
        </span>
      </Link>
    </SidebarTooltip>
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

  const navItems: NavItem[] = visibleNavItems(isAdmin).map((item) => {
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
      data-collapsed={collapsed ? 'true' : 'false'}
      onPointerEnter={onPointerEnter}
      onPointerLeave={handlePointerLeave}
      onFocusCapture={handleFocusEnter}
      onBlurCapture={handleFocusLeave}
      onClick={handleAsideClick}
      className={cn(
        'sticky top-3 flex h-[calc(100vh-1.5rem)] shrink-0 flex-col rounded-xl border border-nham-border/60 bg-white shadow-nham-text/[0.03] shadow-sm transition-[width] duration-[220ms] ease-out',
        collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
        pinnedCollapsed && collapsed && 'cursor-pointer'
      )}
    >
      {/* Header — pin/unpin toggle */}
      <div
        className={cn(
          'flex shrink-0 items-center px-3 pt-3',
          collapsed ? 'justify-center' : 'justify-end'
        )}
      >
        <SidebarTooltip
          enabled={collapsed}
          label={pinnedCollapsed ? t('expandSidebar') : t('collapseSidebar')}
        >
          <button
            type="button"
            onClick={togglePinned}
            aria-label={
              pinnedCollapsed ? t('expandSidebar') : t('collapseSidebar')
            }
            aria-pressed={pinnedCollapsed}
            aria-keyshortcuts="Meta+B Control+B"
            className="flex h-7 w-7 items-center justify-center rounded-md text-nham-text-muted transition-colors hover:bg-nham-hover/60 hover:text-nham-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent"
          >
            {pinnedCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </SidebarTooltip>
      </div>

      {/* Scroll region: nav + onboarding + settings */}
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-3">
        <nav className="flex flex-col gap-3">
          <SectionHeader label={t('sectionLabel')} collapsed={collapsed} />
          <ul className="flex flex-col gap-1.5">
            {navItems.map((item) => (
              <li key={item.id}>
                <SidebarNavLink
                  item={item}
                  collapsed={collapsed}
                  isActive={isActiveRoute(pathname, item.href)}
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
      <div className="shrink-0 border-nham-border/40 border-t bg-white/40 p-2.5">
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
