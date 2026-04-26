'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { Link } from '@/i18n/navigation';

export function EmptyState() {
  const t = useTranslations('nutrition');
  const headingId = useId();

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.1 }}
      aria-labelledby={headingId}
      className="flex flex-col items-start gap-6 py-10 sm:py-16"
    >
      <SeedMark />
      <div className="max-w-xl space-y-3">
        <h2
          id={headingId}
          className="text-balance text-nham-text"
          style={{
            fontFamily: 'Lora, serif',
            fontWeight: 500,
            fontSize: 'clamp(1.5rem, 1.1rem + 1.6vw, 2rem)',
            letterSpacing: '-0.015em',
            lineHeight: 1.25,
          }}
        >
          {t('emptyV2.title')}
        </h2>
        <p className="text-nham-text-muted text-sm leading-7">
          {t('emptyV2.description')}
        </p>
      </div>
      <Link
        href="/logging"
        className="inline-flex touch-manipulation items-center rounded-full bg-nham-text px-5 py-2.5 font-medium text-nham-surface text-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent focus-visible:ring-offset-2 focus-visible:ring-offset-nham-surface"
      >
        {t('emptyV2.logMeal')}
      </Link>
    </motion.section>
  );
}

function SeedMark() {
  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 56 56"
      fill="none"
      aria-hidden="true"
      className="text-nham-accent"
    >
      <path
        d="M28 8c8 6 12 14 12 22 0 10-7 18-12 18s-12-8-12-18c0-8 4-16 12-22z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
        opacity="0.55"
      />
      <path
        d="M28 16c0 8 0 18 0 30"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.45"
        strokeDasharray="2 3"
      />
    </svg>
  );
}
