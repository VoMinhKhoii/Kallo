'use client';

import { Users2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { AddFriendDialog } from '@/components/groups/add-friend-dialog';

/**
 * Calm empty state for the Circle home. Mirrors the logging empty-state
 * aesthetic so a solo tracker is fully unaffected: the social wall is simply
 * quiet until they invite a friend. Read-only, no vanity metrics.
 */
export function CircleEmpty() {
  const t = useTranslations('groups.empty');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center gap-4 py-14 text-center"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.05, duration: 0.3 }}
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-nham-border/30">
          <Users2 className="h-5 w-5 text-nham-text-muted" />
        </div>
      </motion.div>

      <div className="max-w-sm space-y-1.5">
        <motion.h2
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="font-normal text-nham-text text-xl tracking-tight"
          style={{ fontFamily: 'Lora, serif' }}
        >
          {t('title')}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="text-nham-text-muted text-sm leading-relaxed"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          {t('subtitle')}
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.3 }}
      >
        <AddFriendDialog
          trigger={
            <button
              type="button"
              className="rounded-xl bg-nham-btn px-4 py-2 font-medium text-[13px] text-white shadow-nham-btn/20 shadow-sm transition-colors hover:bg-nham-btn/90"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            >
              {t('cta')}
            </button>
          }
        />
      </motion.div>
    </motion.div>
  );
}
