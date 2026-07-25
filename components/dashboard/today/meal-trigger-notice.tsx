'use client';

import { useTranslations } from 'next-intl';
import type { DashboardMealStream } from '@/hooks/dashboard/use-dashboard-meal-log';
import { cn } from '@/lib/utils';

/**
 * One-row terminal notice for the dashboard meal bar: an error (danger,
 * retryable) or a precise-clarify question (quiet). Dismiss restores the draft;
 * see the clarify docs. Rendered by MealInputForm only when
 * `streaming.error || streaming.clarify`.
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
        role={streaming.error ? 'alert' : 'status'}
        className={cn(
          'min-w-0 flex-1 truncate text-sm',
          streaming.error ? 'text-nham-danger' : 'text-nham-text'
        )}
      >
        {streaming.error ?? streaming.clarify}
      </span>
      {streaming.error && (
        <button
          type="button"
          onClick={streaming.onRetry}
          className="shrink-0 font-medium text-nham-btn text-xs underline-offset-2 hover:underline"
        >
          {td('retry')}
        </button>
      )}
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
