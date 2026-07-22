'use client';

import { Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';

interface SaveBarProps {
  isDirty: boolean;
  isPending: boolean;
  /** Floored kcal target the save names, or null when metrics are incomplete. */
  pendingTarget: number | null;
  onCancel: () => void;
}

/**
 * Pinned save bar — rests above the bottom edge while content scrolls behind it
 * and dissolves into a soft fade. Names its consequence when a target exists.
 */
export function SaveBar({
  isDirty,
  isPending,
  pendingTarget,
  onCancel,
}: SaveBarProps) {
  const t = useTranslations('settings');
  const tc = useTranslations('common');

  return (
    <AnimatePresence>
      {isDirty && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="sticky inset-x-0 bottom-0 z-20 pb-3 sm:pb-4"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 -top-8 bottom-0 bg-gradient-to-t from-55% from-nham-surface to-transparent"
          />
          <div className="relative flex items-center justify-end gap-3 rounded-2xl border border-[#EAE7E0] bg-[#FDFCF8]/95 px-5 py-3.5 shadow-lg backdrop-blur-sm sm:px-6 sm:py-4">
            <button
              type="button"
              onClick={onCancel}
              disabled={isPending}
              className="rounded-xl px-5 py-2.5 font-medium text-[#7B6F62] text-[14px] transition-colors hover:bg-nham-track hover:text-nham-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent/40"
            >
              {tc('cancel')}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 rounded-xl bg-nham-ink px-5 py-2.5 font-medium text-[#FDFCF8] text-[14px] shadow-sm transition-all hover:bg-[#1C1917] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent/60 disabled:opacity-50"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {pendingTarget !== null
                ? t('saveWithTarget', {
                    target: pendingTarget.toLocaleString(),
                  })
                : t('save')}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
