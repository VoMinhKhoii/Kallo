'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { NutritionOverview } from '@/lib/nutrition/types';

type Summary = NutritionOverview['summary'];

interface SummaryStripProps {
  summary: Summary;
}

function formatPercent(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(value);
}

function getAverageConfidence(items: Summary['mostConsistent']): number | null {
  if (items.length === 0) return null;

  return (
    items.reduce((total, item) => total + item.confidence, 0) / items.length
  );
}

export function SummaryStrip({ summary }: SummaryStripProps) {
  const t = useTranslations('nutrition');
  const tRoot = useTranslations();
  const locale = useLocale();
  const consistentItems = summary.mostConsistent.slice(0, 2);
  const consistent = consistentItems.map((item) => tRoot(item.labelKey));
  const averageConfidence = getAverageConfidence(consistentItems);
  const attention = summary.needsAttention
    .slice(0, 2)
    .map((item) => tRoot(item.labelKey));
  const weakestMacro = summary.macroConsistency.weakestMacro
    ? t(`macros.${summary.macroConsistency.weakestMacro}`)
    : t('summary.none');

  return (
    <section
      className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
      aria-label={t('summary.label')}
    >
      <SummaryCard
        title={t('summary.mostConsistent')}
        value={
          consistent.length > 0 ? consistent.join(', ') : t('summary.none')
        }
        detail={
          averageConfidence === null
            ? t('summary.none')
            : t('summary.averageConfidence', {
                value: `${formatPercent(averageConfidence, locale)}%`,
              })
        }
      />
      <SummaryCard
        title={t('summary.needsAttention')}
        value={attention.length > 0 ? attention.join(', ') : t('summary.none')}
        detail={t('summary.confidentOnly')}
      />
      <SummaryCard
        title={t('summary.limitedData')}
        value={new Intl.NumberFormat(locale).format(summary.limitedDataCount)}
        detail={t('summary.coverageHint')}
      />
      <SummaryCard
        title={t('summary.macroConsistency')}
        value={`${formatPercent(summary.macroConsistency.averageConsistencyPct, locale)}%`}
        detail={`${t('summary.weakest')}: ${weakestMacro}`}
      />
    </section>
  );
}

interface SummaryCardProps {
  title: string;
  value: string;
  detail: string;
}

function SummaryCard({ title, value, detail }: SummaryCardProps) {
  return (
    <article className="min-w-0 rounded-2xl border border-nham-border/60 bg-card p-4 shadow-[0_4px_24px_rgba(44,36,22,0.04)]">
      <h2 className="font-bold text-[10px] text-nham-stone uppercase tracking-[0.16em]">
        {title}
      </h2>
      <p
        className="mt-3 truncate font-semibold text-base text-nham-text"
        title={value}
      >
        {value}
      </p>
      <p className="mt-1 text-nham-text-muted text-xs">{detail}</p>
    </article>
  );
}
