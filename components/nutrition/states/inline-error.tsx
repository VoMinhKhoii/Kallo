'use client';

import { useTranslations } from 'next-intl';
import { RetryAction } from '@/components/shared/surface-state/retry-action';
import { SurfaceState } from '@/components/shared/surface-state/surface-state';

interface InlineErrorProps {
  isRetrying: boolean;
  message: string;
  onRetry: () => void;
  retryLabel: string;
}

/** The nutrition overview's failure, inside the card the overview would have
 *  filled — so the page keeps its shape when the fetch does not land. */
export function InlineError({
  isRetrying,
  message,
  onRetry,
  retryLabel,
}: InlineErrorProps) {
  const t = useTranslations('nutrition');

  return (
    <SurfaceState
      action={
        <RetryAction
          isRetrying={isRetrying}
          label={retryLabel}
          onRetry={onRetry}
        />
      }
      area="nutrition"
      className="rounded-2xl border border-kallo-border/60 bg-card"
      kind="error"
      subtitle={message}
      title={t('errors.overviewTitle')}
    />
  );
}
