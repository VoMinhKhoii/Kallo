'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';

/**
 * The floating "smart context" card beside the hero phone, shown once the
 * demo reveals its result. Hidden below xl. Presentation only.
 */
export function HeroContextBadge() {
  const t = useTranslations('landing.hero');
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="absolute top-[38%] left-[calc(100%+1rem)] z-30 hidden w-[170px] -translate-y-1/2 rounded-2xl border border-nham-border/40 bg-white/95 p-3 shadow-xl backdrop-blur-md xl:block"
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="font-bold text-[9px] text-nham-text-muted uppercase tracking-wider">
          {t('demo.smartContext')}
        </span>
      </div>
      <p className="font-medium text-[10px] text-nham-text leading-relaxed">
        {t('demo.smartContextText')}
      </p>
    </motion.div>
  );
}
