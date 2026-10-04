'use client';

import { Apple, House, type LucideIcon, PencilLine, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useNavBadgeCounts } from '@/hooks/ui/use-nav-badges';
import { usePathname } from '@/i18n/navigation';
import { isActiveRoute, isFullScreenRoute, type NavItemId } from '../nav-items';
import { MobileAddSheet } from './mobile-add-sheet';
import { MobileTabLink } from './mobile-tab-link';

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
 * composer owns the bottom edge then (the Flutter bar does the same). On the
 * logging feed it is not rendered at all: Flutter pushes Log full-screen over
 * the tabs, so the feed's composer is the bottom edge and the header carries
 * a back chevron.
 */
export function MobileTabBar() {
  const t = useTranslations('app.tabBar');
  const tNav = useTranslations('app.mainSidebar');
  const pathname = usePathname();
  const badgeCounts = useNavBadgeCounts();
  const renderTab = (tab: TabConfig) => (
    <MobileTabLink
      key={tab.id}
      href={tab.href}
      icon={tab.icon}
      label={t(tab.labelKey)}
      active={isActiveRoute(pathname, tab.href)}
      badged={(badgeCounts[tab.id] ?? 0) > 0}
    />
  );

  // A full-screen page (the logging feed) has a back chevron instead.
  if (isFullScreenRoute(pathname)) return null;

  return (
    <nav
      aria-label={tNav('navigationLabel')}
      data-mobile-tab-bar=""
      className="typing:hidden shrink-0 px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),0.5rem)] md:hidden"
    >
      <ul className="flex h-16 items-center rounded-full bg-white px-3 shadow-nav">
        {LEADING_TABS.map(renderTab)}
        <li className="flex h-full w-16 shrink-0 items-center justify-center">
          <MobileAddSheet />
        </li>
        {TRAILING_TABS.map(renderTab)}
      </ul>
    </nav>
  );
}
