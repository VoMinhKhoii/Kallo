'use client';

import { useTranslations } from 'next-intl';
import { RetryAction } from '@/components/shared/surface-state/retry-action';
import { SurfaceState } from '@/components/shared/surface-state/surface-state';

/**
 * Retryable error state for the Circle read surfaces (wall + circle list). A
 * failed fetch must not masquerade as an empty state — a user with a circle
 * should see "try again", not "your circle is quiet". `compact` is for the
 * panels and sheets where the full-size state would overwhelm the layout.
 */
export function CircleError({
  onRetry,
  isRetrying,
  compact = false,
}: {
  onRetry: () => void;
  isRetrying: boolean;
  compact?: boolean;
}) {
  const t = useTranslations('groups.error');

  return (
    <SurfaceState
      action={
        <RetryAction
          isRetrying={isRetrying}
          label={t('retry')}
          onRetry={onRetry}
        />
      }
      area="circle"
      compact={compact}
      kind="error"
      subtitle={t('body')}
      title={t('title')}
    />
  );
}
