'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Retryable error state for the Circle read surfaces (wall + circle list). A
 * failed fetch must not masquerade as an empty state — a user with a circle
 * should see "try again", not "your circle is quiet". Mirrors the logging
 * surface's day-error pattern, using the warm `kallo-danger` token.
 */
export function CircleError({
  onRetry,
  isRetrying,
}: {
  onRetry: () => void;
  isRetrying: boolean;
}) {
  const t = useTranslations('groups.error');

  return (
    <div className="flex items-center justify-center py-10">
      <div
        role="alert"
        className="w-full max-w-md rounded-2xl border border-kallo-danger/30 bg-kallo-danger/[0.06] p-4"
      >
        <div className="flex gap-3">
          <AlertCircle
            className="mt-0.5 h-5 w-5 shrink-0 text-kallo-danger"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="font-sans-display font-semibold text-[13px] text-kallo-text">
              {t('title')}
            </p>
            <p className="mt-1 font-sans-display text-[13px] text-kallo-text-muted">
              {t('body')}
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
              {t('retry')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
