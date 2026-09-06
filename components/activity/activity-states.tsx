'use client';

// The Activity surface's two non-content states. Pulled out of activity-page so
// that file is only the page's logic — the mark-seen watermark and which state
// is showing — rather than that logic plus two blocks of presentation.

import { useTranslations } from 'next-intl';
import { RetryAction } from '@/components/shared/surface-state/retry-action';
import { SurfaceState } from '@/components/shared/surface-state/surface-state';

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
    <SurfaceState
      action={
        <RetryAction
          isRetrying={isRetrying}
          label={t('error.retry')}
          onRetry={onRetry}
        />
      }
      area="circle"
      kind="error"
      subtitle={t('error.body')}
      title={t('error.title')}
    />
  );
}
