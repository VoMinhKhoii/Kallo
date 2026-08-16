'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/ui/cn';
import { isActiveRoute, type NavItemConfig } from '../nav-items';

interface MobileNavListProps {
  items: readonly NavItemConfig[];
  pathname: string;
  /** Pending copy/split offers — drives the ambient dot on the Circle row. */
  inviteCount: number;
  /** Closes the drawer after a nav tap. */
  onNavigate: () => void;
}

/**
 * The drawer's primary nav list — one row per visible destination, active row
 * as a filled umber pill. Mirrors the desktop `SidebarNavLink` and the Flutter
 * `SidebarNavList`; the Circle row carries an unread dot when invites are
 * pending.
 */
export function MobileNavList({
  items,
  pathname,
  inviteCount,
  onNavigate,
}: MobileNavListProps) {
  const tNav = useTranslations('app.mainSidebar');

  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActiveRoute(pathname, item.href);
        return (
          <li key={item.id}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
                active
                  ? 'bg-kallo-hover text-[#141413]'
                  : 'text-[#6E6D66] hover:bg-kallo-hover hover:text-[#141413]'
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span
                className={cn(
                  'font-sans-display text-[14px]',
                  active ? 'font-semibold' : 'font-medium'
                )}
              >
                {tNav(item.labelKey)}
              </span>
              {item.id === 'groups' && inviteCount > 0 && (
                <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-kallo-accent" />
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
