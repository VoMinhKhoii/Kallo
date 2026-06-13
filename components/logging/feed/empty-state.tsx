'use client';

import { UtensilsCrossed } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';

export function EmptyState() {
  const t = useTranslations('logging.emptyState');

  return (
    <motion.div
      key="empty-state"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center gap-4 py-10"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.05, duration: 0.3 }}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-nham-border/30">
          <UtensilsCrossed className="h-5 w-5 text-nham-text-muted" />
        </div>
      </motion.div>

      <div className="space-y-1.5 text-center">
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
          className="text-nham-text-muted text-sm"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          {t('subtitle')}
        </motion.p>
      </div>
    </motion.div>
  );
}
