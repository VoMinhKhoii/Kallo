'use client';

import { motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import type {
  NutrientSummaryItem,
  NutritionOverview,
  NutritionRange,
} from '@/lib/nutrition/types';

interface VerdictHeroProps {
  overview: NutritionOverview;
}

const PERIOD_KEYS: Record<NutritionRange, string> = {
  '1d': 'verdict.period1d',
  '7d': 'verdict.period7d',
  '30d': 'verdict.period30d',
  '90d': 'verdict.period90d',
};

function takeNames(
  items: NutrientSummaryItem[],
  tRoot: ReturnType<typeof useTranslations>,
  limit = 2
): string[] {
  return items
    .slice(0, limit)
    .map((item) => tRoot(item.labelKey).toLowerCase());
}

function joinNames(names: string[], locale: string): string {
  if (names.length === 0) return '';
  try {
    return new Intl.ListFormat(locale, {
      style: 'long',
      type: 'conjunction',
    }).format(names);
  } catch {
    return names.join(', ');
  }
}

export function VerdictHero({ overview }: VerdictHeroProps) {
  const t = useTranslations('nutrition');
  const tRoot = useTranslations();
  const locale = useLocale();

  const period = t(PERIOD_KEYS[overview.resolvedRange]);
  const consistentNames = takeNames(overview.summary.mostConsistent, tRoot);
  const attentionNames = takeNames(overview.summary.needsAttention, tRoot);
  const consistent = joinNames(consistentNames, locale);
  const attention = joinNames(attentionNames, locale);
  const tooFew = overview.trendStatus === 'too_few_logged_days';
  const dayFormatter = new Intl.NumberFormat(locale);

  let headline: string;
  let muted: string;

  if (tooFew) {
    headline = t('verdict.gathering');
    muted = t('verdict.gatheringSub', {
      days: dayFormatter.format(overview.completeDays),
    });
  } else {
    if (consistent && attention) {
      headline = t('verdict.both', { period, consistent, attention });
    } else if (consistent) {
      headline = t('verdict.steadyOnly', { period, consistent });
    } else if (attention) {
      headline = t('verdict.attentionOnly', { period, attention });
    } else {
      headline = t('verdict.quiet');
    }
    muted = t('verdict.trustLineNoConfidence', {
      days: dayFormatter.format(overview.completeDays),
    });
    if (overview.partialDays > 0) {
      muted += ` ${t('verdict.partialNote', { count: overview.partialDays })}`;
    }
  }

  return (
    <motion.p
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.05 }}
      className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-sm leading-6"
    >
      <span className="font-serif text-nham-text" style={{ fontWeight: 400 }}>
        {headline}
      </span>
      <span className="text-nham-text-muted">{muted}</span>
    </motion.p>
  );
}
