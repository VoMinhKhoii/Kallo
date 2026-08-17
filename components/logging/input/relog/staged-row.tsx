'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { formatKcal, formatMacro } from '@/lib/domain/logging/manual-logging';
import type { RelogStagedEntry } from '@/lib/domain/logging/relog/relog';

interface StagedRowProps {
  entry: RelogStagedEntry;
  disabled?: boolean;
  onRemove: () => void;
}

/** One staged pick: name on the left, then its macro split and calories on the
 *  right. A meal stays a SINGLE row rather than exploding into its dishes, so
 *  removing it is one click and the list keeps the shape it was picked in. */
export function StagedRow({ entry, disabled, onRemove }: StagedRowProps) {
  const t = useTranslations('logging.relog');

  return (
    <div className="flex items-center gap-2">
      <span className="min-w-0 flex-1 truncate font-sans-display text-kallo-text text-sm">
        {entry.label}
      </span>
      <span className="shrink-0 font-sans-display text-kallo-text-muted/70 text-xs tabular-nums">
        {t('macroSplit', {
          protein: formatMacro(entry.summary.proteinG),
          carbs: formatMacro(entry.summary.carbohydrateG),
          fat: formatMacro(entry.summary.fatG),
        })}
      </span>
      <span className="w-14 shrink-0 text-right font-sans-display text-kallo-text-muted text-xs tabular-nums">
        {t('rowKcal', { kcal: formatKcal(entry.summary.caloriesKcal) })}
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={onRemove}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-kallo-text-muted/40 transition-colors hover:bg-kallo-hover/30 hover:text-kallo-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent/40 disabled:opacity-40"
        aria-label={t('removeStaged', { name: entry.label })}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
