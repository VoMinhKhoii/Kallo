'use client';

import { ChevronRight, ShieldCheck, User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { memo } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
}

function SidebarInner() {
  const pathname = usePathname();
  const t = useTranslations('settings.sidebar');

  const NAV_ITEMS: NavItem[] = [
    {
      id: 'profile',
      label: t('profile'),
      href: '/settings/profile',
      icon: <User className="h-4 w-4 shrink-0" />,
    },
    {
      id: 'account',
      label: t('account'),
      href: '/settings/account',
      icon: <ShieldCheck className="h-4 w-4 shrink-0" />,
    },
  ];

  return (
    <aside
      className="flex w-full flex-col gap-3"
      aria-label={t('navigationLabel')}
      style={{ fontFamily: 'DM Sans, sans-serif' }}
    >
      <h2
        className="px-3 font-medium text-[#2C2416] text-lg tracking-tight"
        style={{ fontFamily: 'Lora, serif' }}
      >
        {t('title')}
      </h2>

      <nav>
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex touch-manipulation items-center gap-2.5 rounded-xl px-3 py-2.5 font-medium text-[14px] transition-[background-color,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent focus-visible:ring-offset-2 lg:py-2',
                    isActive
                      ? 'bg-nham-accent/35 text-nham-text hover:bg-nham-accent/50'
                      : 'text-nham-text-muted hover:bg-nham-hover/50 hover:text-nham-text'
                  )}
                >
                  {item.icon}
                  <span className="flex-1">{item.label}</span>
                  {/* Drill-in affordance until the side-by-side layout kicks in */}
                  <ChevronRight
                    className={cn(
                      'h-4 w-4 shrink-0 lg:hidden',
                      isActive ? 'text-nham-text/40' : 'text-nham-text-muted/50'
                    )}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

export const Sidebar = memo(SidebarInner);
