'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useSelectedLayoutSegment } from 'next/navigation';
import { Sidebar } from './sidebar';

interface ShellProps {
  children: React.ReactNode;
}

export function Shell({ children }: ShellProps) {
  const segment = useSelectedLayoutSegment();
  const hasActiveSection = !!segment;

  return (
    <div
      className="flex flex-1 flex-col overflow-hidden md:flex-row md:gap-6"
      style={{ fontFamily: 'DM Sans, sans-serif' }}
    >
      {/* Sidebar — always visible on desktop, hidden on mobile when section is active */}
      <div
        className={`shrink-0 py-6 pl-4 md:block md:py-8 md:pl-6 ${
          hasActiveSection ? 'hidden' : 'block'
        }`}
      >
        <Sidebar />
      </div>

      {/* Content area */}
      <div
        className={`flex-1 overflow-y-auto ${
          hasActiveSection ? 'block' : 'hidden md:block'
        }`}
      >
        {/* Mobile back button */}
        {hasActiveSection && (
          <div className="px-4 pt-4 md:hidden">
            <Link
              href="/settings"
              className="inline-flex items-center gap-1.5 font-medium text-[#8B8682] text-[14px] transition-colors hover:text-[#2C2416]"
            >
              <ArrowLeft className="h-4 w-4" />
              Settings
            </Link>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
