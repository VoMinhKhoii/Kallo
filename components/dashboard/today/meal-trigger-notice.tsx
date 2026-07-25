'use client';

import { useTranslations } from 'next-intl';
import type { DashboardMealStream } from '@/hooks/dashboard/use-dashboard-meal-log';

/**
 * One-row error notice for the dashboard meal bar: the failed attempt, a retry
 * (which reuses the attempt id so it supersedes the first try server-side), and
 * a dismiss that hands the draft back to the input. Rendered by MealInputForm
 * only when `streaming.error`.
 */
export function MealTriggerNotice({
  streaming,
}: {
  streaming: DashboardMealStream;
}) {
  const td = useTranslations('dashboard');

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <span
        role="alert"
        className="min-w-0 flex-1 truncate text-nham-danger text-sm"
      >
        {streaming.error}
      </span>
      <button
        type="button"
        onClick={streaming.onRetry}
        className="shrink-0 font-medium text-nham-btn text-xs underline-offset-2 hover:underline"
      >
        {td('retry')}
      </button>
      <button
        type="button"
        onClick={streaming.onDismiss}
        className="shrink-0 text-nham-text-muted text-xs underline-offset-2 hover:underline"
      >
        {td('streaming.dismiss')}
      </button>
    </div>
  );
}
