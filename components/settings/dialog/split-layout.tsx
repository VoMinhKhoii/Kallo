'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { useEffect, useRef } from 'react';
import { DEFAULT_SETTINGS_PAGE } from '@/lib/domain/settings/pages';
import { SettingsRail } from './settings-rail';
import type { SettingsLayoutProps } from './types';

/**
 * The desktop dialog: a centered card split into the rail and the page. The
 * page scrolls on its own; the profile form's save bar is pinned to the
 * bottom of that scroll whichever page is showing.
 */
export function SplitLayout({
  page,
  onShow,
  isVisible,
  renderPage,
  saveBar,
}: SettingsLayoutProps) {
  const tc = useTranslations('common');
  const current = page ?? DEFAULT_SETTINGS_PAGE;
  const scrollRef = useRef<HTMLDivElement>(null);

  // A new page starts at its top. Not a remount: that would replay the save
  // bar's entrance on every page switch.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on page change by design
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [current]);

  return (
    <DialogPrimitive.Content
      aria-describedby={undefined}
      // Focus the dialog, not the rail's first link: opened on another page
      // (a deep link), that link would wear a focus ring it has no claim to.
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        (event.currentTarget as HTMLElement).focus();
      }}
      className="data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-1/2 left-1/2 z-50 flex h-[min(640px,calc(100dvh-3rem))] w-[min(920px,calc(100vw-3rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-kallo-border bg-kallo-surface font-sans-display text-kallo-text shadow-lg outline-none duration-200 data-[state=closed]:animate-out data-[state=open]:animate-in"
    >
      <SettingsRail current={current} onShow={onShow} isVisible={isVisible} />
      <div className="relative min-w-0 flex-1">
        <DialogPrimitive.Close
          aria-label={tc('close')}
          className="absolute top-3 right-3 z-30 flex size-8 items-center justify-center rounded-lg text-kallo-text-muted transition-colors hover:bg-kallo-hover hover:text-kallo-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent"
        >
          <X className="size-[18px]" aria-hidden="true" />
        </DialogPrimitive.Close>
        <div
          ref={scrollRef}
          className="h-full overflow-y-auto overscroll-contain px-8 pt-7"
        >
          {renderPage(current)}
          {saveBar}
          <div aria-hidden="true" className="h-8" />
        </div>
      </div>
    </DialogPrimitive.Content>
  );
}
