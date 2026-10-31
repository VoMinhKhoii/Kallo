'use client';

import { Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useFormState } from 'react-hook-form';
import { useLiveTargets } from '@/hooks/profile/use-live-targets';

interface SaveBarProps {
  isPending: boolean;
  onSave: () => void;
  onCancel: () => void;
}

/**
 * The dialog's footer while the profile form has unsaved edits: a hairline
 * across the bottom edge with Cancel and Save, whichever page is showing.
 * Save names its consequence when a target exists. The layout places it
 * under the scrolling page, so it always sits at the very bottom.
 */
export function SaveBar({ isPending, onSave, onCancel }: SaveBarProps) {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const { isDirty } = useFormState();
  // Floored kcal target the save names, or null when metrics are incomplete.
  const { pendingTarget } = useLiveTargets();

  return (
    <AnimatePresence>
      {isDirty && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="shrink-0 border-kallo-border border-t bg-kallo-surface"
        >
          <div className="flex items-center justify-end gap-2 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-8">
            <button
              type="button"
              onClick={onCancel}
              disabled={isPending}
              className="h-9 rounded-lg px-4 font-medium text-[14px] text-kallo-text-muted transition-colors hover:bg-kallo-hover hover:text-kallo-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent/40"
            >
              {tc('cancel')}
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={isPending}
              className="flex h-9 items-center gap-2 rounded-lg bg-kallo-btn px-4 font-medium text-[14px] text-kallo-btn-ink transition-colors hover:bg-kallo-btn/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent/60 disabled:opacity-50"
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
