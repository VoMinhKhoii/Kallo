'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { formatKcal } from '@/lib/logging/manual-logging';
import type { RelogStagedEntry } from '@/lib/logging/relog/relog';

interface StagedRowProps {
  entry: RelogStagedEntry;
  disabled?: boolean;
  onRemove: () => void;
}

/** One staged pick. A meal stays a SINGLE row reading "n món" rather than
 *  exploding into its dishes: removing it is then one click, and the staged
 *  list keeps the shape the user picked in. */
export function StagedRow({ entry, disabled, onRemove }: StagedRowProps) {
  const t = useTranslations('logging.relog');

  const detail =
    entry.ref.kind === 'meal'
      ? t('dishCount', { count: entry.partCount })
      : t('ingredientCount', { count: entry.partCount });

  return (
    <div className="flex items-center gap-2">
      <span className="min-w-0 flex-1 truncate font-sans-display text-nham-text text-sm">
        {entry.label}
      </span>
      <span className="shrink-0 font-sans-display text-nham-text-muted/70 text-xs">
        {detail}
      </span>
      <span className="w-14 shrink-0 text-right font-sans-display text-nham-text-muted text-xs tabular-nums">
        {t('rowKcal', { kcal: formatKcal(entry.summary.caloriesKcal) })}
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={onRemove}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-nham-text-muted/40 transition-colors hover:bg-nham-hover/30 hover:text-nham-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent/40 disabled:opacity-40"
        aria-label={t('removeStaged', { name: entry.label })}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
