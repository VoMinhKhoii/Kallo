'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import type { EducationCardData } from '@/lib/nutrition/types';

interface PullQuoteProps {
  card: EducationCardData;
}

export function PullQuote({ card }: PullQuoteProps) {
  const tRoot = useTranslations();

  return (
    <motion.aside
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.22 }}
      className="max-w-3xl border-nham-accent/60 border-l-[3px] border-dashed pl-5 lg:ml-8 lg:pl-8"
    >
      <h3
        className="text-nham-text"
        style={{
          fontFamily: 'Lora, serif',
          fontStyle: 'italic',
          fontWeight: 400,
          fontSize: 'clamp(1.125rem, 0.85rem + 1.2vw, 1.4rem)',
          lineHeight: 1.35,
          letterSpacing: '-0.005em',
        }}
      >
        {tRoot(card.titleKey)}
      </h3>
      <p
        className="mt-3 max-w-prose text-nham-text-muted leading-7"
        style={{
          fontFamily: 'Lora, serif',
          fontStyle: 'italic',
          fontSize: '0.9375rem',
        }}
      >
        {tRoot(card.bodyKey)}
      </p>
    </motion.aside>
  );
}
