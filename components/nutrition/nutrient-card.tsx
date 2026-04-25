'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { getNutrientTrend } from '@/lib/nutrition/actions';
import type {
  ConfidenceDisplayState,
  NutrientCardData,
  NutritionRange,
} from '@/lib/nutrition/types';
import { cn } from '@/lib/utils';
import { FoodSourceCandidatesPanel } from './food-source-candidates-panel';
import { NutrientTrend } from './nutrient-trend';

const confidenceLabelKeys: Record<ConfidenceDisplayState, string> = {
  normal: 'confidence.normal',
  limited_data: 'confidence.limitedData',
  warning_points: 'confidence.warningPoints',
  insufficient_data: 'confidence.insufficientData',
};

interface NutrientCardProps {
  card: NutrientCardData;
  resolvedRange: NutritionRange;
  timezoneOffset: number | null;
}

function formatValue(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: value >= 100 ? 0 : 1,
  }).format(value);
}

function formatPercent(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(value);
}

function getStateClass(displayState: ConfidenceDisplayState): string {
  if (displayState === 'normal') {
    return 'border-nham-success/30 bg-nham-success/10 text-nham-text';
  }

  if (displayState === 'limited_data') {
    return 'border-nham-border bg-nham-hover/60 text-nham-text-muted';
  }

  if (displayState === 'warning_points') {
    return 'border-nham-accent/40 bg-nham-accent/15 text-nham-text';
  }

  return 'border-nham-border bg-card text-nham-text-muted';
}

export function NutrientCard({
  card,
  resolvedRange,
  timezoneOffset,
}: NutrientCardProps) {
  const t = useTranslations('nutrition');
  const tRoot = useTranslations();
  const locale = useLocale();
  const [expanded, setExpanded] = useState(false);
  const trendPanelId = `nutrition-trend-${card.nutrient}`;
  const trendQuery = useQuery({
    queryKey: [
      'nutrition',
      'trend',
      card.nutrient,
      resolvedRange,
      timezoneOffset ?? 'utc',
    ],
    queryFn: () =>
      getNutrientTrend({
        nutrient: card.nutrient,
        range: resolvedRange,
        timezoneOffset,
      }),
    enabled: expanded,
    staleTime: 60_000,
  });
  const hasTargetClaim =
    card.displayState !== 'insufficient_data' && card.percentOfTarget !== null;
  const targetProgress =
    hasTargetClaim && card.percentOfTarget !== null
      ? `${formatPercent(card.percentOfTarget, locale)}%`
      : t('card.noTargetClaim');

  return (
    <article className="rounded-3xl border border-nham-border/60 bg-card p-4 shadow-[0_4px_24px_rgba(44,36,22,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-base text-nham-text">
            {tRoot(card.labelKey)}
          </h3>
          <p className="mt-1 text-nham-text-muted text-xs">
            {tRoot(card.targetSourceLabelKey)}
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full border px-2.5 py-1 font-medium text-[11px]',
            getStateClass(card.displayState)
          )}
        >
          {t(confidenceLabelKeys[card.displayState])}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Metric
          label={t('card.average')}
          value={
            card.averagePerDay === null
              ? t('card.noData')
              : `${formatValue(card.averagePerDay, locale)} ${card.unit}`
          }
        />
        <Metric
          label={t('card.target')}
          value={
            card.target === null
              ? t('macros.noTarget')
              : `${formatValue(card.target, locale)} ${card.unit}`
          }
        />
        <Metric label={t('card.targetProgress')} value={targetProgress} />
      </div>

      {card.contextMetrics && card.contextMetrics.length > 0 ? (
        <div className="mt-4 rounded-2xl bg-nham-hover/45 p-3">
          <p className="font-bold text-[10px] text-nham-stone uppercase tracking-[0.14em]">
            {t('card.context')}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {card.contextMetrics.map((metric) => (
              <span
                key={metric.key}
                className="rounded-full bg-card px-2.5 py-1 text-nham-text-muted text-xs"
              >
                <span>{tRoot(metric.labelKey)}</span>:{' '}
                {metric.averagePerDay === null
                  ? t('card.noData')
                  : `${formatValue(metric.averagePerDay, locale)} ${metric.unit}`}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {card.caveatKey ? (
        <p className="mt-4 rounded-2xl border border-nham-border/60 bg-nham-hover/35 p-3 text-nham-text-muted text-sm">
          {tRoot(card.caveatKey)}
        </p>
      ) : null}

      {card.displayState === 'insufficient_data' ? (
        <p className="mt-4 text-nham-text-muted text-sm">
          {t('trend.insufficientData')}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        aria-controls={trendPanelId}
        className="mt-4 inline-flex touch-manipulation items-center rounded-xl border border-nham-border/60 px-3 py-2 font-medium text-nham-text text-sm transition-colors hover:bg-nham-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent focus-visible:ring-offset-2 focus-visible:ring-offset-nham-surface"
      >
        {expanded ? t('card.collapse') : t('card.expand')}
      </button>

      <div id={trendPanelId} aria-live="polite">
        {expanded ? (
          <div className="mt-4">
            {trendQuery.isLoading ? (
              <p className="text-nham-text-muted text-sm">
                {t('trend.loading')}
              </p>
            ) : trendQuery.isError ? (
              <p role="alert" className="text-nham-text-muted text-sm">
                {t('trend.error')}
              </p>
            ) : trendQuery.data ? (
              <NutrientTrend
                trend={trendQuery.data}
                unit={card.unit}
                forcePointMode={card.displayState === 'warning_points'}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      <FoodSourceCandidatesPanel card={card} />
    </article>
  );
}

interface MetricProps {
  label: string;
  value: string;
}

function Metric({ label, value }: MetricProps) {
  return (
    <div className="min-w-0">
      <p className="font-bold text-[9px] text-nham-stone uppercase tracking-[0.14em]">
        {label}
      </p>
      <p className="mt-1 truncate font-medium text-nham-text text-sm tabular-nums">
        {value}
      </p>
    </div>
  );
}
