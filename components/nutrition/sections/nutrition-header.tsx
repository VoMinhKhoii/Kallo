'use client';

import { useTranslations } from 'next-intl';
import type {
  NutritionRange,
  NutritionRangeInput,
} from '@/lib/nutrition/types';
import { cn } from '@/lib/ui/cn';

const RANGES = [
  '7d',
  '30d',
  '90d',
] as const satisfies readonly NutritionRange[];

interface NutritionHeaderProps {
  resolvedRange: NutritionRange;
  onRangeChange: (range: NutritionRangeInput) => void;
  disabled?: boolean;
}

/**
 * Lean nutrition header — just the timeframe toggle, sitting beside the page
 * chrome. Mirrors the Flutter nutrition screen, where the range selector lives
 * in the app header and the screen body opens straight on the summary card.
 */
export function NutritionHeader({
  resolvedRange,
  onRangeChange,
  disabled,
}: NutritionHeaderProps) {
  const t = useTranslations('nutrition');

  return (
    <header className="flex items-center justify-between gap-4">
      <h1 className="font-bold font-sans-display text-[18px] text-kallo-text tracking-[-0.01em]">
        {t('title')}
      </h1>
      <div
        role="group"
        aria-label={t('range.label')}
        className="inline-flex items-center gap-px rounded-full bg-kallo-track p-1"
      >
        {RANGES.map((range) => {
          const active = resolvedRange === range;
          return (
            <button
              key={range}
              type="button"
              aria-pressed={active}
              onClick={() => onRangeChange(range)}
              disabled={disabled}
              className={cn(
                'touch-manipulation rounded-full px-3 py-1.5 font-medium text-[12px] tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kallo-surface disabled:opacity-60',
                active
                  ? 'bg-card text-kallo-text shadow-sm'
                  : 'text-kallo-text-muted hover:text-kallo-text'
              )}
            >
              {t(`range.${range}`)}
            </button>
          );
        })}
      </div>
    </header>
  );
}
