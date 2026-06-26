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
      className="mx-auto max-w-2xl py-6 text-center sm:py-8 lg:py-10"
    >
      <h3
        className="font-serif text-nham-text"
        style={{
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
        className="mx-auto mt-3 max-w-prose font-serif text-nham-text-muted leading-7"
        style={{
          fontStyle: 'italic',
          fontSize: '0.9375rem',
        }}
      >
        {tRoot(card.bodyKey)}
      </p>
    </motion.aside>
  );
}
