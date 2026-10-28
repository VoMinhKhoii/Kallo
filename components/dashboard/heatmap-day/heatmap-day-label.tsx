'use client';

import { useLocale, useTranslations } from 'next-intl';
import { heatmapTierFor } from '@/components/dashboard/progress/heatmap-colors';
import { TooltipContent } from '@/components/ui/tooltip';
import { dayKeyToUtcDate } from '@/lib/core/date/day-key';
import type { HeatmapCell } from '@/lib/core/types/dashboard';

export interface HeatmapDayLabel {
  /** "Tue, Oct 20 · 1,240 kcal" — kcal only when something was logged. */
  heading: string;
  /** The full status, for the cell's accessible name. */
  status: string;
  /** The tooltip's second line. Only an awaiting day has one: every other
   *  day's colour already says its status. */
  note: string | null;
}

/** What a heatmap day says about itself: its date and kcal, then its status. */
export function useHeatmapDayLabel() {
  const t = useTranslations('dashboard.adherenceHeatmap');
  const locale = useLocale();

  const statusOf = (cell: HeatmapCell) => {
    if (cell.status === 'future') return t('future');
    if (cell.status === 'outside') return t('outside');
    if (cell.status === 'partial') return t('partial');
    if (cell.status !== 'logged' || cell.ratio === null) return t('notLogged');

    if (cell.hasCheatMeal) return t('cheatDay');
    return `${t(heatmapTierFor(cell.ratio))} · ${Math.round(cell.ratio * 100)}%`;
  };

  return (cell: HeatmapCell): HeatmapDayLabel => {
    const day = dayKeyToUtcDate(cell.date).toLocaleDateString(locale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
    const heading =
      cell.calories === null
        ? day
        : `${day} · ${t('kcal', { calories: Math.round(cell.calories) })}`;
    const status = statusOf(cell);
    return {
      heading,
      status,
      note: cell.status === 'partial' ? status : null,
    };
  };
}

export function HeatmapDayTooltip({ label }: { label: HeatmapDayLabel }) {
  return (
    <TooltipContent
      side="top"
      className="flex flex-col items-center bg-kallo-text text-kallo-surface text-xs"
    >
      <span className="font-medium tabular-nums">{label.heading}</span>
      {label.note ? <span className="opacity-70">{label.note}</span> : null}
    </TooltipContent>
  );
}
