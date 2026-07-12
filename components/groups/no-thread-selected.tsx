'use client';

import { MessageCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';

/** Right-pane placeholder at the bare /groups route (desktop only — mobile
 * hides this pane and shows the list instead). Nothing opens automatically;
 * the actor picks a friend or group on the left to view its thread. */
export function NoThreadSelected() {
  const t = useTranslations('groups.noThreadSelected');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-1 flex-col items-center justify-center gap-4 py-14 text-center"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-nham-border/30">
        <MessageCircle className="h-5 w-5 text-nham-text-muted" />
      </div>
      <div className="max-w-sm space-y-1.5">
        <h2 className="font-normal font-serif text-nham-text text-xl tracking-tight">
          {t('title')}
        </h2>
        <p className="font-sans-display text-nham-text-muted text-sm leading-relaxed">
          {t('subtitle')}
        </p>
      </div>
    </motion.div>
  );
}
