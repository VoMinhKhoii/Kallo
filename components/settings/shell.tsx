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
      className="flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-hidden md:h-[calc(100vh-1.5rem)] md:flex-row md:gap-3"
      style={{ fontFamily: 'DM Sans, sans-serif' }}
    >
      {/* Category nav — sits where the logging timeline sidebar sits on
          desktop; on mobile it's the master list, hidden once a category
          is open (Claude-style drill-in). */}
      <div
        className={`min-h-0 shrink-0 overflow-y-auto md:block md:w-[252px] md:border-border/40 md:border-r md:py-3 md:pr-3 ${
          hasActiveSection ? 'hidden' : 'block w-full px-1 py-3'
        }`}
      >
        <Sidebar />
      </div>

      {/* Content area */}
      <div
        className={`min-h-0 min-w-0 flex-1 flex-col overflow-y-auto ${
          hasActiveSection ? 'flex' : 'hidden md:flex'
        }`}
      >
        {/* Mobile back header */}
        {hasActiveSection && (
          <div className="sticky top-0 z-10 flex items-center gap-2 border-[#EAE7E0] border-b bg-[#FDFCF8]/90 px-4 py-3 backdrop-blur-sm md:hidden">
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
