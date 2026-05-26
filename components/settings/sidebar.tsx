'use client';

import { ChevronRight, User } from 'lucide-react';
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
                    'flex items-center gap-2.5 rounded-lg px-3 py-2.5 font-medium text-[14px] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A87C]/40 md:py-2',
                    isActive
                      ? 'bg-[#695e4e] text-white shadow-[#695e4e]/20 shadow-sm'
                      : 'text-[#8B8682] hover:bg-[#F0EAE0]/60 hover:text-[#2C2416]'
                  )}
                >
                  {item.icon}
                  <span className="flex-1">{item.label}</span>
                  {/* Drill-in affordance on mobile only */}
                  <ChevronRight
                    className={cn(
                      'h-4 w-4 shrink-0 md:hidden',
                      isActive ? 'text-white/70' : 'text-[#C4BCB0]'
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
