'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { MacroPattern } from '@/lib/nutrition/types';

interface MacroPatternSectionProps {
  macros: MacroPattern[];
}

function formatValue(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: value >= 100 ? 0 : 1,
  }).format(value);
}

function formatPercent(value: number | null, locale: string): string {
  if (value === null) return '—';

  return `${new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(value)}%`;
}

export function MacroPatternSection({ macros }: MacroPatternSectionProps) {
  const t = useTranslations('nutrition');
  const tRoot = useTranslations();
  const locale = useLocale();

  return (
    <section
      data-testid="macro-pattern-section"
      className="rounded-3xl border border-nham-border/60 bg-card p-4 shadow-[0_4px_24px_rgba(44,36,22,0.04)]"
      aria-labelledby="macro-pattern-title"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            id="macro-pattern-title"
            className="font-semibold text-lg text-nham-text"
          >
            {t('macros.title')}
          </h2>
          <p className="text-nham-text-muted text-sm">
            {t('macros.averagePerDay')}
          </p>
        </div>
      </div>

      <div className="mt-4 divide-y divide-nham-border/50">
        {macros.map((macro) => (
          <div
            key={macro.key}
            className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center"
          >
            <div className="min-w-0">
              <h3 className="truncate font-medium text-nham-text text-sm">
                {tRoot(macro.labelKey)}
              </h3>
            </div>
            <Metric
              label={t('macros.averagePerDay')}
              value={`${formatValue(macro.averagePerDay, locale)} ${macro.unit}`}
            />
            <Metric
              label={t('macros.target')}
              value={
                macro.target === null
                  ? t('macros.noTarget')
                  : `${formatValue(macro.target, locale)} ${macro.unit}`
              }
            />
            <Metric
              label={t('macros.consistency')}
              value={formatPercent(macro.consistencyPct, locale)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

interface MetricProps {
  label: string;
  value: string;
}

function Metric({ label, value }: MetricProps) {
  return (
    <div className="min-w-[5.5rem]">
      <p className="font-bold text-[9px] text-nham-stone uppercase tracking-[0.14em]">
        {label}
      </p>
      <p className="mt-1 font-medium text-nham-text text-sm tabular-nums">
        {value}
      </p>
    </div>
  );
}
