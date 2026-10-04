'use client';

import {
  Apple,
  House,
  type LucideIcon,
  PencilLine,
  Plus,
  Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useNavBadgeCounts } from '@/hooks/ui/use-nav-badges';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/core/ui/cn';
import { isActiveRoute, type NavItemId } from '../nav-items';
import { MobileAddSheet } from './mobile-add-sheet';

interface TabConfig {
  id: NavItemId;
  href: string;
  labelKey: 'today' | 'log' | 'nutrition' | 'circle';
  icon: LucideIcon;
}

/** Flutter's `PillNavBar` tabs, glyphs and order: Today, Log, (+), Nutrition,
 *  Circle. Activity lives on the header heart; Settings and Admin in the
 *  account sheet behind the header avatar. */
const LEADING_TABS: readonly TabConfig[] = [
  { id: 'dashboard', href: '/dashboard', labelKey: 'today', icon: House },
  { id: 'logging', href: '/logging', labelKey: 'log', icon: PencilLine },
];
const TRAILING_TABS: readonly TabConfig[] = [
  { id: 'nutrition', href: '/nutrition', labelKey: 'nutrition', icon: Apple },
  { id: 'groups', href: '/circle', labelKey: 'circle', icon: Users },
];

const TAB =
  'relative flex h-full flex-1 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent';

/**
 * Mobile primary navigation — the web port of the Flutter app's floating
 * `PillNavBar`: a white capsule inset 8px from the screen edges with the
 * two-layer nav shadow, icon-only tabs (the active one ink with a heavier
 * stroke, the rest muted), and the brand-sweep "+" in the middle that opens
 * the Add sheet.
 *
 * It sits in flow below the page rather than over it, so no page has to know
 * the bar's height to keep its last row clear. It steps aside while a text
 * field has focus — on a phone that is the on-screen keyboard, and the logging
 * composer owns the bottom edge then (the Flutter bar does the same).
 */
export function MobileTabBar() {
  const t = useTranslations('app.tabBar');
  const tNav = useTranslations('app.mainSidebar');
  const pathname = usePathname();
  const badgeCounts = useNavBadgeCounts();
  const [addOpen, setAddOpen] = useState(false);
  const renderTab = (tab: TabConfig) => (
    <TabLink
      key={tab.id}
      tab={tab}
      label={t(tab.labelKey)}
      active={isActiveRoute(pathname, tab.href)}
      badged={(badgeCounts[tab.id] ?? 0) > 0}
    />
  );

  return (
    <nav
      aria-label={tNav('navigationLabel')}
      data-mobile-tab-bar=""
      className="typing:hidden shrink-0 px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),0.5rem)] md:hidden"
    >
      <ul className="flex h-16 items-center rounded-full bg-white px-3 shadow-nav">
        {LEADING_TABS.map(renderTab)}
        <li className="flex h-full w-16 shrink-0 items-center justify-center">
          <button
            type="button"
            aria-label={t('add')}
            aria-haspopup="dialog"
            aria-expanded={addOpen}
            onClick={() => setAddOpen(true)}
            className="flex size-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--kallo-brand-apricot),var(--kallo-brand-lilac))] text-kallo-text shadow-[0_4px_12px_rgba(20,20,19,0.14)] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent active:scale-95"
          >
            <Plus className="size-6" strokeWidth={2} aria-hidden="true" />
          </button>
        </li>
        {TRAILING_TABS.map(renderTab)}
      </ul>
      <MobileAddSheet open={addOpen} onOpenChange={setAddOpen} />
    </nav>
  );
}

function TabLink({
  tab,
  label,
  active,
  badged,
}: {
  tab: TabConfig;
  label: string;
  active: boolean;
  badged: boolean;
}) {
  const Icon = tab.icon;

  return (
    <li className="flex h-full flex-1">
      <Link
        href={tab.href}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        className={cn(
          TAB,
          active ? 'text-kallo-text' : 'text-kallo-text-muted'
        )}
      >
        <span className="relative">
          <Icon
            className="size-6"
            strokeWidth={active ? 2 : 1.5}
            aria-hidden="true"
          />
          {badged && (
            <span
              aria-hidden="true"
              className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-kallo-accent ring-2 ring-white"
            />
          )}
        </span>
      </Link>
    </li>
  );
}
