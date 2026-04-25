'use client';

import { useTranslations } from 'next-intl';
import type { NutritionRange } from '@/lib/nutrition/types';
import { cn } from '@/lib/utils';

const RANGES = [
  '7d',
  '30d',
  '90d',
] as const satisfies readonly NutritionRange[];

interface RangeSelectorProps {
  value: NutritionRange;
  onChange: (range: NutritionRange) => void;
  disabled?: boolean;
}

export function RangeSelector({
  value,
  onChange,
  disabled,
}: RangeSelectorProps) {
  const t = useTranslations('nutrition.range');

  return (
    <div
      role="group"
      className="inline-flex rounded-xl bg-nham-hover p-1"
      aria-label={t('label')}
    >
      {RANGES.map((range) => (
        <button
          key={range}
          type="button"
          aria-pressed={value === range}
          onClick={() => onChange(range)}
          disabled={disabled}
          className={cn(
            'touch-manipulation rounded-lg px-3 py-1.5 font-medium text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent focus-visible:ring-offset-2 focus-visible:ring-offset-nham-surface disabled:opacity-60',
            value === range
              ? 'bg-card text-nham-text shadow-sm'
              : 'text-nham-text-muted hover:bg-card/50 hover:text-nham-text'
          )}
        >
          {t(range)}
        </button>
      ))}
    </div>
  );
}
