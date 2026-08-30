'use client';

// The Activity surface's two non-content states. Pulled out of activity-page so
// that file is only the page's logic — the mark-seen watermark and which state
// is showing — rather than that logic plus two blocks of presentation.

import { AlertCircle, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';

const SKELETON_COUNT = 4;

export function ActivitySkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label}>
      {Array.from({ length: SKELETON_COUNT }, (_, index) => (
        <div
          key={index}
          className="flex gap-3 border-kallo-border border-b px-4 py-3.5 last:border-b-0"
        >
          <div className="size-9 shrink-0 rounded-full bg-kallo-track motion-safe:animate-pulse" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-3 w-2/3 rounded bg-kallo-track motion-safe:animate-pulse" />
            <div className="h-3 w-1/4 rounded bg-kallo-track motion-safe:animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ActivityError({
  onRetry,
  isRetrying,
}: {
  onRetry: () => void;
  isRetrying: boolean;
}) {
  const t = useTranslations('activity');
  return (
    <div
      role="alert"
      className="mt-2 rounded-2xl border border-kallo-danger/30 bg-kallo-danger/[0.06] p-4"
    >
      <div className="flex gap-3">
        <AlertCircle
          className="mt-0.5 h-5 w-5 shrink-0 text-kallo-danger"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="font-sans-display font-semibold text-[13px] text-kallo-text">
            {t('error.title')}
          </p>
          <p className="mt-1 font-sans-display text-[13px] text-kallo-text-muted">
            {t('error.body')}
          </p>
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            aria-busy={isRetrying}
            className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-full bg-kallo-danger/10 px-3.5 py-2 font-medium font-sans-display text-[13px] text-kallo-danger transition-colors hover:bg-kallo-danger/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            {t('error.retry')}
          </button>
        </div>
      </div>
    </div>
  );
}
