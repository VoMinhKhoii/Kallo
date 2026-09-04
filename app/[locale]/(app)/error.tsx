'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { SurfaceState } from '@/components/shared/surface-state/surface-state';
import { Button } from '@/components/ui/button';

/**
 * Route-group error boundary for every authenticated surface. Without this, a
 * server-side failure in dashboard/logging/nutrition/groups/settings rendered
 * Next's unstyled default screen inside the cream shell. This catches it in the
 * brand's calm first-person voice with a retry.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');

  useEffect(() => {
    console.error('[app] route error', error);
  }, [error]);

  return (
    <SurfaceState
      action={
        <Button onClick={() => reset()} size="sm">
          {t('route.retry')}
        </Button>
      }
      area="system"
      className="min-h-[60vh] flex-1"
      kind="error"
      subtitle={t('route.body')}
      title={t('route.title')}
    />
  );
}
