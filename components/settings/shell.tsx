'use client';

import { ArrowLeft } from 'lucide-react';
import { useSelectedLayoutSegment } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Sidebar } from './sidebar';

interface ShellProps {
  children: React.ReactNode;
}

export function Shell({ children }: ShellProps) {
  const t = useTranslations('settings');
  const segment = useSelectedLayoutSegment();
  const hasActiveSection = !!segment;

  return (
    <div
      className="flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-hidden lg:h-[calc(100vh-1.5rem)] lg:flex-row lg:gap-3"
      style={{ fontFamily: 'DM Sans, sans-serif' }}
    >
      {/* Category nav — sits beside the content only on large screens (where
          there's room next to the global rail); on medium/small it collapses
          to a Claude-style drill-in master list. */}
      <div
        className={`min-h-0 shrink-0 overflow-y-auto lg:block lg:w-[252px] lg:border-border/40 lg:border-r lg:py-3 lg:pr-3 ${
          hasActiveSection ? 'hidden' : 'block w-full px-1 py-3'
        }`}
      >
        <Sidebar />
      </div>

      {/* Content area */}
      <div
        className={`min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden ${
          hasActiveSection ? 'flex' : 'hidden lg:flex'
        }`}
      >
        {/* Back header — shown until the side-by-side layout kicks in */}
        {hasActiveSection && (
          <div className="sticky top-0 z-10 flex items-center gap-2 border-[#EAE7E0] border-b bg-[#FDFCF8]/90 px-4 py-3 backdrop-blur-sm lg:hidden">
            <Link
              href="/settings"
              className="inline-flex items-center gap-1.5 font-medium text-[#8B8682] text-[14px] transition-colors hover:text-[#2C2416] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A87C]/40"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('title')}
            </Link>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
