'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/core/ui/cn';
import { gaugeHeight } from '@/lib/core/ui/gauge-arc-geometry';
import {
  FEED_MACRO_CAP,
  gaugeStripSizes,
} from '@/lib/core/ui/gauge-strip-layout';

/**
 * The dial row's own silhouette — one wide mark for the day, three narrow ones
 * for the macros. Shaped like what it stands in for, so the header does not
 * visibly change layout when the day arrives.
 */
export function MacroSummarySkeleton() {
  // At the cap, which is what the strip settles on for any feed-width column —
  // shaped like what it stands in for, so the header does not visibly change
  // layout when the day arrives.
  const { calorieRadius, macroRadius, gap } = gaugeStripSizes(
    Number.POSITIVE_INFINITY,
    FEED_MACRO_CAP
  );

  return (
    <div
      aria-hidden="true"
      className="flex animate-pulse items-start justify-center"
      style={{ gap }}
    >
      <div
        className="shrink-0 rounded-full bg-kallo-track"
        style={{
          width: calorieRadius * 2,
          height: gaugeHeight(calorieRadius),
        }}
      />
      {[0, 1, 2].map((index) => (
        <div className="flex flex-col items-center gap-1" key={index}>
          <div className="h-3 w-11 rounded-full bg-kallo-border/70" />
          <div
            className="rounded-full bg-kallo-track"
            style={{
              width: macroRadius * 2,
              height: gaugeHeight(macroRadius),
            }}
          />
        </div>
      ))}
    </div>
  );
}

export function LoggingDaySkeleton() {
  return (
    <div
      aria-busy="true"
      data-testid="logging-day-skeleton"
      className="mx-auto w-full max-w-3xl"
    >
      <div className="flex animate-pulse flex-col gap-8">
        {[0, 1].map((item) => (
          <div key={item} className="relative">
            <div className="mb-2 h-3 w-16 rounded-full bg-kallo-border/70" />
            <div className="rounded-2xl border border-kallo-border/60 bg-kallo-hover/20 p-5 shadow-sm">
              <div className="mb-4 h-5 w-2/3 rounded-full bg-kallo-border/70" />
              <div className="space-y-2">
                <div className="h-3 w-full rounded-full bg-kallo-border/60" />
                <div className="h-3 w-5/6 rounded-full bg-kallo-border/50" />
                <div className="h-3 w-3/5 rounded-full bg-kallo-border/40" />
              </div>
              <div className="mt-5 flex items-center justify-between border-kallo-border/50 border-t border-dashed pt-3">
                <div className="h-3 w-28 rounded-full bg-kallo-border/50" />
                <div className="h-4 w-16 rounded-full bg-kallo-track" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface LoggingDayErrorStateProps {
  onRetry: () => void;
  isRetrying: boolean;
}

export function LoggingDayErrorState({
  onRetry,
  isRetrying,
}: LoggingDayErrorStateProps) {
  const t = useTranslations('logging.feedArea');

  return (
    <div className="flex flex-1 items-center justify-center py-6">
      <div
        role="alert"
        className="w-full max-w-md rounded-2xl border border-kallo-danger/30 bg-kallo-danger/10 p-4 text-kallo-text shadow-sm"
      >
        <div className="flex gap-3">
          <AlertCircle
            className="mt-0.5 h-5 w-5 shrink-0 text-kallo-danger"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm">{t('loadErrorTitle')}</p>
            <p className="mt-1 text-kallo-text-muted text-sm">
              {t('loadErrorDescription')}
            </p>
            <button
              type="button"
              onClick={onRetry}
              disabled={isRetrying}
              aria-busy={isRetrying}
              className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-full bg-kallo-danger/15 px-3.5 py-2 font-medium text-kallo-danger text-sm transition-colors hover:bg-kallo-danger/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-danger focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={cn('h-4 w-4', isRetrying && 'animate-spin')}
                aria-hidden="true"
              />
              {t('retryDay')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
