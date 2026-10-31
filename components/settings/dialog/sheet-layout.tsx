'use client';

import { ChevronLeft, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { cn } from '@/lib/core/ui/cn';
import { SettingsMenu } from './settings-menu';
import type { SettingsLayoutProps } from './types';

// Push and pop inside the one sheet, never close and reopen: a page slides in
// from the right over the list, and Back slides it out to the right again.
const SLIDE = {
  enter: (direction: number) => ({ x: direction > 0 ? '100%' : '-25%' }),
  center: { x: 0 },
  exit: (direction: number) => ({ x: direction > 0 ? '-25%' : '100%' }),
};
const EASE_OUT = [0.32, 0.72, 0, 1] as const;

/**
 * The phone dialog: a full-height sheet whose first level is the page list
 * and whose second is one page. The profile form's save bar rides at the
 * bottom of either level, so unsaved edits stay in sight after Back.
 */
export function SheetLayout({
  page,
  onShow,
  isVisible,
  renderPage,
  saveBar,
}: SettingsLayoutProps) {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const reduceMotion = useReducedMotion();
  const direction = page ? 1 : -1;

  return (
    <DialogPrimitive.Content
      aria-describedby={undefined}
      // Focus the sheet, not its first button: a tapped-open sheet would
      // otherwise greet the thumb with a focus ring on the close button.
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        (event.currentTarget as HTMLElement).focus();
      }}
      className="data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom fixed inset-x-0 bottom-0 z-50 flex h-[calc(100dvh-env(safe-area-inset-top)-0.75rem)] flex-col overflow-hidden rounded-t-2xl bg-kallo-surface font-sans-display text-kallo-text outline-none duration-300 data-[state=closed]:animate-out data-[state=open]:animate-in"
    >
      <DialogPrimitive.Title className="sr-only">
        {t('title')}
      </DialogPrimitive.Title>
      <div className="flex h-12 shrink-0 items-center justify-between px-2">
        {page ? (
          <button
            type="button"
            onClick={() => onShow(null)}
            className="flex h-10 items-center gap-0.5 rounded-lg pr-3 pl-1 text-[16px] text-kallo-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
            {t('title')}
          </button>
        ) : (
          <span />
        )}
        <DialogPrimitive.Close
          aria-label={tc('close')}
          className="flex size-10 items-center justify-center rounded-lg text-kallo-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent"
        >
          <X className="size-5" aria-hidden="true" />
        </DialogPrimitive.Close>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={page ?? 'menu'}
            custom={direction}
            variants={SLIDE}
            initial="enter"
            animate="center"
            exit="exit"
            transition={
              reduceMotion
                ? { duration: 0 }
                : { type: 'tween', ease: EASE_OUT, duration: 0.32 }
            }
            className={cn(
              'absolute inset-0 overflow-y-auto overscroll-contain bg-kallo-surface px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]',
              page && 'z-10'
            )}
          >
            {page ? (
              renderPage(page)
            ) : (
              <SettingsMenu onShow={onShow} isVisible={isVisible} />
            )}
            {saveBar}
          </motion.div>
        </AnimatePresence>
      </div>
    </DialogPrimitive.Content>
  );
}
